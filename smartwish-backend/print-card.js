import { PDFDocument, rgb } from 'pdf-lib';
import pdfPrinter from 'pdf-to-printer';
const print = pdfPrinter.print;
const getPrinters = pdfPrinter.getPrinters;

import { promises as fs } from 'fs';
import  fss from 'fs';
import path from 'path';
import sharp from 'sharp';

export let printJobStatus = 'idle';
export function getPrintJobStatus() {
  return printJobStatus;
}

// Image files - will be set dynamically based on job directory
let imageFiles = {
  front: 'downloads/flipbook/page_1.png', // Front cover
  back: 'downloads/flipbook/page_4.png', // Back cover
  insideLeft: 'downloads/flipbook/page_3.png', // Inside Left page
  insideRight: 'downloads/flipbook/page_2.png', // Inside Right page
};
// --- Configuration ---
// const imageFiles = {
//   front: 'image1.png', // Front cover
//   back: 'image2.png', // Back cover
//   insideLeft: 'image3.png', // Inside Left page
//   insideRight: 'image4.png', // Inside Right page
// };
const outputPdf = 'greeting_card.pdf';
const DPI = 300; // High quality printing at 300 DPI

// === PAPER SIZE CONFIGURATIONS ===
// Function to get paper configuration based on selected size
function getPaperConfig(paperSize = 'custom') {
  
  if (paperSize === 'letter') {
    // LETTER SIZE: 8.5" × 11" (landscape: 11" × 8.5")
    // BORDERLESS - Card content fills the ENTIRE page
    // Standard size with FULL auto-duplex support!
    const LETTER_WIDTH = 11;    // inches (landscape)
    const LETTER_HEIGHT = 8.5;  // inches (landscape)
    
    // For Letter, each panel is HALF the page width
    const panelWidthPx = Math.round((LETTER_WIDTH / 2) * DPI);  // 5.5" = 1650px
    const panelHeightPx = Math.round(LETTER_HEIGHT * DPI);       // 8.5" = 2550px
    
    return {
      name: 'Letter',
      paperWidthPx: Math.round(LETTER_WIDTH * DPI),      // 3300px
      paperHeightPx: Math.round(LETTER_HEIGHT * DPI),    // 2550px
      paperWidthPoints: LETTER_WIDTH * 72,               // 792 points
      paperHeightPoints: LETTER_HEIGHT * 72,             // 612 points
      panelWidthPx,                                      // 1650px (5.5")
      panelHeightPx,                                     // 2550px (8.5")
      cardContentWidthPx: Math.round(LETTER_WIDTH * DPI),  // 3300px (full width)
      cardContentHeightPx: Math.round(LETTER_HEIGHT * DPI), // 2550px (full height)
      // NO margins - fill entire page for borderless printing
      horizontalOffsetPx: 0,
      verticalOffsetPx: 0,
      supportsDuplex: true,
      description: '11" × 8.5" landscape BORDERLESS (standard US Letter size)',
      trimRequired: false,
      // Folded card will be 5.5" × 8.5"
      foldedWidth: 5.5,
      foldedHeight: 8.5,
    };
  } else if (paperSize === 'half-letter') {
    // HALF LETTER (STATEMENT): 5.5" × 8.5" (landscape: 8.5" × 5.5")
    // BORDERLESS - fills entire page
    const HALF_LETTER_WIDTH = 8.5;  // inches (landscape)
    const HALF_LETTER_HEIGHT = 5.5; // inches (landscape)
    
    // Each panel is HALF the page width
    const panelWidthPx = Math.round((HALF_LETTER_WIDTH / 2) * DPI);  // 4.25" = 1275px
    const panelHeightPx = Math.round(HALF_LETTER_HEIGHT * DPI);       // 5.5" = 1650px
    
    return {
      name: 'Half Letter',
      paperWidthPx: Math.round(HALF_LETTER_WIDTH * DPI),   // 2550px
      paperHeightPx: Math.round(HALF_LETTER_HEIGHT * DPI), // 1650px
      paperWidthPoints: HALF_LETTER_WIDTH * 72,            // 612 points
      paperHeightPoints: HALF_LETTER_HEIGHT * 72,          // 396 points
      panelWidthPx,                                        // 1275px (4.25")
      panelHeightPx,                                       // 1650px (5.5")
      cardContentWidthPx: Math.round(HALF_LETTER_WIDTH * DPI),   // 2550px (full width)
      cardContentHeightPx: Math.round(HALF_LETTER_HEIGHT * DPI), // 1650px (full height)
      // NO margins - fill entire page for borderless printing
      horizontalOffsetPx: 0,
      verticalOffsetPx: 0,
      supportsDuplex: true,
      description: '8.5" × 5.5" landscape BORDERLESS (Half Letter/Statement)',
      trimRequired: false,
      foldedWidth: 4.25,
      foldedHeight: 5.5,
    };
  } else {
    // CUSTOM 8×6: Traditional card size (two 4×6 panels)
    const CARD_WIDTH_INCHES = 8;
    const CARD_HEIGHT_INCHES = 6;
    const panelWidthPx = 4 * DPI;  // 4" = 1200px
    const panelHeightPx = 6 * DPI; // 6" = 1800px
    
    return {
      name: 'Custom 8×6',
      paperWidthPx: CARD_WIDTH_INCHES * DPI,   // 2400px
      paperHeightPx: CARD_HEIGHT_INCHES * DPI, // 1800px
      paperWidthPoints: CARD_WIDTH_INCHES * 72,  // 576 points
      paperHeightPoints: CARD_HEIGHT_INCHES * 72, // 432 points
      panelWidthPx,                              // 1200px (4")
      panelHeightPx,                             // 1800px (6")
      cardContentWidthPx: CARD_WIDTH_INCHES * DPI,   // 2400px
      cardContentHeightPx: CARD_HEIGHT_INCHES * DPI, // 1800px
      horizontalOffsetPx: 0,
      verticalOffsetPx: 0,
      supportsDuplex: false,
      description: '8" × 6" landscape (custom size)',
      trimRequired: false,
      foldedWidth: 4,
      foldedHeight: 6,
    };
  }
}
// --- End Configuration ---

