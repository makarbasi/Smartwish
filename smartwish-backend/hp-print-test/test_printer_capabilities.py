import asyncio
from pyipp import IPP

async def check_printer():
    # Replace with your printer's IPP URI
    uri = "ipp://192.168.1.239/ipp/print"
    
    async with IPP(uri) as ipp:
        printer = await ipp.printer()
        print(f"Printer: {printer.info.name if printer.info else 'Unknown'}")
        
        # Check for PDF support in the document formats
        formats = printer.info.document_formats_supported if printer.info else []
        if "application/pdf" in formats:
            print("✅ This printer supports direct PDF printing.")
        else:
            print("❌ PDF printing is not directly supported.")
            print(f"Supported formats: {', '.join(formats)}")

if __name__ == "__main__":
    asyncio.run(check_printer())