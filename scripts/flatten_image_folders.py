#!/usr/bin/env python3
"""
Flatten per-image subfolders: move images up to the parent folder.

This is useful after running the resizer with --per-image-folder and later
wanting all images to live directly under the category folder (e.g., "Thankyou").

Behavior:
- For each immediate subfolder of --target-dir, move supported image files up
  into --target-dir.
- If a filename collision occurs, prefix the filename with the subfolder name
  (and, if needed, add a numeric suffix) to ensure uniqueness.
- Optionally delete empty subfolders after moving.

Usage (Windows):
  python scripts/flatten_image_folders.py \
    --target-dir "C:\\Users\\makar\\OneDrive\\OLD\\E-Learning\\projects\\SmartWish\\Designs\\Series1\\Resized_1650x2550\\Thankyou" \
    --apply --delete-empty-subdirs

Supported formats: PNG, JPG, JPEG, WEBP
"""

import argparse
import shutil
from pathlib import Path
from typing import Set

SUPPORTED_EXTS: Set[str] = {".png", ".jpg", ".jpeg", ".webp"}


def ensure_unique_name(root: Path, candidate_name: str, prefix: str) -> str:
    dest = root / candidate_name
    if not dest.exists():
        return candidate_name

    base = Path(candidate_name).stem
    suffix = Path(candidate_name).suffix

    # Try with prefix
    prefixed = f"{prefix}_{candidate_name}"
    dest = root / prefixed
    if not dest.exists():
        return prefixed

    # Fallback to numeric suffixes
    counter = 2
    while True:
        candidate = f"{prefix}_{base}({counter}){suffix}"
        dest = root / candidate
        if not dest.exists():
            return candidate
        counter += 1


def flatten_once(target_dir: Path, apply: bool, delete_empty_subdirs: bool) -> int:
    moved = 0
    for child in sorted(target_dir.iterdir()):
        if not child.is_dir():
            continue
        prefix = child.name
        for f in sorted(child.iterdir()):
            if not f.is_file():
                continue
            if f.suffix.lower() not in SUPPORTED_EXTS:
                continue

            new_name = ensure_unique_name(target_dir, f.name, prefix)
            new_path = target_dir / new_name
            if apply:
                new_path.parent.mkdir(parents=True, exist_ok=True)
                shutil.move(str(f), str(new_path))
            print(f"Moved: {f} -> {new_path}")
            moved += 1

        # Optionally remove the subfolder if it became empty
        if delete_empty_subdirs:
            try:
                is_empty = True
                for _ in child.iterdir():
                    is_empty = False
                    break
                if is_empty:
                    if apply:
                        child.rmdir()
                    print(f"Removed empty folder: {child}")
            except Exception as e:
                print(f"Could not remove folder '{child}': {e}")

    return moved


def main():
    parser = argparse.ArgumentParser(description="Flatten per-image subfolders into the parent folder")
    parser.add_argument("--target-dir", type=Path, required=True, help="Folder containing per-image subfolders to flatten")
    parser.add_argument("--apply", action="store_true", help="Actually move files; otherwise just print actions (dry-run)")
    parser.add_argument("--delete-empty-subdirs", action="store_true", help="Delete subfolders that become empty after moving files")
    parser.add_argument("--process-children", action="store_true", help="Process all immediate subfolders under --target-dir (treat each as a category root)")
    args = parser.parse_args()

    target_dir: Path = args.target_dir
    apply: bool = args.apply
    delete_empty_subdirs: bool = args.delete_empty_subdirs
    process_children: bool = args.process_children

    if not target_dir.exists() or not target_dir.is_dir():
        raise SystemExit(f"Target directory does not exist or is not a directory: {target_dir}")

    if process_children:
        print(
            f"Flattening all category subfolders under '{target_dir}' (apply={apply}, delete_empty_subdirs={delete_empty_subdirs})"
        )
        total_moved = 0
        processed_folders = 0
        for child in sorted(target_dir.iterdir()):
            if not child.is_dir():
                continue
            processed_folders += 1
            print(f"\n=== Processing category folder: {child} ===")
            moved = flatten_once(child, apply, delete_empty_subdirs)
            total_moved += moved
            print(f"Category summary: Moved {moved} file(s) in '{child}'.")
        print(
            f"\nAll done. Moved {total_moved} file(s) across {processed_folders} folder(s) under '{target_dir}'."
        )
    else:
        print(
            f"Flattening subfolders under '{target_dir}' (apply={apply}, delete_empty_subdirs={delete_empty_subdirs})"
        )
        moved = flatten_once(target_dir, apply, delete_empty_subdirs)
        print(f"Done. Moved {moved} file(s).")


if __name__ == "__main__":
    main()