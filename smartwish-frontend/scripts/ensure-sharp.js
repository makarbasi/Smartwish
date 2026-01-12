#!/usr/bin/env node

// Ensure sharp is properly installed for the current platform
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function findSharp() {
  // Try to find sharp in node_modules
  const possiblePaths = [
    path.join(process.cwd(), 'node_modules', 'sharp'),
    path.join(process.cwd(), 'node_modules', '.pnpm', 'sharp@'),
  ];
  
  for (const basePath of possiblePaths) {
    if (basePath.includes('.pnpm')) {
      // For pnpm, we need to find the actual versioned directory
      try {
        const pnpmDir = path.join(process.cwd(), 'node_modules', '.pnpm');
        if (fs.existsSync(pnpmDir)) {
          const entries = fs.readdirSync(pnpmDir);
          const sharpDir = entries.find(e => e.startsWith('sharp@'));
          if (sharpDir) {
            const sharpPath = path.join(pnpmDir, sharpDir, 'node_modules', 'sharp');
            if (fs.existsSync(sharpPath)) {
              return sharpPath;
            }
          }
        }
      } catch (e) {
        // Ignore
      }
    } else {
      if (fs.existsSync(basePath)) {
        return basePath;
      }
    }
  }
  return null;
}

function checkSharpBinary(sharpPath) {
  if (!sharpPath) return false;
  
  const buildPath = path.join(sharpPath, 'build', 'Release');
  if (!fs.existsSync(buildPath)) return false;
  
  const binaryFiles = fs.readdirSync(buildPath).filter(f => f.endsWith('.node'));
  return binaryFiles.length > 0;
}

console.log('Checking sharp installation...');

const sharpPath = findSharp();
if (sharpPath) {
  console.log('Found sharp at:', sharpPath);
  
  if (!checkSharpBinary(sharpPath)) {
    console.log('Sharp binary not found, attempting to rebuild...');
    try {
      // Try npm rebuild
      execSync('npm rebuild sharp', { stdio: 'inherit', cwd: process.cwd() });
      console.log('Sharp rebuild completed');
    } catch (e) {
      try {
        // Try pnpm rebuild
        execSync('pnpm rebuild sharp', { stdio: 'inherit', cwd: process.cwd() });
        console.log('Sharp rebuild completed (pnpm)');
      } catch (e2) {
        console.warn('Could not rebuild sharp automatically. Please ensure install scripts are enabled.');
        console.warn('On Render.com, check build settings to ensure install scripts run.');
      }
    }
  } else {
    console.log('Sharp binary found, installation looks good');
  }
} else {
  console.log('Sharp not found in node_modules, it should be installed as a dependency');
}
