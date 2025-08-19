import express from "express";
import fetch from "node-fetch"; // Ensure you have node-fetch installed
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import cors from "cors";
import OpenAI from 'openai';
import dotenv from 'dotenv';
import multer from "multer";
import FormData from 'form-data';
import { PDFDocument, rgb } from 'pdf-lib';
import pdfPrinter from 'pdf-to-printer';
const { print, getPrinters } = pdfPrinter;
import { promises as fsp } from 'fs';
import sharp from 'sharp';
import { GoogleGenerativeAI } from "@google/generative-ai";

import { main, getPrintJobStatus } from './print-card.js';

// Configure multer to store files in memory
const storage = multer.memoryStorage();
const upload = multer({ storage });

dotenv.config();

const app = express();
const openai = new OpenAI({ apiKey: 'sk-proj-NvIhErDqtvUVWbPDmiGST3BlbkFJhIT57Yke5MxeGJE2Ra2P' });

// Define port
const PORT = process.env.PORT || 5000;

// Define __dirname for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use('/images', express.static(path.join(__dirname, 'public', 'images')));

// Serve static files based on environment
const isDevelopment = process.env.NODE_ENV !== 'production';
if (isDevelopment) {
  // In development, serve the React dev server
  console.log('Running in development mode - React dev server should be running on port 5173');
} else {
  // In production, serve the built React app
  app.use(express.static(path.join(__dirname, 'build')));
}

// Ensure "downloads" folder exists
const downloadsDir = path.join(__dirname, "downloads");
if (!fs.existsSync(downloadsDir)) {
  try {
    fs.mkdirSync(downloadsDir, { recursive: true });
    console.log("Created downloads directory");
  } catch (error) {
    console.error("Error creating downloads directory:", error);
  }
}

// Ensure "flipbook" subfolder exists
const flipbookDir = path.join(downloadsDir, "flipbook");
if (!fs.existsSync(flipbookDir)) {
  try {
    fs.mkdirSync(flipbookDir, { recursive: true });
    console.log("Created flipbook directory");
  } catch (error) {
    console.error("Error creating flipbook directory:", error);
  }
}

// Ensure "media" subfolder exists
const mediaDir = path.join(downloadsDir, "media");
if (!fs.existsSync(mediaDir)) {
  try {
    fs.mkdirSync(mediaDir, { recursive: true });
    console.log("Created media directory");
  } catch (error) {
    console.error("Error creating media directory:", error);
  }
}

app.use('/downloads', express.static(path.join(__dirname, 'downloads')));

// Utility function to get base URL based on environment
const getBaseUrl = () => {
  // Check if we're in development mode
  const isDevelopment = process.env.NODE_ENV === 'development' ||
                       process.env.NODE_ENV !== 'production';

  let baseUrl;
  if (isDevelopment) {
    baseUrl = `http://localhost:${process.env.PORT || 5000}`;
  } else {
    // Check if we're on Render.com
    if (process.env.RENDER || process.env.RENDER_SERVICE_NAME) {
      baseUrl = `https://${process.env.RENDER_EXTERNAL_HOSTNAME || 'smartwish.onrender.com'}`;
    } else {
      baseUrl = process.env.PRODUCTION_URL || 'https://app.smartwish.us';
    }
  }

  console.log('Server environment detection:', {
    NODE_ENV: process.env.NODE_ENV,
    PORT: process.env.PORT,
    RENDER: process.env.RENDER,
    RENDER_EXTERNAL_HOSTNAME: process.env.RENDER_EXTERNAL_HOSTNAME,
    isDevelopment,
    baseUrl
  });

  return baseUrl;
};

