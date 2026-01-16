const ipp = require('ipp');
const printer = ipp.Printer("http://192.168.1.239:631/ipp/print");

const msg = {
    "operation-attributes-tag": {
        "requested-attributes": [
            "media-source-supported",
            "document-format-supported",
            "job-attributes-supported",
            "media-type-supported",
            "media-supported"
        ]
    }
};

printer.execute("Get-Printer-Attributes", msg, (err, res) => {
    if (err) {
        console.error("Error:", err);
        return;
    }
    if (res && res['printer-attributes-tag']) {
        const attrs = res['printer-attributes-tag'];
        console.log("Supported Trays (media-source-supported):");
        console.log(attrs['media-source-supported']);
        console.log("\nSupported Document Formats (document-format-supported):");
        console.log(attrs['document-format-supported']);
        console.log("\nSupported Job Attributes (job-attributes-supported):");
        console.log(attrs['job-attributes-supported']);
        console.log("\nSupported Media Types (media-type-supported):");
        console.log(attrs['media-type-supported']);
        console.log("\nSupported Media (media-supported):");
        console.log(attrs['media-supported']);
    } else {
        console.log("Could not find printer attributes. Check IP address.");
    }
});