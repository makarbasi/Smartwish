"""
Split the right half of every page in all PDFs within a folder and
export each as PNG.

Defaults:
- Input directory: C:\\Users\\makar\\OneDrive\\OLD\\E-Learning\\projects\\SmartWish\\Designs
- Output directory: <input_dir>\\RightHalves

Requirements:
    pip install pymupdf

Usage examples:
    python scripts/split_pdf_right_half.py
    python scripts/split_pdf_right_half.py --input-dir "C:\\path\\to\\Designs" --dpi 144
    python scripts/split_pdf_right_half.py --recurse --output-dir "C:\\output\\folder"

Notes:
- Assumes each PDF page is visually split into left/right halves.
- Only the RIGHT half is exported.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    import fitz  # PyMuPDF
except ImportError as e:
    print("PyMuPDF not installed. Install with: pip install pymupdf", file=sys.stderr)
    raise


def process_pdf(pdf_path: Path, output_dir: Path, dpi: int) -> int:
    """Process a single PDF file: export the right half of every page to PNG.

    Returns the number of pages processed.
    """
    doc = fitz.open(pdf_path)
    page_count = doc.page_count

    # Scale matrix based on DPI (PDF default is 72 DPI)
    scale = dpi / 72.0
    matrix = fitz.Matrix(scale, scale)

    # Create a subfolder for this PDF's outputs
    pdf_output_dir = output_dir / pdf_path.stem
    pdf_output_dir.mkdir(parents=True, exist_ok=True)

    for page_index in range(page_count):
        page = doc.load_page(page_index)
        rect = page.rect

        # Define the right half rectangle
        right_half = fitz.Rect(rect.x0 + rect.width / 2.0, rect.y0, rect.x1, rect.y1)

        # Render only the right half at the requested DPI
        pix = page.get_pixmap(matrix=matrix, clip=right_half, alpha=True)

        out_name = f"{pdf_path.stem}_page_{page_index + 1}_right.png"
        out_path = pdf_output_dir / out_name
        pix.save(out_path.as_posix())

    doc.close()
    return page_count


def find_pdfs(input_dir: Path, recurse: bool) -> list[Path]:
    pattern = "**/*.pdf" if recurse else "*.pdf"
    return sorted(input_dir.glob(pattern))


def main():
    default_input = Path(
        r"C:\\Users\\makar\\OneDrive\\OLD\\E-Learning\\projects\\SmartWish\\Designs"
    )
    parser = argparse.ArgumentParser(
        description="Export the right half of each page of PDFs as PNGs."
    )
    parser.add_argument(
        "--input-dir",
        type=Path,
        default=default_input,
        help="Directory containing PDF files (default: Designs folder)",
    )
    parser.add_argument(
        "--output-dir",
        type=Path,
        default=None,
        help="Directory to store PNG outputs (default: <input-dir>/RightHalves)",
    )
    parser.add_argument(
        "--dpi",
        type=int,
        default=144,
        help="Output DPI for rendering (default: 144)",
    )
    parser.add_argument(
        "--recurse",
        action="store_true",
        help="Search PDFs recursively in subdirectories",
    )

    args = parser.parse_args()

    input_dir: Path = args.input_dir
    output_dir: Path = args.output_dir or (input_dir / "RightHalves")
    dpi: int = args.dpi
    recurse: bool = args.recurse

    if not input_dir.exists() or not input_dir.is_dir():
        print(f"Input directory not found or not a directory: {input_dir}", file=sys.stderr)
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    pdfs = find_pdfs(input_dir, recurse=recurse)
    if not pdfs:
        print(f"No PDF files found in {input_dir} (recurse={recurse}).")
        sys.exit(0)

    total_pages = 0
    print(
        f"Processing {len(pdfs)} PDF(s) from '{input_dir}' -> outputs in '{output_dir}' at {dpi} DPI"
    )
    for pdf_path in pdfs:
        try:
            pages = process_pdf(pdf_path, output_dir, dpi)
            total_pages += pages
            print(f"  ✔ {pdf_path.name}: {pages} page(s) processed")
        except Exception as exc:
            print(f"  ✖ {pdf_path.name}: error: {exc}", file=sys.stderr)

    print(f"Done. Exported right halves for {total_pages} page(s) across {len(pdfs)} PDF(s).")


if __name__ == "__main__":
    main()