app.get('/api/print-status', (req, res) => {
  res.json({ status: getPrintJobStatus() });
});
// Save image endpoint
app.post("/save-image", async (req, res) => {
  try {
    const { imageUrl } = req.body;
    if (!imageUrl) {
      return res.status(400).json({ message: "Image URL is required" });
    }

    console.log("Received URL:", imageUrl);

    // Extract file name from the URL
    const fileName = `image-${Date.now()}.png`;
    const filePath = path.join(downloadsDir, fileName);

    // Download the image
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image. Status: ${response.status}`);
    }

    const buffer = await response.buffer();
    fs.writeFileSync(filePath, buffer);

    console.log("Image saved at:", filePath);
    res.json({ message: "Image saved successfully", filePath });
  } catch (error) {
    console.error("Error downloading image:", error);
    res.status(500).json({ message: "Failed to download image" });
  }
});

app.get("/proxy", async (req, res) => {
  const imageUrl = req.query.url;

  console.log("Proxy request details:", {
    imageUrl,
    baseUrl: getBaseUrl(),
    hostname: req.hostname,
    headers: req.headers,
    query: req.query
  });

  if (!imageUrl) {
      return res.status(400).json({ error: "Image URL is required" });
  }

  try {
      const response = await fetch(imageUrl);

      if (!response.ok) {
          console.error(`Failed to fetch image: ${response.status} ${response.statusText}`);
          throw new Error(`Failed to fetch image: ${response.statusText}`);
      }

      const contentType = response.headers.get("content-type");
      res.setHeader("Content-Type", contentType);

      // Add CORS headers for cross-origin requests
      res.setHeader("Access-Control-Allow-Origin", "*");
      res.setHeader("Access-Control-Allow-Methods", "GET");
      res.setHeader("Access-Control-Allow-Headers", "Content-Type");

      response.body.pipe(res);
  } catch (error) {
      console.error("Error fetching image:", error.message);
      res.status(500).json({ error: "Failed to fetch image through proxy", details: error.message });
  }
});


app.post('/openai-edit', upload.fields([{ name: 'image' }, { name: 'mask' }]), async (req, res) => {
  const { prompt } = req.body;
  const image = req.files?.image?.[0];
  const mask = req.files?.mask?.[0];

  if (!prompt || !image) {
    return res.status(400).json({ error: 'Missing prompt or image' });
  }

  const form = new FormData();
  form.append('prompt', prompt);
  form.append('n', '1');
  form.append('size', '1024x1024');
  form.append('image', image.buffer, { filename: 'image.png' });

  if (mask) {
    form.append('mask', mask.buffer, { filename: 'mask.png' });
  }

  try {
    const response = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
        ...form.getHeaders(),
      },
      body: form,
    });

    const data = await response.json();

    if (response.ok && data?.data?.[0]?.url) {
      res.json({ url: data.data[0].url });
    } else {
      console.error('OpenAI Error:', data);
      res.status(500).json({ error: data.error || 'Unknown error' });
    }
  } catch (err) {
    console.error('Server Error:', err);
    res.status(500).json({ error: 'Failed to reach OpenAI' });
  }
});


app.post("/gemini-inpaint", upload.fields([{ name: "image" }, { name: "extraImage" }]), async (req, res) => {
  try {
    const image = req.files?.image?.[0];
    const extraImage = req.files?.extraImage?.[0];
    const prompt = req.body.prompt;

    if (!image || !prompt) {
      return res.status(400).json({ message: "Image and prompt are required" });
    }

    const base64Image = image.buffer.toString("base64");
    const parts = [
      {
        inline_data: {
          mime_type: "image/png",
          data: base64Image,
        },
      },
      {
        text: prompt,
      },
    ];

    if (extraImage) {
      const base64Extra = extraImage.buffer.toString("base64");
      parts.push({
        inline_data: {
          mime_type: "image/png",
          data: base64Extra,
        },
      });
    }

    const payload = {
      contents: [
        {
          role: "user",
          parts,
        },
      ],
      generation_config: {
        response_modalities: ["image", "text"],
        response_mime_type: "text/plain",
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", errorText);
      return res.status(500).json({ message: "Gemini API failed", error: errorText });
    }

    const data = await response.json();

    const partWithImage = data?.candidates?.[0]?.content?.parts?.find(p => p.inlineData);

    if (partWithImage) {
      const modifiedImage = Buffer.from(partWithImage.inlineData.data, "base64");
      const filename = `gemini-${Date.now()}.png`;
      const filePath = path.join(downloadsDir, filename);
      fs.writeFileSync(filePath, modifiedImage);

      return res.json({
        imageUrl:`${getBaseUrl()}/downloads/${filename}`,
      });
    } else {
      const fallbackText = data?.candidates?.[0]?.content?.parts?.find(p => p.text)?.text;
      console.error("No image returned from Gemini", fallbackText || data);
      return res.status(500).json({
        message: "No image returned from Gemini",
        details: fallbackText || data,
      });
    }
  } catch (error) {
    console.error("Gemini inpaint route error:", error);
    return res.status(500).json({ message: "Internal server error", error });
  }
});

app.post("/save-images", async (req, res) => {
  try {
    const { images } = req.body;

    if (!Array.isArray(images) || images.length === 0) {
      console.error("No images provided in request");
      return res.status(400).json({ message: "No images provided" });
    }

    console.log(`Attempting to save ${images.length} images`);

    // Create a unique folder for this set of images
    const timestamp = Date.now();
    const saveDir = path.join(__dirname, "downloads", "flipbook", timestamp.toString());
    console.log(`Save directory path: ${saveDir}`);

    try {
      if (!fs.existsSync(saveDir)) {
        console.log("Creating save directory");
        fs.mkdirSync(saveDir, { recursive: true });
      }
    } catch (mkdirError) {
      console.error("Error creating directory:", mkdirError);
      return res.status(500).json({ message: "Failed to create save directory" });
    }

    const savedFiles = [];
    for (let i = 0; i < images.length; i++) {
      try {
        const img = images[i];
        const ext = '.png';
        const filename = `page_${i + 1}${ext}`;
        const filePath = path.join(saveDir, filename);
        console.log(`Processing image ${i + 1} to ${filePath}`);

        if (img.startsWith("data:image/")) {
          // Base64 image
          const base64Data = img.replace(/^data:image\/\w+;base64,/, "");
          const buffer = Buffer.from(base64Data, "base64");
          fs.writeFileSync(filePath, buffer);
          savedFiles.push({
            filename: filename,
            url: `/downloads/flipbook/${timestamp}/${filename}`
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
      console.error("No files were saved successfully");
      return res.status(500).json({ message: "Failed to save any images" });
    }

    console.log(`Successfully saved ${savedFiles.length} images`);
    res.json({ 
      message: "Flipbook images saved successfully",
      timestamp: timestamp,
      files: savedFiles
    });
  } catch (err) {
    console.error("Save images error:", err);
    res.status(500).json({ 
      message: "Failed to save flipbook images",
      error: err.message 
    });
  }
});

// Add endpoint to load saved images
app.get('/load-images/:timestamp', (req, res) => {
  try {
    const timestamp = req.params.timestamp;
    const dirPath = path.join(__dirname, 'downloads', 'flipbook', timestamp);
    
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ message: 'Directory not found' });
    }

    const files = fs.readdirSync(dirPath)
      .filter(file => file.startsWith('page_') && file.endsWith('.png'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/page_(\d+)/)[1]);
        const numB = parseInt(b.match(/page_(\d+)/)[1]);
        return numA - numB;
      })
      .map(filename => ({
        filename: filename,
        url: `/downloads/flipbook/${timestamp}/${filename}`
      }));

    res.json({ files });
  } catch (error) {
    console.error('Error loading images:', error);
    res.status(500).json({ message: 'Failed to load images' });
  }
});

// Add this endpoint to list files in a directory
app.get('/downloads/flipbook/:timestamp', (req, res) => {
  try {
    const timestamp = req.params.timestamp;
    const dirPath = path.join(__dirname, 'downloads', 'flipbook', timestamp);
    
    if (!fs.existsSync(dirPath)) {
      return res.status(404).json({ message: 'Directory not found' });
    }

    const files = fs.readdirSync(dirPath)
      .filter(file => file.startsWith('page_') && file.endsWith('.png'))
      .sort((a, b) => {
        const numA = parseInt(a.match(/page_(\d+)/)[1]);
        const numB = parseInt(b.match(/page_(\d+)/)[1]);
        return numA - numB;
      });

    // Set content type to JSON
    res.setHeader('Content-Type', 'application/json');
    res.json(files);
  } catch (error) {
    console.error('Error listing directory:', error);
    res.status(500).json({ message: 'Failed to list directory contents' });
  }
});

// Add a specific route for serving the images
app.get('/downloads/flipbook/:timestamp/:filename', (req, res) => {
  try {
    const { timestamp, filename } = req.params;
    const filePath = path.join(__dirname, 'downloads', 'flipbook', timestamp, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }

    // Set content type to image/png
    res.setHeader('Content-Type', 'image/png');
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ message: 'Failed to serve file' });
  }
});

// Add endpoint to handle media uploads
app.post('/upload-media', upload.single('media'), async (req, res) => {
  try {
    console.log('Media upload request received');
    console.log('Request body:', req.body);
    console.log('Request file:', req.file);
    
    const { qrCode } = req.body;
    const mediaFile = req.file;

    if (!mediaFile || !qrCode) {
      console.error('Missing required fields:', { mediaFile: !!mediaFile, qrCode: !!qrCode });
      return res.status(400).json({ message: 'Media file and QR code are required' });
    }

    // Extract timestamp and unique ID from QR code URL
    let timestampAndId;
    if (qrCode.includes('/add-media/')) {
      // Full URL format: ${getBaseUrl()}/add-media/timestamp-uniqueId (or localhost in dev)
      timestampAndId = qrCode.split('/add-media/')[1];
    } else {
      // Direct format: timestamp-uniqueId
      timestampAndId = qrCode;
    }

    if (!timestampAndId) {
      console.error('Invalid QR code format:', qrCode);
      return res.status(400).json({ message: 'Invalid QR code format' });
    }

    const [timestamp, uniqueId] = timestampAndId.split('-');

    console.log('QR Code parts:', { qrCode, timestampAndId, timestamp, uniqueId });

    // Create media directory for this QR code
    const mediaDir = path.join(__dirname, 'downloads', 'media', timestampAndId);
    console.log('Creating media directory:', mediaDir);
    
    if (!fs.existsSync(mediaDir)) {
      fs.mkdirSync(mediaDir, { recursive: true });
      console.log('Media directory created successfully');
    }

    // Generate unique filename for the media
    const fileExtension = path.extname(mediaFile.originalname) || '.bin';
    const mediaFilename = `media-${Date.now()}${fileExtension}`;
    const mediaPath = path.join(mediaDir, mediaFilename);

    console.log('Saving media file:', { mediaFilename, mediaPath, fileSize: mediaFile.size });

    // Save the media file
    fs.writeFileSync(mediaPath, mediaFile.buffer);

    console.log(`Media saved successfully: ${mediaPath}`);

    res.json({
      message: 'Media uploaded successfully',
      filename: mediaFilename,
      url: `/downloads/media/${timestampAndId}/${mediaFilename}`,
      qrCode: qrCode
    });

  } catch (error) {
    console.error('Error uploading media:', error);
    res.status(500).json({ message: 'Failed to upload media', error: error.message });
  }
});

// Add endpoint to serve uploaded media
app.get('/downloads/media/:timestampAndId/:filename', (req, res) => {
  try {
    const { timestampAndId, filename } = req.params;
    const filePath = path.join(__dirname, 'downloads', 'media', timestampAndId, filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'Media file not found' });
    }

    // Determine content type based on file extension
    const ext = path.extname(filename).toLowerCase();
    let contentType = 'application/octet-stream';
    
    if (ext.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
      contentType = `image/${ext.slice(1)}`;
    } else if (ext.match(/\.(mp4|webm|avi|mov)$/)) {
      contentType = `video/${ext.slice(1)}`;
    } else if (ext.match(/\.(mp3|wav|ogg|m4a)$/)) {
      contentType = `audio/${ext.slice(1)}`;
    }

    res.setHeader('Content-Type', contentType);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error serving media file:', error);
    res.status(500).json({ message: 'Failed to serve media file' });
  }
});

// Add endpoint to validate media QR code and get existing media info
app.get('/validate-media-qr/:timestampAndId', (req, res) => {
  try {
    const { timestampAndId } = req.params;
    const mediaDir = path.join(__dirname, 'downloads', 'media', timestampAndId);
    
    if (!fs.existsSync(mediaDir)) {
      return res.json({
        valid: true,
        exists: false,
        mediaCount: 0,
        message: 'QR code is valid but no media has been uploaded yet'
      });
    }

    // Get all media files in the directory
    const files = fs.readdirSync(mediaDir)
      .filter(file => !file.startsWith('.'))
      .map(filename => {
        const filePath = path.join(mediaDir, filename);
        const stats = fs.statSync(filePath);
        const ext = path.extname(filename).toLowerCase();
        
        let mediaType = 'unknown';
        if (ext.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          mediaType = 'image';
        } else if (ext.match(/\.(mp4|webm|avi|mov)$/)) {
          mediaType = 'video';
        } else if (ext.match(/\.(mp3|wav|ogg|m4a)$/)) {
          mediaType = 'audio';
        }

        return {
          filename,
          url: `/downloads/media/${timestampAndId}/${filename}`,
          type: mediaType,
          size: stats.size,
          date: stats.mtime
        };
      })
      .sort((a, b) => b.date - a.date); // Sort by date, newest first

    res.json({
      valid: true,
      exists: true,
      mediaCount: files.length,
      media: files,
      message: `Found ${files.length} media file(s)`
    });

  } catch (error) {
    console.error('Error validating media QR code:', error);
    res.status(500).json({ 
      valid: false, 
      error: 'Failed to validate media QR code',
      message: error.message 
    });
  }
});

// Add endpoint to serve media viewer page
app.get('/add-media/:timestampAndId', (req, res) => {
  try {
    const { timestampAndId } = req.params;
    const mediaDir = path.join(__dirname, 'downloads', 'media', timestampAndId);
    
    if (!fs.existsSync(mediaDir)) {
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Media Not Found</title>
          <meta name="viewport" content="width=device-width, initial-scale=1">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
            .container { max-width: 600px; margin: 0 auto; }
            .error { color: #d32f2f; }
          </style>
        </head>
        <body>
          <div class="container">
            <h1 class="error">Media Not Found</h1>
            <p>No media has been uploaded for this QR code yet.</p>
          </div>
        </body>
        </html>
      `);
    }

    // Get all media files in the directory
    const files = fs.readdirSync(mediaDir)
      .filter(file => !file.startsWith('.'))
      .map(filename => {
        const filePath = path.join(mediaDir, filename);
        const stats = fs.statSync(filePath);
        const ext = path.extname(filename).toLowerCase();
        
        let mediaType = 'unknown';
        if (ext.match(/\.(jpg|jpeg|png|gif|webp)$/)) {
          mediaType = 'image';
        } else if (ext.match(/\.(mp4|webm|avi|mov)$/)) {
          mediaType = 'video';
        } else if (ext.match(/\.(mp3|wav|ogg|m4a)$/)) {
          mediaType = 'audio';
        }

        return {
          filename,
          url: `/downloads/media/${timestampAndId}/${filename}`,
          type: mediaType,
          size: stats.size,
          date: stats.mtime
        };
      })
      .sort((a, b) => b.date - a.date); // Sort by date, newest first

    // Generate HTML page
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <title>Media Viewer</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            padding: 20px;
            background-color: #f5f5f5;
          }
          .container {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            border-radius: 10px;
            padding: 20px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.1);
          }
          h1 {
            text-align: center;
            color: #333;
            margin-bottom: 30px;
          }
          .media-item {
            margin-bottom: 30px;
            padding: 15px;
            border: 1px solid #ddd;
            border-radius: 8px;
            background: #fafafa;
          }
          .media-item h3 {
            margin: 0 0 10px 0;
            color: #555;
          }
          .media-item img {
            max-width: 100%;
            height: auto;
            border-radius: 5px;
          }
          .media-item video {
            max-width: 100%;
            height: auto;
            border-radius: 5px;
          }
          .media-item audio {
            width: 100%;
            margin-top: 10px;
          }
          .media-info {
            font-size: 12px;
            color: #666;
            margin-top: 10px;
          }
          .no-media {
            text-align: center;
            color: #666;
            font-style: italic;
          }
          .controls {
            text-align: center;
            margin-bottom: 20px;
          }
          .play-all-btn {
            background: #4CAF50;
            color: white;
            border: none;
            padding: 10px 20px;
            border-radius: 5px;
            cursor: pointer;
            font-size: 16px;
          }
          .play-all-btn:hover {
            background: #45a049;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>📱 Media Viewer</h1>
          ${files.length > 0 ? `
            <div class="controls">
              <button class="play-all-btn" onclick="playAllMedia()">▶️ Play All Media</button>
            </div>
            ${files.map((file, index) => `
              <div class="media-item">
                <h3>${file.filename}</h3>
                ${file.type === 'image' ? 
                  `<img src="${file.url}" alt="${file.filename}" onclick="openFullscreen(this)">` :
                  file.type === 'video' ? 
                  `<video controls preload="metadata">
                    <source src="${file.url}" type="video/${file.filename.split('.').pop()}">
                    Your browser does not support the video tag.
                  </video>` :
                  file.type === 'audio' ? 
                  `<audio controls preload="metadata">
                    <source src="${file.url}" type="audio/${file.filename.split('.').pop()}">
                    Your browser does not support the audio tag.
                  </audio>` :
                  `<p>Unsupported file type: ${file.filename}</p>`
                }
                <div class="media-info">
                  Type: ${file.type} | Size: ${(file.size / 1024 / 1024).toFixed(2)} MB | 
                  Date: ${file.date.toLocaleString()}
                </div>
              </div>
            `).join('')}
          ` : `
            <div class="no-media">
              <p>No media files found.</p>
            </div>
          `}
        </div>

        <script>
          function playAllMedia() {
            const videos = document.querySelectorAll('video');
            const audios = document.querySelectorAll('audio');
            
            videos.forEach(video => {
              video.play().catch(e => console.log('Could not play video:', e));
            });
            
            audios.forEach(audio => {
              audio.play().catch(e => console.log('Could not play audio:', e));
            });
          }

          function openFullscreen(element) {
            if (element.requestFullscreen) {
              element.requestFullscreen();
            } else if (element.webkitRequestFullscreen) {
              element.webkitRequestFullscreen();
            } else if (element.msRequestFullscreen) {
              element.msRequestFullscreen();
            }
          }

          // Auto-play first media item on page load
          window.addEventListener('load', function() {
            const firstVideo = document.querySelector('video');
            const firstAudio = document.querySelector('audio');
            
            if (firstVideo) {
              firstVideo.play().catch(e => console.log('Could not auto-play video:', e));
            } else if (firstAudio) {
              firstAudio.play().catch(e => console.log('Could not auto-play audio:', e));
            }
          });
        </script>
      </body>
      </html>
    `;

    res.send(html);
  } catch (error) {
    console.error('Error serving media viewer:', error);
    res.status(500).send(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1">
        <style>
          body { font-family: Arial, sans-serif; text-align: center; padding: 20px; }
          .container { max-width: 600px; margin: 0 auto; }
          .error { color: #d32f2f; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1 class="error">Error</h1>
          <p>An error occurred while loading the media.</p>
        </div>
      </body>
      </html>
    `);
  }
});

