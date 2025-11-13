"""
Universal filename fixer for all categories.

This script fixes filename mismatches in all categories automatically.

Usage:
    python scripts/fix_all_filenames.py --check      # Preview all fixes
    python scripts/fix_all_filenames.py --fix        # Apply all fixes
    python scripts/fix_all_filenames.py --fix BirthdayFunny  # Fix specific category
"""

import json
import sys
import argparse
from pathlib import Path
from typing import Dict, List, Set

# Configuration
CARDS_DIRECTORY = Path(r"C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Designs\Series1_original\Series")


def load_json_file(file_path: Path):
    """Load JSON file and return data with format info."""
    if not file_path.exists():
        return [], 'none'
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        if isinstance(data, dict) and 'cards' in data:
            return data['cards'], 'wrapped'
        elif isinstance(data, list):
            return data, 'list'
        else:
            return [data], 'single'


def get_image_files(folder: Path) -> Set[str]:
    """Get all main image files."""
    images = set()
    for ext in ['*.png', '*.jpg', '*.jpeg']:
        for file in folder.glob(ext):
            if not file.name.startswith("inside_"):
                images.add(file.name)
    return images


def find_best_match(json_filename: str, actual_images: Set[str]) -> str:
    """Find the best matching actual image file."""
    # Exact match
    if json_filename in actual_images:
        return json_filename
    
    # Case-insensitive match
    for img in actual_images:
        if img.lower() == json_filename.lower():
            return img
    
    # Different extension (e.g., .png vs .jpg)
    base = Path(json_filename).stem
    for ext in ['.png', '.jpg', '.jpeg']:
        candidate = f"{base}{ext}"
        if candidate in actual_images:
            return candidate
    
    # Check if JSON filename is contained in actual filename (prefix/suffix issue)
    json_lower = json_filename.lower()
    for img in actual_images:
        if json_lower in img.lower():
            return img
    
    # Check common prefix patterns
    for prefix in ['Untitled-', 'Vase', 'Card']:
        prefixed = f"{prefix}{json_filename}"
        if prefixed in actual_images:
            return prefixed
        # Also try with different extension
        base = Path(json_filename).stem
        for ext in ['.png', '.jpg']:
            candidate = f"{prefix}{base}{ext}"
            if candidate in actual_images:
                return candidate
    
    return None


