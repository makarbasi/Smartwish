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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURATION - Modify these values
// =============================================================================
const CONFIG = {
  // Cloud server URL - change this to your deployed backend
  cloudServerUrl: process.env.CLOUD_SERVER_URL || 'https://smartwish.onrender.com',

  // Default printer name - set to your actual printer
  defaultPrinter: process.env.DEFAULT_PRINTER || 'HPA4CC43 (HP Smart Tank 7600 series)',

  // How often to poll for new jobs (milliseconds)
  pollInterval: process.env.POLL_INTERVAL || 5000,

  // Temporary directory for downloaded files
  tempDir: path.join(__dirname, 'temp-print-jobs'),

  // Paper configuration
  dpi: 300,
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
    console.log('  ✅ Print job sent successfully (duplex: flip on short edge)!');
  } catch (err) {
    console.warn('  ⚠️ Print with duplex options failed:', err.message);
    console.warn('  📝 Trying basic print...');
    // Fallback: try basic print (duplex should be set in printer defaults)
    await print(pdfPath, { printer: printerName });
    console.log('  ✅ Print job sent using printer defaults');
    console.log('');
    console.log('  ⚠️  If not printing two-sided, set duplex in Windows:');
    console.log('     Control Panel → Devices and Printers');
    console.log('     Right-click printer → Printing Preferences');
    console.log('     Set "Two-sided" to "Flip on Short Edge"');
  }
}

// =============================================================================
// JOB PROCESSING
// =============================================================================

async function processJob(job) {
  console.log(`\n📋 Processing job: ${job.id}`);
  console.log(`   Printer: ${job.printerName}`);
  console.log(`   Paper Type: ${job.paperType || 'greeting-card'}`);
  console.log(`   PDF URL: ${job.pdfUrl ? 'Yes ✓' : 'No'}`);
  console.log(`   JPG URL: ${job.jpgUrl ? 'Yes ✓' : 'No'}`);
  console.log(`   Images: ${job.imagePaths?.length || 0}`);

  const jobDir = path.join(CONFIG.tempDir, job.id);
  await fs.mkdir(jobDir, { recursive: true });

  try {
    // =========================================================================
    // STICKER PRINTING: Use JPG URL and print via IPP
    // =========================================================================
    if (job.jpgUrl && job.paperType === 'sticker') {
      console.log('  🖼️  Using sticker JPG (IPP printing)');

      const jpgPath = path.join(jobDir, 'stickers.jpg');
      await downloadImage(job.jpgUrl, jpgPath);
      console.log('  ✅ JPG downloaded successfully');

      // Get printer IP from job or use default
      const printerIP = job.printerIP || '192.168.1.239';
      const printerUrl = `http://${printerIP}:631/ipp/print`;

      console.log(`  📡 Printer IP: ${printerIP}`);
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
            console.log('  ✅ Print job sent. Status:', result.statusCode);
            if (result.statusCode !== 'successful-ok') {
              console.warn('  ⚠️  Warning: Status code is not "successful-ok":', result.statusCode);
            }
            resolve(result);
          }
        });
      });

      // Update job status on server
      await updateJobStatus(job.id, 'completed');

      // Cleanup
      await fs.rm(jobDir, { recursive: true, force: true });

      console.log(`  ✅ Job ${job.id} completed successfully!`);
      return;
    }

    // =========================================================================
    // GREETING CARDS: Use PDF or generate from images
    // =========================================================================
    let pdfPath = path.join(jobDir, 'card.pdf');

    // PREFERRED: Use pre-generated PDF from server (faster, more reliable)
    if (job.pdfUrl) {
      console.log('  📄 Using server-generated PDF (recommended)');
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

    // Print
    const printerName = job.printerName || CONFIG.defaultPrinter;
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

async function updateJobStatus(jobId, status, error = null) {
  try {
    const body = { status };
    if (error) body.error = error;

    await fetch(`${CONFIG.cloudServerUrl}/print-jobs/${jobId}/status`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  } catch (err) {
    console.warn(`  ⚠️ Could not update job status: ${err.message}`);
  }
}

// =============================================================================
// MAIN POLLING LOOP
// =============================================================================

async function pollForJobs() {
  try {
    const response = await fetch(`${CONFIG.cloudServerUrl}/print-jobs`);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    const jobs = data.jobs || [];

    // Find pending jobs
    const pendingJobs = jobs.filter(j => j.status === 'pending');

    if (pendingJobs.length > 0) {
      console.log(`\n📬 Found ${pendingJobs.length} pending job(s)`);

      for (const job of pendingJobs) {
        // Mark as processing first
        await updateJobStatus(job.id, 'processing');
        await processJob(job);
      }
    }

  } catch (error) {
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      // Server might be down, just wait and retry
    } else {
      console.error('Poll error:', error.message);
    }
  }
}

async function listPrinters() {
  console.log('\n📋 Available Printers:');
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
  console.log(`  Default: ${CONFIG.defaultPrinter}`);
  console.log('');
}

async function main() {
  console.log('═'.repeat(60));
  console.log('  🖨️  SMARTWISH LOCAL PRINT AGENT');
  console.log('═'.repeat(60));
  console.log(`  Server: ${CONFIG.cloudServerUrl}`);
  console.log(`  Poll Interval: ${CONFIG.pollInterval}ms`);
  console.log('');

  await ensureTempDir();
  await listPrinters();

  console.log('🔄 Waiting for print jobs...');
  console.log('   Press Ctrl+C to stop\n');

  // Initial poll
  await pollForJobs();

  // Start polling loop
  setInterval(pollForJobs, CONFIG.pollInterval);
}

// Run the agent
main().catch(console.error);