// Get available printers endpoint
app.get("/get-printers", async (req, res) => {
  try {
    console.log("Getting available printers...");
    
    // Check if we're in a cloud environment
    const isCloudEnvironment = process.env.NODE_ENV === 'production' || 
                              process.env.RENDER || 
                              process.env.HEROKU ||
                              process.env.VERCEL;
    
    if (isCloudEnvironment) {
      // In cloud environment, return a message about local print agent
      console.log("Running in cloud environment - printer access not available");
      res.json({ 
        printers: [],
        message: "Printer access requires local print agent. Please run the local print agent on your computer to access printers.",
        requiresLocalAgent: true,
        localAgentUrl: "https://github.com/your-repo/local-print-agent"
      });
    } else {
      // In local environment, try to get actual printers
      const printers = await getPrinters();
      console.log("Available printers:", printers);
      res.json({ printers });
    }
  } catch (error) {
    console.error("Error getting printers:", error);
    res.status(500).json({ 
      message: "Failed to get printers", 
      error: error.message 
    });
  }
});

// PC Printing endpoint
app.post("/print-pc", async (req, res) => {
  try {
    const { images, printerName } = req.body;
    
    if (!images || !Array.isArray(images) || images.length === 0) {
      return res.status(400).json({ message: "Images array is required" });
    }

    if (!printerName) {
      return res.status(400).json({ message: "Printer name is required" });
    }

    console.log(`PC Print request received for ${images.length} images to printer: ${printerName}`);

    // Check if we're in a cloud environment
    const isCloudEnvironment = process.env.NODE_ENV === 'production' || 
                              process.env.RENDER || 
                              process.env.HEROKU ||
                              process.env.VERCEL;
    
    if (isCloudEnvironment) {
      // In cloud environment, queue the job for local print agent
      const jobId = `job_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Save images to flipbook directory with unique names for job tracking
      const savedPaths = [];
      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        // Use unique names for job tracking
        const fileName = `${jobId}_page_${i + 1}.png`;
        const filePath = path.join(flipbookDir, fileName);
        
        // Convert base64 to buffer and save
        const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
        const buffer = Buffer.from(base64Data, 'base64');
        fs.writeFileSync(filePath, buffer);
        savedPaths.push(filePath);
        
        console.log(`Saved page ${i + 1}: ${filePath}`);
      }

      // Create print job record
      const printJob = {
        id: jobId,
        printerName,
        imagePaths: savedPaths,
        status: 'pending',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Store job in memory (in production, use a database)
      if (!global.printJobQueue) {
        global.printJobQueue = [];
      }
      global.printJobQueue.push(printJob);

      console.log(`Print job ${jobId} queued for local print agent`);
      res.json({ 
        message: "Print job queued successfully. Please ensure your local print agent is running.",
        jobId,
        status: 'queued',
        requiresLocalAgent: true
      });
    } else {
      // In local environment, print directly
      // Save images to flipbook directory with correct names for print-card.js
      const savedPaths = [];
      for (let i = 0; i < images.length; i++) {
        const imageData = images[i];
        // Use the correct naming convention that print-card.js expects
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
      console.log("Starting print process...");
      await main(printerName);
      
      console.log("Print process completed");
      res.json({ 
        message: "Print job sent successfully",
        savedImages: savedPaths.length,
        printStatus: getPrintJobStatus()
      });
    }
    
  } catch (error) {
    console.error("Error in PC printing:", error);
    res.status(500).json({ 
      message: "Failed to print", 
      error: error.message,
      printStatus: getPrintJobStatus()
    });
  }
});

// Get print jobs endpoint (for local print agent)
app.get("/print-jobs", (req, res) => {
  try {
    const jobs = global.printJobQueue || [];
    res.json({ jobs });
  } catch (error) {
    console.error("Error getting print jobs:", error);
    res.status(500).json({ 
      message: "Failed to get print jobs", 
      error: error.message 
    });
  }
});

// Get specific print job endpoint
app.get("/print-jobs/:jobId", (req, res) => {
  try {
    const { jobId } = req.params;
    const jobs = global.printJobQueue || [];
    const job = jobs.find(j => j.id === jobId);
    
    if (!job) {
      return res.status(404).json({ message: "Print job not found" });
    }
    
    res.json({ job });
  } catch (error) {
    console.error("Error getting print job:", error);
    res.status(500).json({ 
      message: "Failed to get print job", 
      error: error.message 
    });
  }
});

// Update print job status endpoint
app.put("/print-jobs/:jobId/status", (req, res) => {
  try {
    const { jobId } = req.params;
    const { status, error } = req.body;
    
    if (!global.printJobQueue) {
      return res.status(404).json({ message: "No print jobs found" });
    }
    
    const jobIndex = global.printJobQueue.findIndex(j => j.id === jobId);
    if (jobIndex === -1) {
      return res.status(404).json({ message: "Print job not found" });
    }
    
    global.printJobQueue[jobIndex].status = status;
    global.printJobQueue[jobIndex].updatedAt = new Date().toISOString();
    if (error) {
      global.printJobQueue[jobIndex].error = error;
    }
    
    console.log(`Print job ${jobId} status updated to: ${status}`);
    res.json({ 
      success: true, 
      message: "Print job status updated successfully" 
    });
  } catch (error) {
    console.error("Error updating print job status:", error);
    res.status(500).json({ 
      message: "Failed to update print job status", 
      error: error.message 
    });
  }
});

// Catch-all route to serve React app
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'build', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