def fix_folder(folder_name: str, dry_run: bool = True) -> bool:
    """Fix filename mismatches in a specific folder."""
    folder = CARDS_DIRECTORY / folder_name
    
    if not folder.exists():
        print(f"❌ Folder not found: {folder_name}")
        return False
    
    print(f"\n{'='*80}")
    print(f"{'[DRY RUN] ' if dry_run else ''}Fixing: {folder_name}")
    print("=" * 80)
    
    metadata_path = folder / "metadata.json"
    insidenote_path = folder / "insidenote.json"
    
    # Load JSON files
    metadata_list, metadata_format = load_json_file(metadata_path)
    insidenote_list, insidenote_format = load_json_file(insidenote_path)
    
    # Get actual images
    actual_images = get_image_files(folder)
    
    print(f"   📊 {len(metadata_list)} metadata, {len(insidenote_list)} insidenote, {len(actual_images)} images")
    
    # Find corrections
    metadata_corrections = {}
    insidenote_corrections = {}
    metadata_removals = []
    insidenote_removals = []
    
    for item in metadata_list:
        if 'filename' not in item:
            continue
        old_name = item['filename']
        match = find_best_match(old_name, actual_images)
        if match and match != old_name:
            metadata_corrections[old_name] = match
        elif not match:
            metadata_removals.append(old_name)
    
    for item in insidenote_list:
        if 'filename' not in item:
            continue
        old_name = item['filename']
        match = find_best_match(old_name, actual_images)
        if match and match != old_name:
            insidenote_corrections[old_name] = match
        elif not match:
            insidenote_removals.append(old_name)
    
    # Print what will be done
    if metadata_corrections:
        print(f"\n   ✏️  Will correct {len(metadata_corrections)} filenames in metadata.json:")
        for old, new in sorted(list(metadata_corrections.items())[:5]):
            print(f"      {old} → {new}")
        if len(metadata_corrections) > 5:
            print(f"      ... and {len(metadata_corrections) - 5} more")
    
    if insidenote_corrections:
        print(f"\n   ✏️  Will correct {len(insidenote_corrections)} filenames in insidenote.json:")
        for old, new in sorted(list(insidenote_corrections.items())[:5]):
            print(f"      {old} → {new}")
        if len(insidenote_corrections) > 5:
            print(f"      ... and {len(insidenote_corrections) - 5} more")
    
    if metadata_removals:
        print(f"\n   ❌ Will remove {len(metadata_removals)} entries from metadata.json (no image)")
    
    if insidenote_removals:
        print(f"\n   ❌ Will remove {len(insidenote_removals)} entries from insidenote.json (no image)")
    
    if not (metadata_corrections or insidenote_corrections or metadata_removals or insidenote_removals):
        print("   ✅ No issues found!")
        return True
    
    if dry_run:
        return True
    
    # Apply fixes
    print(f"\n   🔧 Applying fixes...")
    
    try:
        # Fix metadata.json
        if metadata_corrections or metadata_removals:
            updated = []
            for item in metadata_list:
                old_name = item.get('filename')
                if not old_name or old_name in metadata_removals:
                    continue
                if old_name in metadata_corrections:
                    item['filename'] = metadata_corrections[old_name]
                updated.append(item)
            
            with open(metadata_path, 'w', encoding='utf-8') as f:
                if metadata_format == 'wrapped':
                    json.dump({'cards': updated}, f, indent=2, ensure_ascii=False)
                else:
                    json.dump(updated, f, indent=2, ensure_ascii=False)
            print(f"   ✅ Updated metadata.json ({len(metadata_list)} → {len(updated)} entries)")
        
        # Fix insidenote.json
        if insidenote_corrections or insidenote_removals:
            updated = []
            for item in insidenote_list:
                old_name = item.get('filename')
                if not old_name or old_name in insidenote_removals:
                    continue
                if old_name in insidenote_corrections:
                    item['filename'] = insidenote_corrections[old_name]
                updated.append(item)
            
            with open(insidenote_path, 'w', encoding='utf-8') as f:
                if insidenote_format == 'wrapped':
                    json.dump({'cards': updated}, f, indent=2, ensure_ascii=False)
                else:
                    json.dump(updated, f, indent=2, ensure_ascii=False)
            print(f"   ✅ Updated insidenote.json ({len(insidenote_list)} → {len(updated)} entries)")
        
        print(f"   ✅ All fixes applied!")
        return True
        
    except Exception as e:
        print(f"   ❌ Error: {e}")
        return False


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Fix filename mismatches in all categories")
    parser.add_argument('--check', action='store_true', help='Preview mode (default)')
    parser.add_argument('--fix', action='store_true', help='Apply fixes')
    parser.add_argument('category', nargs='?', help='Specific category to fix (optional)')
    args = parser.parse_args()
    
    dry_run = not args.fix
    
    print("=" * 80)
    print(f"{'PREVIEW MODE' if dry_run else 'FIX MODE'} - Filename Fixer")
    print("=" * 80)
    
    # Categories with known issues
    problem_categories = ['BirthdayFunny', 'ChristmasCardBundle', 'Congratulations', 'Thankyou']
    
    if args.category:
        # Fix specific category
        if args.category not in problem_categories:
            print(f"\n⚠️  Warning: {args.category} not in known problem list")
            print(f"   Known problems: {', '.join(problem_categories)}")
            print(f"   Proceeding anyway...\n")
        fix_folder(args.category, dry_run=dry_run)
    else:
        # Fix all problem categories
        print(f"\nProcessing {len(problem_categories)} categories with known issues...\n")
        
        for category in problem_categories:
            fix_folder(category, dry_run=dry_run)
    
    if dry_run:
        print(f"\n{'='*80}")
        print("⚠️  DRY RUN - No files were modified")
        print("=" * 80)
        print("\n💡 To apply these fixes, run:")
        print("   python scripts/fix_all_filenames.py --fix")
        print("\nOr fix specific category:")
        print("   python scripts/fix_all_filenames.py --fix Congratulations")
    else:
        print(f"\n{'='*80}")
        print("✅ All fixes applied!")
        print("=" * 80)


if __name__ == "__main__":
    main()

