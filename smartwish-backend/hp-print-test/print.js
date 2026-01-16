const ipp = require('ipp');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// --- 1. CRITICAL FIX: PATCH IPP LIBRARY ---
// This attempts to register 'media-type' attribute, but the library may still reject it.
// If it fails, the code will automatically retry without media-type.
console.log("🔧 Patching IPP library attributes...");
ipp.attributes['media-type'] = { tag: 0x44 }; // 0x44 = Keyword
console.log(`   Patch status: 'media-type' is now ${ipp.attributes['media-type'] ? 'REGISTERED' : 'MISSING'}`);
console.log(`   Note: If printing fails, will automatically retry without media-type attribute`);
// ------------------------------------------

// --- CONFIGURATION ---
const PRINTER_IP = "192.168.1.239";
const FILE_NAME = "test.pdf";

// SELECT PAPER TYPE HERE:
// Options: 'matt-brochure', 'professional', 'photo-glossy', 'plain'
const SELECTED_PAPER = 'matt-brochure';
// ---------------------

const printerUrl = `http://${PRINTER_IP}:631/ipp/print`;
const printer = ipp.Printer(printerUrl);
const filePath = path.join(__dirname, FILE_NAME);

/**
 * Returns the correct IPP media-type keyword based on your selection
 */
function getMediaType(selection) {
    switch (selection) {
        case 'matt-brochure':
            return 'stationery-coated'; // Standard for Matte/Brochure
        case 'professional':
            return 'stationery-heavyweight'; // Standard for Cardstock
        case 'photo-matte':
            return 'photographic-matte';
        case 'photo-glossy':
            return 'photographic-glossy';
        default:
            return 'stationery'; // Plain paper
    }
}

function sendToPrinter(buffer, jobName, format, useMinimalAttributes = false) {
    return new Promise((resolve, reject) => {
        const mediaType = getMediaType(SELECTED_PAPER);

        const jobAttributes = {
            "copies": 1,
            "sides": "one-sided",
            "media": "na_letter_8.5x11in",  // Letter size (8.5" x 11")
            "print-quality": 5,      // 5 = High
            "orientation-requested": 3  // 3 = Portrait
        };

        // Only add optional attributes if not using minimal set
        if (!useMinimalAttributes) {
            jobAttributes["media-type"] = mediaType;
            // Removed print-scaling as it's not supported by the library
        }

        const msg = {
            "operation-attributes-tag": {
                "requesting-user-name": "Admin",
                "job-name": jobName,
                "document-format": format
            },
            "job-attributes-tag": jobAttributes,
            data: buffer
        };

        console.log(`\n📤 Sending Job: ${jobName}`);
        console.log(`   Format: ${format}`);
        if (!useMinimalAttributes) {
            console.log(`   Paper:  ${mediaType} (${SELECTED_PAPER})`);
        } else {
            console.log(`   Paper:  (using minimal attributes due to library limitations)`);
        }

        // We wrap execute in a try-catch because the serializer throws synchronous errors
        try {
            printer.execute("Print-Job", msg, (err, res) => {
                if (err) {
                    // If error is about unknown attribute and we haven't retried, retry with minimal attributes
                    const errorMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
                    if (!useMinimalAttributes && errorMsg.includes("Unknown attribute")) {
                        console.log("   ⚠️  Some attributes not supported, retrying with minimal attributes...");
                        return sendToPrinter(buffer, jobName, format, true).then(resolve).catch(reject);
                    }
                    reject(err);
                } else {
                    if (res.statusCode === 'successful-ok' || res.statusCode === 'successful-ok-ignored-or-substituted-attributes') {
                        resolve(res);
                    } else {
                        reject({
                            message: `Printer returned status: ${res.statusCode}`,
                            ippResponse: res
                        });
                    }
                }
            });
        } catch (syncError) {
            // Catch "Unknown attribute" error here specifically
            const errorMsg = syncError?.message || (typeof syncError === 'string' ? syncError : JSON.stringify(syncError));
            if (!useMinimalAttributes && errorMsg.includes("Unknown attribute")) {
                console.log("   ⚠️  Some attributes not supported, retrying with minimal attributes...");
                return sendToPrinter(buffer, jobName, format, true).then(resolve).catch(reject);
            }
            reject(syncError);
        }
    });
}

