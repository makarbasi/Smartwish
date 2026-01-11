import {
  Controller,
  Get,
  Post,
  Delete,
  Req,
  Res,
  UploadedFiles,
  UseInterceptors,
  Param,
  Put,
} from '@nestjs/common';
import { AppService } from './app.service';
import { Request, Response } from 'express';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import * as multer from 'multer';
import * as fs from 'fs';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import * as sharp from 'sharp';
import fetch from 'node-fetch';
import { Express } from 'express';
// @ts-ignore
import { getPrinters } from 'pdf-to-printer';
import { PDFDocument } from 'pdf-lib';
import { SharingService } from './sharing/sharing.service';
import { SupabaseStorageService } from './saved-designs/supabase-storage.service';
import { SavedDesignsService } from './saved-designs/saved-designs.service';
import { SupabaseTemplatesEnhancedService } from './templates/supabase-templates-enhanced.service';
import { KioskConfigService } from './kiosks/kiosk-config.service';

// After TypeScript compilation, __dirname will be in dist/backend/src/
// So we need to go up 4 levels to reach smartwish-backend root
const downloadsDir = path.join(__dirname, '../../../../downloads');
console.log('Downloads directory:', downloadsDir);
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

// Cleanup old temp files on startup (older than 1 hour)
const cleanupOldTempFiles = () => {
  const flipbookDir = path.join(downloadsDir, 'flipbook');
  const printJpegsDir = path.join(downloadsDir, 'print-jpegs');
  const oneHourAgo = Date.now() - (60 * 60 * 1000);
  let totalCleaned = 0;

  [flipbookDir, printJpegsDir].forEach(dir => {
    if (!fs.existsSync(dir)) return;
    try {
      const files = fs.readdirSync(dir);
      for (const file of files) {
        const filePath = path.join(dir, file);
        try {
          const stats = fs.statSync(filePath);
          if (stats.mtimeMs < oneHourAgo) {
            fs.unlinkSync(filePath);
            totalCleaned++;
          }
        } catch { /* ignore individual file errors */ }
      }
    } catch (err) {
      console.warn(`⚠️ Could not clean ${dir}:`, err.message);
    }
  });

  if (totalCleaned > 0) {
    console.log(`🧹 Startup cleanup: Removed ${totalCleaned} old temp files`);
  }
};

// Run cleanup on module load
cleanupOldTempFiles();

function getBaseUrl() {
  const isDevelopment =
    process.env.NODE_ENV === 'development' ||
    process.env.NODE_ENV !== 'production';

  if (isDevelopment) {
    return `http://localhost:${process.env.PORT || 3001}`;
  } else {
    // Check if we're on Render.com
    if (process.env.RENDER || process.env.RENDER_SERVICE_NAME) {
      return `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'smartwish.onrender.com'}`;
    } else {
      return process.env.PRODUCTION_URL || 'https://app.smartwish.us';
    }
  }
}

// Type declaration for global print job queue
declare global {
  var printJobQueue: Array<{
    id: string;
    printerName: string;
    imagePaths: string[];
    pdfUrl?: string;
    pdfData?: string;
    paperSize?: string;
    paperType?: string;
    trayNumber?: number | null;
    borderless?: boolean;
    borderlessPaperSize?: string;
    duplexSide?: 'duplex' | 'duplexshort' | 'duplexlong' | 'simplex';
    copies?: number;
    status: string;
    createdAt: string;
    updatedAt: string;
    error?: string;
  }>;
}

