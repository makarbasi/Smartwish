/**
 * LOCAL PRINT AGENT
 * 
 * This script runs on your LOCAL computer to print jobs queued by the cloud server.
 * 
 * USAGE:
 *   1. Run this on the computer connected to your printer
 *   2. It polls the cloud server for pending print jobs
 *   3. When a job is found, it downloads the PDF and prints via PowerShell/SumatraPDF
 * 
 * SETUP:
 *   npm install pdf-to-printer pdf-lib sharp node-fetch
 *   node local-print-agent.js
 * 
 * CONFIGURATION:
 *   Set environment variables or modify config.json
 */

import pdfPrinter from 'pdf-to-printer';
const getPrinters = pdfPrinter.getPrinters;

import { PDFDocument } from 'pdf-lib';
import sharp from 'sharp';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { exec } from 'child_process';
import { promisify } from 'util';
import { getSurveillanceManager } from './surveillance-manager.js';
import { DevicePairingServer, fetchKioskConfig } from './device-pairing.js';
import { MultiPrinterMonitor } from './printer-status-monitor.js';

const execAsync = promisify(exec);

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// =============================================================================
// LOAD CONFIGURATION FROM FILE OR ENVIRONMENT
// =============================================================================

let fileConfig = {};
const configPath = path.join(__dirname, 'config.json');
try {
  const configData = await fs.readFile(configPath, 'utf-8');
  fileConfig = JSON.parse(configData);
  console.log('📁 Loaded configuration from config.json');
} catch (err) {
  console.log('📁 No config.json found, using environment variables');
}

