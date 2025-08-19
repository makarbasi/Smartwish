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

const imageFiles = {
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
// const PRINTER_NAME = 'HP Envy 6100e series [HPIECD37C]'; // <<< --- Your working printer name
// const PRINTER_NAME = 'Microsoft Print to PDF';
// Target dimensions (based on 8.5x11 paper, folded to 5.5x8.5 panels)
const panelWidthPx = 1650; // 5.5 inches * 300 DPI
const panelHeightPx = 2550; // 8.5 inches * 300 DPI
const paperWidthPx = panelWidthPx * 2; // 3300px (11 inches)
const paperHeightPx = panelHeightPx; // 2550px (8.5 inches)

// PDF page size in points (1 inch = 72 points)
const paperWidthPoints = 11 * 72; // 792
const paperHeightPoints = 8.5 * 72; // 612
// --- End Configuration ---

// --- Image Compositing Function (Keep as before) ---
async function createCompositeImage(outputFilename, leftImgPath, rightImgPath, rotateLeft = false, rotateRight = false) {
  try {
    console.log(`Creating composite image: ${outputFilename}`);

    // Read metadata for logging
    const leftMeta = await sharp(leftImgPath).metadata();
    const rightMeta = await sharp(rightImgPath).metadata();

    console.log(` -> Left Image (${path.basename(leftImgPath)}): ${leftMeta.width}x${leftMeta.height}`);
    console.log(` -> Right Image (${path.basename(rightImgPath)}): ${rightMeta.width}x${rightMeta.height}`);
    console.log(` -> Resizing to Panel Size: ${panelWidthPx}x${panelHeightPx}`);

    // Prepare and transform images
    let leftImageSharp = sharp(leftImgPath).resize(panelWidthPx, panelHeightPx, { fit: 'fill' });
    if (rotateLeft) leftImageSharp = leftImageSharp.rotate(180);

    let rightImageSharp = sharp(rightImgPath).resize(panelWidthPx, panelHeightPx, { fit: 'fill' });
    if (rotateRight) rightImageSharp = rightImageSharp.rotate(180);

    // Composite images side by side
    await sharp({
      create: {
        width: paperWidthPx,
        height: paperHeightPx,
        channels: 4,
        background: { r: 255, g: 255, b: 255, alpha: 1 },
      },
    })
      .composite([
        { input: await leftImageSharp.toBuffer(), top: 0, left: 0 },
        { input: await rightImageSharp.toBuffer(), top: 0, left: panelWidthPx },
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

// --- PDF Creation Function (Keep as before) ---
async function createPdf(pdfPath, side1ImagePath, side2ImagePath) {
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

    const page1 = pdfDoc.addPage([paperWidthPoints, paperHeightPoints]);
    page1.drawImage(side1Image, { x: 0, y: 0, width: paperWidthPoints, height: paperHeightPoints });

    const page2 = pdfDoc.addPage([paperWidthPoints, paperHeightPoints]);
    page2.drawImage(side2Image, { x: 0, y: 0, width: paperWidthPoints, height: paperHeightPoints });

    const pdfBytes = await pdfDoc.save();
    await fs.writeFile(pdfPath, pdfBytes);
    console.log(`Successfully created ${pdfPath}`);
  } catch (error) {
    console.error(`Error creating PDF ${pdfPath}:`, error);
    throw error;
  }
}

// --- Printing Function (Using pdf-to-printer) ---
async function printPdfWithPdfToPrinter(pdfFilePath, printerName) {
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
        console.log("\n--- Checking Printers with pdf-to-printer ---");
        const printers = await getPrinters();
        console.log(printers)
        console.log("Available Printers Found:");
        
        let foundPrinter = false;
        printers.forEach(p => {
            console.log(` - "${p.name}"`);
            if (p.name === printerName) {
                foundPrinter = true;
            }
        });
        if (!foundPrinter) {
             console.warn(`⚠️ Warning: Specified printer "${printerName}" not found in the list above. Printing might fail or go to default.`);
             console.warn(`   Ensure the PRINTER_NAME constant matches one of the listed printers exactly.`);
        } else {
             console.log(`Printer "${printerName}" confirmed in list.`);
        }
        console.log("--- End Printer Check ---");


        // --- Prepare options for pdf-to-printer ---
        // It's crucial that OS defaults are set correctly for duplex/borderless
        const printOptions = {
            printer: printerName,
            // Add pdf-to-printer specific options here if needed (check its docs)
            // Common ones might relate to scaling, copies, orientation, but often
            // relying on OS defaults for duplex/borderless is necessary.
            // Example (check pdf-to-printer docs if these are valid):
            // scale: "noscale",
            // orientation: "landscape",
            // duplex: "DuplexTumble" // Or "DuplexNoTumble" - depends on printer & lib
        };

        console.warn("\n M A N D A T O R Y : ");
        console.warn("=======================================================================================");
        console.warn(" Ensure printer defaults are set correctly in Windows 'Printing Preferences':");
        console.warn("   1. Paper Size: Letter (8.5 x 11 in)");
        console.warn("   2. Orientation: Landscape");
        console.warn("   3. Two-Sided Printing: ON / Duplex");
        console.warn("   4. Duplex Type: Flip on Short Edge (or 'Tablet', 'Top Binding')");
        console.warn("   5. Borderless Printing: ON (Select the 8.5x11 Borderless option if available)");
        console.warn("   6. Scaling: None / Actual Size / 100%");
        console.warn("=======================================================================================");
        console.log(`\nAttempting to print ${absolutePdfPath} to "${printerName}" using pdf-to-printer...`);
        console.log("Using options:", printOptions);


        // --- Print the file ---
        //await print(absolutePdfPath, printOptions);
        await print(absolutePdfPath, { printer: printerName });
        console.log("✅ Print job successfully sent via pdf-to-printer!");
        console.log("   Check the printer physically or the Windows Print Queue for job status.");

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
export async function main(printerName) {
  const compositeSide1 = 'temp_side1.png';
  const compositeSide2 = 'temp_side2.png';

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
    await createCompositeImage(compositeSide1, imageFiles.back, imageFiles.front);
    await createCompositeImage(compositeSide2, imageFiles.insideRight, imageFiles.insideLeft, false, false);

    // Create PDF
    await createPdf(outputPdf, compositeSide1, compositeSide2);

    // Print PDF using pdf-to-printer with the specified printer
    await printPdfWithPdfToPrinter('greeting_card.pdf', printerName);
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

