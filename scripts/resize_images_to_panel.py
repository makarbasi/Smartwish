#!/usr/bin/env python3
"""
Batch resize images to a fixed canvas size (1650x2550 by default).

Defaults are aligned to:
  const panelWidthPx = 1650;  // 5.5 inches * 300 DPI
  const panelHeightPx = 2550; // 8.5 inches * 300 DPI

Usage (Windows):
  python scripts/resize_images_to_panel.py \
    --input-dir "C:\\Users\\makar\\OneDrive\\OLD\\E-Learning\\projects\\SmartWish\\Designs\\Series1" \
    --mode fit --background "#FFFFFF" --quality 92 --recurse \
    --preserve-structure --per-image-folder

Modes:
  - fit:   Scale to fit inside target, pad with background (no cropping)
  - fill:  Scale to fill target, center-crop overflow (may crop edges)
  - stretch: Directly resize to target (distorts aspect ratio)

Output placement options:
  - --preserve-structure: mirror the input subfolder structure under the output root
  - --per-image-folder: place each output image inside a folder named after the file stem
    (can be combined with --preserve-structure)

Supported formats: PNG, JPG, JPEG, WEBP. Keeps original format by default.
If the output format is JPEG, image is saved as RGB (no alpha).
"""

import argparse
import sys
from pathlib import Path
from typing import Tuple

try:
    from PIL import Image, ImageColor
except ImportError:
    print("Missing dependency: Pillow. Install with: pip install pillow", file=sys.stderr)
    sys.exit(1)


def parse_color(color_str: str) -> Tuple[int, int, int]:
    """Parse a color string (e.g., '#FFFFFF' or 'white') to an RGB tuple."""
    try:
        rgb = ImageColor.getrgb(color_str)
        # Ensure 3-tuple
        if isinstance(rgb, tuple) and len(rgb) == 4:
            rgb = rgb[:3]
        return rgb
    except Exception:
        return (255, 255, 255)


def resize_fit(img: Image.Image, target_w: int, target_h: int, bg_rgb: Tuple[int, int, int]) -> Image.Image:
    """Scale to fit within target and pad with background color."""
    src_w, src_h = img.size
    ratio = min(target_w / src_w, target_h / src_h)
    new_size = (max(1, int(src_w * ratio)), max(1, int(src_h * ratio)))
    resized = img.resize(new_size, Image.Resampling.LANCZOS)

    canvas = Image.new("RGB", (target_w, target_h), bg_rgb)
    # Center paste
    x = (target_w - new_size[0]) // 2
    y = (target_h - new_size[1]) // 2
    if resized.mode in ("RGBA", "LA"):
        # Composite onto background to avoid alpha in JPEG
        tmp_bg = Image.new("RGB", resized.size, bg_rgb)
        tmp_bg.paste(resized, mask=resized.split()[-1])
        resized = tmp_bg
    canvas.paste(resized, (x, y))
    return canvas


