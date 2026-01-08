const ipp = require('ipp');
const printer = ipp.Printer("192.168.1.239");

printer.execute("Get-Printer-Attributes", null, (err, res) => {
    if (err) {
        console.error("Connection Failed:", err);
    } else {
        console.log("Printer is reachable! Supported formats:", 
            res['printer-attributes-tag']['document-format-supported']);
    }
});