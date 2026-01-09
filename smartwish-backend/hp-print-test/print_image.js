const ipp = require('ipp');
const fs = require('fs');
const path = require('path');
let PDFDocument;

// --- 1. CRITICAL FIX: PATCH IPP LIBRARY ---
// This forces the library to recognize 'media-type' so it doesn't crash.
console.log("🔧 Patching IPP library attributes...");
ipp.attributes['media-type'] = { tag: 0x44 }; // 0x44 = Keyword
console.log(`   Patch status: 'media-type' is now ${ipp.attributes['media-type'] ? 'SUPPORTED' : 'MISSING'}`);
// ------------------------------------------

// Try to load pdfkit for fallback support
try {
    PDFDocument = require('pdfkit');
} catch (e) {
    console.log("⚠️  'pdfkit' is not installed. PDF fallback will not work.");
    console.log("   Run: npm install pdfkit");
}

// --- CONFIGURATION ---
const PRINTER_IP = "192.168.1.239";
const FILE_NAME = "test.jpg";

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

function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.png': return 'image/png';
        default: return 'application/octet-stream';
    }
}

function convertImageToPdf(imageBuffer) {
    return new Promise((resolve, reject) => {
        if (!PDFDocument) {
            return reject(new Error("pdfkit not installed"));
        }
        try {
            const doc = new PDFDocument({ autoFirstPage: false });
            const buffers = [];
            doc.on('data', buffers.push.bind(buffers));
            doc.on('end', () => resolve(Buffer.concat(buffers)));

            const img = doc.openImage(imageBuffer);
            doc.addPage({ size: [img.width, img.height], margin: 0 });
            doc.image(img, 0, 0);
            doc.end();
        } catch (err) {
            reject(err);
        }
    });
}

function sendToPrinter(buffer, jobName, format) {
    return new Promise((resolve, reject) => {
        const mediaType = getMediaType(SELECTED_PAPER);

        const msg = {
            "operation-attributes-tag": {
                "requesting-user-name": "Admin",
                "job-name": jobName,
                "document-format": format
            },
            "job-attributes-tag": {
                "copies": 1,
                "sides": "one-sided",
                "media": "iso_a4_210x297mm",
                "media-type": mediaType, // This line causes the crash if not patched
                "print-quality": 5,      // 5 = High
                "orientation-requested": 3
            },
            data: buffer
        };

        console.log(`\n📤 Sending Job: ${jobName}`);
        console.log(`   Format: ${format}`);
        console.log(`   Paper:  ${mediaType} (${SELECTED_PAPER})`);

        // We wrap execute in a try-catch because the serializer throws synchronous errors
        try {
            printer.execute("Print-Job", msg, (err, res) => {
                if (err) {
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
            reject(syncError);
        }
    });
}

async function start() {
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: File not found at ${filePath}`);
        return;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = getMimeType(filePath);

    // 1. Try Native Print
    try {
        console.log("🔹 Attempt 1: Printing Native Image...");
        const res = await sendToPrinter(fileBuffer, "Native-Image-Print", mimeType);
        console.log(`✅ Success! Job ID: ${res["job-attributes-tag"]?.["job-id"]}`);
        return;
    } catch (error) {
        console.error("❌ Native Print Failed.");
        const errorMsg = error?.message || (typeof error === 'string' ? error : JSON.stringify(error));
        console.log(`   Reason: ${errorMsg}`);

        // If the patch didn't work, stop here to avoid same error in fallback
        if (errorMsg.includes("Unknown attribute: media-type")) {
            console.log("\n🛑 CRITICAL ERROR: The library patch failed. We cannot set paper type.");
            console.log("   Attempting to print WITHOUT paper type setting as last resort...");
            await printWithoutPaperType(fileBuffer, "Emergency-No-PaperType", mimeType);
            return;
        }
    }

    // 2. Fallback: Convert to PDF
    if (PDFDocument) {
        console.log("\n🔄 Attempt 2: Converting Image to PDF (Fallback)...");
        try {
            const pdfBuffer = await convertImageToPdf(fileBuffer);
            console.log(`   Conversion successful.`);

            const res = await sendToPrinter(pdfBuffer, "Image-Converted-To-PDF", "application/pdf");
            console.log(`✅ Success! Job ID: ${res["job-attributes-tag"]?.["job-id"]}`);
        } catch (pdfErr) {
            console.error("\n❌ PDF Fallback Failed:");
            console.error(pdfErr);
        }
    }
}

// Emergency function to print if attributes fail
function printWithoutPaperType(buffer, jobName, format) {
    return new Promise((resolve, reject) => {
        const msg = {
            "operation-attributes-tag": {
                "requesting-user-name": "Admin",
                "job-name": jobName,
                "document-format": format
            },
            "job-attributes-tag": {
                "copies": 1,
                "media": "iso_a4_210x297mm",
                "print-quality": 5
                // REMOVED media-type here
            },
            data: buffer
        };

        console.log(`\n🚑 Emergency Print (No Paper Type)...`);
        printer.execute("Print-Job", msg, (err, res) => {
            if (err) console.log("   ❌ Failed:", err.message);
            else console.log("   ✅ Emergency Print Sent. Status:", res.statusCode);
            resolve();
        });
    });
}

start();