// --- Image Compositing Function ---
async function createCompositeImage(outputFilename, leftImgPath, rightImgPath, config, rotateLeft = false, rotateRight = false) {
  try {
    console.log(`Creating composite image: ${outputFilename}`);

    // Read metadata for logging
    const leftMeta = await sharp(leftImgPath).metadata();
    const rightMeta = await sharp(rightImgPath).metadata();

    console.log(` -> Left Image (${path.basename(leftImgPath)}): ${leftMeta.width}x${leftMeta.height}`);
    console.log(` -> Right Image (${path.basename(rightImgPath)}): ${rightMeta.width}x${rightMeta.height}`);
    console.log(` -> Resizing to Panel Size: ${config.panelWidthPx}x${config.panelHeightPx}`);

    // Prepare and transform images
    let leftImageSharp = sharp(leftImgPath).resize(config.panelWidthPx, config.panelHeightPx, { fit: 'fill' });
    if (rotateLeft) leftImageSharp = leftImageSharp.rotate(180);

    let rightImageSharp = sharp(rightImgPath).resize(config.panelWidthPx, config.panelHeightPx, { fit: 'fill' });
    if (rotateRight) rightImageSharp = rightImageSharp.rotate(180);

    // Composite images side by side, with offsets for centering on larger paper
    const leftX = config.horizontalOffsetPx;
    const rightX = config.horizontalOffsetPx + config.panelWidthPx;
    const topY = config.verticalOffsetPx;

    await sharp({
      create: {
        width: config.paperWidthPx,
        height: config.paperHeightPx,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([
        { input: await leftImageSharp.toBuffer(), top: topY, left: leftX },
        { input: await rightImageSharp.toBuffer(), top: topY, left: rightX },
      ])
      .png()
      .toFile(outputFilename);

    console.log(`Successfully created ${outputFilename}`);
    return outputFilename;
  } catch (error) {
    console.error(`Error creating composite image ${outputFilename}:`, error);
    throw error;
  }
}

// --- PDF Creation Function ---
async function createPdf(pdfPath, side1ImagePath, side2ImagePath, config) {
  try {
    console.log(`Creating PDF: ${pdfPath}`);
    const pdfDoc = await PDFDocument.create();
    const side1ImageBytes = await fs.readFile(side1ImagePath);
    const side2ImageBytes = await fs.readFile(side2ImagePath);

    let side1Image, side2Image;
    // Basic image type detection based on extension
     if (side1ImagePath.toLowerCase().endsWith('.png')) {
        side1Image = await pdfDoc.embedPng(side1ImageBytes);
    } else if (side1ImagePath.toLowerCase().endsWith('.jpg') || side1ImagePath.toLowerCase().endsWith('.jpeg')) {
        side1Image = await pdfDoc.embedJpg(side1ImageBytes);
    } else {
        throw new Error(`Unsupported image type for ${side1ImagePath}`);
    }

     if (side2ImagePath.toLowerCase().endsWith('.png')) {
        side2Image = await pdfDoc.embedPng(side2ImageBytes);
    } else if (side2ImagePath.toLowerCase().endsWith('.jpg') || side2ImagePath.toLowerCase().endsWith('.jpeg')) {
        side2Image = await pdfDoc.embedJpg(side2ImageBytes);
    } else {
        throw new Error(`Unsupported image type for ${side2ImagePath}`);
    }

    const page1 = pdfDoc.addPage([config.paperWidthPoints, config.paperHeightPoints]);
    page1.drawImage(side1Image, { x: 0, y: 0, width: config.paperWidthPoints, height: config.paperHeightPoints });

    const page2 = pdfDoc.addPage([config.paperWidthPoints, config.paperHeightPoints]);
    page2.drawImage(side2Image, { x: 0, y: 0, width: config.paperWidthPoints, height: config.paperHeightPoints });

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(pdfPath, pdfBytes);
    console.log(`Successfully created ${pdfPath}`);
  } catch (error) {
    console.error(`Error creating PDF ${pdfPath}:`, error);
    throw error;
  }
}

// --- Printing Function (Using pdf-to-printer) ---
async function printPdfWithPdfToPrinter(pdfFilePath, printerName, config) {
    const absolutePdfPath = path.resolve(pdfFilePath); // Good practice to use absolute path

    if (!printerName || printerName.trim() === '') {
        console.error("❌ Error: Printer name (PRINTER_NAME) is missing in the configuration.");
        return;
    }

    try {
        // Verify PDF exists
        try {
          await fs.access(absolutePdfPath);
          console.log("✅ PDF is accessible:", absolutePdfPath);
        } catch (err) {
          console.error("❌ PDF file is not accessible:", absolutePdfPath);
          console.error(err);
          return;
        }

        console.log(`Verified PDF exists: ${absolutePdfPath}`);

        // Optional: List printers for confirmation/debugging
        // Note: getPrinters() can be unreliable on some Windows systems, so we skip it
        console.log("\n--- Skipping printer verification (known to cause issues) ---");
        console.log(`Will attempt to print to: "${printerName}"`);
        console.log("If printer name is incorrect, the print will fail or go to default printer.");
        
        // Uncomment below if you want to try printer verification (may cause errors):
        /*
        try {
            console.log("\n--- Checking Printers with pdf-to-printer ---");
            const printers = await getPrinters();
            console.log("Available Printers Found:");
            
            let foundPrinter = false;
            if (printers && Array.isArray(printers)) {
                printers.forEach(p => {
                    console.log(` - "${p.name}"`);
                    if (p.name === printerName) {
                        foundPrinter = true;
                    }
                });
            }
            if (!foundPrinter) {
                 console.warn(`⚠️ Warning: Specified printer "${printerName}" not found in the list above.`);
            } else {
                 console.log(`Printer "${printerName}" confirmed in list.`);
            }
        } catch (printerCheckError) {
            console.warn("⚠️ Could not verify printers (this is OK, will try to print anyway):", printerCheckError.message);
        }
        */
        console.log("--- End Printer Check ---");


        // --- Prepare options for pdf-to-printer ---
        const printOptions = {
            printer: printerName,
            // Note: pdf-to-printer has limited options support
            // Most settings must be configured in Windows printer preferences
        };
        
        // Add tray selection if specified
        if (trayNumber) {
            printOptions.paperSource = `Tray ${trayNumber}`;
            console.log(`   📥 Using tray: ${trayNumber}`);
        }
        
        console.warn("\n═══════════════════════════════════════════════════════════════════════════════════");
        console.warn(`  🖨️  HP SMART TANK 7600 PRINT SETTINGS - ${config.name.toUpperCase()}`);
        console.warn("═══════════════════════════════════════════════════════════════════════════════════");
        console.warn("  PDF SETTINGS:");
        console.warn(`    ✓ Paper Size: ${config.description}`);
        console.warn("    ✓ Resolution: 300 DPI (High Quality)");
        console.warn(`    ✓ Layout: Two ${config.panelWidthPx / DPI}\" × ${config.panelHeightPx / DPI}\" panels side-by-side`);
        console.warn(`    ✓ Folded card: ${config.foldedWidth || config.panelWidthPx / DPI} × ${config.foldedHeight || config.panelHeightPx / DPI} inches`);
        console.warn("    ✓ Printer: " + printerName);
        console.warn("");
        
        if (config.supportsDuplex) {
          console.warn("  ✅ DUPLEX SUPPORT:");
          console.warn(`    • ${config.name} is a STANDARD size - supports AUTO-DUPLEX!`);
          console.warn("    • Printer will automatically flip and print both sides");
          console.warn("    • One card per print job (front + back automatically)");
          console.warn("");
        } else {
          console.warn("  ⚠️  DUPLEX LIMITATION:");
          console.warn(`    • ${config.name} is a CUSTOM size - does NOT support auto-duplex`);
          console.warn("    • You will get 2 SEPARATE pages printed");
          console.warn("    • Page 1: Back + Front");
          console.warn("    • Page 2: Inside Right + Inside Left");
          console.warn("    • Manually glue/tape them back-to-back if needed");
          console.warn("");
        }
        
        console.warn("  📋 WINDOWS PRINTER PREFERENCES:");
        if (config.name === 'Letter') {
          console.warn("    1. Paper Size: Letter (8.5 × 11 inches) - SELECT FROM DROPDOWN");
          console.warn("    2. Orientation: LANDSCAPE (11\" wide × 8.5\" tall)");
          console.warn("    3. Duplex: ON / Two-Sided Printing (flip on SHORT edge)");
        } else if (config.name === 'Half Letter') {
          console.warn("    1. Paper Size: Statement or Half Letter (5.5 × 8.5 inches) - SELECT FROM DROPDOWN");
          console.warn("    2. Orientation: LANDSCAPE (8.5\" wide × 5.5\" tall)");
          console.warn("    3. Duplex: ON / Two-Sided Printing (flip on SHORT edge)");
        } else {
          console.warn("    1. Paper Size: Create custom 8 × 6 inches (User Defined)");
          console.warn("    2. Orientation: LANDSCAPE (8\" wide × 6\" tall)");
          console.warn("    3. Duplex: OFF (not supported for custom 8×6 size)");
        }
        console.warn("    4. Paper Type: Heavyweight/Premium Matte");
        console.warn("    5. Print Quality: BEST / HIGHEST / Maximum");
        console.warn("    6. Borderless: ON (recommended for cards)");
        console.warn("");
        console.warn("  📐 HOW TO LOAD PAPER:");
        if (config.name === 'Letter') {
          console.warn("    • Use standard US Letter paper (8.5 × 11 inches) or heavyweight cardstock");
          console.warn("    • Place in LANDSCAPE orientation (11\" wide at top)");
          console.warn("    • Printer will auto-duplex - just load and go!");
          console.warn("    • ✅ BORDERLESS: Card fills entire page (no margins)");
          console.warn("    • Folded card size: 5.5\" × 8.5\"");
        } else if (config.name === 'Half Letter') {
          console.warn("    • Use Half Letter/Statement paper (5.5 × 8.5 inches) or heavyweight cardstock");
          console.warn("    • Place in LANDSCAPE orientation (8.5\" wide at top)");
          console.warn("    • Printer will auto-duplex - just load and go!");
          console.warn("    • ✅ BORDERLESS: Card fills entire page (no margins)");
          console.warn("    • Folded card size: 4.25\" × 5.5\"");
        } else {
          console.warn("    • Use 8 × 6 inch heavyweight cardstock");
          console.warn("    • Place in LANDSCAPE orientation (8\" wide at top)");
          console.warn("    • No centering needed - exact size");
        }
        console.warn("");
        if (config.name === 'Custom 8×6') {
          console.warn("  🔧 TO CREATE CUSTOM 8×6 SIZE IN WINDOWS:");
          console.warn("    • Control Panel → Devices and Printers");
          console.warn("    • Right-click 'HPA4CC43 (HP Smart Tank 7600 series)'");
          console.warn("    • 'Printing Preferences' → Main/Paper tab");
          console.warn("    • Paper Size → 'User Defined' at bottom of list");
          console.warn("    • Set Width: 8.00 inches, Height: 6.00 inches");
          console.warn("");
        }
        console.warn("═══════════════════════════════════════════════════════════════════════════════════");
        console.log(`\n🚀 Attempting to print ${absolutePdfPath} to "${printerName}" using pdf-to-printer...`);
        console.log("Using options:", JSON.stringify(printOptions, null, 2));


        // --- Print the file ---
        try {
            await print(absolutePdfPath, printOptions);
            console.log("✅ Print job successfully sent via pdf-to-printer!");
            console.log(`   📄 Paper: ${config.name} (${config.description})`);
            console.log(`   🎴 Card: ${config.foldedWidth || config.panelWidthPx / DPI} × ${config.foldedHeight || config.panelHeightPx / DPI} inches when folded`);
            console.log("   🎨 Quality: 300 DPI High Resolution");
            if (config.supportsDuplex) {
              console.log("   ✅ Result: ONE double-sided card (auto-duplex)");
            } else {
              console.log("   ⚠️  Result: 2 SEPARATE pages (no duplex on custom size)");
            }
            console.log("   📊 Check the printer physically or Windows Print Queue for job status.");
            console.log("");
            if (!config.supportsDuplex) {
              console.log("   💡 TIP: For one double-sided card:");
              console.log("      • You'll get 2 sheets printed separately");
              console.log("      • Manually align and glue/tape them back-to-back");
            }
        } catch (printError) {
            console.error("❌ Print with options failed, trying with basic options...");
            console.error("Error details:", printError.message);
            // Fallback: Try without advanced options if printer doesn't support them
            await print(absolutePdfPath, { printer: printerName });
            console.log("⚠️  Printed with basic options. Please verify print settings manually.");
        }

    } catch (err) {
        console.error(`❌ Printing failed using pdf-to-printer for "${printerName}":`, err);
        // Add specific hints based on potential errors from this library
        if (err.message && err.message.toLowerCase().includes('invalid printer name')) {
             console.error(` -> Hint: Double-check the PRINTER_NAME constant matches an available printer exactly.`);
        } else if (err.message && err.message.toLowerCase().includes('access is denied')) {
             console.error(` -> Hint: Run the Node.js script with Administrator privileges.`);
        } else {
             console.error(` -> Hint: Ensure printer is online, drivers are installed, and PDF file is not corrupted.`);
             console.error(` -> Hint: Check the Windows Print Queue for more details.`);
        }
    }
}

// --- Main Application Logic ---
export async function main(printerName, paperSize = 'custom', timestamp = null, trayNumber = null) {
  const compositeSide1 = 'temp_side1.png';
  const compositeSide2 = 'temp_side2.png';

  // If timestamp is provided, use timestamped filenames to avoid file locking
  if (timestamp) {
    console.log(`Using timestamped files: ${timestamp}`);
    imageFiles = {
      front: `downloads/flipbook/page_1_${timestamp}.png`,
      back: `downloads/flipbook/page_4_${timestamp}.png`,
      insideLeft: `downloads/flipbook/page_3_${timestamp}.png`,
      insideRight: `downloads/flipbook/page_2_${timestamp}.png`,
    };
    console.log('Updated image file paths:', imageFiles);
  }

  // Get paper configuration
  const config = getPaperConfig(paperSize);
  console.log(`\n📐 Paper Configuration: ${config.name}`);
  console.log(`   Size: ${config.description}`);
  console.log(`   Auto-Duplex: ${config.supportsDuplex ? '✅ Supported' : '❌ Not Supported'}`);
  console.log(`   Trim Required: ${config.trimRequired ? '✂️ Yes' : '✅ No'}\n`);

  try {
    // Validate inputs
    for (const key in imageFiles) {
        const filePath = imageFiles[key];
      

        if (!fss.existsSync(filePath)) {
            throw new Error(`Input image file not found: ${filePath}`);
        }
        console.log(`Found image: ${filePath}`);
    }

    // Create composite images
    await createCompositeImage(compositeSide1, imageFiles.back, imageFiles.front, config);
    await createCompositeImage(compositeSide2, imageFiles.insideRight, imageFiles.insideLeft, config, false, false);

    // Create PDF
    await createPdf(outputPdf, compositeSide1, compositeSide2, config);

    // Print PDF using pdf-to-printer with the specified printer
    await printPdfWithPdfToPrinter('greeting_card.pdf', printerName, config);
   printJobStatus = 'done';
  } catch (error) {
    printJobStatus = 'error';
    console.error('\n--- An error occurred during the process ---');
    console.error(error.message);
    // console.error(error.stack); // Uncomment for detailed stack trace
  } finally {
    // Cleanup temporary composite images
    // console.log('\nCleaning up temporary files...');
    // try {
    //   if (fs.existsSync(compositeSide1)) await fss.unlink(compositeSide1);
    //   if (fs.existsSync(compositeSide2)) await fss.unlink(compositeSide2);
    //   console.log(`Kept final PDF: ${outputPdf}`);
    //   console.log('Cleanup complete (excluding final PDF).');
    // } catch (cleanupError) {
    //   console.warn('Warning: Could not clean up temporary files.', cleanupError);
    // }
  }
}

