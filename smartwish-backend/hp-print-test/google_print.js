// google_print.js
// Prints documentA.pdf on Tray 1 and documentB.pdf on Tray 2

const path = require("path");
const { print, getPrinters } = require("pdf-to-printer");

async function main() {
  try {
    // 1) List printers so you can verify names
    const printers = await getPrinters();
    console.log("Available printers:");
    printers.forEach(p => console.log("-", p.name));

    // 2) Use the exact printer name from the list above.
    // You already saw: HP OfficeJet Pro 9130e Series [HPIE4B65B]
    // If that fails, try just: "HP OfficeJet Pro 9130e Series"
    const printerName = "HP OfficeJet Pro 9130e Series [HPIE4B65B]";

    // 3) Paths to your PDFs in this folder
    const docAPath = path.join(__dirname, "greeting_card2.pdf"); // e.g. greeting_card2.pdf
    const docBPath = path.join(__dirname, "documentB.pdf");

    // ---- STEP 1: sanity check, print WITHOUT trays ----
    console.log("\n=== Test: printing A without tray selection ===");
    await print(docAPath, {
      printer: printerName,
      copies: 1
    });
    console.log("Test print for documentA.pdf sent.\n");

    // If the above works, enable the tray selection below.
    // ---- STEP 2: WITH tray selection ----

    console.log("Printing documentA.pdf to Tray 1...");
    await print(docAPath, {
      printer: printerName,
      // CHANGE this label to the exact tray name shown in the printer driver,
      // e.g. 'Tray 1', 'Main tray', 'Upper', etc.
      bin: "Tray-1",
      copies: 1
    });
    console.log("documentA.pdf sent to Tray 1.\n");

    // console.log("Printing documentB.pdf to Tray 2...");
    // await print(docBPath, {
    //   printer: printerName,
    //   // CHANGE this label to match your second tray, e.g. 'Tray 2', 'Photo tray', 'Lower', etc.
    //   bin: "Tray 2",
    //   copies: 1
    // });
    // console.log("documentB.pdf sent to Tray 2.\n");

    console.log("All jobs submitted.");
  } catch (err) {
    console.error("Printing failed:", err);
  }
}

main();