/**
 * Converts PDF to JPEG image using Ghostscript (gs command)
 * Falls back to other methods if Ghostscript is not available
 */
function convertPdfToImage(pdfPath) {
    return new Promise((resolve, reject) => {
        const outputPath = path.join(__dirname, 'temp_pdf_page.jpg');

        try {
            // Method 1: Try Ghostscript (most reliable)
            console.log("   🔄 Converting PDF to image using Ghostscript...");
            try {
                // Ghostscript command to convert first page of PDF to JPEG at 300 DPI
                // Letter size: 8.5x11 inches at 300 DPI = 2550x3300 pixels
                execSync(`gs -dNOPAUSE -dBATCH -sDEVICE=jpeg -r300 -dFirstPage=1 -dLastPage=1 -sOutputFile="${outputPath}" "${pdfPath}"`, {
                    stdio: 'ignore'
                });

                if (fs.existsSync(outputPath)) {
                    const imageBuffer = fs.readFileSync(outputPath);
                    // Clean up temp file
                    fs.unlinkSync(outputPath);
                    console.log(`   ✅ PDF converted to image (${imageBuffer.length} bytes)`);
                    resolve(imageBuffer);
                    return;
                }
            } catch (gsError) {
                console.log("   ⚠️  Ghostscript not available, trying alternative method...");
            }

            // Method 2: Try ImageMagick (convert command)
            try {
                console.log("   🔄 Trying ImageMagick...");
                execSync(`convert -density 300 "${pdfPath}[0]" -quality 95 "${outputPath}"`, {
                    stdio: 'ignore'
                });

                if (fs.existsSync(outputPath)) {
                    const imageBuffer = fs.readFileSync(outputPath);
                    fs.unlinkSync(outputPath);
                    console.log(`   ✅ PDF converted to image (${imageBuffer.length} bytes)`);
                    resolve(imageBuffer);
                    return;
                }
            } catch (imError) {
                console.log("   ⚠️  ImageMagick not available...");
            }

            reject(new Error("No PDF conversion tool available. Please install Ghostscript (gs) or ImageMagick (convert)"));
        } catch (err) {
            // Clean up on error
            if (fs.existsSync(outputPath)) {
                try { fs.unlinkSync(outputPath); } catch (e) { }
            }
            reject(err);
        }
    });
}

async function start() {
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: PDF file not found at ${filePath}`);
        process.exit(1);
    }

    // Read PDF file, convert to image, and print
    try {
        console.log("🔹 Reading PDF file...");
        const pdfBuffer = fs.readFileSync(filePath);
        console.log(`   PDF file loaded (${pdfBuffer.length} bytes).`);

        // Try PDF first, but if it fails, convert to image
        try {
            console.log("\n🔹 Attempt 1: Trying to print PDF directly...");
            const res = await sendToPrinter(pdfBuffer, "PDF-Print", "application/pdf");
            console.log(`✅ Success! Job ID: ${res["job-attributes-tag"]?.["job-id"]}`);
            return;
        } catch (pdfErr) {
            const errorMsg = pdfErr?.message || (typeof pdfErr === 'string' ? pdfErr : JSON.stringify(pdfErr));
            if (errorMsg.includes("document-format-not-supported")) {
                console.log("   ⚠️  PDF format not supported by printer.");
                console.log("\n🔹 Attempt 2: Converting PDF to image and printing...");

                // Convert PDF to image
                const imageBuffer = await convertPdfToImage(filePath);

                // Print as JPEG
                const res = await sendToPrinter(imageBuffer, "PDF-As-Image", "image/jpeg");
                console.log(`✅ Success! Job ID: ${res["job-attributes-tag"]?.["job-id"]}`);
            } else {
                throw pdfErr;
            }
        }
    } catch (err) {
        console.error("❌ Print Failed.");
        const errorMsg = err?.message || (typeof err === 'string' ? err : JSON.stringify(err));
        console.error(`   Reason: ${errorMsg}`);
        process.exit(1);
    }
}

start();