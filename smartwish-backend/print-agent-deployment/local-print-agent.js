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

async function printPdf(pdfPath, printerName, job = {}) {
  const debugPrint = (process.env.DEBUG_PRINT || '').toLowerCase() === 'true';

  const printers = await getAllPrintersSafe();
  const matched = pickBestMatchingPrinter(printers, printerName);
  const effectivePrinterName = matched?.name || printerName;

  if (!matched) {
    console.warn(
      `  ⚠️ Printer "${printerName}" not found on this machine. Will try Windows default printer instead.`,
    );
  }

  console.log(`  🖨️ Printing to: ${matched ? effectivePrinterName : '(Windows default printer)'}`);

  const paperSize = resolvePaperSizeForJob(job, matched);
  const side = resolveDuplexSide(job);
  const scale = resolveScale(job);
  const copies = Number(job.copies || CONFIG.defaultCopies || 1);

  console.log(
    `  📄 Settings: paper="${paperSize}", duplex="${side}", scale="${scale}", copies=${copies}, borderless=${Boolean(
      job.borderless ?? CONFIG.defaultBorderless,
    )}`,
  );

  // Print options for pdf-to-printer (uses SumatraPDF on Windows)
  // https://github.com/artiebits/pdf-to-printer
  const printOptions = {
    ...(matched ? { printer: effectivePrinterName } : {}),
    // Duplex options: 'simplex', 'duplex', 'duplexshort', 'duplexlong'
    // For landscape greeting cards: use 'duplexshort' (flip on short edge)
    side,
    // Scale: 'noscale', 'shrink', 'fit'
    scale,
    // Color printing (not monochrome)
    monochrome: false,
    paperSize,
    copies,
    silent: !debugPrint,
  };

  try {
    await print(pdfPath, printOptions);
    console.log('  ✅ Print job sent successfully!');
  } catch (err) {
    const e = err || {};
    console.warn('  ⚠️ Print with options failed:', e.message || e);
    if (e.code !== undefined) console.warn('  ↳ exit code:', e.code);
    if (e.signal) console.warn('  ↳ signal:', e.signal);
    if (e.stdout) console.warn('  ↳ stdout:', String(e.stdout).trim());
    if (e.stderr) console.warn('  ↳ stderr:', String(e.stderr).trim());

    console.warn('  📝 Trying basic print (no options)...');
    // Fallback: try basic print (uses printer defaults; if printer not found, uses Windows default)
    await print(pdfPath, matched ? { printer: effectivePrinterName } : {});
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
  console.log(`   PDF: ${job.pdfUrl ? 'pdfUrl' : job.pdfData ? 'pdfData' : 'none'}`);
  console.log(`   Images: ${job.imagePaths?.length || 0}`);

  const jobDir = path.join(CONFIG.tempDir, job.id);
  await fs.mkdir(jobDir, { recursive: true });

  try {
    const printerName = job.printerName || CONFIG.defaultPrinter;

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

    // Print
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

