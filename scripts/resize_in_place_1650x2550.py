#!/usr/bin/env python3
"""
Resize all images in a given folder to exactly 1650x2550 pixels, in-place.

Behavior:
- Uses a "cover" strategy: scale the image to fully cover the target size,
  then crop any overflow so there is no padding.
- When vertical cropping is needed, cropping aligns to the bottom (keeps bottom).
- When horizontal cropping is needed, cropping is centered.
- Overwrites the original files (no new images created).

Supported formats: .jpg, .jpeg, .png, .webp

Usage:
  python scripts/resize_in_place_1650x2550.py "C:\\path\\to\\folder"
"""

import argparse
import os
from typing import Tuple

from PIL import Image


TARGET_WIDTH = 1650
TARGET_HEIGHT = 2550
TARGET_SIZE: Tuple[int, int] = (TARGET_WIDTH, TARGET_HEIGHT)
VALID_EXTS = {".jpg", ".jpeg", ".png", ".webp"}


def is_image_file(filename: str) -> bool:
    ext = os.path.splitext(filename)[1].lower()
    return ext in VALID_EXTS


def resize_cover_crop(img: Image.Image, target_w: int, target_h: int) -> Image.Image:
    """
    Resize the image to cover the target size, then crop overflow.

    - Scale factor = max(target_w / w, target_h / h)
    - If vertical overflow: crop from the top (keep bottom) to avoid bottom padding.
    - If horizontal overflow: center crop left/right.
    """
    w, h = img.size
    if w == 0 or h == 0:
        return img

    scale = max(target_w / w, target_h / h)
    new_w = int(round(w * scale))
    new_h = int(round(h * scale))

    # High-quality resize
    img_resized = img.resize((new_w, new_h), resample=Image.Resampling.LANCZOS)

    # Compute crop box
    # If resized height > target height, crop vertically (align to bottom)
    if new_h > target_h:
        top = new_h - target_h  # keep bottom
        left = max(0, (new_w - target_w) // 2) if new_w > target_w else 0
    else:
        top = 0
        # If resized width > target width, crop horizontally (center)
        left = max(0, (new_w - target_w) // 2) if new_w > target_w else 0

    right = left + target_w
    bottom = top + target_h

    # Ensure bounds
    left = max(0, min(left, new_w - target_w))
    top = max(0, min(top, new_h - target_h))
    right = min(new_w, max(target_w, right))
    bottom = min(new_h, max(target_h, bottom))

    img_cropped = img_resized.crop((left, top, right, bottom))

    # Final sanity: enforce exact size
    if img_cropped.size != (target_w, target_h):
        img_cropped = img_cropped.resize((target_w, target_h), resample=Image.Resampling.LANCZOS)

    return img_cropped


def process_folder(folder: str) -> None:
    if not os.path.isdir(folder):
        print(f"Error: '{folder}' is not a directory")
        return

    processed = 0
    skipped = 0

    for root, _, files in os.walk(folder):
        for name in files:
            path = os.path.join(root, name)

            if not is_image_file(name):
                skipped += 1
                continue

            try:
                with Image.open(path) as img:
                    img_format = img.format  # e.g., 'JPEG', 'PNG', 'WEBP'
                    exif = img.info.get('exif')

                    img = img.convert("RGBA") if img.mode in ("P", "RGBA") else img.convert("RGB")
                    result = resize_cover_crop(img, TARGET_WIDTH, TARGET_HEIGHT)

                    save_kwargs = {}
                    if img_format == 'JPEG':
                        save_kwargs.update({
                            'quality': 95,
                            'subsampling': 0,
                            'optimize': True,
                        })
                        if exif:
                            save_kwargs['exif'] = exif
                    elif img_format == 'PNG':
                        save_kwargs.update({'optimize': True})
                    elif img_format == 'WEBP':
                        save_kwargs.update({'quality': 95})

                    # Overwrite the original file in place
                    result.save(path, format=img_format, **save_kwargs)
                    processed += 1
                    print(f"Resized: {path}")
            except Exception as e:
                skipped += 1
                print(f"Failed: {path} -> {e}")

    print(f"\nDone. Processed: {processed}, Skipped: {skipped}")


def main():
    parser = argparse.ArgumentParser(description="Resize all images in a folder to 1650x2550, in-place, with crop-to-fit.")
    parser.add_argument("folder", help="Path to the folder containing images")
    args = parser.parse_args()
    process_folder(args.folder)


if __name__ == "__main__":
    main()