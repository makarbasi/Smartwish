const ipp = require('ipp');
const fs = require('fs');
const path = require('path');

// --- CONFIGURATION ---
const PRINTER_IP = "192.168.1.239";
const FILE_NAME = "test.jpg";

const printerUrl = `http://${PRINTER_IP}:631/ipp/print`;
const printer = ipp.Printer(printerUrl);
const filePath = path.join(__dirname, FILE_NAME);

function getMimeType(filename) {
    const ext = path.extname(filename).toLowerCase();
    switch (ext) {
        case '.jpg':
        case '.jpeg': return 'image/jpeg';
        case '.png': return 'image/png';
        default: return 'application/octet-stream';
    }
}

function printImage(buffer, jobName, format) {
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
            },
            data: buffer
        };

        console.log(`\n📤 Sending Job: ${jobName}`);
        console.log(`   Format: ${format}`);
        
        printer.execute("Print-Job", msg, (err, res) => {
            if (err) {
                console.log("   ❌ Failed:", err.message);
                reject(err);
            } else {
                console.log("   ✅ Print Sent. Status:", res.statusCode);
                resolve(res);
            }
        });
    });
}

async function start() {
    if (!fs.existsSync(filePath)) {
        console.error(`❌ Error: File not found at ${filePath}`);
        return;
    }

    const fileBuffer = fs.readFileSync(filePath);
    const mimeType = getMimeType(filePath);

    try {
        await printImage(fileBuffer, "Image-Print", mimeType);
    } catch (error) {
        console.error("❌ Print Failed:", error.message);
    }
}

start();