const ipp = require('ipp');
const printer = ipp.Printer("http://192.168.1.239:631/ipp/print");

printer.execute("Get-Printer-Attributes", null, (err, res) => {
    if (err) {
        console.error("Error:", err);
        return;
    }
    if (res && res['printer-attributes-tag']) {
        console.log("Supported Trays (media-source-supported):");
        console.log(res['printer-attributes-tag']['media-source-supported']);
        console.log("\nSupported Document Formats (document-format-supported):");
        console.log(res['printer-attributes-tag']['document-format-supported']);
        console.log("\nSupported Job Attributes (job-attributes-supported):");
        console.log(res['printer-attributes-tag']['job-attributes-supported']);
    } else {
        console.log("Could not find printer attributes. Check IP address.");
    }
});