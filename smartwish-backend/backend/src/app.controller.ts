import {
  Controller,
  Get,
  Post,
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
import * as path from 'path';
import * as sharp from 'sharp';
import fetch from 'node-fetch';
import { Express } from 'express';
// @ts-ignore
import { getPrinters } from 'pdf-to-printer';
import { SharingService } from './sharing/sharing.service';
import { SupabaseStorageService } from './saved-designs/supabase-storage.service';
import { SavedDesignsService } from './saved-designs/saved-designs.service';
import { SupabaseTemplatesEnhancedService } from './templates/supabase-templates-enhanced.service';

const downloadsDir = path.join(__dirname, '../../downloads');
if (!fs.existsSync(downloadsDir)) {
  fs.mkdirSync(downloadsDir, { recursive: true });
}

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
    try {
      const { images, printerName } = req.body;
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
      console.log(
        `PC Print request received for ${images.length} images to printer: ${printerName}`,
      );
      // Save images to flipbook directory
      const savedPaths = [];
      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        const fileName = `page_${i + 1}.png`;
        const filePath = path.join(flipbookDir, fileName);
        // Convert base64 to buffer and save
        const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        savedPaths.push(filePath);
        console.log(`Saved page ${i + 1}: ${filePath}`);
      }
      // Call the print function with the specified printer
      try {
        // Use require instead of import to avoid TypeScript issues
        const printCardModule = require('../../print-card.js');
        await printCardModule.main(printerName);
      } catch (importError) {
        console.error('Error importing print-card module:', importError);
        throw new Error('Failed to load printing module');
      }
      res.json({
        message: 'Print job sent successfully',
        savedImages: savedPaths.length,
      });
    } catch (error) {
      console.error('Error in PC printing:', error);
      res.status(500).json({
        message: 'Failed to print',
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

  @Post('search-templates')
  async searchTemplates(@Req() req: Request, @Res() res: Response) {
    try {
      const { query } = req.body;

      if (!query) {
        return res.status(400).json({ message: 'Search query is required' });
      }

      console.log('[search-templates] Received query:', query);

      // Fetch templates from database
      const templates = await this.templatesService.getAllTemplates();

      console.log(
        '[search-templates] Loaded templates count:',
        templates.length,
      );

      // Convert templates to the format expected by the search algorithm
      const templatesData: Record<string, any> = {};
      
      // Fetch keywords for each template and build the search data
      for (const template of templates) {
        const keywords = await this.templatesService.getTemplateKeywords(template.id);
        templatesData[template.id] = {
          title: template.title,
          text: `${template.description || ''} ${keywords.join(', ')}`,
          category: template.category_id,
        };
      }

      // Prepare the prompt for Gemini
      const templateDescriptions = Object.entries(templatesData)
        .map(([key, template]: [string, any]) => `${key}: ${template.text}`)
        .join('\n');

      console.log(
        '[search-templates] Prompt size (chars):',
        templateDescriptions.length,
      );

      const prompt = `You are an expert at semantic search and understanding user intent for greeting card templates.

User's search query: "${query}"

Template descriptions (ID: description + keywords):
${templateDescriptions}

Task: Find templates that semantically match the user's query. Consider:
- Synonyms and variations (e.g., "water color" = "watercolor", "playful girl" includes "girl")
- Related themes and concepts (e.g., "birthday" relates to "celebration", "party")
- Artistic styles and moods (e.g., "elegant" relates to "sophisticated", "classy")
- Occasions and emotions (e.g., "thank you" relates to "gratitude", "appreciation")
- Partial matches and broader categories

Be inclusive rather than restrictive. If a template could reasonably match the user's intent or contains related concepts, include it.

Return ONLY a JSON array of relevant template IDs, ordered by relevance (most relevant first):
["id1", "id2", "id3"]`;

      const payload = {
        contents: [
          {
            role: 'user',
            parts: [
              {
                text: prompt,
              },
            ],
          },
        ],
        generation_config: {
          temperature: 0.3,
          top_p: 0.9,
          top_k: 50,
          max_output_tokens: 512,
        },
      };

      if (!process.env.GEMINI_API_KEY) {
        console.warn(
          '[search-templates] GEMINI_API_KEY not set. This endpoint requires Gemini.',
        );
      }

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
        `[search-templates] Gemini HTTP status: ${response.status} ${response.statusText} in ${durationMs}ms`,
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[search-templates] Gemini API Error:', errorText);
        return res
          .status(500)
          .json({ message: 'Gemini API failed', error: errorText });
      }

      const data = await response.json();
      const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      // console.log('[search-templates] Raw Gemini response:', responseText);

      if (!responseText) {
        return res.status(500).json({ message: 'No response from Gemini API' });
      }

      // Parse the JSON response from Gemini
      let relevantTemplates;
      try {
        // Clean the response text to extract just the JSON array
        // Handle both plain JSON and markdown-wrapped JSON
        let jsonText = responseText.trim();
        
        // Remove markdown code block formatting if present
        if (jsonText.includes('```json')) {
          jsonText = jsonText.replace(/```json\s*/, '').replace(/\s*```/, '');
        } else if (jsonText.includes('```')) {
          jsonText = jsonText.replace(/```\s*/, '').replace(/\s*```/, '');
        }
        
        // Extract JSON array
        const jsonMatch = jsonText.match(/\[.*\]/s);
        if (jsonMatch) {
          relevantTemplates = JSON.parse(jsonMatch[0]);
        } else {
          relevantTemplates = [];
        }
        console.log(
          '[search-templates] Parsed template IDs count:',
          Array.isArray(relevantTemplates) ? relevantTemplates.length : 0,
        );
        if (Array.isArray(relevantTemplates)) {
          console.log(
            '[search-templates] Parsed IDs sample:',
            relevantTemplates.slice(0, 5),
          );
        }
      } catch (error) {
        console.error(
          '[search-templates] Error parsing Gemini response:',
          error,
        );
        relevantTemplates = [];
      }

      // Filter templates to only include valid ones and get full template data
      const validTemplateIds = relevantTemplates.filter(
        (templateId: string) => templatesData[templateId]
      );

      console.log('[search-templates] Valid template IDs:', validTemplateIds);

      // Get full template data from database for valid IDs
      const results = [];
      for (const templateId of validTemplateIds) {
        const template = templates.find(t => t.id === templateId);
        if (template) {
          results.push(template);
        }
      }

      console.log('[search-templates] Final results count:', results.length);

      return res.json({
        query,
        results,
        totalFound: results.length,
        usedGemini: true,
      });
    } catch (error) {
      console.error('[search-templates] Error:', error);
      return res
        .status(500)
        .json({ message: 'Internal server error', error: error.message });
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

      // Download images from URLs
      const downloadImage = async (url: string, filename: string) => {
        const response = await fetch(url);
        if (!response.ok) {
          throw new Error(`Failed to download image from ${url}`);
        }
        const buffer = await response.buffer();
        const tempPath = path.join(outputDir, filename);
        fs.writeFileSync(tempPath, buffer);
        return tempPath;
      };

      // Download all images
      const tempImage1 = await downloadImage(image1, `temp_${cardId}_1.jpg`);
      const tempImage2 = await downloadImage(image2, `temp_${cardId}_2.jpg`);
      const tempImage3 = await downloadImage(image3, `temp_${cardId}_3.jpg`);
      const tempImage4 = await downloadImage(image4, `temp_${cardId}_4.jpg`);

      // Create composite images
      const jpeg1Path = path.join(outputDir, `${cardId}_print_1.jpg`);
      const jpeg2Path = path.join(outputDir, `${cardId}_print_2.jpg`);

      // First JPEG: Image 4 and Image 1 side by side
      await sharp({
        create: {
          width: 3300, // 11 inches * 300 DPI
          height: 2550, // 8.5 inches * 300 DPI
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .composite([
          { 
            input: await sharp(tempImage4).resize(1650, 2550, { fit: 'fill' }).toBuffer(), 
            top: 0, 
            left: 0 
          },
          { 
            input: await sharp(tempImage1).resize(1650, 2550, { fit: 'fill' }).toBuffer(), 
            top: 0, 
            left: 1650 
          },
        ])
        .jpeg({ quality: 90 })
        .toFile(jpeg1Path);

      // Second JPEG: Image 3 and Image 2 side by side
      const compositeElements = [
        { 
          input: await sharp(tempImage3).resize(1650, 2550, { fit: 'fill' }).toBuffer(), 
          top: 0, 
          left: 0 
        },
        { 
          input: await sharp(tempImage2).resize(1650, 2550, { fit: 'fill' }).toBuffer(), 
          top: 0, 
          left: 1650 
        },
      ];

      // Add gift card QR code and logo overlay if present
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
            // Handle HTTP URL
            const qrResponse = await fetch(giftCardData.qrCode);
            if (qrResponse.ok) {
              qrBuffer = await qrResponse.buffer();
              qrMimeType = giftCardData.qrCode.includes('.png') ? 'image/png' : 'image/jpeg';
              console.log('[generate-print-jpegs] QR code downloaded from URL, buffer size:', qrBuffer.length);
            } else {
              throw new Error(`Failed to download QR code: ${qrResponse.status}`);
            }
          }
          
          if (qrBuffer) {
            
            // Create gift card overlay SVG with QR code, logo, and info
            let storeLogo = '';
            if (giftCardData.storeLogo) {
              try {
                if (giftCardData.storeLogo.startsWith('data:')) {
                  // Already a base64 data URL
                  storeLogo = giftCardData.storeLogo;
                  console.log('[generate-print-jpegs] Store logo is already base64 encoded');
                } else {
                  // Handle HTTP URL
                  const logoResponse = await fetch(giftCardData.storeLogo);
                  if (logoResponse.ok) {
                    const logoBuffer = await logoResponse.buffer();
                    const logoBase64 = logoBuffer.toString('base64');
                    const logoMimeType = giftCardData.storeLogo.includes('.png') ? 'image/png' : 'image/jpeg';
                    storeLogo = `data:${logoMimeType};base64,${logoBase64}`;
                    console.log('[generate-print-jpegs] Store logo downloaded and encoded');
                  }
                }
              } catch (logoError) {
                console.warn('[generate-print-jpegs] Failed to process store logo:', logoError);
              }
            }
            
            // Convert QR code to base64 for SVG embedding
            const qrBase64 = qrBuffer.toString('base64');
            
            // Create comprehensive gift card overlay SVG
            const giftCardOverlaySvg = `
              <svg width="500" height="300" xmlns="http://www.w3.org/2000/svg">
                <!-- Background with rounded corners and shadow -->
                <defs>
                  <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
                    <feDropShadow dx="0" dy="4" stdDeviation="8" flood-color="rgba(0,0,0,0.15)"/>
                  </filter>
                </defs>
                
                <rect x="10" y="10" width="480" height="280" rx="20" ry="20" 
                      fill="rgba(255,255,255,0.95)" stroke="rgba(0,0,0,0.1)" 
                      stroke-width="1" filter="url(#shadow)"/>
                
                <!-- QR Code -->
                <image x="30" y="30" width="120" height="120" 
                       href="data:${qrMimeType};base64,${qrBase64}"/>
                
                <!-- Store Logo (if available) -->
                ${storeLogo ? `<image x="170" y="40" width="60" height="60" href="${storeLogo}" preserveAspectRatio="xMidYMid meet"/>` : ''}
                
                <!-- Store Name -->
                <text x="${storeLogo ? '250' : '170'}" y="60" font-family="Arial, sans-serif" 
                      font-size="24" font-weight="bold" fill="#1a202c">
                  ${giftCardData.storeName || 'Gift Card'}
                </text>
                
                <!-- Amount -->
                <text x="${storeLogo ? '250' : '170'}" y="90" font-family="Arial, sans-serif" 
                      font-size="20" font-weight="600" fill="#2d3748">
                  $${giftCardData.amount || '0'}
                </text>
                
                <!-- Instructions -->
                <text x="30" y="180" font-family="Arial, sans-serif" 
                      font-size="14" fill="#4a5568">
                  Scan QR code to redeem this gift card
                </text>
                
                <!-- Decorative border -->
                <rect x="10" y="10" width="480" height="280" rx="20" ry="20" 
                      fill="none" stroke="rgba(99,102,241,0.3)" stroke-width="2"/>
              </svg>
            `;
            
            const giftCardOverlayBuffer = Buffer.from(giftCardOverlaySvg);
            
            // Position the gift card overlay on the bottom right of the right page (image2)
            const overlayTop = 1800; // Higher up from bottom for better visibility
            const overlayLeft = 2200; // Right side of right panel
            
            compositeElements.push({
              input: giftCardOverlayBuffer,
              top: overlayTop,
              left: overlayLeft
            });
            
            console.log(`[generate-print-jpegs] Gift card overlay positioned at top: ${overlayTop}, left: ${overlayLeft}`);
            console.log('[generate-print-jpegs] Gift card overlay with QR code and logo added successfully to print JPEG');
          }
        } catch (giftCardError) {
          console.error('[generate-print-jpegs] Failed to add gift card overlay to print version:', giftCardError);
          console.error('[generate-print-jpegs] Gift card error details:', giftCardError.message, giftCardError.stack);
        }
      } else {
        console.log('[generate-print-jpegs] No gift card data provided or QR code missing');
        console.log('[generate-print-jpegs] Gift card data received:', giftCardData);
      }
      
      // Add timestamp overlay to the print
      try {
        const timestampSvg = `
          <svg width="400" height="30" xmlns="http://www.w3.org/2000/svg">
            <rect width="400" height="30" fill="rgba(255,255,255,0.8)" rx="5"/>
            <text x="10" y="20" font-family="Arial, sans-serif" font-size="14" fill="#333">
              Printed: ${printTimestamp}
            </text>
          </svg>
        `;
        
        const timestampBuffer = Buffer.from(timestampSvg);
        
        // Add timestamp to bottom right of the right page (image2)
        compositeElements.push({
          input: timestampBuffer,
          top: 2500, // Bottom of the page
          left: 2850  // Right side of right panel
        });
        
        console.log('[generate-print-jpegs] Timestamp added to print JPEG');
      } catch (timestampError) {
        console.warn('[generate-print-jpegs] Failed to add timestamp:', timestampError);
      }

      await sharp({
        create: {
          width: 3300, // 11 inches * 300 DPI
          height: 2550, // 8.5 inches * 300 DPI
          channels: 4,
          background: { r: 255, g: 255, b: 255, alpha: 1 },
        },
      })
        .composite(compositeElements)
        .jpeg({ quality: 90 })
        .toFile(jpeg2Path);

      // Clean up temporary files
      [tempImage1, tempImage2, tempImage3, tempImage4].forEach(tempPath => {
        if (fs.existsSync(tempPath)) {
          fs.unlinkSync(tempPath);
        }
      });

      // Return download URLs
      const baseUrl = getBaseUrl();
      const jpeg1Url = `${baseUrl}/downloads/print-jpegs/${cardId}_print_1.jpg`;
      const jpeg2Url = `${baseUrl}/downloads/print-jpegs/${cardId}_print_2.jpg`;

      console.log('[generate-print-jpegs] Successfully created JPEG files:', { jpeg1Url, jpeg2Url });

      return res.json({
        success: true,
        message: 'Print JPEG files generated successfully',
        files: {
          jpeg1: jpeg1Url,
          jpeg2: jpeg2Url
        }
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
      const designsService = new SavedDesignsService();
      const designs = await designsService.getPublishedDesigns();

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
