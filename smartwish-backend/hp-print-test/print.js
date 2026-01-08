const ipp = require('ipp');
const fs = require('fs');
const path = require('path');

const PRINTER_IP = "192.168.1.239"; 
const printerUrl = `http://${PRINTER_IP}:631/ipp/print`;
const printer = ipp.Printer(printerUrl);
const filePath = path.join(__dirname, "test.pdf");

// Check printer capabilities before printing
function getPrinterAttributes() {
    return new Promise((resolve, reject) => {
        const msg = {
            "operation-attributes-tag": {
                "requesting-user-name": "Admin",
                "requested-attributes": [
                    "document-format-supported",
                    "printer-state",
                    "printer-state-reasons",
                    "sides-supported",
                    "print-color-mode-supported"
                ]
            }
        };
        
        printer.execute("Get-Printer-Attributes", msg, (err, res) => {
            if (err) {
                reject(err);
            } else {
                resolve(res);
            }
        });
    });
}

function printPdf(pdfBuffer, jobName, documentFormat = "application/pdf") {
    return new Promise((resolve, reject) => {
        const msg = {
            "operation-attributes-tag": {
                "requesting-user-name": "Admin",
                "job-name": jobName,
                "document-format": documentFormat
            },
            "job-attributes-tag": {
                "sides": "two-sided-long-edge",
                "print-color-mode": "color",
                "print-quality": 5,  // IPP uses integers: 3=draft, 4=normal, 5=high
                "copies": 1,
                "media": "iso_a4_210x297mm"  // or "na_letter_8.5x11in" for US Letter
            },
            data: pdfBuffer
        };

        console.log(`Sending PDF (${(pdfBuffer.length / 1024).toFixed(2)} KB) with duplex enabled...`);
        console.log(`Document format: ${documentFormat}`);

        printer.execute("Print-Job", msg, (err, res) => {
            if (err) {
                console.error(`PRINTER ERROR:`, JSON.stringify(err, null, 2));
                reject(err);
            } else {
                console.log(`Printer response code:`, res.statusCode);
                
                // Store job ID if available
                const jobId = res["job-id"] || res["job-attributes-tag"]?.["job-id"];
                if (jobId) {
                    console.log(`Job ID: ${jobId}`);
                }
                
                if (res.statusCode !== 'successful-ok') {
                    console.log("Details:", JSON.stringify(res, null, 2));
                    reject(new Error(`Print failed: ${res.statusCode}`));
                } else {
                    console.log(`PDF sent successfully.`);
                    
                    // Try to get job status after a short delay
                    if (jobId) {
                        setTimeout(() => {
                            checkJobStatus(jobId);
                        }, 2000);
                    }
                    
                    resolve(res);
                }
            }
        });
    });
}

function checkJobStatus(jobId) {
    const msg = {
        "operation-attributes-tag": {
            "requesting-user-name": "Admin",
            "job-id": jobId,
            "requested-attributes": ["job-state", "job-state-message", "job-state-reasons"]
        }
    };
    
    printer.execute("Get-Job-Attributes", msg, (err, res) => {
        if (err) {
            console.log("Could not check job status:", err.message);
        } else {
            const jobState = res["job-attributes-tag"]?.["job-state"];
            const jobStateMessage = res["job-attributes-tag"]?.["job-state-message"];
            const jobStateReasons = res["job-attributes-tag"]?.["job-state-reasons"];
            
            console.log("\n📊 Job Status:");
            console.log(`   State: ${jobState}`);
            if (jobStateMessage) {
                console.log(`   Message: ${jobStateMessage}`);
            }
            if (jobStateReasons) {
                const reasons = Array.isArray(jobStateReasons) ? jobStateReasons : [jobStateReasons];
                if (reasons.length > 0) {
                    console.log(`   Reasons: ${reasons.join(", ")}`);
                }
            }
        }
    });
}

async function tryDifferentFormats(pdfBuffer) {
    // application/pdf is the correct MIME type for native PDF printing on HP printers
    const formats = [
        "application/pdf",
        "application/octet-stream"
    ];
    
    for (const format of formats) {
        console.log(`\n--- Trying format: ${format} ---`);
        try {
            await printPdf(pdfBuffer, "SmartWish-Card-PDF", format);
            console.log(`✅ Success with format: ${format}`);
            return;
        } catch (error) {
            console.log(`❌ Failed with ${format}: ${error.message}`);
            // Wait a bit before trying next format
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    throw new Error("All formats failed");
}

async function startPrint() {
    try {
        // First, check printer capabilities
        console.log("🔍 Checking printer capabilities...\n");
        try {
            const printerInfo = await getPrinterAttributes();
            const attrs = printerInfo["printer-attributes-tag"];
            
            console.log("📋 Printer Status:");
            console.log(`   State: ${attrs["printer-state"]}`);
            console.log(`   State Reasons: ${attrs["printer-state-reasons"]}`);
            
            const supportedFormats = attrs["document-format-supported"];
            console.log(`\n📄 Supported Document Formats:`);
            if (Array.isArray(supportedFormats)) {
                supportedFormats.forEach(f => console.log(`   - ${f}`));
                
                if (supportedFormats.includes("application/pdf")) {
                    console.log("\n✅ Printer supports native PDF printing!");
                } else {
                    console.log("\n⚠️ application/pdf not in supported formats list");
                    console.log("   Will try application/octet-stream as fallback");
                }
            } else if (supportedFormats) {
                console.log(`   - ${supportedFormats}`);
            }
            
            console.log("");
        } catch (err) {
            console.log("⚠️ Could not query printer capabilities:", err.message);
            console.log("   Proceeding with print attempt anyway...\n");
        }

        if (!fs.existsSync(filePath)) {
            console.error(`ERROR: File not found at ${filePath}`);
            return;
        }

        const pdfBuffer = fs.readFileSync(filePath);
        console.log(`📄 Reading PDF file: ${filePath}`);
        console.log(`   File size: ${(pdfBuffer.length / 1024).toFixed(2)} KB`);
        
        // Check PDF version
        const pdfHeader = pdfBuffer.toString('utf8', 0, Math.min(100, pdfBuffer.length));
        const versionMatch = pdfHeader.match(/%PDF-(\d\.\d)/);
        if (versionMatch) {
            console.log(`   PDF version: ${versionMatch[1]}`);
        }
        
        console.log("\n🖨️ Sending PDF to printer...\n");
        await tryDifferentFormats(pdfBuffer);
        console.log("\n✅ Print job completed successfully!");
        console.log("\n⚠️ If the printer makes noises but doesn't print, check:");
        console.log("   1. Printer display for error messages or paper prompts");
        console.log("   2. Paper tray settings match the job requirements");
        console.log("   3. Printer is not in a paused or error state");

    } catch (error) {
        if (error.message === "All formats failed") {
            console.error("\n❌ All print formats failed");
            console.log("\n💡 Troubleshooting tips:");
            console.log("   1. Check if printer is online and ready");
            console.log("   2. Verify PDF file is not corrupted");
            console.log("   3. Try a simpler PDF file");
        } else {
            console.error("SYSTEM ERROR:", error);
            console.error("Error details:", error.stack);
        }
    }
}

startPrint();