def resize_fill(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Scale to fill target, then center-crop to exact size."""
    src_w, src_h = img.size
    ratio = max(target_w / src_w, target_h / src_h)
    new_size = (max(1, int(src_w * ratio)), max(1, int(src_h * ratio)))
    resized = img.resize(new_size, Image.Resampling.LANCZOS)
    # Center crop
    x = (new_size[0] - target_w) // 2
    y = (new_size[1] - target_h) // 2
    cropped = resized.crop((x, y, x + target_w, y + target_h))
    # Ensure RGB for JPEG
    if cropped.mode not in ("RGB", "L"):
        cropped = cropped.convert("RGB")
    return cropped


def resize_stretch(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """Directly resize to target size (may distort)."""
    out = img.resize((target_w, target_h), Image.Resampling.LANCZOS)
    if out.mode not in ("RGB", "L"):
        out = out.convert("RGB")
    return out


SUPPORTED_EXTS = {".png", ".jpg", ".jpeg", ".webp"}


def process_image(
    path: Path,
    input_dir: Path,
    output_dir: Path,
    target_w: int,
    target_h: int,
    mode: str,
    bg_color: str,
    quality: int,
    overwrite: bool,
    preserve_structure: bool,
    per_image_folder: bool,
) -> bool:
    if path.suffix.lower() not in SUPPORTED_EXTS:
        return False

    # Compute output path based on flags
    try:
        rel = path.relative_to(input_dir)
    except ValueError:
        # If path is not under input_dir (unlikely), fall back to name only
        rel = Path(path.name)

    if preserve_structure and per_image_folder:
        out_path = output_dir / rel.parent / path.stem / path.name
    elif preserve_structure:
        out_path = output_dir / rel.parent / path.name
    elif per_image_folder:
        out_path = output_dir / path.stem / path.name
    else:
        out_path = output_dir / path.name

    if out_path.exists() and not overwrite:
        print(f"Skipping existing: {out_path}")
        return True

    out_path.parent.mkdir(parents=True, exist_ok=True)

    with Image.open(path) as img:
        img.load()
        if mode == "fit":
            rgb = parse_color(bg_color)
            out_img = resize_fit(img, target_w, target_h, rgb)
        elif mode == "fill":
            out_img = resize_fill(img, target_w, target_h)
        elif mode == "stretch":
            out_img = resize_stretch(img, target_w, target_h)
        else:
            raise ValueError(f"Unknown mode: {mode}")

        fmt = img.format or ("JPEG" if path.suffix.lower() in {".jpg", ".jpeg"} else "PNG")
        if fmt.upper() == "JPEG":
            out_img = out_img.convert("RGB")
            out_img.save(out_path, format="JPEG", quality=quality, optimize=True)
        else:
            out_img.save(out_path, format=fmt)

        print(f"Saved: {out_path}")
        return True


def find_images(input_dir: Path, recurse: bool) -> list[Path]:
    pattern = "**/*" if recurse else "*"
    files = []
    for p in input_dir.glob(pattern):
        if p.is_file() and p.suffix.lower() in SUPPORTED_EXTS:
            files.append(p)
    return sorted(files)


def main():
    parser = argparse.ArgumentParser(description="Resize images to a fixed 1650x2550 canvas.")
    parser.add_argument("--input-dir", type=Path, required=True, help="Folder with images to resize")
    parser.add_argument("--output-dir", type=Path, default=None, help="Output folder (default: <input>/Resized_1650x2550)")
    parser.add_argument("--width", type=int, default=1650, help="Target width in pixels (default: 1650)")
    parser.add_argument("--height", type=int, default=2550, help="Target height in pixels (default: 2550)")
    parser.add_argument("--mode", choices=["fit", "fill", "stretch"], default="fit", help="Resize strategy (default: fit)")
    parser.add_argument("--background", type=str, default="#FFFFFF", help="Background color for padding in fit mode (default: #FFFFFF)")
    parser.add_argument("--quality", type=int, default=92, help="JPEG quality 1-95 (default: 92)")
    parser.add_argument("--recurse", action="store_true", help="Process subdirectories recursively")
    parser.add_argument("--overwrite", action="store_true", help="Overwrite existing outputs")
    parser.add_argument("--preserve-structure", action="store_true", help="Mirror input subfolders under the output root")
    parser.add_argument("--per-image-folder", action="store_true", help="Place each output image in its own folder named after the file stem")

    args = parser.parse_args()
    input_dir: Path = args.input_dir
    output_dir: Path = args.output_dir or (input_dir / "Resized_1650x2550")
    target_w: int = args.width
    target_h: int = args.height
    mode: str = args.mode
    bg_color: str = args.background
    quality: int = args.quality
    recurse: bool = args.recurse
    overwrite: bool = args.overwrite
    preserve_structure: bool = args.preserve_structure
    per_image_folder: bool = args.per_image_folder

    if not input_dir.exists() or not input_dir.is_dir():
        print(f"Input directory not found or not a directory: {input_dir}", file=sys.stderr)
        sys.exit(1)

    output_dir.mkdir(parents=True, exist_ok=True)

    files = find_images(input_dir, recurse)
    if not files:
        print(f"No images found in {input_dir} (recurse={recurse}).")
        sys.exit(0)

    print(
        f"Resizing {len(files)} image(s) from '{input_dir}' -> '{output_dir}' to {target_w}x{target_h} "
        f"(mode={mode}, preserve_structure={preserve_structure}, per_image_folder={per_image_folder})"
    )
    processed = 0
    for f in files:
        try:
            if process_image(
                f,
                input_dir,
                output_dir,
                target_w,
                target_h,
                mode,
                bg_color,
                quality,
                overwrite,
                preserve_structure,
                per_image_folder,
            ):
                processed += 1
        except Exception as e:
            print(f"  ✖ {f.name}: {e}", file=sys.stderr)

    print(f"Done. {processed} image(s) written to '{output_dir}'.")


if __name__ == "__main__":
    main()