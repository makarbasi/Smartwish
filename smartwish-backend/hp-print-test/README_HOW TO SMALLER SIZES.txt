The short answer is: Technically yes, you can request it via IPP, but the printer may physically refuse or "cheat" by adding a tiny margin.[1]
HP's firmware typically blocks "Borderless + Duplex" on small sizes because the "Duplexer" (the mechanical arm that flips the paper) needs a dry area to grab.[1] If the paper is soaking wet with ink at the very edge, the rollers will smear the ink and get dirty.[1]
However, using IPP allows you to send a "Low-Level Request" that bypasses the Windows Driver's grayed-out buttons.[1] Here is how to attempt it.
The IPP "Custom Size" Strategy
To get borderless on small sizes (like 5x7 or 4x6), you must use Tray 1 (Tray 2 is locked to Plain Paper/Letter only) and you must "lie" to the printer about the paper type.[1]
The Updated Script for Small Size + Duplex + Borderless
In this example, we will try a 5x7 inch card.
Note: Dimensions in IPP are usually in hundredths of a millimeter.[1]
code
JavaScript
const ipp = require('ipp');
const fs = require('fs');

const PRINTER_IP = "192.168.1.50"; 
const printerUrl = `http://${PRINTER_IP}:631/ipp/print`;
const printer = ipp.Printer(printerUrl);

try {
    const file = fs.readFileSync("5x7_design.pdf");

    const msg = {
        "operation-attributes-tag": {
            "requesting-user-name": "Admin",
            "job-name": "Small Borderless Duplex",
            "document-format": "application/pdf"
        },
        "job-attributes-tag": {
            "media-source": "tray-1", // MUST use Tray 1 for custom/small sizes
            "sides": "two-sided-long-edge",
            
            // "The Big Lie": We use 'photographic' to unlock the borderless engine
            "media-type": "photographic-glossy", 
            
            "print-scaling": "fill",

            "media-col": {
                // EXPLICIT SIZE: 5x7 inches in 1/100mm
                // 5 inches = 12700 | 7 inches = 17780
                "media-size": {
                    "x-dimension": 12700,
                    "y-dimension": 17780
                },
                "media-margins": {
                    "media-top-margin": 0,
                    "media-bottom-margin": 0,
                    "media-left-margin": 0,
                    "media-right-margin": 0
                }
            }
        },
        data: file
    };

    console.log("Sending Small-Size Borderless Job...");
    printer.execute("Print-Job", msg, (err, res) => {
        if (err) console.error(err);
        else console.log("Response:", JSON.stringify(res, null, 2));
    });

} catch (e) {
    console.error("Check file and IP.");
}
Why this might still fail (and how to fix it):
Hardware Reject: If the printer detects you have "Plain Paper" in the tray but the code says "Photo Paper," it may halt with a "Paper Mismatch" error.[1]
Fix: You must go to the printer's touchscreen, select Tray 1, and manually set the Paper Type to Photo Paper (even if you are using cardstock/plain paper).[1]
The "Spittoon" Limit: Most HP printers have a physical "gutter" or "spittoon" (a foam strip that catches extra ink) only at specific widths (e.g., exactly 4 inches, 5 inches, or 8.5 inches wide).[1]
If you use a weird size (like 4.25 inches), the printer cannot do borderless because the ink would spray directly onto the internal plastic and rollers.[1]
Tip: Always stick to standard widths: 4", 5", 8.27" (A4), or 8.5" (Letter).[1]
Duplex Conflict: If the printer ignores the "Duplex" command and prints two separate pages, it means the firmware has a hard-coded safety rule: If Borderless = ON, then Duplex = OFF for small paper.[1]
Workaround: If this happens, you are physically blocked by the firmware.[1] Your only choice is to print on Letter paper (which supports both) and then cut the paper down to size after printing.[1]
Summary for your 9130e:
Tray 2: Impossible (Locked to Plain/Letter/No-Borderless).
Tray 1: Possible for Single-Sided Borderless (4x6, 5x7).
Duplex + Borderless + Small: Very likely to be rejected by hardware safety. Use Letter size and "Multi-up" printing (printing two 5x7s on one Letter sheet) if you absolutely need duplex.