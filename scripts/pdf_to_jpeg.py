#!/usr/bin/env python3
"""
Convert each page of a PDF into a JPEG image.

Usage examples (Windows):
  python scripts/pdf_to_jpeg.py --pdf "C:\\Users\\makar\\OneDrive\\OLD\\E-Learning\\projects\\SmartWish\\Designs\\BirthdayCardsPDF.pdf" --dpi 300 --quality 92

This script also accepts Chrome viewer URLs like:
  chrome-extension://efaidnbmnnnibpcajpcglclefindmkaj/file:///C:/Users/makar/OneDrive/OLD/E-Learning/projects/SmartWish/Designs/BirthdayCardsPDF.pdf
and will normalize them to the actual file path automatically.
"""

import argparse
import os
import re
import sys
from pathlib import Path
from urllib.parse import unquote

try:
    import fitz  # PyMuPDF
except ImportError:
    print("Missing dependency: PyMuPDF. Install with: pip install pymupdf")
    sys.exit(1)

try:
    from PIL import Image
except ImportError:
    print("Missing dependency: Pillow. Install with: pip install pillow")
    sys.exit(1)


def normalize_input_path(path_str: str) -> str:
    """Normalize Windows path and handle chrome-extension/file URLs."""
    s = path_str.strip().strip('"')

    # Handles chrome-extension viewer wrapping a file:/// URL
    if s.startswith("chrome-extension://"):
        m = re.search(r"file:///([A-Za-z]:/[^\s]+)", s)
        if m:
            s = "file:///" + m.group(1)

    # Convert file:///C:/... to Windows path
    if s.startswith("file:///"):
        win_path = unquote(s.replace("file:///", ""))
        return win_path.replace("/", "\\")

    return s


def convert_pdf_to_jpegs(pdf_path: str, output_dir: Path, dpi: int = 300, quality: int = 92, overwrite: bool = False) -> None:
    """Render each page of the PDF to a JPEG file in output_dir."""
    doc = fitz.open(pdf_path)
    output_dir.mkdir(parents=True, exist_ok=True)

    scale = dpi / 72.0
    matrix = fitz.Matrix(scale, scale)

    print(f"Converting '{pdf_path}' -> '{output_dir}' (dpi={dpi}, quality={quality})")

    for page_index in range(doc.page_count):
        page = doc.load_page(page_index)
        pix = page.get_pixmap(matrix=matrix, alpha=False)
        img = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)

        out_name = f"page-{page_index + 1}.jpg"
        out_path = output_dir / out_name

        if out_path.exists() and not overwrite:
            print(f"Skipping existing: {out_path}")
            continue

        img.save(out_path, format="JPEG", quality=quality, optimize=True)
        print(f"Saved: {out_path}")

    doc.close()
    print("Done.")


def main():
    parser = argparse.ArgumentParser(description="Convert each PDF page to a JPEG image.")
    parser.add_argument("--pdf", "-i", required=True, help="Path to the input PDF file (or chrome-extension/file URL).")
    parser.add_argument("--output-dir", "-o", default=None, help="Directory to save JPEGs. Defaults to '<PDF_stem>_JPEGs' next to the PDF.")
    parser.add_argument("--dpi", type=int, default=300, help="Render DPI (default: 300). Higher = larger images.")
    parser.add_argument("--quality", type=int, default=92, help="JPEG quality 1-95 (default: 92). Higher = better, larger files.")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing JPEGs if present.")

    args = parser.parse_args()
    pdf_input = normalize_input_path(args.pdf)
    pdf_input = os.path.expandvars(os.path.expanduser(pdf_input))

    if not os.path.isfile(pdf_input):
        print(f"PDF not found: {pdf_input}")
        sys.exit(1)

    pdf_path = Path(pdf_input)
    default_output = pdf_path.parent / f"{pdf_path.stem}_JPEGs"
    output_dir = Path(args.output_dir) if args.output_dir else default_output

    try:
        convert_pdf_to_jpegs(str(pdf_path), output_dir, dpi=args.dpi, quality=args.quality, overwrite=args.overwrite)
        print(f"JPEGs saved to: {output_dir}")
    except Exception as e:
        print(f"Conversion failed: {e}")
        sys.exit(1)


if __name__ == "__main__":
    main()