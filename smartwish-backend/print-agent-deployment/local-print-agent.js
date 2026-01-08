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
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURATION - Modify these values in start-print-agent.ps1 or here
// =============================================================================
const CONFIG = {
  // Cloud server URL - change this to your deployed backend
  cloudServerUrl: process.env.CLOUD_SERVER_URL || 'https://smartwish.onrender.com',

  // Printer name comes from kiosk config via job.printerName
  // This is just a fallback if job doesn't specify printer
  defaultPrinter: process.env.DEFAULT_PRINTER || null,

  // How often to poll for new jobs (milliseconds)
  pollInterval: process.env.POLL_INTERVAL || 5000,

  // Temporary directory for downloaded files
  tempDir: path.join(__dirname, 'temp-print-jobs'),

  // Printing defaults (can be overridden per-job)
  defaultDuplexSide: process.env.DEFAULT_DUPLEX_SIDE || 'duplexshort', // simplex|duplex|duplexshort|duplexlong
  defaultPaperSize: process.env.DEFAULT_PAPER_SIZE || 'Letter',
  defaultBorderless: (process.env.BORDERLESS || 'false').toLowerCase() === 'true',
  borderlessPaperSize: process.env.BORDERLESS_PAPER_SIZE || '',
  defaultScale: process.env.DEFAULT_SCALE || 'noscale', // noscale|shrink|fit
  defaultCopies: Number(process.env.DEFAULT_COPIES || 1),

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

function parseDataUrl(dataUrl) {
  // Supports: data:application/pdf;base64,.... and data:image/...;base64,...
  const match = /^data:([^;]+);base64,(.*)$/i.exec(dataUrl || '');
  if (!match) return null;
  return { mime: match[1], base64: match[2] };
}

async function downloadFile(url, savePath) {
  console.log(`  📥 Downloading: ${url}`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download file: ${response.status}`);
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

async function getPrinterInfoByName(printerName) {
  try {
    const printers = await getPrinters();
    return printers?.find((p) => p.name === printerName) || null;
  } catch {
    return null;
  }
}

async function getAllPrintersSafe() {
  try {
    const printers = await getPrinters();
    return Array.isArray(printers) ? printers : [];
  } catch {
    return [];
  }
}

function pickBestMatchingPrinter(printers, requestedName) {
  if (!requestedName) return null;
  const normalize = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const req = normalize(requestedName);
  if (!req) return null;

  // Exact match (case-insensitive)
  const exact = printers.find((p) => normalize(p.name) === req);
  if (exact) return exact;

  // Substring match (helps when Windows appends "Copy 1", etc.)
  const contains = printers.find((p) => normalize(p.name).includes(req) || req.includes(normalize(p.name)));
  if (contains) return contains;

  return null;
}

function resolvePaperSizeForJob(job, printerInfo) {
  const requestedPaperSize = job.paperSize || CONFIG.defaultPaperSize;
  const wantsBorderless = Boolean(job.borderless ?? CONFIG.defaultBorderless);

  if (!wantsBorderless) return requestedPaperSize;

  // If caller explicitly provided a borderless paper size name, prefer it.
  const explicitBorderlessPaper =
    job.borderlessPaperSize ||
    job.borderlessPaper ||
    CONFIG.borderlessPaperSize ||
    '';

  const normalize = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const paperSizes = Array.isArray(printerInfo?.paperSizes) ? printerInfo.paperSizes : [];

  if (explicitBorderlessPaper) {
    // Try to match printer-reported casing exactly when possible.
    const exact = paperSizes.find((p) => normalize(p) === normalize(explicitBorderlessPaper));
    if (exact) return exact;
    return explicitBorderlessPaper;
  }

  // Best effort: pick the first paper size that looks borderless and matches base size
  const base = normalize(requestedPaperSize);
  const candidate = paperSizes.find((p) => {
    const n = normalize(p);
    return n.includes('borderless') && (base ? n.includes(base) : true);
  });
  if (candidate) return candidate;

  console.warn(
    `  ⚠️ Borderless requested but no borderless paper size found for printer. Using paperSize="${requestedPaperSize}".`,
  );
  return requestedPaperSize;
}

function resolveDuplexSide(job) {
  // Accept a few aliases
  const side = (job.duplexSide || job.duplex || job.side || CONFIG.defaultDuplexSide || '').toLowerCase();
  const valid = new Set(['simplex', 'duplex', 'duplexshort', 'duplexlong']);
  if (valid.has(side)) return side;
  return CONFIG.defaultDuplexSide;
}

function resolveScale(job) {
  const scale = (job.scale || CONFIG.defaultScale || '').toLowerCase();
  const valid = new Set(['noscale', 'shrink', 'fit']);
  if (valid.has(scale)) return scale;
  return CONFIG.defaultScale;
}

/**
 * Print PDF using SumatraPDF with tray selection
 * Tries multiple tray name formats to match different printer models
 */
async function printWithSumatraPDF(pdfPath, printerName, trayNumber, side = 'duplexshort') {
  // Common SumatraPDF install locations
  const sumatraPaths = [
    path.join(process.env.LOCALAPPDATA || '', 'SumatraPDF', 'SumatraPDF.exe'),
    'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
    'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe',
  ];

  let sumatraPath = null;
  for (const p of sumatraPaths) {
    try {
      await fs.access(p);
      sumatraPath = p;
      break;
    } catch { }
  }

  if (!sumatraPath) {
    throw new Error('SumatraPDF not found');
  }

  const isSimplex = side === 'simplex';

  // Try different tray name formats that printers might use
  const trayFormats = [
    `tray-${trayNumber}`,      // User's printer format: "tray-1", "tray-2"
    `Tray ${trayNumber}`,       // HP format: "Tray 1", "Tray 2"
    `Tray${trayNumber}`,        // Alternative: "Tray1", "Tray2"
    `tray${trayNumber}`,        // Lowercase: "tray1", "tray2"
  ];

  // Build print settings
  const settings = [
    isSimplex ? 'simplex' : 'duplexshort',
    'color',
    'noscale',
  ];

  // Try each tray format until one works - no fallbacks, exact tray required
  const errors = [];
  for (const trayFormat of trayFormats) {
    try {
      const settingsWithTray = [...settings, `bin=${trayFormat}`];
      const settingsStr = settingsWithTray.join(',');

      console.log(`  📜 Trying tray format: ${trayFormat}`);
      console.log(`  📜 SumatraPDF settings: ${settingsStr}`);

      const cmd = `"${sumatraPath}" -print-to "${printerName}" -print-settings "${settingsStr}" -silent "${pdfPath}"`;

      await execAsync(cmd, { timeout: 60000 });
      console.log(`  ✅ Print job sent to ${trayFormat} via SumatraPDF!`);
      return; // Success - exit function
    } catch (err) {
      const errorMsg = `Tray format "${trayFormat}" failed: ${err.message}`;
      console.error(`  ❌ ${errorMsg}`);
      errors.push(errorMsg);
      // Continue to next format
    }
  }

  // All tray formats failed - throw error with details
  throw new Error(`Failed to print to tray-${trayNumber}. All tray formats failed:\n${errors.join('\n')}`);
}

async function printPdf(pdfPath, printerName, job = {}) {
  const printers = await getAllPrintersSafe();
  const matched = pickBestMatchingPrinter(printers, printerName);
  const effectivePrinterName = matched?.name || printerName;

  if (printerName && !matched) {
    console.warn(`  ⚠️ Printer "${printerName}" not found. Available printers:`);
    printers.slice(0, 3).forEach(p => console.warn(`     - ${p.name}`));
    console.warn(`  Will try to print anyway...`);
  }

  console.log(`  🖨️ Printing to: ${effectivePrinterName || '(Windows default printer)'}`);

  const side = resolveDuplexSide(job);
  console.log(`  📄 Duplex: ${side}`);

  // Get tray number from job (required for printing)
  const trayNumber = job.trayNumber;
  if (!trayNumber) {
    throw new Error('Tray number is required but not provided in print job');
  }

  console.log(`  📥 Tray: ${trayNumber} (required)`);

  // Use SumatraPDF with tray selection (no fallbacks - exact tray required)
  console.log('  🔄 Using SumatraPDF with tray selection (no fallbacks)...');
  try {
    await printWithSumatraPDF(pdfPath, effectivePrinterName, trayNumber, side);
    console.log(`  ✅ Print job sent to tray-${trayNumber} via SumatraPDF!`);
  } catch (err) {
    console.error(`  ❌ Failed to print to tray-${trayNumber}: ${err.message}`);
    throw new Error(`Print failed: Could not print to tray-${trayNumber}. ${err.message}`);
  }
}

// =============================================================================
// JOB PROCESSING
// =============================================================================

async function processJob(job) {
  console.log(`\n📋 Processing job: ${job.id}`);
  const printerName = job.printerName || CONFIG.defaultPrinter;
  if (job.printerName) {
    console.log(`   Printer: ${job.printerName} (from kiosk config)`);
  } else if (CONFIG.defaultPrinter) {
    console.log(`   Printer: ${CONFIG.defaultPrinter} (fallback from config)`);
  } else {
    console.log(`   Printer: Windows default (no printer in kiosk config)`);
  }
  console.log(`   PDF: ${job.pdfUrl ? 'pdfUrl' : job.pdfData ? 'pdfData' : 'none'}`);
  console.log(`   Images: ${job.imagePaths?.length || 0}`);
  if (job.trayNumber) {
    console.log(`   Tray: ${job.trayNumber}`);
  } else {
    console.log(`   Tray: Auto (printer default)`);
  }

  const jobDir = path.join(CONFIG.tempDir, job.id);
  await fs.mkdir(jobDir, { recursive: true });

  try {

    let pdfPath = path.join(jobDir, 'card.pdf');

    // Preferred path: server-generated PDF
    if (job.pdfUrl || job.pdfData) {
      console.log('  📄 Using server-generated PDF...');
      if (job.pdfUrl) {
        await downloadFile(job.pdfUrl, pdfPath);
      } else {
        const parsed = job.pdfData.startsWith('data:') ? parseDataUrl(job.pdfData) : null;
        const base64 = parsed ? parsed.base64 : job.pdfData;
        const pdfBuffer = Buffer.from(base64, 'base64');
        await fs.writeFile(pdfPath, pdfBuffer);
      }
    } else {
      // Legacy path: build PDF from 4 images
      // Get paper configuration (used for PDF page size and compositing dimensions)
      const config = getPaperConfig(job.paperSize || 'letter');
      console.log(`   Paper (compose): ${config.name}`);

      // Download or use local paths for images
      const imageFiles = {
        front: path.join(jobDir, 'page_1.png'),
        insideRight: path.join(jobDir, 'page_2.png'),
        insideLeft: path.join(jobDir, 'page_3.png'),
        back: path.join(jobDir, 'page_4.png'),
      };

      if (job.imagePaths && job.imagePaths.length >= 4) {
        for (let i = 0; i < 4; i++) {
          const imagePath = job.imagePaths[i];
          const localPath = path.join(jobDir, `page_${i + 1}.png`);

          if (imagePath.startsWith('http')) {
            await downloadImage(imagePath, localPath);
          } else {
            const absolutePath = path.resolve(imagePath);
            await fs.copyFile(absolutePath, localPath);
          }
        }
      } else {
        throw new Error('Job missing pdfUrl/pdfData and does not contain 4 imagePaths');
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
    }

    // Print using local CONFIG settings (duplex, borderless, etc.)
    await printPdf(pdfPath, printerName, job);

    // Update job status on server
    await updateJobStatus(job.id, 'completed');

    // Cleanup
    await fs.rm(jobDir, { recursive: true, force: true });

    console.log(`  ✅ Job ${job.id} completed successfully!`);

  } catch (error) {
    console.error(`  ❌ Job ${job.id} failed:`, error.message);
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
  console.log(`  Printer: Will use printer from each job's kiosk config`);
  if (CONFIG.defaultPrinter) {
    console.log(`  Fallback (if job has no printer): ${CONFIG.defaultPrinter}`);
  } else {
    console.log(`  Fallback (if job has no printer): Windows default printer`);
  }
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
