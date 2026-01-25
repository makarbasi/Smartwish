/**
 * Events Scraper Manager
 * 
 * This script manages the daily scraping of Eventbrite events and deploys
 * them to the frontend public folder for display on the kiosk.
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// ES module equivalent of __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const SCRAPER_DIR = path.join(__dirname, 'events-scraper');
const FRONTEND_PUBLIC_EVENTS = path.resolve(__dirname, '../../smartwish-frontend/public/events');
const PYTHON_SCRIPT = path.join(SCRAPER_DIR, 'scrape_events.py');
const LOG_FILE = path.join(SCRAPER_DIR, 'scraper.log');

// Configuration
const SCRAPE_INTERVAL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
const SCRAPE_TIME = { hour: 3, minute: 0 }; // Run at 3:00 AM daily

/**
 * Log message to console and file
 */
function log(message) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] ${message}\n`;
  console.log(logMessage.trim());
  fs.appendFileSync(LOG_FILE, logMessage);
}

/**
 * Copy directory recursively
 */
function copyDirectory(src, dest) {
  // Create destination directory if it doesn't exist
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDirectory(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

/**
 * Run the Python scraper
 */
function runScraper() {
  return new Promise((resolve, reject) => {
    log('🚀 Starting Eventbrite scraper...');

    const python = spawn('python', [PYTHON_SCRIPT], {
      cwd: SCRAPER_DIR,
      env: process.env
    });

    let stdout = '';
    let stderr = '';

    python.stdout.on('data', (data) => {
      const output = data.toString();
      stdout += output;
      console.log(output);
    });

    python.stderr.on('data', (data) => {
      const error = data.toString();
      stderr += error;
      console.error(error);
    });

    python.on('close', (code) => {
      if (code === 0) {
        log('✅ Scraper completed successfully');
        resolve({ stdout, stderr });
      } else {
        log(`❌ Scraper failed with exit code ${code}`);
        reject(new Error(`Scraper failed with exit code ${code}\n${stderr}`));
      }
    });

    python.on('error', (err) => {
      log(`❌ Failed to start scraper: ${err.message}`);
      reject(err);
    });
  });
}

/**
 * Deploy scraped content to frontend
 */
function deployToFrontend() {
  try {
    log('📦 Deploying content to frontend...');

    // Check if required files exist
    const htmlFile = path.join(SCRAPER_DIR, 'index.html');
    const dataFile = path.join(SCRAPER_DIR, 'event_data.js');
    const imagesDir = path.join(SCRAPER_DIR, 'images');

    if (!fs.existsSync(htmlFile)) {
      throw new Error('index.html not found');
    }
    if (!fs.existsSync(dataFile)) {
      throw new Error('event_data.js not found');
    }

    // Create public events directory if it doesn't exist
    if (!fs.existsSync(FRONTEND_PUBLIC_EVENTS)) {
      fs.mkdirSync(FRONTEND_PUBLIC_EVENTS, { recursive: true });
    }

    // Copy files
    fs.copyFileSync(htmlFile, path.join(FRONTEND_PUBLIC_EVENTS, 'index.html'));
    fs.copyFileSync(dataFile, path.join(FRONTEND_PUBLIC_EVENTS, 'event_data.js'));

    // Copy images directory if it exists
    if (fs.existsSync(imagesDir)) {
      const destImagesDir = path.join(FRONTEND_PUBLIC_EVENTS, 'images');
      copyDirectory(imagesDir, destImagesDir);
      log(`✅ Copied images directory (${fs.readdirSync(imagesDir).length} files)`);
    }

    log('✅ Content deployed successfully');
  } catch (error) {
    log(`❌ Deployment failed: ${error.message}`);
    throw error;
  }
}

/**
 * Run the complete scrape and deploy workflow
 */
async function scrapeAndDeploy() {
  try {
    log('═══════════════════════════════════════════');
    log('Starting Events Scraper Workflow');
    log('═══════════════════════════════════════════');

    // Run scraper
    await runScraper();

    // Deploy to frontend
    deployToFrontend();

    log('═══════════════════════════════════════════');
    log('✅ Workflow completed successfully!');
    log('═══════════════════════════════════════════');
  } catch (error) {
    log('═══════════════════════════════════════════');
    log(`❌ Workflow failed: ${error.message}`);
    log('═══════════════════════════════════════════');
  }
}

/**
 * Calculate milliseconds until next scheduled run
 */
function getMillisecondsUntilNextRun() {
  const now = new Date();
  const next = new Date();

  next.setHours(SCRAPE_TIME.hour, SCRAPE_TIME.minute, 0, 0);

  // If the time has already passed today, schedule for tomorrow
  if (next <= now) {
    next.setDate(next.getDate() + 1);
  }

  return next - now;
}

/**
 * Schedule daily scraping
 */
function scheduleDailyScraping() {
  const msUntilNext = getMillisecondsUntilNextRun();
  const nextRun = new Date(Date.now() + msUntilNext);

  log(`📅 Next scrape scheduled for: ${nextRun.toLocaleString()}`);

  setTimeout(() => {
    scrapeAndDeploy();
    // Schedule next run
    setInterval(scrapeAndDeploy, SCRAPE_INTERVAL);
  }, msUntilNext);
}

/**
 * Main entry point
 */
function main() {
  log('🎬 Events Scraper Manager started');

  // Check if Python is available
  const pythonCheck = spawn('python', ['--version']);

  pythonCheck.on('error', () => {
    log('❌ Python not found. Please install Python to run the scraper.');
    process.exit(1);
  });

  pythonCheck.on('close', (code) => {
    if (code === 0) {
      log('✅ Python is available');

      // Run immediately on startup (comment out if you don't want initial run)
      log('🏃 Running initial scrape...');
      scrapeAndDeploy();

      // Schedule daily runs
      scheduleDailyScraping();
    }
  });
}

// Run if called directly (ES module equivalent of require.main === module)
const isMainModule = import.meta.url === `file://${process.argv[1].replace(/\\/g, '/')}`;
if (isMainModule) {
  main();
}

export {
  runScraper,
  deployToFrontend,
  scrapeAndDeploy
};
