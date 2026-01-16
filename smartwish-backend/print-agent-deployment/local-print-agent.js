/**
 * LOCAL PRINT AGENT
 * 
 * This script runs on your LOCAL computer to print jobs queued by the cloud server.
 * 
 * USAGE:
 *   1. Run this on the computer connected to your printer
 *   2. It polls the cloud server for pending print jobs
 *   3. When a job is found, it downloads the images, creates a PDF, and prints
 * 
 * SETUP:
 *   npm install pdf-to-printer pdf-lib sharp node-fetch
 *   node local-print-agent.js
 * 
 * CONFIGURATION:
 *   Set environment variables or modify the CONFIG object below
 */

import pdfPrinter from 'pdf-to-printer';
const print = pdfPrinter.print;
const getPrinters = pdfPrinter.getPrinters;

import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import ipp from 'ipp';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getSurveillanceManager } from './surveillance-manager.js';
import { DevicePairingServer, fetchKioskConfig } from './device-pairing.js';
import { PrinterStatusMonitor } from './printer-status-monitor.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// LOAD CONFIGURATION FROM FILE OR ENVIRONMENT
// =============================================================================

// Try to load config.json if it exists
let fileConfig = {};
const configPath = path.join(__dirname, 'config.json');
try {
  const configData = await fs.readFile(configPath, 'utf-8');
  fileConfig = JSON.parse(configData);
  console.log('📁 Loaded configuration from config.json');
} catch (err) {
  // Config file doesn't exist or is invalid, use defaults
  console.log('📁 No config.json found, using environment variables');
}

// =============================================================================
// CONFIGURATION - All settings from config.json (single source of truth)
// =============================================================================
const CONFIG = {
  // Cloud connections (external)
  cloudServerUrl: fileConfig.cloudServerUrl || 'https://smartwish.onrender.com',
  frontendUrl: fileConfig.frontendUrl || 'https://app.smartwish.us',

  // Printer settings
  defaultPrinter: fileConfig.defaultPrinter || '',

  // Polling settings
  pollInterval: fileConfig.pollInterval || 10000,
  rateLimitBackoff: 10000,

  // Local directories
  tempDir: path.join(__dirname, 'temp-print-jobs'),

  // Paper configuration
  dpi: 300,

  // Local service ports (these run on THIS machine, not cloud)
  localServices: {
    pairingPort: fileConfig.localServices?.pairingPort || 8766,
    surveillancePort: fileConfig.localServices?.surveillancePort || fileConfig.surveillance?.httpPort || 8765,
  },

  // Surveillance configuration
  surveillance: {
    enabled: fileConfig.surveillance?.enabled ?? false,
    kioskId: fileConfig.surveillance?.kioskId || 'default-kiosk',
    apiKey: fileConfig.surveillance?.apiKey || '',
    webcamIndex: fileConfig.surveillance?.webcamIndex ?? 0,
    httpPort: fileConfig.surveillance?.httpPort ?? 8765,
    showPreview: fileConfig.surveillance?.showPreview ?? false,
    pythonPath: fileConfig.surveillance?.pythonPath || 'python',
    dwellThresholdSeconds: fileConfig.surveillance?.dwellThresholdSeconds ?? 8,
    frameThreshold: fileConfig.surveillance?.frameThreshold ?? 10,
  },
};

