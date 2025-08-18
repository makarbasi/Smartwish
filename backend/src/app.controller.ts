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
import fetch from 'node-fetch';
import { Express } from 'express';
// @ts-ignore
import { getPrinters } from 'pdf-to-printer';
import { SharingService } from './sharing/sharing.service';
import { SupabaseStorageService } from './saved-designs/supabase-storage.service';
import { SavedDesignsService } from './saved-designs/saved-designs.service';

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

      if (!image || !prompt) {
        return res
          .status(400)
          .json({ message: 'Image and prompt are required' });
      }

      const base64Image = image.buffer.toString('base64');
      const parts: any[] = [
        {
          inline_data: {
            mime_type: 'image/png',
            data: base64Image,
          },
        },
        {
          text: prompt,
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
        },
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${process.env.GEMINI_API_KEY}`,
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
        const modifiedImage = Buffer.from(
          partWithImage.inlineData.data,
          'base64',
        );
        const filename = `gemini-${Date.now()}.png`;
        const filePath = path.join(downloadsDir, filename);
        fs.writeFileSync(filePath, modifiedImage);

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

      // Use centralized template system
      const { getAllTemplates } = await import(
        '../../shared/constants/templates'
      );
      const templates = getAllTemplates();

      console.log('[search-templates] Loaded templates count:', templates.length);

      // Convert templates to the format expected by the search algorithm
      const templatesData: Record<string, any> = {};
      templates.forEach((template: any) => {
        templatesData[template.id] = {
          title: template.title,
          text: `${template.description} ${template.searchKeywords.join(', ')}`,
          category: template.category,
        };
      });

      // Prepare the prompt for Gemini
      const templateDescriptions = Object.entries(templatesData)
        .map(([key, template]: [string, any]) => `${key}: ${template.text}`)
        .join('\n');

      console.log('[search-templates] Prompt size (chars):', templateDescriptions.length);

      const prompt = `Given the user's search query: "${query}"

And these template descriptions:
${templateDescriptions}

Please analyze which templates are most relevant to the user's search query. Consider the theme, occasion, and content of each template.

Return ONLY a JSON array of template IDs that are most relevant to the search query. 
Do not include any other text, just the JSON array.

Focus on templates that match the user's intent, occasion, or theme they're looking for.`;

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
          temperature: 0.1,
          top_p: 0.8,
          top_k: 40,
          max_output_tokens: 1024,
        },
      };

      if (!process.env.GEMINI_API_KEY) {
        console.warn('[search-templates] GEMINI_API_KEY not set. This endpoint requires Gemini.');
      }

      const startedAt = Date.now();
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        },
      );
      const durationMs = Date.now() - startedAt;
      console.log(`[search-templates] Gemini HTTP status: ${response.status} ${response.statusText} in ${durationMs}ms`);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('[search-templates] Gemini API Error:', errorText);
        return res
          .status(500)
          .json({ message: 'Gemini API failed', error: errorText });
      }

      const data = await response.json();
      const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!responseText) {
        return res.status(500).json({ message: 'No response from Gemini API' });
      }

      // Parse the JSON response from Gemini
      let relevantTemplates;
      try {
        // Clean the response text to extract just the JSON array
        const jsonMatch = responseText.match(/\[.*\]/);
        if (jsonMatch) {
          relevantTemplates = JSON.parse(jsonMatch[0]);
        } else {
          relevantTemplates = [];
        }
        console.log('[search-templates] Parsed template IDs count:', Array.isArray(relevantTemplates) ? relevantTemplates.length : 0);
        if (Array.isArray(relevantTemplates)) {
          console.log('[search-templates] Parsed IDs sample:', relevantTemplates.slice(0, 5));
        }
      } catch (error) {
        console.error('[search-templates] Error parsing Gemini response:', error);
        relevantTemplates = [];
      }

      // Filter templates to only include valid ones
      const validTemplates = relevantTemplates.filter(
        (templateKey: string) =>
          templatesData[templateKey] &&
          Object.keys(templatesData).includes(templateKey),
      );

      // Return the relevant templates with their data
      const results = validTemplates.map((templateKey: string) => ({
        key: templateKey,
        ...templatesData[templateKey],
      }));

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

      console.log('[search-designs] Loaded published designs count:', designs?.length || 0);

      if (!designs || designs.length === 0) {
        return res.json({ query, results: [], totalFound: 0, resultType: 'design' });
      }

      // Build map for AI prompt and quick lookup
      const designsData: Record<string, any> = {};
      designs.forEach((d: any) => {
        const keywords = Array.isArray(d.searchKeywords) ? d.searchKeywords.join(', ') : '';
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
          console.warn('[search-designs] GEMINI_API_KEY not set. Skipping Gemini and using fallback.');
          return [];
        }
        console.log('[search-designs] Using Gemini for semantic ranking...');
        console.log('[search-designs] Prompt size (chars):', allDescriptions.length);
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
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
          },
        );
        const durationMs = Date.now() - startedAt;
        console.log(`[search-designs] Gemini HTTP status: ${response.status} ${response.statusText} in ${durationMs}ms`);

        if (!response.ok) {
          const errorText = await response.text();
          console.warn('[search-designs] Gemini error:', errorText);
          return [];
        }

        const data = await response.json();
        const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
        if (!responseText) return [];
        try {
          const jsonMatch = responseText.match(/\[.*\]/);
          if (!jsonMatch) return [];
          const arr = JSON.parse(jsonMatch[0]);
          console.log('[search-designs] Parsed design IDs count:', Array.isArray(arr) ? arr.length : 0);
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
        console.log('[search-designs] Using simple keyword ranking fallback...');
        // Tokenize query
        const q = (query as string).toLowerCase();
        const tokens = q.split(/[^a-z0-9]+/).filter(Boolean);
        const uniqueTokens = Array.from(new Set(tokens));
        console.log('[search-designs] Query tokens:', uniqueTokens);

        const scoreById: Record<string, number> = {};
        Object.entries(designsData).forEach(([id, d]) => {
          const hay = `${d.title} ${d.description} ${d.category} ${(d.author || '')}`.toLowerCase();
          let score = 0;
          for (const t of uniqueTokens) {
            if (!t) continue;
            const occurrences = hay.split(t).length - 1;
            if (occurrences > 0) score += 2 * occurrences; // title/desc/category matches

            // keywords boost
            const keywords = Array.isArray(designs.find(dd => dd.id === id)?.searchKeywords)
              ? (designs.find(dd => dd.id === id)!.searchKeywords as string[])
              : [];
            if (keywords.some(k => (k || '').toLowerCase() === t)) score += 3;
            if (keywords.some(k => (k || '').toLowerCase().includes(t))) score += 1;
          }
          // Simple occasion heuristics
          if ((d.category || '').toLowerCase().includes('birthday') && q.includes('birthday')) score += 2;
          if ((d.category || '').toLowerCase().includes('wedding') && q.includes('wedding')) score += 2;
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
      } catch {}
      const usedGemini = Array.isArray(geminiIds) && geminiIds.length > 0 && !!process.env.GEMINI_API_KEY;
      rankedIds = usedGemini ? geminiIds : simpleRank();

      const results = rankedIds
        .filter((id) => designsData[id])
        .map((id) => ({
          ...designsData[id],
        }));

      console.log('[search-designs] Returning results:', { count: results.length, usedGemini });

      return res.json({
        query,
        results,
        totalFound: results.length,
        resultType: 'design',
        usedGemini,
      });
    } catch (error) {
      console.error('[search-designs] Error:', error);
      return res
        .status(500)
        .json({ message: 'Internal server error', error: (error as any).message });
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
