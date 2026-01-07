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
import { exec, execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// CONFIGURATION - Modify these values
// =============================================================================
const CONFIG = {
  // Cloud server URL - change this to your deployed backend
  cloudServerUrl: process.env.CLOUD_SERVER_URL || 'https://smartwish.onrender.com',

  // Default printer name - set to your actual printer
  defaultPrinter: process.env.DEFAULT_PRINTER || 'HP OfficeJet Pro 9130e Series [HPIE4B65B]',

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
 * Print PDF using PowerShell script for reliable tray selection on HP printers
 * Uses dedicated print-with-tray.ps1 script
 */
async function printWithPowerShellScript(pdfPath, printerName, options = {}) {
  const { trayNumber, paperType } = options;
  
  // Path to our PowerShell print script
  const scriptPath = path.join(__dirname, 'print-with-tray.ps1');
  
  // Check if script exists
  try {
    await fs.access(scriptPath);
  } catch {
    throw new Error('print-with-tray.ps1 script not found');
  }
  
  // Build PowerShell command
  const args = [
    '-ExecutionPolicy', 'Bypass',
    '-File', `"${scriptPath}"`,
    '-PdfPath', `"${pdfPath}"`,
    '-PrinterName', `"${printerName}"`,
    '-TrayNumber', trayNumber || 0,
    '-PaperType', `"${paperType || 'greeting-card'}"`
  ].join(' ');
  
  console.log(`  📜 Running: powershell ${args}`);
  
  return new Promise((resolve, reject) => {
    exec(`powershell ${args}`, { timeout: 120000 }, (error, stdout, stderr) => {
      console.log('  --- PowerShell Output ---');
      if (stdout) console.log(stdout);
      if (stderr) console.log(stderr);
      console.log('  --- End Output ---');
      
      if (error && error.code !== 0) {
        reject(new Error(`PowerShell script failed: ${error.message}`));
        return;
      }
      resolve();
    });
  });
}

/**
 * Print PDF using SumatraPDF directly with tray selection
 */
async function printWithSumatraPDF(pdfPath, printerName, options = {}) {
  const { trayNumber, paperType } = options;
  const isSticker = paperType === 'sticker';
  
  // Common SumatraPDF install locations
  const sumatraPaths = [
    'C:\\Users\\makar\\AppData\\Local\\SumatraPDF\\SumatraPDF.exe',
    'C:\\Program Files\\SumatraPDF\\SumatraPDF.exe',
    'C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe',
  ];
  
  let sumatraPath = null;
  for (const p of sumatraPaths) {
    try {
      await fs.access(p);
      sumatraPath = p;
      break;
    } catch {}
  }
  
  if (!sumatraPath) {
    throw new Error('SumatraPDF not found');
  }
  
  // Build print settings
  // HP OfficeJet Pro tray names: "Tray 1", "Tray 2"
  let settings = [];
  settings.push(isSticker ? 'simplex' : 'duplexshort');
  settings.push('color');
  settings.push('noscale');
  
  if (trayNumber) {
    // HP format: "Tray 1" or "Tray 2"
    settings.push(`bin=Tray ${trayNumber}`);
  }
  
  const settingsStr = settings.join(',');
  
  console.log(`  📜 SumatraPDF: ${sumatraPath}`);
  console.log(`  📜 Settings: ${settingsStr}`);
  
  // Run SumatraPDF
  const cmd = `"${sumatraPath}" -print-to "${printerName}" -print-settings "${settingsStr}" -silent "${pdfPath}"`;
  
  return new Promise((resolve, reject) => {
    exec(cmd, { timeout: 60000 }, (error, stdout, stderr) => {
      if (error) {
        reject(new Error(`SumatraPDF failed: ${error.message}`));
        return;
      }
      resolve();
    });
  });
}

async function printPdf(pdfPath, printerName, options = {}) {
  const { trayNumber, paperType } = options;
  
  console.log(`  🖨️ Printing to: ${printerName}`);
  console.log(`  📄 Paper Type: ${paperType || 'greeting-card'}`);
  console.log(`  📥 Requested Tray: ${trayNumber || 'Auto (printer default)'}`);

  const isSticker = paperType === 'sticker';
  const duplexSetting = isSticker ? 'simplex' : 'duplexshort';
  
  console.log(`  📄 Duplex: ${isSticker ? 'No (simplex)' : 'Yes (flip short edge)'}`);

  // METHOD 1: Try SumatraPDF directly (most reliable for tray selection)
  if (trayNumber) {
    console.log('  🔄 METHOD 1: Trying SumatraPDF with tray selection...');
    try {
      await printWithSumatraPDF(pdfPath, printerName, options);
      console.log(`  ✅ Print job sent to Tray ${trayNumber} via SumatraPDF!`);
      return;
    } catch (err) {
      console.warn(`  ⚠️ SumatraPDF method failed: ${err.message}`);
    }
  }

  // METHOD 2: Try PowerShell script
  if (trayNumber) {
    console.log('  🔄 METHOD 2: Trying PowerShell script...');
    try {
      await printWithPowerShellScript(pdfPath, printerName, options);
      console.log(`  ✅ Print job sent via PowerShell script!`);
      return;
    } catch (err) {
      console.warn(`  ⚠️ PowerShell script failed: ${err.message}`);
    }
  }

  // METHOD 3: Use pdf-to-printer library
  console.log('  🔄 METHOD 3: Using pdf-to-printer library...');
  const printOptions = {
    printer: printerName,
    side: duplexSetting,
    scale: 'noscale',
    monochrome: false,
  };

  try {
    await print(pdfPath, printOptions);
    console.log(`  ✅ Print job sent via pdf-to-printer (${isSticker ? 'simplex' : 'duplex'})!`);
    
    if (trayNumber) {
      console.log('');
      console.log('  ⚠️  WARNING: Tray selection may not have worked with this method!');
      console.log('     The print job was sent but may use the wrong tray.');
      console.log('');
      console.log('  📋 TO FIX TRAY SELECTION:');
      console.log('     Option A: Install SumatraPDF (recommended)');
      console.log('        Download from: https://www.sumatrapdfreader.org/download-free-pdf-viewer');
      console.log('');
      console.log('     Option B: Set Windows printer default tray');
      console.log('        1. Open Control Panel → Devices and Printers');
      console.log('        2. Right-click your HP printer → Printing Preferences');
      console.log('        3. Go to Paper/Quality tab');
      console.log('        4. Set Paper Source to "Tray 1" for stickers');
      console.log('        5. Click OK');
    }
  } catch (err) {
    console.warn('  ⚠️ pdf-to-printer failed:', err.message);
    
    // Last resort: basic print
    try {
      await print(pdfPath, { printer: printerName });
      console.log('  ✅ Print job sent using printer defaults only');
    } catch (err2) {
      throw new Error(`All print methods failed: ${err2.message}`);
    }
  }
}

// =============================================================================
// JOB PROCESSING
// =============================================================================

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

async function processJob(job) {
  console.log(`\n📋 Processing job: ${job.id}`);
  
  // Use default printer if job doesn't specify one
  const printerName = job.printerName || CONFIG.defaultPrinter;
  const trayNumber = job.trayNumber || null;
  
  console.log(`   Printer: ${printerName}`);
  console.log(`   Paper Type: ${job.paperType || 'greeting-card'}`);
  console.log(`   Tray: ${trayNumber || 'Auto'}`);
  console.log(`   PDF URL: ${job.pdfUrl ? 'Yes ✓' : 'No (will use images)'}`);
  console.log(`   Images: ${job.imagePaths?.length || 0}`);

  const jobDir = path.join(CONFIG.tempDir, job.id);
  await fs.mkdir(jobDir, { recursive: true });

  try {
    let pdfPath;

    // =========================================================================
    // PREFERRED: Use pre-generated PDF from server (faster, more reliable)
    // =========================================================================
    if (job.pdfUrl) {
      console.log('  📄 Using server-generated PDF (recommended)');
      pdfPath = path.join(jobDir, 'card.pdf');
      await downloadPdf(job.pdfUrl, pdfPath);
      console.log('  ✅ PDF downloaded successfully');
    } 
    // =========================================================================
    // FALLBACK: Generate PDF from images (legacy support)
    // =========================================================================
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
      pdfPath = path.join(jobDir, 'card.pdf');
      await createPdf(pdfPath, side1Path, side2Path, config);
    } else {
      throw new Error('Job has no PDF URL and no valid image paths');
    }

    // Print the PDF with tray and paper type options
    await printPdf(pdfPath, printerName, { 
      trayNumber, 
      paperType: job.paperType || 'greeting-card' 
    });

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