// Paper size configurations
function getPaperConfig(paperSize = 'letter') {
  const DPI = CONFIG.dpi;

  if (paperSize === 'letter') {
    const LETTER_WIDTH = 11;
    const LETTER_HEIGHT = 8.5;
    return {
      name: 'Letter',
      paperWidthPx: Math.round(LETTER_WIDTH * DPI),
      paperHeightPx: Math.round(LETTER_HEIGHT * DPI),
      paperWidthPoints: LETTER_WIDTH * 72,
      paperHeightPoints: LETTER_HEIGHT * 72,
      panelWidthPx: Math.round((LETTER_WIDTH / 2) * DPI),
      panelHeightPx: Math.round(LETTER_HEIGHT * DPI),
    };
  } else if (paperSize === 'half-letter') {
    const HALF_LETTER_WIDTH = 8.5;
    const HALF_LETTER_HEIGHT = 5.5;
    return {
      name: 'Half Letter',
      paperWidthPx: Math.round(HALF_LETTER_WIDTH * DPI),
      paperHeightPx: Math.round(HALF_LETTER_HEIGHT * DPI),
      paperWidthPoints: HALF_LETTER_WIDTH * 72,
      paperHeightPoints: HALF_LETTER_HEIGHT * 72,
      panelWidthPx: Math.round((HALF_LETTER_WIDTH / 2) * DPI),
      panelHeightPx: Math.round(HALF_LETTER_HEIGHT * DPI),
    };
  } else {
    // Custom 8x6
    return {
      name: 'Custom 8×6',
      paperWidthPx: 8 * DPI,
      paperHeightPx: 6 * DPI,
      paperWidthPoints: 8 * 72,
      paperHeightPoints: 6 * 72,
      panelWidthPx: 4 * DPI,
      panelHeightPx: 6 * DPI,
    };
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

async function ensureTempDir() {
  try {
    await fs.mkdir(CONFIG.tempDir, { recursive: true });
  } catch (err) {
    // Directory might already exist
  }
}

async function downloadImage(url, savePath) {
  console.log(`  📥 Downloading: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(savePath, buffer);
  return savePath;
}

async function downloadPdf(url, savePath) {
  console.log(`  📥 Downloading PDF: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download PDF: ${response.status}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await fs.writeFile(savePath, buffer);
  return savePath;
}

async function createCompositeImage(outputPath, leftImgPath, rightImgPath, config) {
  const leftImage = await sharp(leftImgPath)
    .resize(config.panelWidthPx, config.panelHeightPx, { fit: 'fill' })
    .toBuffer();

  const rightImage = await sharp(rightImgPath)
    .resize(config.panelWidthPx, config.panelHeightPx, { fit: 'fill' })
    .toBuffer();

  await sharp({
    create: {
      width: config.paperWidthPx,
      height: config.paperHeightPx,
      channels: 4,
      background: { r: 255, g: 255, b: 255, alpha: 1 },
    },
  })
    .composite([
      { input: leftImage, top: 0, left: 0 },
      { input: rightImage, top: 0, left: config.panelWidthPx },
    ])
    .png()
    .toFile(outputPath);

  return outputPath;
}

async function createPdf(pdfPath, side1Path, side2Path, config) {
  const pdfDoc = await PDFDocument.create();

  const side1Bytes = await fs.readFile(side1Path);
  const side2Bytes = await fs.readFile(side2Path);

  const side1Image = await pdfDoc.embedPng(side1Bytes);
  const side2Image = await pdfDoc.embedPng(side2Bytes);

  const page1 = pdfDoc.addPage([config.paperWidthPoints, config.paperHeightPoints]);
  page1.drawImage(side1Image, { x: 0, y: 0, width: config.paperWidthPoints, height: config.paperHeightPoints });

  const page2 = pdfDoc.addPage([config.paperWidthPoints, config.paperHeightPoints]);
  page2.drawImage(side2Image, { x: 0, y: 0, width: config.paperWidthPoints, height: config.paperHeightPoints });

  const pdfBytes = await pdfDoc.save();
  await fs.writeFile(pdfPath, pdfBytes);

  return pdfPath;
}

/**
 * Get current print jobs from Windows print queue
 */
async function getWindowsPrintQueue(printerName) {
  try {
    // PowerShell command to get print jobs for the specific printer
    const cmd = `powershell -Command "Get-PrintJob -PrinterName '${printerName}' | Select-Object Id, JobStatus, DocumentName | ConvertTo-Json"`;
    const { stdout } = await execAsync(cmd);
    
    if (!stdout.trim()) {
      return []; // Empty queue
    }
    
    const jobs = JSON.parse(stdout);
    // Handle single job (PowerShell returns object, not array)
    return Array.isArray(jobs) ? jobs : [jobs];
  } catch (err) {
    // No jobs or printer not found
    return [];
  }
}

/**
 * Wait for print queue to be empty (job completed)
 */
async function waitForPrintComplete(printerName, timeoutMs = 60000) {
  const startTime = Date.now();
  const checkInterval = 1000; // Check every 1 second
  
  console.log(`  ⏳ Monitoring Windows print queue for completion...`);
  
  while (Date.now() - startTime < timeoutMs) {
    const jobs = await getWindowsPrintQueue(printerName);
    
    if (jobs.length === 0) {
      console.log(`  ✅ Windows print queue is empty - job completed!`);
      return true;
    }
    
    // Show current queue status
    const printing = jobs.filter(j => j.JobStatus === 'Printing').length;
    const spooling = jobs.filter(j => j.JobStatus === 'Spooling').length;
    const waiting = jobs.length - printing - spooling;
    
    if (printing > 0 || spooling > 0) {
      console.log(`  🖨️  Windows queue: ${jobs.length} job(s) - ${printing} printing, ${spooling} spooling`);
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  console.log(`  ⚠️ Timeout waiting for print queue - assuming completed`);
  return true; // Assume completed after timeout
}

async function printPdf(pdfPath, printerName) {
  console.log(`  🖨️ Printing to: ${printerName}`);
  console.log(`  📄 Settings: Letter, Landscape, Duplex (flip short edge), Color`);

  // Print options for pdf-to-printer (uses SumatraPDF on Windows)
  // https://github.com/artiebits/pdf-to-printer
  const printOptions = {
    printer: printerName,
    // Duplex options: 'simplex', 'duplex', 'duplexshort', 'duplexlong'
    // For landscape greeting cards: use 'duplexshort' (flip on short edge)
    side: 'duplexshort',
    // Scale: 'noscale', 'shrink', 'fit'
    scale: 'noscale',
    // Color printing (not monochrome)
    monochrome: false,
  };

  try {
    await print(pdfPath, printOptions);
    console.log('  ✅ Print job sent to Windows spooler');
  } catch (err) {
    console.warn('  ⚠️ Print with duplex options failed:', err.message);
    console.warn('  📝 Trying basic print...');
    // Fallback: try basic print (duplex should be set in printer defaults)
    await print(pdfPath, { printer: printerName });
    console.log('  ✅ Print job sent using printer defaults');
  }
  
  // NOW MONITOR WINDOWS PRINT QUEUE FOR REAL COMPLETION
  await waitForPrintComplete(printerName, 120000); // 2 minute timeout
}

// =============================================================================
// JOB PROCESSING
// =============================================================================

async function processJob(job) {
  const paperType = job.paperType || 'greeting-card';
  const isSticker = paperType === 'sticker';
  
  console.log(`\n📋 Processing job: ${job.id}`);
  console.log(`   Type: ${isSticker ? '🏷️  STICKER (IPP with printer IP)' : '💌 GREETING CARD (Windows printer name)'}`);
  console.log(`   Kiosk: ${job.kioskName || 'Unknown'}`);
  
  if (isSticker) {
    console.log(`   Printer IP: ${job.printerIP || '(not set - will use fallback)'}`);
  } else {
    console.log(`   Printer Name: ${job.printerName || '(not set - will use fallback)'}`);
  }
  
  console.log(`   PDF URL: ${job.pdfUrl ? 'Yes ✓' : 'No'}`);
  console.log(`   JPG URL: ${job.jpgUrl ? 'Yes ✓' : 'No'}`);

  const jobDir = path.join(CONFIG.tempDir, job.id);
  await fs.mkdir(jobDir, { recursive: true });

  try {
    // =========================================================================
    // STICKER PRINTING: Use JPG URL and print via IPP (requires printer IP)
    // =========================================================================
    if (job.jpgUrl && paperType === 'sticker') {
      console.log('  🖼️  Sticker printing via IPP protocol');

      const jpgPath = path.join(jobDir, 'stickers.jpg');
      await downloadImage(job.jpgUrl, jpgPath);
      console.log('  ✅ JPG downloaded successfully');

      // Get printer IP from job (set in /admin/kiosks) or use fallback
      const printerIP = job.printerIP || '192.168.1.239';
      const printerUrl = `http://${printerIP}:631/ipp/print`;

      console.log(`  📡 Printer IP: ${printerIP}${job.printerIP ? ' (from kiosk config)' : ' (fallback)'}`);
      console.log(`  📡 Printer URL: ${printerUrl}`);

      // Verify printer is reachable (optional check)
      try {
        const testUrl = `http://${printerIP}:631`;
        const testResponse = await fetch(testUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(3000) // 3 second timeout
        });
        console.log(`  ✅ Printer is reachable (HTTP ${testResponse.status})`);
      } catch (testErr) {
        console.warn(`  ⚠️  Could not verify printer reachability: ${testErr.message}`);
        console.warn(`  ⚠️  Continuing anyway - printer might still work...`);
      }

      // Read JPG file
      const jpgBuffer = await fs.readFile(jpgPath);
      console.log(`  📄 JPG file size: ${(jpgBuffer.length / 1024).toFixed(2)} KB`);

      // Print using IPP
      console.log('  🔌 Connecting to printer via IPP...');
      const printer = ipp.Printer(printerUrl);

      const printJob = {
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
        data: jpgBuffer,
      };

      console.log(`  📤 Sending print job (${(jpgBuffer.length / 1024).toFixed(2)} KB)...`);
      await new Promise((resolve, reject) => {
        printer.execute('Print-Job', printJob, (err, result) => {
          if (err) {
            console.error('  ❌ IPP Error details:', err);
            reject(new Error(`IPP Print failed: ${err.message || JSON.stringify(err)}`));
          } else {
            console.log('  ✅ Print job accepted by printer. Status:', result.statusCode);
            if (result.statusCode !== 'successful-ok') {
              console.warn('  ⚠️  Warning: Status code is not "successful-ok":', result.statusCode);
            }
            resolve(result);
          }
        });
      });
      
      // Wait a few seconds for sticker to actually print
      console.log('  ⏳ Waiting for sticker to print...');
      await new Promise(resolve => setTimeout(resolve, 5000));
      console.log('  ✅ Sticker print completed!');

      // Update job status on server
      await updateJobStatus(job.id, 'completed');

      // Cleanup
      await fs.rm(jobDir, { recursive: true, force: true });

      console.log(`  ✅ Job ${job.id} completed successfully!`);
      return;
    }

    // =========================================================================
    // GREETING CARDS: Use PDF and print via Windows printer name
    // =========================================================================
    console.log('  💌 Greeting card printing via Windows printer driver');
    
    let pdfPath = path.join(jobDir, 'card.pdf');

    // PREFERRED: Use pre-generated PDF from server (faster, more reliable)
    if (job.pdfUrl) {
      console.log('  📄 Downloading server-generated PDF...');
      await downloadPdf(job.pdfUrl, pdfPath);
      console.log('  ✅ PDF downloaded successfully');
    }
    // FALLBACK: Generate PDF from images (legacy support)
    else if (job.imagePaths && job.imagePaths.length >= 4) {
      console.log('  ⚠️  No PDF URL provided - generating from images (slower)');

      // Get paper configuration
      const config = getPaperConfig(job.paperSize || 'letter');
      console.log(`   Paper: ${config.name}`);

      // Download or use local paths for images
      const imageFiles = {
        front: path.join(jobDir, 'page_1.png'),
        insideRight: path.join(jobDir, 'page_2.png'),
        insideLeft: path.join(jobDir, 'page_3.png'),
        back: path.join(jobDir, 'page_4.png'),
      };

      // If imagePaths are URLs, download them
      for (let i = 0; i < 4; i++) {
        const imagePath = job.imagePaths[i];
        const localPath = path.join(jobDir, `page_${i + 1}.png`);

        if (imagePath.startsWith('http')) {
          await downloadImage(imagePath, localPath);
        } else {
          // Copy local file
          const absolutePath = path.resolve(imagePath);
          await fs.copyFile(absolutePath, localPath);
        }
      }

      // Create composite images
      console.log('  🔧 Creating composite images...');
      const side1Path = path.join(jobDir, 'side1.png');
      const side2Path = path.join(jobDir, 'side2.png');

      await createCompositeImage(side1Path, imageFiles.back, imageFiles.front, config);
      await createCompositeImage(side2Path, imageFiles.insideRight, imageFiles.insideLeft, config);

      // Create PDF
      console.log('  📄 Creating PDF...');
      await createPdf(pdfPath, side1Path, side2Path, config);
    } else {
      throw new Error('Job has no PDF URL and no valid image paths');
    }

    // Print using Windows printer name (set in /admin/kiosks)
    const printerName = job.printerName || CONFIG.defaultPrinter;
    console.log(`  🖨️  Printer: ${printerName}${job.printerName ? ' (from kiosk config)' : ' (fallback)'}`);
    await printPdf(pdfPath, printerName);

    // Update job status on server
    await updateJobStatus(job.id, 'completed');

    // Cleanup
    await fs.rm(jobDir, { recursive: true, force: true });

    console.log(`  ✅ Job ${job.id} completed successfully!`);

  } catch (error) {
    console.error(`  ❌ Job ${job.id} failed:`);
    console.error(`     Error: ${error.message}`);
    console.error(`     Stack: ${error.stack}`);
    if (error.cause) {
      console.error(`     Cause: ${error.cause}`);
    }
    await updateJobStatus(job.id, 'failed', error.message);

    // Cleanup on error too
    try {
      await fs.rm(jobDir, { recursive: true, force: true });
    } catch { }
  }
}

/**
 * Update job status using the database-backed endpoint
 */
/**
 * Update job status using the database-backed endpoint
 * CRITICAL: This MUST succeed for frontend to show "Print Complete"
 */
async function updateJobStatusDB(jobId, status, error = null) {
  const maxRetries = 10; // More retries for critical status updates
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const body = { status };
      if (error) body.error = error;

      const response = await fetch(`${CONFIG.cloudServerUrl}/local-agent/jobs/${jobId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (response.status === 429) {
        // Rate limited - wait and retry with shorter delays
        const waitTime = Math.min(Math.pow(1.5, attempt) * 500, 5000); // 500ms to 5s max
        console.log(`  ⏳ DB status update rate limited, retry ${attempt + 1}/${maxRetries} in ${(waitTime/1000).toFixed(1)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (response.ok) {
        return true; // Success
      }
    } catch (err) {
      const waitTime = Math.min(1000 * (attempt + 1), 3000);
      if (attempt < maxRetries - 1) {
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.warn(`  ⚠️ Could not update job status (DB) after ${maxRetries} attempts: ${err.message}`);
      }
    }
  }
  return false;
}

/**
 * Update job status using the legacy in-memory endpoint
 * CRITICAL: This MUST succeed for frontend to show "Print Complete"
 */
async function updateJobStatusLegacy(jobId, status, error = null) {
  const maxRetries = 10; // More retries for critical status updates
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const body = { status };
      if (error) body.error = error;

      const response = await fetch(`${CONFIG.cloudServerUrl}/print-jobs/${jobId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      
      if (response.status === 429) {
        // Rate limited - wait and retry with shorter delays for status updates
        const waitTime = Math.min(Math.pow(1.5, attempt) * 500, 5000); // 500ms to 5s max
        console.log(`  ⏳ Status update rate limited, retry ${attempt + 1}/${maxRetries} in ${(waitTime/1000).toFixed(1)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (response.ok) {
        if (status === 'completed') {
          console.log(`  ✅ Status "${status}" sent to server successfully`);
        }
        return true; // Success
      }
    } catch (err) {
      const waitTime = Math.min(1000 * (attempt + 1), 3000);
      if (attempt < maxRetries - 1) {
        console.log(`  ⏳ Network error, retry ${attempt + 1}/${maxRetries} in ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
      } else {
        console.warn(`  ⚠️ Could not update job status (legacy) after ${maxRetries} attempts: ${err.message}`);
      }
    }
  }
  return false;
}

/**
 * Retry a fetch request with exponential backoff for 429 errors
 */
async function fetchWithRetry(url, options, maxRetries = 3) {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        // Rate limited - wait and retry
        const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
        console.log(`  ⏳ Rate limited, waiting ${waitTime/1000}s before retry...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      return response;
    } catch (err) {
      if (attempt === maxRetries - 1) throw err;
      // Wait before retry on network errors
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  throw new Error('Max retries exceeded');
}

// Update job status on the server
// CRITICAL: The in-memory queue update is what frontend polls to show "Print Complete"
async function updateJobStatus(jobId, status, error = null) {
  console.log(`  📡 Updating job status to "${status}" on server...`);
  
  // PRIORITY 1: Update in-memory queue - this is what frontend polls!
  const legacySuccess = await updateJobStatusLegacy(jobId, status, error);
  
  if (status === 'completed') {
    if (legacySuccess) {
      console.log(`  🎉 Frontend will now show "Print Complete"!`);
    } else {
      console.warn(`  ⚠️ WARNING: Could not update status - frontend may be stuck on "Printing..."`);
    }
  }
  
  // PRIORITY 2: Try DB update (non-blocking, less critical)
  // Don't wait for this - it's for record keeping, not frontend display
  updateJobStatusDB(jobId, status, error).catch(() => {});
  
  // PRIORITY 3: Cleanup (non-blocking)
  if (status === 'completed' || status === 'failed') {
    cleanupCompletedJobs().catch(() => {});
  }
}

/**
 * Remove the processed job from the in-memory queue
 * Uses clear-all to ensure no jobs remain that could be re-printed
 * Retries on rate limiting (429) errors
 */
async function cleanupCompletedJobs() {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(`${CONFIG.cloudServerUrl}/print-jobs/clear-all`, {
        method: 'DELETE',
      });
      
      if (response.status === 429) {
        // Rate limited - wait and retry with increasing delay
        const waitTime = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s, 8s, 16s
        console.log(`  ⏳ Cleanup rate limited, waiting ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (response.ok) {
        const result = await response.json();
        if (result.cleared > 0) {
          console.log(`  🧹 Cleared queue (${result.cleared} job(s) removed)`);
        }
        return; // Success, exit
      }
    } catch (err) {
      // Wait before retry on network errors
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  console.warn('  ⚠️ Could not clear queue after retries');
}

// =============================================================================
// MAIN POLLING LOOP
// =============================================================================

/**
 * Poll for pending jobs from the DATABASE-BACKED endpoint
 * Greeting cards are stored in the database with kiosk config (printerName, printerIP)
 */
async function pollForJobsFromDB() {
  try {
    const response = await fetch(`${CONFIG.cloudServerUrl}/local-agent/pending-jobs`);
    if (!response.ok) {
      if (response.status === 404) {
        // Endpoint not deployed yet, skip silently
        return;
      }
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    const jobs = data.jobs || [];
    
    // Filter out jobs we've already processed locally
    const newJobs = jobs.filter(j => !locallyProcessedJobs.has(j.id));

    if (newJobs.length > 0) {
      console.log(`\n📬 Found ${newJobs.length} pending greeting card job(s) from database`);

      for (const job of newJobs) {
        // Mark as locally processed IMMEDIATELY to prevent re-processing
        locallyProcessedJobs.add(job.id);
        
        await updateJobStatusDB(job.id, 'processing');
        await processJob(job);
      }
    }
  } catch (error) {
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      // Server might be down, just wait and retry
    } else if (error.message.includes('429')) {
      // Rate limited - log and wait
      console.log('Poll error (DB): Rate limited, will retry...');
    } else {
      console.error('Poll error (DB):', error.message);
    }
  }
}

/**
 * Poll for pending jobs from the IN-MEMORY queue
 * Both greeting cards and stickers can be in the in-memory queue
 */
async function pollForJobsFromMemory() {
  try {
    const response = await fetch(`${CONFIG.cloudServerUrl}/print-jobs`);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    const jobs = data.jobs || [];

    // Debug: Show ALL jobs in queue periodically
    if (pollCount % 6 === 1 && jobs.length > 0) {
      console.log(`\n🔍 Queue contents (${jobs.length} total):`);
      jobs.forEach((j, i) => {
        const isLocal = locallyProcessedJobs.has(j.id);
        console.log(`   ${i + 1}. [${j.status}] ${j.id} (${j.paperType || 'greeting-card'})${isLocal ? ' ✓local' : ''}`);
      });
    }

    // ONLY process "pending" jobs that we haven't already processed locally
    // This prevents re-printing if server status update fails due to rate limiting
    const pendingJobs = jobs.filter(j => 
      j.status === 'pending' && !locallyProcessedJobs.has(j.id)
    );

    // Only show queue status when there are NEW jobs to process
    if (pendingJobs.length > 0) {
      console.log(`\n🔍 Found ${pendingJobs.length} new job(s) in queue`);
      pendingJobs.forEach((j, i) => {
        console.log(`   ${i + 1}. ${j.id} (${j.paperType || 'greeting-card'}) - jpgUrl: ${j.jpgUrl ? 'YES' : 'no'}, pdfUrl: ${j.pdfUrl ? 'YES' : 'no'}`);
      });
    }

    if (pendingJobs.length > 0) {
      console.log(`\n📬 Processing ${pendingJobs.length} new job(s)`);

      for (const job of pendingJobs) {
        // Mark as locally processed IMMEDIATELY to prevent re-processing
        locallyProcessedJobs.add(job.id);
        
        // Mark as processing on server
        await updateJobStatusLegacy(job.id, 'processing');
        // Process the job
        await processJob(job);
        // Note: processJob calls updateJobStatus which cleans up completed jobs
        
        console.log(`  📋 Job ${job.id} added to local tracking (${locallyProcessedJobs.size} total tracked)`);
      }
    }
  } catch (error) {
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      // Server might be down, just wait and retry
    } else if (error.message.includes('429')) {
      // Rate limited - skip logging (retry logic handles this)
    } else {
      console.error('Poll error (memory):', error.message);
    }
  }
}

// Track last poll time for debugging
let pollCount = 0;

// LOCAL tracking of processed jobs to prevent re-processing
// even if server status update fails due to rate limiting
const locallyProcessedJobs = new Set();

/**
 * Main polling function
 * Only polls in-memory queue to reduce rate limit pressure
 * All jobs (stickers + greeting cards) go through /print-jobs endpoint
 */
async function pollForJobs() {
  pollCount++;
  // Show poll activity every 6 polls (1 minute at 10s interval)
  if (pollCount % 6 === 0) {
    const now = new Date().toLocaleTimeString();
    console.log(`\n⏱️  [${now}] Still polling... (${pollCount} polls so far)`);
  }
  
  // Only poll in-memory queue to reduce server requests
  // This reduces rate limiting and leaves room for status updates
  await pollForJobsFromMemory();
}

async function listPrinters() {
  console.log('\n📋 Available Local Printers:');
  console.log('─'.repeat(50));

  try {
    const printers = await getPrinters();
    if (printers && printers.length > 0) {
      printers.forEach((p, i) => {
        console.log(`  ${i + 1}. ${p.name}`);
      });
    } else {
      console.log('  No printers found');
    }
  } catch (err) {
    console.error('  Could not list printers:', err.message);
  }

  console.log('─'.repeat(50));
  console.log(`  Fallback: ${CONFIG.defaultPrinter}`);
  console.log('');
}

async function fetchKioskPrinterConfigs() {
  console.log('\n🔧 Kiosk Printer Configurations (from /admin/kiosks):');
  console.log('─'.repeat(60));

  try {
    const response = await fetch(`${CONFIG.cloudServerUrl}/local-agent/printer-config`);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const kiosks = await response.json();
    
    if (kiosks && kiosks.length > 0) {
      kiosks.forEach((kiosk, i) => {
        const printerName = kiosk.printerName || '(not set)';
        const printerIP = kiosk.printerIP || '(not set)';
        console.log(`  ${i + 1}. ${kiosk.name}`);
        console.log(`     Printer: ${printerName}`);
        console.log(`     IP: ${printerIP}`);
      });
    } else {
      console.log('  No kiosks configured');
    }
  } catch (err) {
    console.error(`  ⚠️ Could not fetch kiosk configs: ${err.message}`);
    console.log('     (Server may not be running or endpoint not deployed yet)');
  }

  console.log('─'.repeat(60));
  console.log('');
}

async function clearJobQueue() {
  console.log('\n🧹 Clearing old jobs from queue (starting fresh)...');
  
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      // Clear the in-memory queue on the server
      const response = await fetch(`${CONFIG.cloudServerUrl}/print-jobs/clear-all`, {
        method: 'DELETE',
      });
      
      if (response.status === 429) {
        // Rate limited - wait and retry
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`   ⏳ Rate limited, waiting ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (response.ok) {
        const result = await response.json();
        console.log(`   ✅ Cleared ${result.cleared || 0} old job(s) from queue`);
        console.log('');
        return; // Success
      } else {
        console.log(`   ⚠️ Could not clear queue: ${response.status}`);
      }
    } catch (err) {
      if (attempt === 4) {
        console.log(`   ⚠️ Could not clear queue: ${err.message}`);
        console.log('   (This is OK if the server endpoint is not deployed yet)');
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  console.log('');
}

async function startSurveillance(surveillanceConfig) {
  const config = surveillanceConfig || CONFIG.surveillance;
  
  if (!config.enabled) {
    console.log('  📹 Surveillance: Disabled');
    return null;
  }

  console.log('\n' + '─'.repeat(60));
  console.log('  📹 SURVEILLANCE MODULE');
  console.log('─'.repeat(60));

  const surveillanceManager = getSurveillanceManager({
    kioskId: config.kioskId,
    serverUrl: CONFIG.cloudServerUrl,
    apiKey: config.apiKey,
    webcamIndex: config.webcamIndex ?? 0,
    httpPort: config.httpPort ?? 8765,
    showPreview: config.showPreview ?? false,
    pythonPath: config.pythonPath || 'python',
    dwellThreshold: config.dwellThresholdSeconds ?? 8,
    frameThreshold: config.frameThreshold ?? 10,
    autoRestart: true,
  });

  const started = await surveillanceManager.start();
  
  if (started) {
    console.log('  ✅ Surveillance started successfully');
    console.log(`  🌐 Image server (LOCAL): http://localhost:${config.httpPort || 8765}`);
  } else {
    console.log('  ⚠️ Surveillance failed to start');
  }

  console.log('─'.repeat(60) + '\n');
  
  return surveillanceManager;
}

/**
 * Start printer status monitoring
 */
function startPrinterStatusMonitor(printerConfig) {
  console.log('\n' + '─'.repeat(60));
  console.log('  🖨️  PRINTER STATUS MONITOR');
  console.log('─'.repeat(60));

  const printerStatusMonitor = new PrinterStatusMonitor({
    printerIP: printerConfig.printerIP || null,
    printerName: printerConfig.printerName || CONFIG.defaultPrinter || null,
    kioskId: printerConfig.kioskId,
    apiKey: printerConfig.apiKey,
    serverUrl: CONFIG.cloudServerUrl,
    snmpCommunity: printerConfig.snmpCommunity || 'public',
    pollInterval: 30000, // Check every 30 seconds
    reportInterval: 60000, // Report to server every minute
    onStatusChange: (status) => {
      // Log significant status changes
      if (status.errors?.length > 0) {
        console.log('\n  🚨 PRINTER ALERT:');
        status.errors.forEach(err => console.log(`     ❌ ${err.message}`));
      }
    },
    onError: (error) => {
      console.error('  ❌ Printer monitor error:', error.message);
    },
  });

  printerStatusMonitor.start();
  
  console.log(`  ✅ Printer monitoring started`);
  if (printerConfig.printerIP) {
    console.log(`  📡 Monitoring IP: ${printerConfig.printerIP} (SNMP)`);
  }
  if (printerConfig.printerName) {
    console.log(`  🏷️  Monitoring queue: ${printerConfig.printerName} (Windows)`);
  }
  console.log('─'.repeat(60) + '\n');

  return printerStatusMonitor;
}

/**
 * Wait for device pairing if not already paired
 */
async function waitForPairing(pairingServer) {
  return new Promise((resolve) => {
    // Set callback for when device is paired
    pairingServer.onPaired = (pairing) => {
      console.log(`\n  ✅ Device paired to kiosk: ${pairing.kioskName || pairing.kioskId}`);
      resolve(pairing);
    };

    // Open browser to manager page
    // Use frontendUrl from config (default: https://app.smartwish.us)
    // For local dev, set frontendUrl in config.json to http://localhost:3000
    pairingServer.openManagerPage(CONFIG.frontendUrl);

    console.log('\n  ⏳ Waiting for manager to pair this device...');
    console.log('  📱 The manager page should open automatically.');
    console.log('  📋 After logging in, select a kiosk and click "Pair Device"');
    console.log('');
  });
}

async function main() {
  console.log('═'.repeat(60));
  console.log('  🖨️  SMARTWISH LOCAL PRINT AGENT');
  console.log('═'.repeat(60));
  console.log('');
  console.log('  📡 CLOUD CONNECTIONS:');
  console.log(`     Backend API: ${CONFIG.cloudServerUrl}`);
  console.log(`     Frontend:    ${CONFIG.frontendUrl}`);
  console.log('');
  console.log('  💻 LOCAL SERVICES (on this machine):');
  console.log(`     Pairing:     http://localhost:${CONFIG.localServices.pairingPort}`);
  console.log(`     Surveillance: http://localhost:${CONFIG.localServices.surveillancePort}`);
  console.log('');
  console.log(`  ⏱️  Poll Interval: ${CONFIG.pollInterval}ms`);
  console.log('');

  await ensureTempDir();
  
  // =========================================================================
  // DEVICE PAIRING - Get kiosk identity from cloud
  // =========================================================================
  
  const pairingServer = new DevicePairingServer({
    port: CONFIG.localServices.pairingPort,
  });
  
  // Start pairing server
  await pairingServer.start();
  
  // Load existing pairing
  let pairing = await pairingServer.loadPairing();
  let surveillanceConfig = null;
  
  // Always open browser to manager portal so manager can verify/change kiosk
  console.log('\n  🌐 Opening manager portal...');
  pairingServer.openManagerPage(CONFIG.frontendUrl);
  
  // Check if we have a valid pairing
  if (!pairing || !pairing.kioskId || !pairing.apiKey) {
    console.log('  📱 Device not paired to any kiosk');
    
    // Check if we have local config as fallback
    if (CONFIG.surveillance.kioskId && CONFIG.surveillance.apiKey && 
        CONFIG.surveillance.kioskId !== 'default-kiosk' && 
        CONFIG.surveillance.kioskId !== 'YOUR_KIOSK_ID') {
      console.log('  📁 Using local config.json configuration');
      pairing = {
        kioskId: CONFIG.surveillance.kioskId,
        apiKey: CONFIG.surveillance.apiKey,
        config: { surveillance: CONFIG.surveillance },
      };
    } else {
      // Wait for manager to pair device
      pairing = await waitForPairing(pairingServer);
    }
  } else {
    console.log(`  📱 Currently paired to: ${pairing.kioskName || pairing.kioskId}`);
    console.log('  💡 Manager can re-pair to a different kiosk from the browser');
  }
  
  // Fetch latest config from cloud
  console.log(`\n  ☁️  Fetching config for kiosk: ${pairing.kioskId}`);
  const cloudConfig = await fetchKioskConfig(CONFIG.cloudServerUrl, pairing.kioskId, pairing.apiKey);
  
  if (cloudConfig) {
    console.log(`  ✅ Got cloud config for: ${cloudConfig.name || pairing.kioskId}`);
    surveillanceConfig = {
      enabled: cloudConfig.surveillance?.enabled ?? false,
      kioskId: pairing.kioskId,
      apiKey: pairing.apiKey,
      webcamIndex: cloudConfig.surveillance?.webcamIndex ?? 0,
      httpPort: cloudConfig.surveillance?.httpPort ?? 8765,
      dwellThresholdSeconds: cloudConfig.surveillance?.dwellThresholdSeconds ?? 8,
      frameThreshold: cloudConfig.surveillance?.frameThreshold ?? 10,
      showPreview: cloudConfig.surveillance?.showPreview ?? false,
    };
    
    // Update default printer from cloud config
    if (cloudConfig.printerName) {
      CONFIG.defaultPrinter = cloudConfig.printerName;
    }
  } else {
    console.log('  ⚠️  Could not fetch cloud config, using pairing config');
    surveillanceConfig = pairing.config?.surveillance || CONFIG.surveillance;
    surveillanceConfig.kioskId = pairing.kioskId;
    surveillanceConfig.apiKey = pairing.apiKey;
  }
  
  console.log('');
  await listPrinters();
  await fetchKioskPrinterConfigs();
  
  // Clear old jobs from queue - start fresh every time
  await clearJobQueue();

  // Start surveillance if enabled in cloud config
  const surveillanceManager = await startSurveillance(surveillanceConfig);

  // Start printer status monitoring
  const printerStatusMonitor = startPrinterStatusMonitor({
    printerIP: cloudConfig?.printerIP || null,
    printerName: cloudConfig?.printerName || CONFIG.defaultPrinter || null,
    kioskId: pairing.kioskId,
    apiKey: pairing.apiKey,
    snmpCommunity: cloudConfig?.snmpCommunity || 'public',
  });

  console.log('🔄 Waiting for print jobs...');
  console.log(`   Kiosk: ${pairing.kioskId}`);
  console.log('   Press Ctrl+C to stop\n');

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\n\n⏹️  Shutting down...');
    if (printerStatusMonitor) {
      printerStatusMonitor.stop();
    }
    if (surveillanceManager) {
      surveillanceManager.stop();
    }
    pairingServer.stop();
    process.exit(0);
  };
  
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Initial poll
  await pollForJobs();

  // Start polling loop
  setInterval(pollForJobs, CONFIG.pollInterval);
}

// Run the agent
main().catch(console.error);