@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly sharingService: SharingService,
    private readonly storageService: SupabaseStorageService,
    private readonly templatesService: SupabaseTemplatesEnhancedService,
    private readonly savedDesignsService: SavedDesignsService,
    private readonly kioskConfigService: KioskConfigService,
  ) {
    console.log('AppController instantiated');
  }

  @Get()
  getHello(): string {
    console.log('Root route (/) hit!');
    return this.appService.getHello();
  }

  @Get('health')
  healthCheck() {
    console.log('HEALTH CHECK endpoint hit');
    return { status: 'ok', time: new Date().toISOString() };
  }

  @Post('gemini-inpaint')
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'image', maxCount: 1 },
      { name: 'extraImage', maxCount: 1 },
    ]),
  )
  async geminiInpaint(
    @UploadedFiles()
    files: {
      image?: Express.Multer.File[];
      extraImage?: Express.Multer.File[];
    },
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const image = files.image?.[0];
      const extraImage = files.extraImage?.[0];
      const prompt = req.body.prompt;
      const style = req.body.style || '';

      if (!image || !prompt) {
        return res
          .status(400)
          .json({ message: 'Image and prompt are required' });
      }

      const base64Image = image.buffer.toString('base64');

      // Inspect uploaded image metadata but always enforce fixed dimensions
      const metadata = await sharp(image.buffer).metadata();
      const inputWidth = metadata.width || 0;
      const inputHeight = metadata.height || 0;

      // Enforced canonical size for all generated images
      const originalWidth = 1650; // required width
      const originalHeight = 2550; // required height
      const aspectRatio = originalWidth / originalHeight;

      if (
        inputWidth &&
        inputHeight &&
        (inputWidth !== originalWidth || inputHeight !== originalHeight)
      ) {
        console.warn(
          `[Gemini Inpaint] Input image dimensions ${inputWidth}x${inputHeight} differ from enforced dimensions ${originalWidth}x${originalHeight}. Forcing ${originalWidth}x${originalHeight}.`,
        );
      }

      console.log(
        `[Gemini Inpaint] Enforced image dimensions: ${originalWidth}x${originalHeight} (aspect ratio: ${aspectRatio.toFixed(2)})`,
      );

      // Determine if this is a theme-based request or custom prompt request
      let finalPrompt = prompt;

      if (style && style.trim() && style.startsWith('theme-')) {
        // This is a theme button request - use only the style description
        const styleDescriptions: { [key: string]: string } = {
          'theme-watercolor':
            'change this image to a soft watercolor painting with flowing colors, gentle brush strokes, and dreamy atmosphere',
          'theme-disney':
            'change this image to a whimsical Disney-style with vibrant colors, expressive features, and magical atmosphere',
          'theme-anime':
            'change this image to a Japanese anime-style illustration with bold colors, expressive eyes, and dynamic character design',
          'theme-pencil-sketch':
            'change this image to a minimalist pencil sketch with fine lines, subtle shading, and elegant black-and-white composition',
          'theme-oil-painting':
            'change this image to a textured oil painting with thick brush strokes, rich colors, and artistic depth',
        };

        finalPrompt = styleDescriptions[style.toLowerCase()] || `Transform this image to ${style} style`;
        console.log(`[Gemini Inpaint] Theme request: "${style}" -> "${finalPrompt}"`);
      } else {
        // This is a custom prompt request - use the prompt as-is
        console.log(`[Gemini Inpaint] Custom prompt request: "${prompt}"`);
      }

      console.log(`[Gemini Inpaint] Final prompt: "${finalPrompt}"`);
      console.log(`[Gemini Inpaint] Has extra image context: ${!!extraImage}`);

      const parts: any[] = [
        {
          inline_data: {
            mime_type: 'image/png',
            data: base64Image,
          },
        },
        {
          text: finalPrompt,
        },
      ];

      if (extraImage) {
        const base64Extra = extraImage.buffer.toString('base64');
        parts.push({
          inline_data: {
            mime_type: 'image/png',
            data: base64Extra,
          },
        });
      }

      const payload = {
        contents: [
          {
            role: 'user',
            parts,
          },
        ],
        generation_config: {
          response_modalities: ['image', 'text'],
          response_mime_type: 'text/plain',
          // Strict parameters for more consistent size compliance
          temperature: 0.1, // Lower temperature for more consistent output
          top_p: 0.8,
          candidate_count: 1,
        },
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Gemini API Error:', errorText);
        return res
          .status(500)
          .json({ message: 'Gemini API failed', error: errorText });
      }

      const data = await response.json();
      const partWithImage = data?.candidates?.[0]?.content?.parts?.find(
        (p: any) => p.inlineData,
      );

      if (partWithImage) {
        const modifiedImageBuffer = Buffer.from(
          partWithImage.inlineData.data,
          'base64',
        );

        // Validate and enforce the generated image has the exact same dimensions as the original
        const generatedMetadata = await sharp(modifiedImageBuffer).metadata();
        const generatedWidth = generatedMetadata.width || 0;
        const generatedHeight = generatedMetadata.height || 0;

        console.log(
          `[Gemini Inpaint] Generated image dimensions: ${generatedWidth}x${generatedHeight}`,
        );
        console.log(
          `[Gemini Inpaint] Required dimensions: ${originalWidth}x${originalHeight}`,
        );

        if (
          generatedWidth !== originalWidth ||
          generatedHeight !== originalHeight
        ) {
          console.warn(
            `[Gemini Inpaint] SIZE MISMATCH DETECTED! Generated: ${generatedWidth}x${generatedHeight}, Required: ${originalWidth}x${originalHeight}`,
          );
          console.log(
            '[Gemini Inpaint] FORCE CORRECTING size using Sharp resize...',
          );
        }

        // AGGRESSIVE size enforcement - force the exact dimensions no matter what
        const resizedImageBuffer = await sharp(modifiedImageBuffer)
          .resize(originalWidth, originalHeight, {
            fit: 'fill', // Force stretch to exact dimensions
            withoutEnlargement: false, // Allow enlargement if needed
            kernel: sharp.kernel.lanczos3, // High-quality resampling
            fastShrinkOnLoad: false, // Disable fast shrinking for accuracy
          })
          .png({
            compressionLevel: 6,
            adaptiveFiltering: false,
            force: true, // Force PNG output
          })
          .toBuffer();

        // Double-check the final result
        const finalMetadata = await sharp(resizedImageBuffer).metadata();
        const finalWidth = finalMetadata.width || 0;
        const finalHeight = finalMetadata.height || 0;

        console.log(
          `[Gemini Inpaint] FINAL image dimensions: ${finalWidth}x${finalHeight}`,
        );

        if (finalWidth !== originalWidth || finalHeight !== originalHeight) {
          console.error(
            `[Gemini Inpaint] CRITICAL ERROR: Could not enforce size! Final: ${finalWidth}x${finalHeight}, Required: ${originalWidth}x${originalHeight}`,
          );
          throw new Error(
            `Size enforcement failed: got ${finalWidth}x${finalHeight}, required ${originalWidth}x${originalHeight}`,
          );
        }

        console.log(
          `[Gemini Inpaint] ✅ SUCCESS: Image dimensions match exactly: ${finalWidth}x${finalHeight}`,
        );

        const filename = `gemini-${Date.now()}.png`;
        const filePath = path.join(downloadsDir, filename);
        fs.writeFileSync(filePath, resizedImageBuffer);

        return res.json({
          imageUrl: `${getBaseUrl()}/downloads/${filename}`,
        });
      } else {
        const fallbackText = data?.candidates?.[0]?.content?.parts?.find(
          (p: any) => p.text,
        )?.text;
        console.error('No image returned from Gemini', fallbackText || data);
        return res.status(500).json({
          message: 'No image returned from Gemini',
          details: fallbackText || data,
        });
      }
    } catch (error) {
      console.error('Gemini inpaint route error:', error);
      return res.status(500).json({ message: 'Internal server error', error });
    }
  }

  @Get('proxy')
  async proxy(@Req() req: Request, @Res() res: Response) {
    const imageUrl = req.query.url as string;

    console.log('Backend proxy request details:', {
      imageUrl,
      baseUrl: getBaseUrl(),
      hostname: req.hostname,
      headers: req.headers,
      query: req.query,
    });

    if (!imageUrl) {
      return res.status(400).json({ error: 'Image URL is required' });
    }

    try {
      const response = await fetch(imageUrl);
      if (!response.ok) {
        console.error(
          `Failed to fetch image: ${response.status} ${response.statusText}`,
        );
        throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const contentType = response.headers.get('content-type');
      res.setHeader('Content-Type', contentType || 'application/octet-stream');

      // Add CORS headers for cross-origin requests
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

      if (response.body) {
        response.body.pipe(res);
      } else {
        throw new Error('Response body is null');
      }
    } catch (error) {
      console.error('Error fetching image:', error);
      res.status(500).json({
        error: 'Failed to fetch image from proxy',
        details: error.message,
      });
    }
  }

  @Post('save-image')
  async saveImage(@Req() req: Request, @Res() res: Response) {
    try {
      const { imageUrl } = req.body;
      console.log('Received imageUrl:', imageUrl);
      if (!imageUrl) {
        return res.status(400).json({ message: 'Image URL is required' });
      }
      const fileName = `image-${Date.now()}.png`;
      const filePath = path.join(downloadsDir, fileName);
      if (imageUrl.startsWith('http://') || imageUrl.startsWith('https://')) {
        // Download the image from a URL
        const response = await fetch(imageUrl);
        if (!response.ok) {
          const errorText = await response.text();
          console.error(
            `Failed to download image. Status: ${response.status}, Body: ${errorText}`,
          );
          throw new Error(
            `Failed to download image. Status: ${response.status}`,
          );
        }
        const buffer = await response.buffer();
        fs.writeFileSync(filePath, buffer);
      } else if (imageUrl.startsWith('data:image/')) {
        // Handle data URL (base64-encoded image)
        const base64Data = imageUrl.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
      } else {
        return res.status(400).json({
          message: 'Invalid imageUrl format. Must be HTTP(S) URL or data URL.',
        });
      }
      return res.json({ message: 'Image saved successfully', filePath });
    } catch (error) {
      console.error('Error downloading image:', error);
      res
        .status(500)
        .json({ message: 'Failed to download image', error: error.message });
    }
  }

  @Post('print-pc')
  async printPC(@Req() req: Request, @Res() res: Response) {
    // Declare outside try block so cleanup can access on error
    let savedPaths: string[] = [];
    
    try {
      const { images, printerName, paperSize, paperType, trayNumber, giftCardData } = req.body;
      const flipbookDir = path.join(downloadsDir, 'flipbook');
      if (!fs.existsSync(flipbookDir)) {
        fs.mkdirSync(flipbookDir, { recursive: true });
      }
      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ message: 'Images array is required' });
      }
      if (!printerName) {
        return res.status(400).json({ message: 'Printer name is required' });
      }
      const selectedPaperSize = paperSize || 'letter'; // Default to 'letter' for standard size

      // Use timestamp in filenames to avoid file locking conflicts
      const timestamp = Date.now();
      const jobId = `job_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(
        `PC Print request received for ${images.length} images to printer: ${printerName}, paper size: ${selectedPaperSize}, paper type: ${paperType || 'greeting-card'}, tray: ${trayNumber || 'auto'}`,
      );
      
      // Log gift card data for debugging
      if (giftCardData) {
        console.log(`🎁 Gift card data received:`, {
          storeName: giftCardData.storeName,
          amount: giftCardData.amount,
          hasQrCode: !!giftCardData.qrCode,
          qrCodeLength: giftCardData.qrCode?.length || 0,
          qrCodePrefix: giftCardData.qrCode?.substring(0, 50) || 'N/A',
          hasStoreLogo: !!giftCardData.storeLogo,
          storeLogoType: typeof giftCardData.storeLogo,
          storeLogoValue: giftCardData.storeLogo || 'EMPTY/UNDEFINED',
          storeLogoLength: giftCardData.storeLogo?.length || 0,
          hasRedemptionLink: !!giftCardData.redemptionLink
        });
      } else {
        console.log('🎁 No gift card data received in request');
      }

      // Save images with unique timestamped names
      savedPaths = [];
      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        const fileName = `page_${i + 1}_${timestamp}.png`;
        const filePath = path.join(flipbookDir, fileName);
        // Convert base64 to buffer and save
        const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        savedPaths.push(filePath);
        console.log(`Saved page ${i + 1}: ${filePath}`);
      }

      // Helper function to clean up temporary files
      const cleanupFiles = (files: string[], description: string = 'temp files') => {
        let cleaned = 0;
        let notFound = 0;
        for (const filePath of files) {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              console.log(`   ✓ Deleted: ${path.basename(filePath)}`);
              cleaned++;
            } else {
              console.log(`   - Not found: ${path.basename(filePath)}`);
              notFound++;
            }
          } catch (err) {
            console.warn(`   ✗ Could not delete ${path.basename(filePath)}:`, err.message);
          }
        }
        console.log(`🧹 Cleanup summary: ${cleaned} deleted, ${notFound} not found (${description})`);
      };

      // Check if running in cloud environment (Render, etc.)
      const isCloudEnvironment = process.env.NODE_ENV === 'production' ||
        process.env.RENDER === 'true' ||
        !process.env.LOCAL_PRINTING;

      if (isCloudEnvironment) {
        // Cloud mode: Queue job for local print agent to pick up
        console.log('☁️ Cloud environment detected - queuing print job for local agent');

        // Generate URLs for the saved images
        const baseUrl =
          process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || getBaseUrl();

        const imageUrls = savedPaths.map((filePath, index) => {
          const fileName = path.basename(filePath);
          return `${baseUrl}/downloads/flipbook/${fileName}`;
        });

        // ALSO generate a server-side PDF (preferred by the local print agent).
        // This avoids re-compositing on the local machine and enables a cleaner job format: { pdfUrl, ... }.
        let pdfUrl: string | undefined = undefined;
        try {
          const printJpegsDir = path.join(downloadsDir, 'print-jpegs');
          if (!fs.existsSync(printJpegsDir)) {
            fs.mkdirSync(printJpegsDir, { recursive: true });
          }

          // Map images to greeting card positions (same mapping used elsewhere)
          const imageFiles = {
            front: savedPaths[0], // page_1
            insideRight: savedPaths[1], // page_2
            insideLeft: savedPaths[2], // page_3
            back: savedPaths[3], // page_4
          };

          const compositeSide1Path = path.join(printJpegsDir, `temp_${jobId}_side1.png`);
          const compositeSide2Path = path.join(printJpegsDir, `temp_${jobId}_side2.png`);

          await this.createCompositeImage(compositeSide1Path, imageFiles.back, imageFiles.front);
          await this.createCompositeImage(compositeSide2Path, imageFiles.insideRight, imageFiles.insideLeft);

          // 🎁 Add gift card overlay to compositeSide2 if giftCardData exists
          if (giftCardData && giftCardData.qrCode) {
            try {
              console.log('[print-pc] Adding gift card overlay to print:', giftCardData.storeName, '$' + giftCardData.amount);

              // Handle QR code image (base64 data URL or HTTP URL)
              let qrBuffer;
              let qrMimeType = 'image/png'; // default

              if (giftCardData.qrCode.startsWith('data:')) {
                // Handle base64 data URL
                const [mimeInfo, base64Data] = giftCardData.qrCode.split(',');
                qrMimeType = mimeInfo.split(':')[1].split(';')[0];
                qrBuffer = Buffer.from(base64Data, 'base64');
                console.log('[print-pc] QR code processed from base64, buffer size:', qrBuffer.length);
              } else {
                // Handle HTTP URL
                try {
                  const response = await fetch(giftCardData.qrCode);
                  if (response.ok) {
                    qrBuffer = await response.buffer();
                  }
                } catch (qrError) {
                  console.warn('[print-pc] Failed to download QR code:', qrError?.message);
                }
              }

              if (qrBuffer) {
                // Process store logo if present
                let storeLogo = '';
                console.log('[print-pc] 🏪 Store logo check:', {
                  hasStoreLogo: !!giftCardData.storeLogo,
                  storeLogoType: typeof giftCardData.storeLogo,
                  storeLogoPrefix: giftCardData.storeLogo?.substring(0, 50) || 'N/A'
                });
                
                if (giftCardData.storeLogo) {
                  try {
                    if (giftCardData.storeLogo.startsWith('data:')) {
                      console.log('[print-pc] 🏪 Store logo is already base64 data URL');
                      storeLogo = giftCardData.storeLogo;
                    } else {
                      console.log('[print-pc] 🏪 Fetching store logo from URL:', giftCardData.storeLogo);
                      const response = await fetch(giftCardData.storeLogo);
                      console.log('[print-pc] 🏪 Store logo fetch response:', {
                        ok: response.ok,
                        status: response.status,
                        contentType: response.headers.get('content-type')
                      });
                      if (response.ok) {
                        const logoBuffer = await response.buffer();
                        // Detect image type from content-type header or URL
                        const contentType = response.headers.get('content-type') || 'image/png';
                        const mimeType = contentType.split(';')[0].trim();
                        const logoBase64 = logoBuffer.toString('base64');
                        storeLogo = `data:${mimeType};base64,${logoBase64}`;
                        console.log('[print-pc] ✅ Store logo converted to base64, length:', logoBase64.length);
                      } else {
                        console.warn('[print-pc] ⚠️ Store logo fetch failed with status:', response.status);
                      }
                    }
                  } catch (logoError) {
                    console.warn('[print-pc] ❌ Failed to process store logo:', logoError?.message);
                    console.warn('[print-pc] Logo URL was:', giftCardData.storeLogo);
                  }
                } else {
                  console.log('[print-pc] ⚠️ No store logo provided in gift card data');
                }

                // Convert QR code to base64 for SVG embedding
                const qrBase64 = qrBuffer.toString('base64');

                // Escape special characters for SVG
                const entities: { [key: string]: string } = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' };
                const storeName = (giftCardData.storeName || 'Gift Card').replace(/[<>&"']/g, (match: string) => entities[match]);
                const amount = (giftCardData.amount || '0').toString().replace(/[<>&"']/g, (match: string) => entities[match]);

                // Create gift card overlay SVG for PRINT version (700x550px for 300 DPI print)
                const giftCardOverlaySvg = `<svg width="700" height="550" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="25"/>
      <feOffset dx="0" dy="12" result="offsetblur"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.3"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  <rect x="0" y="0" width="700" height="550" rx="48" ry="48" fill="rgba(255,255,255,0.95)" stroke="rgba(229,231,235,1)" stroke-width="3" filter="url(#shadow)"/>
  <rect x="50" y="40" width="280" height="280" rx="24" ry="24" fill="white"/>
  <image x="50" y="40" width="280" height="280" href="data:${qrMimeType};base64,${qrBase64}" preserveAspectRatio="xMidYMid meet"/>
  ${storeLogo ? `
  <rect x="370" y="40" width="280" height="280" rx="24" ry="24" fill="white"/>
  <image x="370" y="40" width="280" height="280" href="${storeLogo}" preserveAspectRatio="xMidYMid meet"/>
  ` : ''}
  <text x="350" y="390" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="600" fill="#1f2937">${storeName}</text>
  <text x="350" y="450" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" fill="#4b5563">$${amount}</text>
</svg>`;

                const giftCardOverlayBuffer = Buffer.from(giftCardOverlaySvg);

                // Position for print: centered on the inside left page (page 3)
                // Composite is 3300px wide (two 1650px panels), page 3 is the right panel
                const overlayTop = 2550 - 550 - 100; // Total height - overlay height - bottom margin
                const overlayLeft = 1650 + (1650 - 700) / 2; // Left panel + centered in right panel

                // Create composite with overlay
                const tempOverlayPath = path.join(printJpegsDir, `temp_${jobId}_overlay.png`);
                await sharp(compositeSide2Path)
                  .composite([{
                    input: giftCardOverlayBuffer,
                    top: overlayTop,
                    left: overlayLeft
                  }])
                  .png()
                  .toFile(tempOverlayPath);

                // Replace original composite with overlayed version
                await fsPromises.unlink(compositeSide2Path);
                await fsPromises.rename(tempOverlayPath, compositeSide2Path);

                console.log(`[print-pc] ✅ Gift card overlay added to print composite at position: (${overlayLeft}, ${overlayTop})`);
              }
            } catch (giftCardError) {
              console.error('[print-pc] Failed to add gift card overlay:', giftCardError?.message || giftCardError);
              // Continue without overlay - don't fail the print
            }
          }

          const outputPdf = `${jobId}_print.pdf`;
          const pdfPath = path.join(printJpegsDir, outputPdf);
          await this.createPdf(pdfPath, compositeSide1Path, compositeSide2Path);

          // Cleanup temp composites (keep the final PDF)
          try {
            if (fs.existsSync(compositeSide1Path)) fs.unlinkSync(compositeSide1Path);
            if (fs.existsSync(compositeSide2Path)) fs.unlinkSync(compositeSide2Path);
          } catch { /* ignore */ }

          // Upload PDF to Supabase for permanent storage (reprints)
          try {
            const pdfBuffer = fs.readFileSync(pdfPath);
            const supabasePdfPath = `print-pdfs/${outputPdf}`;
            pdfUrl = await this.storageService.uploadBuffer(pdfBuffer, supabasePdfPath, 'application/pdf');
            console.log(`✅ PDF uploaded to Supabase: ${pdfUrl}`);
            // Clean up local PDF after upload
            fs.unlinkSync(pdfPath);
          } catch (uploadErr) {
            // Fallback to local URL if Supabase upload fails
            pdfUrl = `${baseUrl}/downloads/print-jpegs/${outputPdf}`;
            console.warn(`⚠️ Supabase upload failed, using local URL: ${pdfUrl}`);
          }
          
          console.log(`✅ Server-generated PDF ready for local agent: ${pdfUrl}`);
        } catch (pdfErr) {
          console.warn('⚠️ Could not generate server-side PDF for print job. Falling back to image-based job.', pdfErr?.message || pdfErr);
        }

        // Clean up source images - PDF is now in Supabase, we don't need local files
        console.log(`🧹 Cleaning up ${savedPaths.length} source images...`);
        cleanupFiles(savedPaths, 'source images (cloud mode)');

        // Create print job for local agent
        const printJob = {
          id: jobId,
          printerName,
          paperSize: selectedPaperSize,
          paperType: paperType || 'greeting-card',
          trayNumber: trayNumber || null,
          imagePaths: imageUrls,
          ...(pdfUrl ? { pdfUrl } : {}),
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Add to global print job queue
        if (!global.printJobQueue) {
          global.printJobQueue = [];
        }
        global.printJobQueue.push(printJob);

        console.log(`✅ Print job ${jobId} queued for local print agent`);
        console.log(`   Run 'node local-print-agent.js' on your local PC to process this job`);

        res.json({
          message: 'Print job queued successfully',
          jobId,
          status: 'pending',
          note: 'Job queued for local print agent. Make sure local-print-agent.js is running on your PC.',
          savedImages: savedPaths.length,
          pdfUrl: pdfUrl || null, // Include PDF URL for reprint functionality
        });
      } else {
        // Local mode: Try direct printing (only works on Windows with printer connected)
        console.log('🏠 Local environment detected - attempting direct print');
        
        try {
          const printCardPath = path.join(__dirname, '../../../../print-card.js');
          const smartwishBackendRoot = path.join(__dirname, '../../../..');

          console.log('Loading print-card module from:', printCardPath);
          const originalCwd = process.cwd();
          process.chdir(smartwishBackendRoot);

          const printCardModule = require(printCardPath);
          await printCardModule.main(printerName, selectedPaperSize, timestamp, trayNumber);

          process.chdir(originalCwd);

          // Upload the generated PDF to Supabase for reprint capability
          let pdfUrl: string | null = null;
          try {
            const generatedPdfPath = path.join(smartwishBackendRoot, 'greeting_card.pdf');
            if (fs.existsSync(generatedPdfPath)) {
              const pdfBuffer = fs.readFileSync(generatedPdfPath);
              const pdfFilePath = `print-pdfs/${jobId}_greeting_card.pdf`;
              pdfUrl = await this.storageService.uploadBuffer(pdfBuffer, pdfFilePath, 'application/pdf');
              console.log(`✅ PDF uploaded to Supabase: ${pdfUrl}`);
            } else {
              console.warn('⚠️ Generated PDF not found at:', generatedPdfPath);
            }
          } catch (uploadErr) {
            console.warn('⚠️ Failed to upload PDF to Supabase:', uploadErr?.message || uploadErr);
          }

          // Clean up source images immediately after PDF upload
          console.log(`🧹 Cleaning up ${savedPaths.length} source images...`);
          cleanupFiles(savedPaths, 'source images (local mode)');

          // Also clean up the local greeting_card.pdf after uploading to Supabase
          try {
            const generatedPdfPath = path.join(smartwishBackendRoot, 'greeting_card.pdf');
            if (fs.existsSync(generatedPdfPath)) {
              fs.unlinkSync(generatedPdfPath);
              console.log('🧹 Cleaned up local greeting_card.pdf');
            }
          } catch { /* ignore */ }

          res.json({
            message: 'Print job sent successfully',
            savedImages: savedPaths.length,
            pdfUrl: pdfUrl, // Supabase URL for reprint functionality
          });
        } catch (importError) {
          console.error('Error in direct printing:', importError);
          throw new Error('Direct printing failed - try using local print agent');
        }
      }
    } catch (error) {
      console.error('Error in PC printing:', error);
      // Clean up any saved files on error
      if (savedPaths && savedPaths.length > 0) {
        for (const filePath of savedPaths) {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
            }
          } catch { /* ignore cleanup errors */ }
        }
        console.log(`🧹 Cleaned up ${savedPaths.length} files after error`);
      }
      res.status(500).json({
        message: 'Failed to print',
        error: error.message,
      });
    }
  }

  /**
   * Print stickers endpoint - generates a sticker sheet with 6 circular stickers
   * Layout matches Avery Presta 94513 (3" diameter, 2x3 grid on letter paper)
   */
  @Post('print-stickers')
  async printStickers(@Req() req: Request, @Res() res: Response) {
    let savedPaths: (string | null)[] = [];

    try {
      const { stickers, printerName, paperSize, trayNumber, layout } = req.body;

      if (!stickers || !Array.isArray(stickers)) {
        return res.status(400).json({ message: 'Stickers array is required' });
      }

      if (!printerName) {
        return res.status(400).json({ message: 'Printer name is required' });
      }

      const selectedPaperSize = paperSize || 'letter';
      const timestamp = Date.now();
      const jobId = `sticker_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(
        `🖨️ Sticker print request: ${stickers.filter(s => s).length} stickers to ${printerName}, layout: ${layout || 'avery-94513'}`,
      );

      // Save sticker images
      const stickersDir = path.join(downloadsDir, 'stickers');
      if (!fs.existsSync(stickersDir)) {
        fs.mkdirSync(stickersDir, { recursive: true });
      }

      savedPaths = [];
      for (let i = 0; i < 6; i++) {
        const stickerData = stickers[i];
        if (!stickerData) {
          savedPaths.push(null);
          continue;
        }

        const fileName = `${jobId}_sticker_${i + 1}.png`;
        const filePath = path.join(stickersDir, fileName);

        // Handle base64 image data
        const base64Data = stickerData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        savedPaths.push(filePath);
        console.log(`Saved sticker ${i + 1} to ${filePath}`);
      }

      // Generate composite sticker sheet
      const compositePath = path.join(stickersDir, `${jobId}_sheet.png`);
      await this.createStickerSheetComposite(compositePath, savedPaths);

      // Generate PDF from composite
      const pdfPath = path.join(stickersDir, `${jobId}_stickers.pdf`);
      await this.createStickerPdf(pdfPath, compositePath);

      // Cloud mode: Queue for local print agent
      const isCloudEnvironment = process.env.NODE_ENV === 'production' ||
        process.env.RENDER === 'true' ||
        !process.env.LOCAL_PRINTING;

      let pdfUrl: string | undefined;

      if (isCloudEnvironment) {
        // Upload PDF to Supabase
        try {
          const pdfBuffer = fs.readFileSync(pdfPath);
          const supabasePdfPath = `print-pdfs/${jobId}_stickers.pdf`;
          pdfUrl = await this.storageService.uploadBuffer(pdfBuffer, supabasePdfPath, 'application/pdf');
          console.log(`✅ Sticker PDF uploaded to Supabase: ${pdfUrl}`);
        } catch (uploadErr) {
          const baseUrl = process.env.RENDER_EXTERNAL_URL || process.env.BASE_URL || getBaseUrl();
          pdfUrl = `${baseUrl}/downloads/stickers/${jobId}_stickers.pdf`;
          console.warn(`⚠️ Supabase upload failed, using local URL: ${pdfUrl}`);
        }

        // Create print job for local agent
        const printJob = {
          id: jobId,
          printerName,
          imagePaths: [], // Stickers use PDF directly, no separate image paths
          paperSize: selectedPaperSize,
          paperType: 'sticker',
          trayNumber: trayNumber || null,
          pdfUrl,
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (!global.printJobQueue) {
          global.printJobQueue = [];
        }
        global.printJobQueue.push(printJob as any);

        console.log(`✅ Sticker print job ${jobId} queued for local print agent`);

        // Cleanup temp files
        const validPaths = savedPaths.filter((p): p is string => p !== null);
        for (const p of validPaths) {
          try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
        }
        try { if (fs.existsSync(compositePath)) fs.unlinkSync(compositePath); } catch { /* ignore */ }
        try { if (fs.existsSync(pdfPath)) fs.unlinkSync(pdfPath); } catch { /* ignore */ }

        res.json({
          message: 'Sticker print job queued successfully',
          jobId,
          status: 'pending',
          pdfUrl,
        });
      } else {
        // Local mode: Direct print
        console.log('🏠 Local environment - attempting direct sticker print');
        // For now, just return success with PDF path
        res.json({
          message: 'Sticker print job created',
          jobId,
          pdfPath,
        });
      }
    } catch (error) {
      console.error('Error in sticker printing:', error);
      // Cleanup
      const validPaths = savedPaths.filter((p): p is string => p !== null);
      for (const p of validPaths) {
        try { if (fs.existsSync(p)) fs.unlinkSync(p); } catch { /* ignore */ }
      }
      res.status(500).json({
        message: 'Failed to print stickers',
        error: error.message,
      });
    }
  }

  @Get('get-printers')
  async getPrinters(@Res() res: Response) {
    try {
      console.log('Getting available printers...');
      const printers = await getPrinters();
      console.log('Available printers:', printers);
      res.json({ printers });
    } catch (error) {
      console.error('Error getting printers:', error);
      res.status(500).json({
        message: 'Failed to get printers',
        error: error.message,
      });
    }
  }

  /**
   * Print sticker JPG - queues for local print agent (cloud) or prints directly (local)
   * Receives JPG as base64 and either queues it or prints via IPP
   */
  @Post('print-sticker-jpg')
  async printStickerJPG(@Req() req: Request, @Res() res: Response) {
    try {
      const { jpgBase64, printerName, kioskId } = req.body;

      if (!jpgBase64) {
        return res.status(400).json({ message: 'JPG base64 data is required' });
      }

      if (!printerName) {
        return res.status(400).json({ message: 'Printer name is required' });
      }

      console.log(`🖨️ Processing sticker JPG print request for: ${printerName}`);

      // Check if we're in cloud environment
      const isCloudEnvironment = process.env.NODE_ENV === 'production' ||
        process.env.RENDER === 'true' ||
        !process.env.LOCAL_PRINTING;

      if (isCloudEnvironment) {
        // Cloud mode: Upload JPG and queue for local print agent
        const timestamp = Date.now();
        const jobId = `sticker_jpg_${timestamp}_${Math.random().toString(36).substr(2, 9)}`;

        // Convert base64 to buffer
        const base64Data = jpgBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Upload JPG to Supabase
        let jpgUrl: string | undefined;
        try {
          const supabaseJpgPath = `print-jpgs/${jobId}_stickers.jpg`;
          jpgUrl = await this.storageService.uploadBuffer(imageBuffer, supabaseJpgPath, 'image/jpeg');
          console.log(`✅ Sticker JPG uploaded to Supabase: ${jpgUrl}`);
        } catch (uploadErr) {
          console.error('❌ Failed to upload JPG to Supabase:', uploadErr);
          return res.status(500).json({
            message: 'Failed to upload sticker JPG',
            error: uploadErr.message,
          });
        }

        // Get printer IP from kiosk configuration (for local agent)
        let printerIP = process.env.PRINTER_IP || '192.168.1.239';
        if (kioskId) {
          try {
            const kioskConfig = await this.kioskConfigService.getConfigById(kioskId);
            const configPrinterIP = (kioskConfig.config as Record<string, any>)?.printerIP;
            if (configPrinterIP) {
              printerIP = configPrinterIP;
              console.log(`📡 Using printer IP from kiosk config: ${printerIP}`);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to fetch kiosk config, using default IP`);
          }
        }

        // Create print job for local agent
        const printJob = {
          id: jobId,
          printerName,
          printerIP, // Include IP for local agent to use
          imagePaths: [], // Stickers use JPG directly, no separate image paths
          paperSize: 'letter',
          paperType: 'sticker',
          trayNumber: null,
          jpgUrl, // JPG URL for local agent to download and print
          status: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        if (!global.printJobQueue) {
          global.printJobQueue = [];
        }
        global.printJobQueue.push(printJob as any);

        console.log(`✅ Sticker print job ${jobId} queued for local print agent`);
        console.log(`   Run 'node local-print-agent.js' on your local PC to process this job`);

        res.json({
          message: 'Sticker print job queued successfully',
          jobId,
          status: 'pending',
          jpgUrl,
          note: 'Job queued for local print agent. Make sure local-print-agent.js is running on your PC.',
        });
      } else {
        // Local mode: Print directly using IPP
        console.log('🏠 Local environment - printing directly via IPP');

        // Get printer IP from kiosk configuration
        let printerIP = process.env.PRINTER_IP || '192.168.1.239';
        if (kioskId) {
          try {
            const kioskConfig = await this.kioskConfigService.getConfigById(kioskId);
            const configPrinterIP = (kioskConfig.config as Record<string, any>)?.printerIP;
            if (configPrinterIP) {
              printerIP = configPrinterIP;
              console.log(`📡 Using printer IP from kiosk config: ${printerIP}`);
            }
          } catch (error) {
            console.warn(`⚠️ Failed to fetch kiosk config, using default IP`);
          }
        }

        const printerUrl = `http://${printerIP}:631/ipp/print`;

        // Convert base64 to buffer
        const base64Data = jpgBase64.replace(/^data:image\/\w+;base64,/, '');
        const imageBuffer = Buffer.from(base64Data, 'base64');

        // Print using IPP
        const ipp = require('ipp');
        const printer = ipp.Printer(printerUrl);

        const ippPrintJob = {
          'operation-attributes-tag': {
            'requesting-user-name': 'Admin',
            'job-name': 'Sticker Sheet',
            'document-format': 'image/jpeg',
          },
          'job-attributes-tag': {
            copies: 1,
            media: 'iso_a4_210x297mm',
            'print-quality': 5, // High quality
          },
          data: imageBuffer,
        };

        // Execute print job
        printer.execute('Print-Job', ippPrintJob, (err: any, result: any) => {
          if (err) {
            console.error('❌ IPP Print failed:', err.message);
            return res.status(500).json({
              message: 'Failed to print sticker JPG',
              error: err.message,
            });
          }

          console.log('✅ Print job sent. Status:', result.statusCode);
          res.json({
            message: 'Sticker print job sent successfully',
            status: 'sent',
          });
        });
      }
    } catch (error) {
      console.error('Error in print-sticker-jpg:', error);
      res.status(500).json({
        message: 'Failed to print sticker JPG',
        error: error.message,
      });
    }
  }

  // Print job queue endpoints for local agent
  @Post('submit-print-job')
  async submitPrintJob(@Req() req: Request, @Res() res: Response) {
    try {
      const { images, printerName, jobId } = req.body;

      if (!images || !Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ message: 'Images array is required' });
      }

      if (!printerName) {
        return res.status(400).json({ message: 'Printer name is required' });
      }

      const jobIdToUse =
        jobId || `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      console.log(
        `Print job submitted: ${jobIdToUse} for printer: ${printerName}`,
      );

      // Save images to flipbook directory
      const flipbookDir = path.join(downloadsDir, 'flipbook');
      if (!fs.existsSync(flipbookDir)) {
        fs.mkdirSync(flipbookDir, { recursive: true });
      }

      const savedPaths = [];
      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        const fileName = `${jobIdToUse}_page_${i + 1}.png`;
        const filePath = path.join(flipbookDir, fileName);

        // Convert base64 to file
        const base64Data = imageData.replace(/^data:image\/\w+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        savedPaths.push(filePath);
      }

      // Create print job record
      const printJob = {
        id: jobIdToUse,
        printerName,
        imagePaths: savedPaths,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      // Store job in memory (in production, use a database)
      if (!global.printJobQueue) {
        global.printJobQueue = [];
      }
      global.printJobQueue.push(printJob);

      console.log(`Print job ${jobIdToUse} queued successfully`);
      res.json({
        success: true,
        jobId: jobIdToUse,
        message: 'Print job submitted successfully',
        status: 'pending',
      });
    } catch (error) {
      console.error('Error submitting print job:', error);
      res.status(500).json({
        message: 'Failed to submit print job',
        error: error.message,
      });
    }
  }

  @Get('print-jobs')
  async getPrintJobs(@Res() res: Response) {
    try {
      const jobs = (global as any).printJobQueue || [];
      res.json({ jobs });
    } catch (error) {
      console.error('Error getting print jobs:', error);
      res.status(500).json({
        message: 'Failed to get print jobs',
        error: error.message,
      });
    }
  }

  /**
   * Clear completed and failed jobs from the in-memory queue
   * Optionally reset stuck "processing" jobs back to "pending"
   */
  @Delete('print-jobs/clear')
  async clearPrintJobs(@Req() req: Request, @Res() res: Response) {
    try {
      if (!global.printJobQueue) {
        return res.json({ message: 'Queue is already empty', cleared: 0 });
      }

      const { resetStuck } = req.query;
      const originalCount = global.printJobQueue.length;

      if (resetStuck === 'true') {
        // Reset stuck "processing" jobs back to "pending"
        let resetCount = 0;
        global.printJobQueue.forEach(job => {
          if (job.status === 'processing') {
            job.status = 'pending';
            job.updatedAt = new Date().toISOString();
            resetCount++;
          }
        });
        console.log(`🔄 Reset ${resetCount} stuck jobs back to pending`);
        return res.json({
          message: `Reset ${resetCount} stuck jobs back to pending`,
          resetCount,
          totalJobs: global.printJobQueue.length,
        });
      }

      // Remove completed and failed jobs, keep pending and processing
      global.printJobQueue = global.printJobQueue.filter(
        job => job.status === 'pending' || job.status === 'processing'
      );

      const clearedCount = originalCount - global.printJobQueue.length;
      console.log(`🧹 Cleared ${clearedCount} completed/failed jobs from queue`);

      res.json({
        message: `Cleared ${clearedCount} completed/failed jobs`,
        cleared: clearedCount,
        remaining: global.printJobQueue.length,
      });
    } catch (error) {
      console.error('Error clearing print jobs:', error);
      res.status(500).json({
        message: 'Failed to clear print jobs',
        error: error.message,
      });
    }
  }

  /**
   * Clear ALL jobs from the in-memory queue (nuclear option)
   */
  @Delete('print-jobs/clear-all')
  async clearAllPrintJobs(@Res() res: Response) {
    try {
      const count = global.printJobQueue?.length || 0;
      global.printJobQueue = [];
      console.log(`🧹 Cleared ALL ${count} jobs from queue`);
      res.json({
        message: `Cleared all ${count} jobs from queue`,
        cleared: count,
      });
    } catch (error) {
      console.error('Error clearing all print jobs:', error);
      res.status(500).json({
        message: 'Failed to clear all print jobs',
        error: error.message,
      });
    }
  }

  @Get('print-jobs/:jobId')
  async getPrintJob(@Param('jobId') jobId: string, @Res() res: Response) {
    try {
      const jobs = global.printJobQueue || [];
      const job = jobs.find((j) => j.id === jobId);

      if (!job) {
        return res.status(404).json({ message: 'Print job not found' });
      }

      res.json({ job });
    } catch (error) {
      console.error('Error getting print job:', error);
      res.status(500).json({
        message: 'Failed to get print job',
        error: error.message,
      });
    }
  }

  @Put('print-jobs/:jobId/status')
  async updatePrintJobStatus(
    @Param('jobId') jobId: string,
    @Req() req: Request,
    @Res() res: Response,
  ) {
    try {
      const { status, error } = req.body;

      if (!global.printJobQueue) {
        return res.status(404).json({ message: 'No print jobs found' });
      }

      const jobIndex = global.printJobQueue.findIndex((j) => j.id === jobId);

      if (jobIndex === -1) {
        return res.status(404).json({ message: 'Print job not found' });
      }

      global.printJobQueue[jobIndex].status = status;
      global.printJobQueue[jobIndex].updatedAt = new Date().toISOString();

      if (error) {
        global.printJobQueue[jobIndex].error = error;
      }

      console.log(`Print job ${jobId} status updated to: ${status}`);
      res.json({
        success: true,
        message: 'Print job status updated successfully',
      });
    } catch (error) {
      console.error('Error updating print job status:', error);
      res.status(500).json({
        message: 'Failed to update print job status',
        error: error.message,
      });
    }
  }

  @Post('save-images')
  async saveImages(@Req() req: Request, @Res() res: Response) {
    try {
      const { images } = req.body;
      if (!Array.isArray(images) || images.length === 0) {
        console.error('No images provided in request');
        return res.status(400).json({ message: 'No images provided' });
      }
      console.log(`Attempting to save ${images.length} images`);
      // Create a unique folder for this set of images
      const timestamp = Date.now();
      const saveDir = path.join(downloadsDir, 'flipbook', timestamp.toString());
      if (!fs.existsSync(saveDir)) {
        fs.mkdirSync(saveDir, { recursive: true });
      }
      const savedFiles = [];
      for (let i = 0; i < images.length; i++) {
        try {
          const img = images[i];
          const ext = '.png';
          const filename = `page_${i + 1}${ext}`;
          const filePath = path.join(saveDir, filename);
          if (img.startsWith('data:image/')) {
            // Base64 image
            const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
            const buffer = Buffer.from(base64Data, 'base64');
            fs.writeFileSync(filePath, buffer);
            savedFiles.push({
              filename: filename,
              url: `/downloads/flipbook/${timestamp}/${filename}`,
            });
            console.log(`Saved base64 image to ${filePath}`);
          } else {
            console.warn(`Invalid image format for image ${i + 1}`);
          }
        } catch (fileError) {
          console.error(`Error processing image ${i + 1}:`, fileError);
        }
      }
      if (savedFiles.length === 0) {
        console.error('No files were saved successfully');
        return res.status(500).json({ message: 'Failed to save any images' });
      }
      console.log(`Successfully saved ${savedFiles.length} images`);
      res.json({
        message: 'Flipbook images saved successfully',
        timestamp: timestamp,
        files: savedFiles,
      });
    } catch (err) {
      console.error('Save images error:', err);
      res.status(500).json({
        message: 'Failed to save flipbook images',
        error: err.message,
      });
    }
  }

  // =============================================================================
  // HELPER FUNCTIONS FOR PDF GENERATION
  // =============================================================================

  /**
   * Creates composite images side by side for greeting card printing
   */
  async createCompositeImage(outputFilename: string, leftImgPath: string, rightImgPath: string, rotateLeft: boolean = false, rotateRight: boolean = false): Promise<string> {
    try {
      console.log(`Creating composite image: ${outputFilename}`);

      // Greeting card dimensions (8.5x11 paper, folded to 5.5x8.5 panels)
      const panelWidthPx = 1650;  // 5.5 inches * 300 DPI
      const panelHeightPx = 2550; // 8.5 inches * 300 DPI
      const paperWidthPx = panelWidthPx * 2;  // 3300px (11 inches)
      const paperHeightPx = panelHeightPx;    // 2550px (8.5 inches)

      // Read metadata for logging
      const leftMeta = await sharp(leftImgPath).metadata();
      const rightMeta = await sharp(rightImgPath).metadata();

      console.log(` -> Left Image (${path.basename(leftImgPath)}): ${leftMeta.width}x${leftMeta.height}`);
      console.log(` -> Right Image (${path.basename(rightImgPath)}): ${rightMeta.width}x${rightMeta.height}`);
      console.log(` -> Resizing to Panel Size: ${panelWidthPx}x${panelHeightPx}`);

      // Prepare and transform images
      let leftImageSharp = sharp(leftImgPath).resize(panelWidthPx, panelHeightPx, { fit: 'fill' });
      if (rotateLeft) leftImageSharp = leftImageSharp.rotate(180);

      let rightImageSharp = sharp(rightImgPath).resize(panelWidthPx, panelHeightPx, { fit: 'fill' });
      if (rotateRight) rightImageSharp = rightImageSharp.rotate(180);

      // Composite images side by side
      await sharp({
        create: {
          width: paperWidthPx,
          height: paperHeightPx,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .composite([
          { input: await leftImageSharp.toBuffer(), top: 0, left: 0 },
          { input: await rightImageSharp.toBuffer(), top: 0, left: panelWidthPx },
        ])
        .png()
        .toFile(outputFilename);

      console.log(`Successfully created ${outputFilename}`);
      return outputFilename;
    } catch (error) {
      console.error(`Error creating composite image ${outputFilename}:`, error);
      throw error;
    }
  }

  /**
   * Creates the final PDF document from composite images
   */
  async createPdf(pdfPath: string, side1ImagePath: string, side2ImagePath: string): Promise<string> {
    try {
      console.log(`Creating PDF: ${pdfPath}`);
      const pdfDoc = await PDFDocument.create();
      const side1ImageBytes = await fsPromises.readFile(side1ImagePath);
      const side2ImageBytes = await fsPromises.readFile(side2ImagePath);

      let side1Image, side2Image;

      // PDF page size in points (1 inch = 72 points)
      const paperWidthPoints = 11 * 72;  // 792 points
      const paperHeightPoints = 8.5 * 72; // 612 points

      // Basic image type detection based on extension
      if (side1ImagePath.toLowerCase().endsWith('.png')) {
        side1Image = await pdfDoc.embedPng(side1ImageBytes);
      } else if (side1ImagePath.toLowerCase().endsWith('.jpg') || side1ImagePath.toLowerCase().endsWith('.jpeg')) {
        side1Image = await pdfDoc.embedJpg(side1ImageBytes);
      } else {
        throw new Error(`Unsupported image type for ${side1ImagePath}`);
      }

      if (side2ImagePath.toLowerCase().endsWith('.png')) {
        side2Image = await pdfDoc.embedPng(side2ImageBytes);
      } else if (side2ImagePath.toLowerCase().endsWith('.jpg') || side2ImagePath.toLowerCase().endsWith('.jpeg')) {
        side2Image = await pdfDoc.embedJpg(side2ImageBytes);
      } else {
        throw new Error(`Unsupported image type for ${side2ImagePath}`);
      }

      const page1 = pdfDoc.addPage([paperWidthPoints, paperHeightPoints]);
      page1.drawImage(side1Image, { x: 0, y: 0, width: paperWidthPoints, height: paperHeightPoints });

      const page2 = pdfDoc.addPage([paperWidthPoints, paperHeightPoints]);
      page2.drawImage(side2Image, { x: 0, y: 0, width: paperWidthPoints, height: paperHeightPoints });

      const pdfBytes = await pdfDoc.save();
      await fsPromises.writeFile(pdfPath, pdfBytes);
      console.log(`Successfully created ${pdfPath}`);
      return pdfPath;
    } catch (error) {
      console.error(`Error creating PDF ${pdfPath}:`, error);
      throw error;
    }
  }

  /**
   * Creates a composite sticker sheet image matching Avery Presta 94513 layout
   * 6 circular stickers (3" diameter) in 2x3 grid on letter paper
   * 
   * Layout specs (at 300 DPI):
   * - Paper: 8.5" x 11" = 2550px x 3300px
   * - Sticker diameter: 3" = 900px
   * - Top margin: 0.75" = 225px
   * - Left margin: 1.25" = 375px
   * - Horizontal gap between stickers: 0.5" = 150px
   * - Vertical gap between stickers: 0.5" = 150px
   */
  async createStickerSheetComposite(outputPath: string, stickerPaths: (string | null)[]): Promise<string> {
    try {
      console.log('Creating sticker sheet composite...');

      // Paper dimensions at 300 DPI
      const paperWidthPx = 2550;  // 8.5 inches
      const paperHeightPx = 3300; // 11 inches

      // Sticker dimensions
      const stickerDiameterPx = 900; // 3 inches

      // Margins and gaps
      const topMarginPx = 225;    // 0.75 inches
      const leftMarginPx = 375;   // 1.25 inches
      const hGapPx = 150;         // 0.5 inches between columns
      const vGapPx = 150;         // 0.5 inches between rows

      // Calculate sticker positions (2 columns, 3 rows)
      const positions = [
        // Row 1
        { x: leftMarginPx, y: topMarginPx },
        { x: leftMarginPx + stickerDiameterPx + hGapPx, y: topMarginPx },
        // Row 2
        { x: leftMarginPx, y: topMarginPx + stickerDiameterPx + vGapPx },
        { x: leftMarginPx + stickerDiameterPx + hGapPx, y: topMarginPx + stickerDiameterPx + vGapPx },
        // Row 3
        { x: leftMarginPx, y: topMarginPx + (stickerDiameterPx + vGapPx) * 2 },
        { x: leftMarginPx + stickerDiameterPx + hGapPx, y: topMarginPx + (stickerDiameterPx + vGapPx) * 2 },
      ];

      // Create composites array for sharp
      const composites: any[] = [];

      for (let i = 0; i < 6; i++) {
        const stickerPath = stickerPaths[i];
        if (!stickerPath || !fs.existsSync(stickerPath)) {
          console.log(`Sticker ${i + 1}: empty slot`);
          continue;
        }

        const pos = positions[i];
        console.log(`Sticker ${i + 1}: placing at (${pos.x}, ${pos.y})`);

        // Resize sticker to fit in circle and create circular mask
        const resizedSticker = await sharp(stickerPath)
          .resize(stickerDiameterPx, stickerDiameterPx, { fit: 'cover' })
          .toBuffer();

        // Create circular mask
        const circleMask = Buffer.from(
          `<svg width="${stickerDiameterPx}" height="${stickerDiameterPx}">
            <circle cx="${stickerDiameterPx / 2}" cy="${stickerDiameterPx / 2}" r="${stickerDiameterPx / 2}" fill="white"/>
          </svg>`
        );

        // Apply circular mask
        const circularSticker = await sharp(resizedSticker)
          .composite([{
            input: circleMask,
            blend: 'dest-in',
          }])
          .png()
          .toBuffer();

        composites.push({
          input: circularSticker,
          top: pos.y,
          left: pos.x,
        });
      }

      // Create white background and composite all stickers
      await sharp({
        create: {
          width: paperWidthPx,
          height: paperHeightPx,
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .composite(composites)
        .png()
        .toFile(outputPath);

      console.log(`✅ Sticker sheet composite created: ${outputPath}`);
      return outputPath;
    } catch (error) {
      console.error('Error creating sticker sheet composite:', error);
      throw error;
    }
  }

  /**
   * Creates a PDF from a single sticker sheet image
   */
  async createStickerPdf(pdfPath: string, stickerSheetPath: string): Promise<string> {
    try {
      console.log(`Creating sticker PDF: ${pdfPath}`);
      const pdfDoc = await PDFDocument.create();
      const imageBytes = await fsPromises.readFile(stickerSheetPath);

      // PDF page size in points (1 inch = 72 points) - Letter portrait
      const paperWidthPoints = 8.5 * 72;  // 612 points
      const paperHeightPoints = 11 * 72;  // 792 points

      const image = await pdfDoc.embedPng(imageBytes);

      const page = pdfDoc.addPage([paperWidthPoints, paperHeightPoints]);
      page.drawImage(image, { x: 0, y: 0, width: paperWidthPoints, height: paperHeightPoints });

      const pdfBytes = await pdfDoc.save();
      await fsPromises.writeFile(pdfPath, pdfBytes);
      console.log(`✅ Sticker PDF created: ${pdfPath}`);
      return pdfPath;
    } catch (error) {
      console.error(`Error creating sticker PDF ${pdfPath}:`, error);
      throw error;
    }
  }

  @Post('generate-print-jpegs')
  async generatePrintJpegs(@Req() req: Request, @Res() res: Response) {
    try {
      const { cardId, image1, image2, image3, image4, giftCardData } = req.body;

      if (!cardId || !image1 || !image2 || !image3 || !image4) {
        return res.status(400).json({ message: 'Card ID and all four image URLs are required' });
      }

      console.log('[generate-print-jpegs] Processing card:', cardId);

      // Get current timestamp for print generation
      const printTimestamp = new Date().toLocaleString('en-US', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
      });
      console.log('[generate-print-jpegs] Print generated at:', printTimestamp);

      // Create output directory if it doesn't exist
      const outputDir = path.join(downloadsDir, 'print-jpegs');
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }

      // Process images (handle both base64 data URLs and HTTP URLs)
      const processImage = async (imageData: string, filename: string) => {
        if (imageData.startsWith('data:')) {
          // Handle base64 data URL
          const [mimeInfo, base64Data] = imageData.split(',');
          const buffer = Buffer.from(base64Data, 'base64');
          const tempPath = path.join(outputDir, filename);
          fs.writeFileSync(tempPath, buffer);
          console.log(`[generate-print-jpegs] Processed base64 image: ${filename}`);
          return tempPath;
        } else {
          // Handle HTTP URL
          try {
            const response = await fetch(imageData);
            if (!response.ok) {
              throw new Error(`Failed to download image from ${imageData}`);
            }
            const buffer = await response.buffer();
            const tempPath = path.join(outputDir, filename);
            fs.writeFileSync(tempPath, buffer);
            console.log(`[generate-print-jpegs] Downloaded HTTP image: ${filename}`);
            return tempPath;
          } catch (error) {
            console.warn(`[generate-print-jpegs] Failed to download image from ${imageData}:`, error.message);
            // Return a placeholder or throw error based on requirements
            throw new Error(`Failed to process image: ${error.message}`);
          }
        }
      };

      // Process all images
      const tempImage1 = await processImage(image1, `temp_${cardId}_1.jpg`);
      const tempImage2 = await processImage(image2, `temp_${cardId}_2.jpg`);
      const tempImage3 = await processImage(image3, `temp_${cardId}_3.jpg`);
      const tempImage4 = await processImage(image4, `temp_${cardId}_4.jpg`);

      // Map images to greeting card positions (existing mapping)
      const imageFiles = {
        front: tempImage1,     // page_1
        back: tempImage4,      // page_4  
        insideLeft: tempImage3, // page_3
        insideRight: tempImage2 // page_2
      };

      // Create temporary composite files
      const compositeSide1Path = path.join(outputDir, `temp_${cardId}_side1.png`);
      const compositeSide2Path = path.join(outputDir, `temp_${cardId}_side2.png`);

      // Create composite images using new logic
      console.log('[generate-print-jpegs] Creating composite images...');
      await this.createCompositeImage(compositeSide1Path, imageFiles.back, imageFiles.front);
      await this.createCompositeImage(compositeSide2Path, imageFiles.insideRight, imageFiles.insideLeft);

      // Add gift card overlay to compositeSide2 if giftCardData exists
      if (giftCardData && giftCardData.qrCode) {
        try {
          console.log('[generate-print-jpegs] Adding gift card overlay to print:', giftCardData);
          console.log('[generate-print-jpegs] QR code URL:', giftCardData.qrCode);

          // Handle QR code image (base64 data URL or HTTP URL)
          let qrBuffer;
          let qrMimeType = 'image/png'; // default

          if (giftCardData.qrCode.startsWith('data:')) {
            // Handle base64 data URL
            const [mimeInfo, base64Data] = giftCardData.qrCode.split(',');
            qrMimeType = mimeInfo.split(':')[1].split(';')[0]; // Extract MIME type
            qrBuffer = Buffer.from(base64Data, 'base64');
            console.log('[generate-print-jpegs] QR code processed from base64, MIME type:', qrMimeType, 'buffer size:', qrBuffer.length);
          } else {
            // Handle HTTP URL with fallback
            try {
              const response = await fetch(giftCardData.qrCode);
              if (!response.ok) {
                throw new Error(`Failed to download QR code from ${giftCardData.qrCode}`);
              }
              qrBuffer = await response.buffer();
              qrMimeType = 'image/png';
              console.log('[generate-print-jpegs] QR code downloaded from URL, buffer size:', qrBuffer.length);
            } catch (qrError) {
              console.warn('[generate-print-jpegs] Failed to download QR code, using fallback:', qrError.message);
              // Create a simple fallback QR code placeholder
              const fallbackQrSvg = `<svg width="100" height="100" xmlns="http://www.w3.org/2000/svg">
                <rect width="100" height="100" fill="#f0f0f0" stroke="#ccc" stroke-width="2"/>
                <text x="50" y="50" text-anchor="middle" dy="0.3em" font-family="Arial" font-size="12" fill="#666">QR Code</text>
              </svg>`;
              qrBuffer = Buffer.from(fallbackQrSvg);
              qrMimeType = 'image/svg+xml';
            }
          }

          if (qrBuffer) {
            // Create gift card overlay SVG with QR code, logo, and info
            let storeLogo = '';
            console.log('[generate-print-jpegs] 🏪 Store logo check:', {
              hasStoreLogo: !!giftCardData.storeLogo,
              storeLogoType: typeof giftCardData.storeLogo,
              storeLogoPrefix: giftCardData.storeLogo?.substring(0, 50) || 'N/A'
            });
            
            if (giftCardData.storeLogo) {
              try {
                if (giftCardData.storeLogo.startsWith('data:')) {
                  // Already a base64 data URL
                  storeLogo = giftCardData.storeLogo;
                  console.log('[generate-print-jpegs] ✅ Store logo is already base64 encoded');
                } else {
                  // Handle HTTP URL with fallback
                  try {
                    console.log('[generate-print-jpegs] 🏪 Fetching store logo from URL:', giftCardData.storeLogo);
                    const response = await fetch(giftCardData.storeLogo);
                    console.log('[generate-print-jpegs] 🏪 Store logo fetch response:', {
                      ok: response.ok,
                      status: response.status,
                      contentType: response.headers.get('content-type')
                    });
                    if (!response.ok) {
                      throw new Error(`Failed to download store logo from ${giftCardData.storeLogo}`);
                    }
                    const logoBuffer = await response.buffer();
                    // Detect image type from content-type header
                    const contentType = response.headers.get('content-type') || 'image/png';
                    const mimeType = contentType.split(';')[0].trim();
                    const logoBase64 = logoBuffer.toString('base64');
                    storeLogo = `data:${mimeType};base64,${logoBase64}`;
                    console.log('[generate-print-jpegs] ✅ Store logo downloaded and encoded, length:', logoBase64.length);
                  } catch (logoError) {
                    console.warn('[generate-print-jpegs] ❌ Failed to download store logo, skipping:', logoError.message);
                  }
                }
              } catch (logoError) {
                console.warn('[generate-print-jpegs] Failed to process store logo:', logoError);
              }
            }

            // Convert QR code to base64 for SVG embedding
            const qrBase64 = qrBuffer.toString('base64');

            // Create comprehensive gift card overlay SVG with proper encoding
            const entities: { [key: string]: string } = { '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&apos;' };

            const storeName = (giftCardData.storeName || 'Gift Card').replace(/[<>&"']/g, (match: string) => {
              return entities[match];
            });

            const amount = (giftCardData.amount || '0').toString().replace(/[<>&"']/g, (match: string) => {
              return entities[match];
            });

            // Create gift card overlay SVG for PRINT version
            // Print is 300 DPI (3300x2550px), so overlay needs to be much larger
            // Layout: QR Code and Logo side-by-side (same size) at top, text centered below
            const giftCardOverlaySvg = `<svg width="700" height="550" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <filter id="shadow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur in="SourceAlpha" stdDeviation="25"/>
      <feOffset dx="0" dy="12" result="offsetblur"/>
      <feComponentTransfer>
        <feFuncA type="linear" slope="0.3"/>
      </feComponentTransfer>
      <feMerge>
        <feMergeNode/>
        <feMergeNode in="SourceGraphic"/>
      </feMerge>
    </filter>
  </defs>
  
  <!-- Main container with shadow -->
  <rect x="0" y="0" width="700" height="550" rx="48" ry="48" fill="rgba(255,255,255,0.95)" stroke="rgba(229,231,235,1)" stroke-width="3" filter="url(#shadow)"/>
  
  <!-- QR Code on left -->
  <rect x="50" y="40" width="280" height="280" rx="24" ry="24" fill="white"/>
  <image x="50" y="40" width="280" height="280" href="data:${qrMimeType};base64,${qrBase64}" preserveAspectRatio="xMidYMid meet"/>
  
  ${storeLogo ? `
  <!-- Company logo on right (same size as QR code) -->
  <rect x="370" y="40" width="280" height="280" rx="24" ry="24" fill="white"/>
  <image x="370" y="40" width="280" height="280" href="${storeLogo}" preserveAspectRatio="xMidYMid meet"/>
  ` : ''}
  
  <!-- Company name and amount centered below both -->
  <text x="350" y="390" text-anchor="middle" font-family="Arial, sans-serif" font-size="42" font-weight="600" fill="#1f2937">${storeName}</text>
  <text x="350" y="450" text-anchor="middle" font-family="Arial, sans-serif" font-size="36" fill="#4b5563">$${amount}</text>
</svg>`;

            const giftCardOverlayBuffer = Buffer.from(giftCardOverlaySvg);

            // Position for print: centered horizontally, 100px from bottom for visibility
            // Composite is 3300px wide (two 1650px panels), page 3 starts at 1650px
            // Overlay dimensions: 700x550px (scaled for print)
            const overlayTop = 2550 - 550 - 100; // Total height - overlay height - bottom margin
            const overlayLeft = 1650 + (1650 - 700) / 2; // Left panel width + centered in right panel

            // Create a temporary file with the overlay
            const tempOverlayPath = path.join(outputDir, `temp_${cardId}_overlay.png`);
            await sharp(compositeSide2Path)
              .composite([{
                input: giftCardOverlayBuffer,
                top: overlayTop,
                left: overlayLeft
              }])
              .png()
              .toFile(tempOverlayPath);

            // Replace the original composite with the one that has the overlay
            await fsPromises.unlink(compositeSide2Path);
            await fsPromises.rename(tempOverlayPath, compositeSide2Path);

            console.log(`[generate-print-jpegs] Gift card overlay positioned at top: ${overlayTop}, left: ${overlayLeft}`);
            console.log('[generate-print-jpegs] Gift card overlay with QR code and logo added successfully to print composite');
          }
        } catch (giftCardError) {
          console.error('[generate-print-jpegs] Failed to add gift card overlay to print version:', giftCardError);
          console.error('[generate-print-jpegs] Gift card error details:', giftCardError.message, giftCardError.stack);
        }
      } else {
        console.log('[generate-print-jpegs] No gift card data provided or QR code missing');
        console.log('[generate-print-jpegs] Gift card data received:', giftCardData);
      }

      // Create PDF using pdf-lib
      const outputPdf = `${cardId}_print.pdf`;
      const pdfPath = path.join(outputDir, outputPdf);

      console.log('[generate-print-jpegs] Creating PDF from composite images...');
      await this.createPdf(pdfPath, compositeSide1Path, compositeSide2Path);

      // Clean up temporary files
      const tempFiles = [tempImage1, tempImage2, tempImage3, tempImage4, compositeSide1Path, compositeSide2Path];
      tempFiles.forEach(tempPath => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      });

      // Return PDF download URL
      const baseUrl = getBaseUrl();
      const pdfUrl = `${baseUrl}/downloads/print-jpegs/${outputPdf}`;

      console.log('[generate-print-jpegs] Successfully created PDF file:', pdfUrl);

      return res.json({
        success: true,
        message: 'Print PDF file generated successfully',
        pdfUrl: pdfUrl
      });
    } catch (error) {
      console.error('[generate-print-jpegs] Error:', error);
      return res.status(500).json({
        message: 'Failed to generate print JPEG files',
        error: error.message,
      });
    }
  }

  @Post('search-designs')
  async searchDesigns(@Req() req: Request, @Res() res: Response) {
    try {
      const { query } = req.body;

      if (!query || typeof query !== 'string') {
        return res.status(400).json({ message: 'Search query is required' });
      }

      console.log('[search-designs] Received query:', query);

      // Load published designs from database (Supabase) or file fallback
      const designs = await this.savedDesignsService.getPublishedDesigns();

      console.log(
        '[search-designs] Loaded published designs count:',
        designs?.length || 0,
      );

      if (!designs || designs.length === 0) {
        return res.json({
          query,
          results: [],
          totalFound: 0,
          resultType: 'design',
        });
      }

      // Build map for AI prompt and quick lookup
      const designsData: Record<string, any> = {};
      designs.forEach((d: any) => {
        const keywords = Array.isArray(d.searchKeywords)
          ? d.searchKeywords.join(', ')
          : '';
        const author = d.author || '';
        designsData[d.id] = {
          id: d.id,
          title: d.title,
          description: d.description || '',
          text: `${d.title} ${d.description || ''} ${keywords} ${d.category || ''} ${author}`.trim(),
          category: d.category,
          author: author,
          imageUrls: d.imageUrls || [],
          designData: d.designData,
          upload_time: d.upload_time,
          num_downloads: d.num_downloads,
          popularity: d.popularity,
        };
      });

      const allDescriptions = Object.entries(designsData)
        .map(([id, d]) => `${id}: ${d.text}`)
        .join('\n');

      const tryGemini = async (): Promise<string[]> => {
        if (!process.env.GEMINI_API_KEY) {
          console.warn(
            '[search-designs] GEMINI_API_KEY not set. Skipping Gemini and using fallback.',
          );
          return [];
        }
        console.log('[search-designs] Using Gemini for semantic ranking...');
        console.log(
          '[search-designs] Prompt size (chars):',
          allDescriptions.length,
        );
        const prompt = `Given the user's search query: "${query}"

And these card design descriptions:
${allDescriptions}

Return ONLY a JSON array of design IDs (e.g., ["uuid1", "uuid2"]) that are most relevant to the search query. Do not include any other text.`;

        const payload = {
          contents: [
            {
              role: 'user',
              parts: [{ text: prompt }],
            },
          ],
          generation_config: {
            temperature: 0.1,
            top_p: 0.8,
            top_k: 40,
            max_output_tokens: 1024,
          },
        } as any;

        const startedAt = Date.now();
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
        const durationMs = Date.now() - startedAt;
        console.log(
          `[search-designs] Gemini HTTP status: ${response.status} ${response.statusText} in ${durationMs}ms`,
        );

        if (!response.ok) {
          const errorText = await response.text();
          console.warn('[search-designs] Gemini error:', errorText);
          return [];
        }

        const data = await response.json();
        const responseText = data?.candidates?.[0]?.content?.parts?.[0]
          ?.text as string | undefined;
        if (!responseText) return [];
        try {
          const jsonMatch = responseText.match(/\[.*\]/);
          if (!jsonMatch) return [];
          const arr = JSON.parse(jsonMatch[0]);
          console.log(
            '[search-designs] Parsed design IDs count:',
            Array.isArray(arr) ? arr.length : 0,
          );
          if (Array.isArray(arr)) {
            console.log('[search-designs] Parsed IDs sample:', arr.slice(0, 5));
          }
          return Array.isArray(arr) ? arr : [];
        } catch (e) {
          console.warn('[search-designs] Failed to parse Gemini response:', e);
          return [];
        }
      };

      const simpleRank = (): string[] => {
        console.log(
          '[search-designs] Using simple keyword ranking fallback...',
        );
        // Tokenize query
        const q = query.toLowerCase();
        const tokens = q.split(/[^a-z0-9]+/).filter(Boolean);
        const uniqueTokens = Array.from(new Set(tokens));
        console.log('[search-designs] Query tokens:', uniqueTokens);

        const scoreById: Record<string, number> = {};
        Object.entries(designsData).forEach(([id, d]) => {
          const hay =
            `${d.title} ${d.description} ${d.category} ${d.author || ''}`.toLowerCase();
          let score = 0;
          for (const t of uniqueTokens) {
            if (!t) continue;
            const occurrences = hay.split(t).length - 1;
            if (occurrences > 0) score += 2 * occurrences; // title/desc/category matches

            // keywords boost
            const keywords = Array.isArray(
              designs.find((dd) => dd.id === id)?.searchKeywords,
            )
              ? (designs.find((dd) => dd.id === id)!.searchKeywords as string[])
              : [];
            if (keywords.some((k) => (k || '').toLowerCase() === t)) score += 3;
            if (keywords.some((k) => (k || '').toLowerCase().includes(t)))
              score += 1;
          }
          // Simple occasion heuristics
          if (
            (d.category || '').toLowerCase().includes('birthday') &&
            q.includes('birthday')
          )
            score += 2;
          if (
            (d.category || '').toLowerCase().includes('wedding') &&
            q.includes('wedding')
          )
            score += 2;
          scoreById[id] = score;
        });

        const ranked = Object.entries(scoreById)
          .sort((a, b) => b[1] - a[1])
          .filter(([, s]) => s > 0)
          .map(([id]) => id);
        console.log('[search-designs] Fallback top IDs:', ranked.slice(0, 5));
        return ranked;
      };

      let rankedIds: string[] = [];
      let geminiIds: string[] = [];
      try {
        geminiIds = await tryGemini();
      } catch { }
      const usedGemini =
        Array.isArray(geminiIds) &&
        geminiIds.length > 0 &&
        !!process.env.GEMINI_API_KEY;
      rankedIds = usedGemini ? geminiIds : simpleRank();

      const results = rankedIds
        .filter((id) => designsData[id])
        .map((id) => ({
          ...designsData[id],
        }));

      console.log('[search-designs] Returning results:', {
        count: results.length,
        usedGemini,
      });

      return res.json({
        query,
        results,
        totalFound: results.length,
        resultType: 'design',
        usedGemini,
      });
    } catch (error) {
      console.error('[search-designs] Error:', error);
      return res.status(500).json({
        message: 'Internal server error',
        error: error.message,
      });
    }
  }

  @Post('save-images-cloud')
  async saveImagesToCloud(@Req() req: Request, @Res() res: Response) {
    try {
      const { images, userId, designId, oldImageUrls } = req.body;

      if (!Array.isArray(images) || images.length === 0) {
        console.error('No images provided in request');
        return res.status(400).json({ message: 'No images provided' });
      }

      if (!userId) {
        console.error('No userId provided in request');
        return res.status(400).json({ message: 'userId is required' });
      }

      console.log(
        `Attempting to save ${images.length} images to cloud storage for user ${userId}`,
      );

      if (!this.storageService.isConfigured()) {
        console.error('Cloud storage not configured');
        return res
          .status(500)
          .json({ message: 'Cloud storage not configured' });
      }

      // Upload images to cloud storage (with optional cleanup of old images)
      const cloudUrls =
        oldImageUrls && oldImageUrls.length > 0
          ? await this.storageService.updateImages(
            images,
            userId.toString(),
            designId,
            oldImageUrls,
          )
          : await this.storageService.uploadImages(
            images,
            userId.toString(),
            designId,
          );

      console.log(
        `Successfully uploaded ${cloudUrls.length} images to cloud storage`,
      );

      res.json({
        message: 'Images saved to cloud storage successfully',
        timestamp: Date.now(),
        cloudUrls: cloudUrls,
        count: cloudUrls.length,
      });
    } catch (err) {
      console.error('Save images to cloud error:', err);
      res.status(500).json({
        message: 'Failed to save images to cloud storage',
        error: err.message,
      });
    }
  }

  @Post('test-complete-flow')
  async testCompleteFlow(@Req() req: Request, @Res() res: Response) {
    try {
      const { images, userId, designId, title, description, category } =
        req.body;

      if (!Array.isArray(images) || images.length === 0) {
        return res.status(400).json({ message: 'No images provided' });
      }

      if (!userId) {
        return res.status(400).json({ message: 'userId is required' });
      }

      console.log(`🧪 Testing complete flow for user ${userId}`);

      // Step 1: Upload images to cloud storage
      const { SupabaseStorageService } = await import(
        './saved-designs/supabase-storage.service'
      );
      const storageService = new SupabaseStorageService();

      if (!storageService.isConfigured()) {
        return res
          .status(500)
          .json({ message: 'Cloud storage not configured' });
      }

      const cloudUrls = await storageService.uploadImages(
        images,
        userId.toString(),
        designId,
      );
      console.log(`✅ Uploaded ${cloudUrls.length} images to cloud storage`);

      // Step 2: Verify images are accessible
      const accessibleImages = [];
      for (let i = 0; i < cloudUrls.length; i++) {
        try {
          const response = await fetch(cloudUrls[i]);
          if (response.ok) {
            accessibleImages.push(cloudUrls[i]);
          }
        } catch (error) {
          console.error(`Error accessing image ${i + 1}:`, error.message);
        }
      }

      // Step 3: Create design data (simulate saving to database)
      const designData = {
        id: designId,
        title: title || 'Test Card',
        description: description || 'Test card created during flow testing',
        category: category || 'Birthday',
        imageUrls: cloudUrls,
        imageTimestamp: Date.now(),
        author: 'Test User',
        upload_time: new Date().toISOString(),
        status: 'draft',
        userId: userId,
      };

      console.log(`✅ Complete flow test successful for design ${designId}`);

      res.json({
        message: 'Complete flow test successful',
        design: designData,
        cloudUrls: cloudUrls,
        accessibleImages: accessibleImages.length,
        totalImages: cloudUrls.length,
      });
    } catch (err) {
      console.error('Complete flow test error:', err);
      res.status(500).json({
        message: 'Complete flow test failed',
        error: err.message,
      });
    }
  }

  @Post('templates/migrate')
  async migrateTemplatesToCloud(@Res() res: Response) {
    try {
      console.log('🚀 Starting template migration to cloud...');

      const { TemplateMigrationService } = await import(
        './templates/template-migration.service'
      );
      const { SupabaseStorageService } = await import(
        './saved-designs/supabase-storage.service'
      );

      const storageService = new SupabaseStorageService();
      const migrationService = new TemplateMigrationService(storageService);

      await migrationService.migrateAllAssets();

      res.json({
        message: 'Template migration completed successfully',
        timestamp: new Date().toISOString(),
        status: 'completed',
      });
    } catch (err) {
      console.error('Template migration error:', err);
      res.status(500).json({
        message: 'Template migration failed',
        error: err.message,
      });
    }
  }

  @Get('templates/cloud')
  async getCloudTemplates(@Res() res: Response) {
    try {
      const { CloudMetadataService } = await import(
        './templates/cloud-metadata.service'
      );
      const { SupabaseStorageService } = await import(
        './saved-designs/supabase-storage.service'
      );

      const storageService = new SupabaseStorageService();
      const cloudService = new CloudMetadataService(storageService);

      const metadata = await cloudService.getCloudMetadata();

      res.json({
        templates: metadata.templates,
        categories: metadata.categories,
        lastUpdated: metadata.lastUpdated,
        version: metadata.version,
      });
    } catch (err) {
      console.error('Cloud templates error:', err);
      res.status(503).json({
        message: 'Cloud templates unavailable',
        error: err.message,
      });
    }
  }

  @Get('categories/cloud')
  async getCloudCategories(@Res() res: Response) {
    try {
      const { CloudMetadataService } = await import(
        './templates/cloud-metadata.service'
      );
      const { SupabaseStorageService } = await import(
        './saved-designs/supabase-storage.service'
      );

      const storageService = new SupabaseStorageService();
      const cloudService = new CloudMetadataService(storageService);

      const categories = await cloudService.getCloudCategories();

      res.json({
        categories: categories,
        lastUpdated: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Cloud categories error:', err);
      res.status(503).json({
        message: 'Cloud categories unavailable',
        error: err.message,
      });
    }
  }

  @Get('templates/cloud/status')
  async getCloudTemplatesStatus(@Res() res: Response) {
    try {
      const { CloudMetadataService } = await import(
        './templates/cloud-metadata.service'
      );
      const { SupabaseStorageService } = await import(
        './saved-designs/supabase-storage.service'
      );

      const storageService = new SupabaseStorageService();
      const cloudService = new CloudMetadataService(storageService);

      const isAvailable = await cloudService.isCloudMetadataAvailable();
      const metadataInfo = await cloudService.getMetadataInfo();
      const validation = await cloudService.validateCloudMetadata();

      res.json({
        available: isAvailable,
        metadataInfo: metadataInfo,
        validation: validation,
        timestamp: new Date().toISOString(),
      });
    } catch (err) {
      console.error('Cloud templates status error:', err);
      res.status(503).json({
        message: 'Cloud templates status unavailable',
        error: err.message,
      });
    }
  }
}