// =============================================================================
// CONFIGURATION - All settings from config.json (single source of truth)
// =============================================================================
const CONFIG = {
  // Cloud connections (external)
  cloudServerUrl: fileConfig.cloudServerUrl || 'https://smartwish.onrender.com',
  frontendUrl: fileConfig.frontendUrl || 'https://app.smartwish.us',

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
 * Get current print jobs from Windows print queue
 */
async function getWindowsPrintQueue(printerName) {
  try {
    const cmd = `powershell -Command "Get-PrintJob -PrinterName '${printerName}' | Select-Object Id, JobStatus, DocumentName | ConvertTo-Json"`;
    const { stdout } = await execAsync(cmd);
    
    if (!stdout.trim()) {
      return [];
    }
    
    const jobs = JSON.parse(stdout);
    return Array.isArray(jobs) ? jobs : [jobs];
  } catch (err) {
    return [];
  }
}

/**
 * Wait for print queue to be empty (job completed)
 */
async function waitForPrintComplete(printerName, timeoutMs = 60000) {
  const startTime = Date.now();
  const checkInterval = 1000;
  
  console.log(`  ⏳ Monitoring Windows print queue for completion...`);
  
  while (Date.now() - startTime < timeoutMs) {
    const jobs = await getWindowsPrintQueue(printerName);
    
    if (jobs.length === 0) {
      console.log(`  ✅ Windows print queue is empty - job completed!`);
      return true;
    }
    
    const printing = jobs.filter(j => j.JobStatus === 'Printing').length;
    const spooling = jobs.filter(j => j.JobStatus === 'Spooling').length;
    
    if (printing > 0 || spooling > 0) {
      console.log(`  🖨️  Windows queue: ${jobs.length} job(s) - ${printing} printing, ${spooling} spooling`);
    }
    
    await new Promise(resolve => setTimeout(resolve, checkInterval));
  }
  
  console.log(`  ⚠️ Timeout waiting for print queue - assuming completed`);
  return true;
}

// =============================================================================
// POWERSHELL PRINTING (Works for BOTH greeting cards and stickers)
// =============================================================================

/**
 * Print PDF using PowerShell + SumatraPDF
 * This is the ONLY print method - no IPP, no tray selection
 * Printer defaults are configured in Windows printer settings
 * 
 * @param {string} pdfPath - Path to the PDF file
 * @param {string} printerName - Name of the Windows printer
 * @param {string} printMode - Print mode: 'simplex' (single-sided), 'duplex' (long edge), 'duplexshort' (short edge)
 */
async function printPdfWithPowerShell(pdfPath, printerName, printMode = 'simplex') {
  const absolutePath = path.resolve(pdfPath);
  
  // Create PowerShell script for reliable printing
  const tempScriptPath = path.join(CONFIG.tempDir, `print-${Date.now()}.ps1`);
  
  // Escape double quotes in printer name for PowerShell
  const escapedPrinterName = printerName.replace(/"/g, '`"');
  const escapedPath = absolutePath.replace(/\\/g, '\\\\');
  
  // Build SumatraPDF print settings based on print mode
  // SumatraPDF supports: simplex, duplex (long edge), duplexshort (short edge)
  const printSettings = printMode && printMode !== 'simplex' ? printMode : '';
  const printSettingsArg = printSettings ? `-print-settings "${printSettings}"` : '';
  
  const psScript = `
# PDF Printing Script
$ErrorActionPreference = "Continue"
$printerName = "${escapedPrinterName}"
$pdfPath = "${escapedPath}"
$printSettings = "${printSettings}"

# SumatraPDF paths
$sumatraPaths = @(
  "$env:LOCALAPPDATA\\SumatraPDF\\SumatraPDF.exe",
  "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe",
  "C:\\Program Files (x86)\\SumatraPDF\\SumatraPDF.exe"
)

$sumatraPath = $null
foreach ($p in $sumatraPaths) {
  if (Test-Path $p) {
    $sumatraPath = $p
    break
  }
}

if ($sumatraPath) {
  Write-Host "Using SumatraPDF to print..."
  # Build print arguments with optional print settings (duplex mode)
  if ($printSettings) {
    $printArgs = "-print-to \`"$printerName\`" -print-settings \`"$printSettings\`" \`"$pdfPath\`""
    Write-Host "Print mode: $printSettings"
  } else {
    $printArgs = "-print-to \`"$printerName\`" \`"$pdfPath\`""
    Write-Host "Print mode: simplex (single-sided)"
  }
  
  # Start SumatraPDF and wait for it to queue the job (not for full completion)
  # SumatraPDF queues the job quickly and returns, but -Wait can timeout on some systems
  $proc = Start-Process -FilePath $sumatraPath -ArgumentList $printArgs -WindowStyle Hidden -PassThru
  
  # Wait up to 30 seconds for SumatraPDF to start and queue the job
  $waited = $proc.WaitForExit(30000)
  
  if (-not $waited) {
    # Process is still running after 30s - it's likely printing, which is fine
    Write-Host "SumatraPDF is processing (still running after 30s - this is normal for large files)"
  }
  
  Write-Host "Print job sent via SumatraPDF"
  exit 0
}

# Fallback: Adobe Reader (does not support duplex via command line)
$adobePaths = @(
  "$env:ProgramFiles\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe",
  "\${env:ProgramFiles(x86)}\\Adobe\\Acrobat DC\\Acrobat\\Acrobat.exe",
  "$env:ProgramFiles\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe",
  "\${env:ProgramFiles(x86)}\\Adobe\\Acrobat Reader DC\\Reader\\AcroRd32.exe"
)

foreach ($p in $adobePaths) {
  if (Test-Path $p) {
    Write-Host "Using Adobe Reader to print (duplex settings not supported, using printer defaults)..."
    $printArgs = "/t \`"$pdfPath\`" \`"$printerName\`""
    # Don't wait for Adobe - just start and exit
    Start-Process -FilePath $p -ArgumentList $printArgs -WindowStyle Hidden
    Start-Sleep -Seconds 2
    Write-Host "Print job sent via Adobe Reader"
    exit 0
  }
}

# Fallback: Windows default handler (duplex settings not supported)
Write-Host "Using Windows default PDF handler (duplex settings not supported)..."
try {
  $psi = New-Object System.Diagnostics.ProcessStartInfo
  $psi.FileName = $pdfPath
  $psi.Verb = "printto"
  $psi.Arguments = "\`"$printerName\`""
  $psi.CreateNoWindow = $true
  $psi.WindowStyle = [System.Diagnostics.ProcessWindowStyle]::Hidden
  $process = [System.Diagnostics.Process]::Start($psi)
  # Wait up to 10 seconds
  $process.WaitForExit(10000)
  Write-Host "Print job sent via default handler"
  exit 0
} catch {
  Write-Host "Error: $_"
  exit 1
}
`;

  await fs.writeFile(tempScriptPath, psScript, 'utf-8');
  
  const modeDisplay = printMode === 'duplex' ? 'duplex (long edge)' : 
                      printMode === 'duplexshort' ? 'duplex (short edge)' : 
                      'simplex (single-sided)';
  console.log(`  🖨️  Printing to: ${printerName}`);
  console.log(`  📄 Print mode: ${modeDisplay}`);
  
  try {
    const { stdout, stderr } = await execAsync(`powershell -NoProfile -ExecutionPolicy Bypass -File "${tempScriptPath}"`, {
      windowsHide: true,
      timeout: 120000,  // Increased to 120 seconds
    });
    
    // Log output from PowerShell script
    if (stdout) {
      stdout.trim().split('\n').forEach(line => {
        if (line.trim()) console.log(`  📝 ${line.trim()}`);
      });
    }
    
    console.log('  ✅ Print job sent successfully');
  } catch (error) {
    // Check if the error is just stderr output but command succeeded
    // Some PowerShell commands write to stderr even on success
    if (error.stdout && error.stdout.includes('Print job sent')) {
      console.log('  ⚠️  PowerShell had warnings but print job was sent:');
      if (error.stdout) {
        error.stdout.trim().split('\n').forEach(line => {
          if (line.trim()) console.log(`     ${line.trim()}`);
        });
      }
      // Don't re-throw - treat as success
    } else if (error.killed) {
      // Timeout - but job might still have been sent
      console.log('  ⚠️  PowerShell timed out, but print job may have been sent');
      // Don't re-throw - the job might still be in the queue
    } else {
      // Real error
      console.error('  ❌ PowerShell error:');
      if (error.stdout) console.error(`     stdout: ${error.stdout.trim()}`);
      if (error.stderr) console.error(`     stderr: ${error.stderr.trim()}`);
      throw error;
    }
  } finally {
    try { await fs.unlink(tempScriptPath); } catch {}
  }
}

// =============================================================================
// JOB PROCESSING
// =============================================================================

async function processJob(job) {
  const paperType = job.paperType || 'greeting-card';
  const printerName = job.printerName;
  // Get print mode from job, with smart defaults based on paper type
  // greeting-card: duplexshort (double-sided, short edge for folded cards)
  // sticker: simplex (single-sided on plain paper)
  const printMode = job.printMode || (paperType === 'greeting-card' ? 'duplexshort' : 'simplex');
  
  const modeDisplay = printMode === 'duplex' ? 'duplex (long edge)' : 
                      printMode === 'duplexshort' ? 'duplex (short edge)' : 
                      'simplex (single-sided)';
  
  console.log(`\n📋 Processing job: ${job.id}`);
  console.log(`   Type: ${paperType === 'sticker' ? '🏷️  STICKER' : '💌 GREETING CARD'}`);
  console.log(`   Kiosk: ${job.kioskName || 'Unknown'}`);
  console.log(`   Printer: ${printerName || '(not configured)'}`);
  console.log(`   Print Mode: ${modeDisplay}`);
  if (paperType === 'sticker') {
    console.log(`   JPG URL: ${job.jpgUrl ? 'Yes ✓' : 'No'}`);
  } else {
    console.log(`   PDF URL: ${job.pdfUrl ? 'Yes ✓' : 'No'}`);
  }

  if (!printerName) {
    throw new Error(`No printer configured for ${paperType} on this kiosk. Please add a printer in admin portal.`);
  }

  const jobDir = path.join(CONFIG.tempDir, job.id);
  await fs.mkdir(jobDir, { recursive: true });

  try {
    let pdfPath = path.join(jobDir, `${paperType}.pdf`);

    // PREFERRED: Download server-generated PDF
    if (job.pdfUrl) {
      console.log('  📄 Downloading server-generated PDF...');
      await downloadPdf(job.pdfUrl, pdfPath);
      console.log('  ✅ PDF downloaded successfully');
    }
    // STICKER JOBS: Download JPG and convert to PDF
    else if (paperType === 'sticker' && job.jpgUrl) {
      console.log('  🏷️  Processing sticker job with JPG...');
      const jpgPath = path.join(jobDir, 'sticker.jpg');
      await downloadImage(job.jpgUrl, jpgPath);
      console.log('  ✅ JPG downloaded successfully');

      // Convert JPG to PDF for printing (Letter size, 8.5x11)
      console.log('  📄 Converting JPG to PDF...');
      const jpgBuffer = await fs.readFile(jpgPath);
      const jpgImage = await sharp(jpgBuffer);
      const metadata = await jpgImage.metadata();

      // Create a PDF with the sticker image (Letter size = 612x792 points)
      const pdfDoc = await PDFDocument.create();
      const page = pdfDoc.addPage([612, 792]); // Letter size in points

      // Embed the JPG image
      const jpgEmbed = await pdfDoc.embedJpg(jpgBuffer);
      
      // Calculate scaling to fit the page while maintaining aspect ratio
      const pageWidth = 612;
      const pageHeight = 792;
      const imgWidth = jpgEmbed.width;
      const imgHeight = jpgEmbed.height;
      
      // Scale to fit page
      const scaleX = pageWidth / imgWidth;
      const scaleY = pageHeight / imgHeight;
      const scale = Math.min(scaleX, scaleY);
      
      const drawWidth = imgWidth * scale;
      const drawHeight = imgHeight * scale;
      const x = (pageWidth - drawWidth) / 2;
      const y = (pageHeight - drawHeight) / 2;
      
      page.drawImage(jpgEmbed, {
        x,
        y,
        width: drawWidth,
        height: drawHeight,
      });

      const pdfBytes = await pdfDoc.save();
      await fs.writeFile(pdfPath, pdfBytes);
      console.log('  ✅ PDF created from sticker JPG');
    }
    // FALLBACK: Generate PDF from images (legacy support for greeting cards)
    else if (job.imagePaths && job.imagePaths.length >= 4) {
      console.log('  ⚠️  No PDF URL provided - generating from images (slower)');

      const config = getPaperConfig(job.paperSize || 'letter');
      console.log(`   Paper: ${config.name}`);

      const imageFiles = {
        front: path.join(jobDir, 'page_1.png'),
        insideRight: path.join(jobDir, 'page_2.png'),
        insideLeft: path.join(jobDir, 'page_3.png'),
        back: path.join(jobDir, 'page_4.png'),
      };

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

      console.log('  🔧 Creating composite images...');
      const side1Path = path.join(jobDir, 'side1.png');
      const side2Path = path.join(jobDir, 'side2.png');

      await createCompositeImage(side1Path, imageFiles.back, imageFiles.front, config);
      await createCompositeImage(side2Path, imageFiles.insideRight, imageFiles.insideLeft, config);

      console.log('  📄 Creating PDF...');
      await createPdf(pdfPath, side1Path, side2Path, config);
    } else {
      // Provide a more helpful error message
      const hasJpgUrl = job.jpgUrl ? 'Yes' : 'No';
      const hasImagePaths = job.imagePaths?.length > 0 ? `Yes (${job.imagePaths.length})` : 'No';
      throw new Error(`Job has no printable content. PDF URL: No, JPG URL: ${hasJpgUrl}, Image Paths: ${hasImagePaths}`);
    }

    // Print using PowerShell (works for BOTH stickers and greeting cards)
    // Pass printMode to control duplex/simplex printing
    await printPdfWithPowerShell(pdfPath, printerName, printMode);
    
    // Wait for print queue to clear
    await waitForPrintComplete(printerName, 120000);

    // Update job status on server
    await updateJobStatus(job.id, 'completed');

    // Cleanup
    await fs.rm(jobDir, { recursive: true, force: true });

    console.log(`  ✅ Job ${job.id} completed successfully!`);

  } catch (error) {
    console.error(`  ❌ Job ${job.id} failed:`);
    console.error(`     Error: ${error.message}`);
    await updateJobStatus(job.id, 'failed', error.message);

    try {
      await fs.rm(jobDir, { recursive: true, force: true });
    } catch { }
  }
}

// =============================================================================
// JOB STATUS UPDATES
// =============================================================================

/**
 * Update job status using the database-backed endpoint
 */
async function updateJobStatusDB(jobId, status, error = null) {
  const maxRetries = 10;
  
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
        const waitTime = Math.min(Math.pow(1.5, attempt) * 500, 5000);
        console.log(`  ⏳ DB status update rate limited, retry ${attempt + 1}/${maxRetries} in ${(waitTime/1000).toFixed(1)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (response.ok) {
        return true;
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
 */
async function updateJobStatusLegacy(jobId, status, error = null) {
  const maxRetries = 10;
  
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
        const waitTime = Math.min(Math.pow(1.5, attempt) * 500, 5000);
        console.log(`  ⏳ Status update rate limited, retry ${attempt + 1}/${maxRetries} in ${(waitTime/1000).toFixed(1)}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (response.ok) {
        if (status === 'completed') {
          console.log(`  ✅ Status "${status}" sent to server successfully`);
        }
        return true;
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
  updateJobStatusDB(jobId, status, error).catch(() => {});
  
  // PRIORITY 3: Cleanup (non-blocking)
  if (status === 'completed' || status === 'failed') {
    cleanupCompletedJobs().catch(() => {});
  }
}

async function cleanupCompletedJobs() {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(`${CONFIG.cloudServerUrl}/print-jobs/clear-all`, {
        method: 'DELETE',
      });
      
      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`  ⏳ Cleanup rate limited, waiting ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (response.ok) {
        const result = await response.json();
        if (result.cleared > 0) {
          console.log(`  🧹 Cleared queue (${result.cleared} job(s) removed)`);
        }
        return;
      }
    } catch (err) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  console.warn('  ⚠️ Could not clear queue after retries');
}

// =============================================================================
// MAIN POLLING LOOP
// =============================================================================

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
    const pendingJobs = jobs.filter(j => 
      j.status === 'pending' && !locallyProcessedJobs.has(j.id)
    );

    if (pendingJobs.length > 0) {
      console.log(`\n🔍 Found ${pendingJobs.length} new job(s) in queue`);
      pendingJobs.forEach((j, i) => {
        console.log(`   ${i + 1}. ${j.id} (${j.paperType || 'greeting-card'}) - Printer: ${j.printerName || 'not set'}`);
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
        
        console.log(`  📋 Job ${job.id} added to local tracking (${locallyProcessedJobs.size} total tracked)`);
      }
    }
  } catch (error) {
    if (error.message.includes('ECONNREFUSED') || error.message.includes('fetch failed')) {
      // Server might be down, just wait and retry
    } else if (error.message.includes('429')) {
      // Rate limited - skip logging
    } else {
      console.error('Poll error (memory):', error.message);
    }
  }
}

let pollCount = 0;
const locallyProcessedJobs = new Set();

async function pollForJobs() {
  pollCount++;
  if (pollCount % 6 === 0) {
    const now = new Date().toLocaleTimeString();
    console.log(`\n⏱️  [${now}] Still polling... (${pollCount} polls so far)`);
  }
  
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
  console.log('');
}

async function fetchKioskPrinters(kioskId) {
  console.log('\n🔧 Kiosk Printer Configurations (from database):');
  console.log('─'.repeat(60));

  try {
    const response = await fetch(`${CONFIG.cloudServerUrl}/local-agent/kiosk-printers/${kioskId}`);
    if (!response.ok) {
      throw new Error(`Server returned ${response.status}`);
    }

    const data = await response.json();
    const printers = data.printers || [];
    
    if (printers.length > 0) {
      printers.forEach((printer, i) => {
        const typeIcon = printer.printableType === 'sticker' ? '🏷️ ' : '💌';
        const modeDisplay = printer.printMode === 'duplex' ? 'Duplex (long edge)' : 
                            printer.printMode === 'duplexshort' ? 'Duplex (short edge)' : 
                            'Simplex (single-sided)';
        console.log(`  ${i + 1}. ${printer.name} ${typeIcon}`);
        console.log(`     Windows Name: ${printer.printerName}`);
        console.log(`     IP: ${printer.ipAddress || '(not set)'}`);
        console.log(`     Type: ${printer.printableType}`);
        console.log(`     Print Mode: ${modeDisplay}`);
        console.log(`     Status: ${printer.status}`);
      });
      return printers;
    } else {
      console.log('  No printers configured for this kiosk');
      console.log('  Add printers in the admin portal: /admin/kiosks');
      return [];
    }
  } catch (err) {
    console.error(`  ⚠️ Could not fetch kiosk printers: ${err.message}`);
    return [];
  }

  console.log('─'.repeat(60));
  console.log('');
}

async function clearJobQueue() {
  console.log('\n🧹 Clearing old jobs from queue (starting fresh)...');
  
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      const response = await fetch(`${CONFIG.cloudServerUrl}/print-jobs/clear-all`, {
        method: 'DELETE',
      });
      
      if (response.status === 429) {
        const waitTime = Math.pow(2, attempt) * 1000;
        console.log(`   ⏳ Rate limited, waiting ${waitTime/1000}s...`);
        await new Promise(resolve => setTimeout(resolve, waitTime));
        continue;
      }
      
      if (response.ok) {
        const result = await response.json();
        console.log(`   ✅ Cleared ${result.cleared || 0} old job(s) from queue`);
        console.log('');
        return;
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
 * Start multi-printer status monitoring
 */
async function startPrinterMonitoring(kioskId, apiKey, printers) {
  console.log('\n' + '─'.repeat(60));
  console.log('  🖨️  PRINTER STATUS MONITOR');
  console.log('─'.repeat(60));

  if (!printers || printers.length === 0) {
    console.log('  ⚠️ No printers configured - monitoring disabled');
    console.log('  💡 Add printers in admin portal to enable monitoring');
    console.log('─'.repeat(60) + '\n');
    return null;
  }

  const monitor = new MultiPrinterMonitor({
    kioskId,
    apiKey,
    serverUrl: CONFIG.cloudServerUrl,
    printers,
    pollInterval: 30000,
    reportInterval: 60000,
  });

  await monitor.start();
  
  console.log(`  ✅ Monitoring ${printers.length} printer(s)`);
  printers.forEach(p => {
    console.log(`     - ${p.name} (${p.printableType})`);
  });
  console.log('─'.repeat(60) + '\n');

  return monitor;
}

async function waitForPairing(pairingServer) {
  return new Promise((resolve) => {
    pairingServer.onPaired = (pairing) => {
      console.log(`\n  ✅ Device paired to kiosk: ${pairing.kioskName || pairing.kioskId}`);
      resolve(pairing);
    };

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
  
  // Initialize surveillance manager variable (will be set later after pairing/config is loaded)
  let surveillanceManager = null;

  const pairingServer = new DevicePairingServer({
    port: CONFIG.localServices.pairingPort,
    surveillanceManager: surveillanceManager, // Pass surveillance manager for recording
  });

  await pairingServer.start();
  
  let pairing = await pairingServer.loadPairing();
  let surveillanceConfig = null;
  
  console.log('\n  🌐 Opening manager portal...');
  pairingServer.openManagerPage(CONFIG.frontendUrl);
  
  if (!pairing || !pairing.kioskId || !pairing.apiKey) {
    console.log('  📱 Device not paired to any kiosk');
    
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
  } else {
    console.log('  ⚠️  Could not fetch cloud config, using pairing config');
    surveillanceConfig = pairing.config?.surveillance || CONFIG.surveillance;
    surveillanceConfig.kioskId = pairing.kioskId;
    surveillanceConfig.apiKey = pairing.apiKey;
  }
  
  console.log('');
  await listPrinters();
  
  // Fetch configured printers for this kiosk
  const kioskPrinters = await fetchKioskPrinters(pairing.kioskId);
  
  // Clear old jobs from queue - start fresh every time
  await clearJobQueue();

  // Start continuous surveillance if enabled (for people counting)
  // Session-based recording will be started/stopped via HTTP endpoints on pairing server
  // If we already have a surveillance manager from config, use it, otherwise create new one
  if (!surveillanceManager) {
    surveillanceManager = await startSurveillance(surveillanceConfig);
  } else if (surveillanceConfig && surveillanceConfig.enabled) {
    // Update existing manager with new config
    surveillanceManager.updateConfig({
      kioskId: surveillanceConfig.kioskId,
      apiKey: surveillanceConfig.apiKey,
      webcamIndex: surveillanceConfig.webcamIndex ?? 0,
      httpPort: surveillanceConfig.httpPort ?? 8765,
      dwellThreshold: surveillanceConfig.dwellThresholdSeconds ?? 8,
      frameThreshold: surveillanceConfig.frameThreshold ?? 10,
      showPreview: surveillanceConfig.showPreview ?? false,
    });
  }
  
  // Update pairing server with surveillance manager (for session recording control)
  pairingServer.surveillanceManager = surveillanceManager;

  // Start multi-printer monitoring
  const printerMonitor = await startPrinterMonitoring(pairing.kioskId, pairing.apiKey, kioskPrinters);

  console.log('🔄 Waiting for print jobs...');
  console.log(`   Kiosk: ${pairing.kioskId}`);
  console.log('   Press Ctrl+C to stop\n');

  // Handle graceful shutdown
  const shutdown = () => {
    console.log('\n\n⏹️  Shutting down...');
    if (printerMonitor) {
      printerMonitor.stop();
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
