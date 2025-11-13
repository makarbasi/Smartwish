"""
Smart fix for Thank You filename mismatches.

This script detects pattern-based mismatches and corrects them.

Usage:
    python scripts/fix_thankyou_filenames_smart.py --check    # Preview
    python scripts/fix_thankyou_filenames_smart.py --fix      # Apply
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple
import argparse

# Configuration
THANKYOU_FOLDER = Path(r"C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Designs\Series1_original\Series\Thankyou")


def load_json_file(file_path: Path) -> Tuple[List[Dict], str]:
    """Load JSON file and return the list and format type."""
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        if isinstance(data, dict) and 'cards' in data:
            return data['cards'], 'wrapped'
        elif isinstance(data, list):
            return data, 'list'
        else:
            return [data], 'single'


def get_image_files(folder: Path) -> Dict[str, str]:
    """Get all image files in the folder (excluding inside_ files)."""
    images = {}
    for file in folder.glob("*.png"):
        if not file.name.startswith("inside_"):
            images[file.name] = str(file)
    for file in folder.glob("*.jpg"):
        if not file.name.startswith("inside_"):
            images[file.name] = str(file)
    return images


def find_best_match(json_filename: str, actual_images: Dict[str, str]) -> str:
    """
    Find the best matching actual image file for a JSON filename.
    
    Strategy:
    1. Exact match
    2. Case-insensitive match
    3. Match with added prefix/suffix
    4. Fuzzy match by removing special characters
    """
    # Exact match
    if json_filename in actual_images:
        return json_filename
    
    # Case-insensitive match
    for img_name in actual_images:
        if img_name.lower() == json_filename.lower():
            return img_name
    
    # Check if adding a prefix helps
    # Try common prefixes
    for prefix in ['Vase', 'Card', 'Design', 'Template']:
        prefixed = f"{prefix}{json_filename}"
        if prefixed in actual_images:
            return prefixed
    
    # Check if JSON filename is contained in any actual filename
    json_base = json_filename.lower()
    for img_name in actual_images:
        if json_base in img_name.lower():
            return img_name
    
    # Check if actual filename is contained in JSON filename
    for img_name in actual_images:
        if img_name.lower() in json_base:
            return img_name
    
    return None


def analyze_and_fix(folder: Path, dry_run: bool = True) -> bool:
    """Analyze and optionally fix filename mismatches."""
    
    print("=" * 80)
    print(f"{'DRY RUN - ' if dry_run else ''}Fixing Thank You Category Filenames")
    print("=" * 80)
    
    metadata_path = folder / "metadata.json"
    insidenote_path = folder / "insidenote.json"
    
    if not metadata_path.exists() or not insidenote_path.exists():
        print("❌ JSON files not found")
        return False
    
    # Load JSON files
    metadata_list, metadata_format = load_json_file(metadata_path)
    insidenote_list, insidenote_format = load_json_file(insidenote_path)
    
    # Get actual image files
    actual_images = get_image_files(folder)
    
    print(f"\n📊 Statistics:")
    print(f"  Metadata entries: {len(metadata_list)}")
    print(f"  Inside note entries: {len(insidenote_list)}")
    print(f"  Actual image files: {len(actual_images)}")
    
    # Find matches and corrections
    print(f"\n🔍 Analyzing filenames...")
    print("=" * 80)
    
    metadata_corrections = {}
    insidenote_corrections = {}
    metadata_removals = []
    insidenote_removals = []
    
    # Check metadata
    for item in metadata_list:
        json_filename = item['filename']
        match = find_best_match(json_filename, actual_images)
        
        if match:
            if match != json_filename:
                metadata_corrections[json_filename] = match
        else:
            metadata_removals.append(json_filename)
    
    # Check insidenote
    for item in insidenote_list:
        json_filename = item['filename']
        match = find_best_match(json_filename, actual_images)
        
        if match:
            if match != json_filename:
                insidenote_corrections[json_filename] = match
        else:
            insidenote_removals.append(json_filename)
    
    # Print corrections
    if metadata_corrections:
        print(f"\n✏️  Filename corrections in metadata.json ({len(metadata_corrections)}):")
        for old, new in metadata_corrections.items():
            print(f"   {old}")
            print(f"   → {new}")
            print()
    
    if insidenote_corrections:
        print(f"\n✏️  Filename corrections in insidenote.json ({len(insidenote_corrections)}):")
        for old, new in insidenote_corrections.items():
            print(f"   {old}")
            print(f"   → {new}")
            print()
    
    if metadata_removals:
        print(f"\n❌ Will remove from metadata.json (no match found) ({len(metadata_removals)}):")
        for filename in metadata_removals:
            print(f"   - {filename}")
    
    if insidenote_removals:
        print(f"\n❌ Will remove from insidenote.json (no match found) ({len(insidenote_removals)}):")
        for filename in insidenote_removals:
            print(f"   - {filename}")
    
    if not (metadata_corrections or insidenote_corrections or metadata_removals or insidenote_removals):
        print("\n✅ No issues found! All filenames are correct.")
        return True
    
    if dry_run:
        print(f"\n{'='*80}")
        print("⚠️  DRY RUN MODE - No files modified")
        print("=" * 80)
        print("\n💡 To apply these fixes, run:")
        print("   python scripts/fix_thankyou_filenames_smart.py --fix")
        return True
    
    # Apply fixes
    print(f"\n{'='*80}")
    print("🔧 Applying fixes...")
    print("=" * 80)
    
    try:
        # Fix metadata.json
        if metadata_corrections or metadata_removals:
            updated_metadata = []
            for item in metadata_list:
                old_filename = item['filename']
                
                if old_filename in metadata_removals:
                    continue  # Skip this item
                
                if old_filename in metadata_corrections:
                    item['filename'] = metadata_corrections[old_filename]
                
                updated_metadata.append(item)
            
            # Save
            with open(metadata_path, 'w', encoding='utf-8') as f:
                if metadata_format == 'wrapped':
                    json.dump({'cards': updated_metadata}, f, indent=2, ensure_ascii=False)
                else:
                    json.dump(updated_metadata, f, indent=2, ensure_ascii=False)
            
            print(f"\n✅ Updated metadata.json")
            print(f"   Corrected: {len(metadata_corrections)}")
            print(f"   Removed: {len(metadata_removals)}")
            print(f"   Final count: {len(updated_metadata)}")
        
        # Fix insidenote.json
        if insidenote_corrections or insidenote_removals:
            updated_insidenote = []
            for item in insidenote_list:
                old_filename = item['filename']
                
                if old_filename in insidenote_removals:
                    continue  # Skip this item
                
                if old_filename in insidenote_corrections:
                    item['filename'] = insidenote_corrections[old_filename]
                
                updated_insidenote.append(item)
            
            # Save
            with open(insidenote_path, 'w', encoding='utf-8') as f:
                if insidenote_format == 'wrapped':
                    json.dump({'cards': updated_insidenote}, f, indent=2, ensure_ascii=False)
                else:
                    json.dump(updated_insidenote, f, indent=2, ensure_ascii=False)
            
            print(f"\n✅ Updated insidenote.json")
            print(f"   Corrected: {len(insidenote_corrections)}")
            print(f"   Removed: {len(insidenote_removals)}")
            print(f"   Final count: {len(updated_insidenote)}")
        
        print(f"\n{'='*80}")
        print("✅ All fixes applied successfully!")
        print("=" * 80)
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error applying fixes: {e}")
        import traceback
        traceback.print_exc()
        return False


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Smart fix for Thank You filename mismatches")
    parser.add_argument('--check', action='store_true', help='Just check (preview mode, default)')
    parser.add_argument('--fix', action='store_true', help='Apply the fixes')
    args = parser.parse_args()
    
    if not THANKYOU_FOLDER.exists():
        print(f"❌ Folder not found: {THANKYOU_FOLDER}")
        return
    
    if args.fix:
        analyze_and_fix(THANKYOU_FOLDER, dry_run=False)
    else:
        analyze_and_fix(THANKYOU_FOLDER, dry_run=True)


if __name__ == "__main__":
    main()

