"""
Detect and fix filename mismatches in Thank You category.

This script:
1. Reads metadata.json and insidenote.json
2. Lists actual image files in the folder
3. Detects mismatches
4. Optionally corrects the JSON files

Usage:
    python scripts/fix_thankyou_filenames.py --check    # Just check, don't fix
    python scripts/fix_thankyou_filenames.py --fix      # Fix the issues
"""

import json
import sys
from pathlib import Path
from typing import Dict, List, Tuple, Set
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


def get_image_files(folder: Path) -> Set[str]:
    """Get all image files in the folder (excluding inside_ files)."""
    images = set()
    for file in folder.glob("*.png"):
        if not file.name.startswith("inside_"):
            images.add(file.name)
    for file in folder.glob("*.jpg"):
        if not file.name.startswith("inside_"):
            images.add(file.name)
    return images


def check_filenames(folder: Path) -> Dict:
    """Check for filename mismatches."""
    print("=" * 80)
    print(f"Checking filenames in: {folder.name}")
    print("=" * 80)
    
    metadata_path = folder / "metadata.json"
    insidenote_path = folder / "insidenote.json"
    
    if not metadata_path.exists():
        print(f"❌ metadata.json not found")
        return None
    
    if not insidenote_path.exists():
        print(f"❌ insidenote.json not found")
        return None
    
    # Load JSON files
    metadata_list, metadata_format = load_json_file(metadata_path)
    insidenote_list, insidenote_format = load_json_file(insidenote_path)
    
    # Get actual image files
    actual_images = get_image_files(folder)
    
    # Extract filenames from JSON
    metadata_files = {item['filename'] for item in metadata_list if 'filename' in item}
    insidenote_files = {item['filename'] for item in insidenote_list if 'filename' in item}
    
    print(f"\n📊 Statistics:")
    print(f"  Metadata entries: {len(metadata_list)}")
    print(f"  Inside note entries: {len(insidenote_list)}")
    print(f"  Actual image files: {len(actual_images)}")
    
    # Create mappings
    metadata_map = {item['filename']: item for item in metadata_list}
    insidenote_map = {item['filename']: item for item in insidenote_list}
    
    # Detect issues
    issues = {
        'in_metadata_not_images': metadata_files - actual_images,
        'in_insidenote_not_images': insidenote_files - actual_images,
        'in_images_not_metadata': actual_images - metadata_files,
        'in_images_not_insidenote': actual_images - insidenote_files,
        'in_metadata_not_insidenote': metadata_files - insidenote_files,
        'in_insidenote_not_metadata': insidenote_files - metadata_files,
    }
    
    # Print issues
    print(f"\n🔍 Issues Found:")
    print("=" * 80)
    
    has_issues = False
    
    if issues['in_metadata_not_images']:
        has_issues = True
        print(f"\n❌ In metadata.json but NO IMAGE FILE ({len(issues['in_metadata_not_images'])}):")
        for filename in sorted(issues['in_metadata_not_images']):
            print(f"   - {filename}")
    
    if issues['in_insidenote_not_images']:
        has_issues = True
        print(f"\n❌ In insidenote.json but NO IMAGE FILE ({len(issues['in_insidenote_not_images'])}):")
        for filename in sorted(issues['in_insidenote_not_images']):
            print(f"   - {filename}")
    
    if issues['in_images_not_metadata']:
        has_issues = True
        print(f"\n⚠️  IMAGE EXISTS but not in metadata.json ({len(issues['in_images_not_metadata'])}):")
        for filename in sorted(issues['in_images_not_metadata']):
            print(f"   - {filename}")
    
    if issues['in_images_not_insidenote']:
        has_issues = True
        print(f"\n⚠️  IMAGE EXISTS but not in insidenote.json ({len(issues['in_images_not_insidenote'])}):")
        for filename in sorted(issues['in_images_not_insidenote']):
            print(f"   - {filename}")
    
    if issues['in_metadata_not_insidenote']:
        has_issues = True
        print(f"\n⚠️  In metadata.json but NOT in insidenote.json ({len(issues['in_metadata_not_insidenote'])}):")
        for filename in sorted(issues['in_metadata_not_insidenote']):
            print(f"   - {filename}")
    
    if issues['in_insidenote_not_metadata']:
        has_issues = True
        print(f"\n⚠️  In insidenote.json but NOT in metadata.json ({len(issues['in_insidenote_not_metadata'])}):")
        for filename in sorted(issues['in_insidenote_not_metadata']):
            print(f"   - {filename}")
    
    if not has_issues:
        print("✅ No issues found! All filenames are aligned.")
    
    # Try to find fuzzy matches
    print(f"\n🔎 Looking for similar filenames (possible typos):")
    print("=" * 80)
    
    found_similar = False
    for meta_file in issues['in_metadata_not_images']:
        for img_file in actual_images:
            # Simple similarity check
            if (meta_file.lower().replace('_', '').replace('-', '') == 
                img_file.lower().replace('_', '').replace('-', '')):
                found_similar = True
                print(f"\n💡 Possible match:")
                print(f"   metadata.json: {meta_file}")
                print(f"   actual file:   {img_file}")
    
    if not found_similar:
        print("   No obvious similar filenames found.")
    
    return {
        'issues': issues,
        'metadata_map': metadata_map,
        'insidenote_map': insidenote_map,
        'actual_images': actual_images,
        'metadata_format': metadata_format,
        'insidenote_format': insidenote_format,
    }


def fix_filenames(folder: Path, dry_run: bool = True) -> bool:
    """Fix filename mismatches by updating JSON files to match actual images."""
    
    result = check_filenames(folder)
    if not result:
        return False
    
    issues = result['issues']
    metadata_map = result['metadata_map']
    insidenote_map = result['insidenote_map']
    actual_images = result['actual_images']
    
    # Check if there are fixable issues
    if not (issues['in_metadata_not_images'] or issues['in_insidenote_not_images']):
        print("\n✅ No filename mismatches to fix!")
        return True
    
    print(f"\n{'='*80}")
    print("🔧 FIX STRATEGY:")
    print("=" * 80)
    print("\nWe'll remove entries from JSON files that don't have corresponding image files.")
    print("This ensures only cards with actual images are processed.")
    
    if dry_run:
        print("\n⚠️  DRY RUN MODE - No files will be modified")
    else:
        print("\n⚠️  LIVE MODE - Files WILL be modified")
    
    # Files to remove from metadata
    to_remove_metadata = issues['in_metadata_not_images']
    # Files to remove from insidenote
    to_remove_insidenote = issues['in_insidenote_not_images']
    
    if to_remove_metadata:
        print(f"\nWill remove {len(to_remove_metadata)} entries from metadata.json:")
        for filename in sorted(to_remove_metadata):
            print(f"   - {filename}")
    
    if to_remove_insidenote:
        print(f"\nWill remove {len(to_remove_insidenote)} entries from insidenote.json:")
        for filename in sorted(to_remove_insidenote):
            print(f"   - {filename}")
    
    if dry_run:
        print("\n✅ Dry run complete. Use --fix to apply changes.")
        return True
    
    # Apply fixes
    print(f"\n{'='*80}")
    print("Applying fixes...")
    print("=" * 80)
    
    try:
        # Fix metadata.json
        if to_remove_metadata:
            metadata_path = folder / "metadata.json"
            metadata_list, metadata_format = load_json_file(metadata_path)
            
            # Remove entries without images
            cleaned_metadata = [item for item in metadata_list 
                              if item['filename'] not in to_remove_metadata]
            
            print(f"\nmetadata.json: {len(metadata_list)} → {len(cleaned_metadata)} entries")
            
            # Save back
            with open(metadata_path, 'w', encoding='utf-8') as f:
                if metadata_format == 'wrapped':
                    json.dump({'cards': cleaned_metadata}, f, indent=2, ensure_ascii=False)
                else:
                    json.dump(cleaned_metadata, f, indent=2, ensure_ascii=False)
            
            print("✅ Updated metadata.json")
        
        # Fix insidenote.json
        if to_remove_insidenote:
            insidenote_path = folder / "insidenote.json"
            insidenote_list, insidenote_format = load_json_file(insidenote_path)
            
            # Remove entries without images
            cleaned_insidenote = [item for item in insidenote_list 
                                if item['filename'] not in to_remove_insidenote]
            
            print(f"\ninsidenote.json: {len(insidenote_list)} → {len(cleaned_insidenote)} entries")
            
            # Save back
            with open(insidenote_path, 'w', encoding='utf-8') as f:
                if insidenote_format == 'wrapped':
                    json.dump({'cards': cleaned_insidenote}, f, indent=2, ensure_ascii=False)
                else:
                    json.dump(cleaned_insidenote, f, indent=2, ensure_ascii=False)
            
            print("✅ Updated insidenote.json")
        
        print(f"\n{'='*80}")
        print("✅ All fixes applied successfully!")
        print("=" * 80)
        
        return True
        
    except Exception as e:
        print(f"\n❌ Error applying fixes: {e}")
        return False


def main():
    """Main function."""
    parser = argparse.ArgumentParser(description="Fix filename mismatches in Thank You category")
    parser.add_argument('--check', action='store_true', help='Just check for issues (default)')
    parser.add_argument('--fix', action='store_true', help='Fix the issues by updating JSON files')
    args = parser.parse_args()
    
    if not THANKYOU_FOLDER.exists():
        print(f"❌ Folder not found: {THANKYOU_FOLDER}")
        return
    
    if args.fix:
        print("🔧 FIX MODE - Will modify JSON files\n")
        fix_filenames(THANKYOU_FOLDER, dry_run=False)
    else:
        print("🔍 CHECK MODE - Just checking for issues\n")
        result = check_filenames(THANKYOU_FOLDER)
        
        if result and (result['issues']['in_metadata_not_images'] or 
                      result['issues']['in_insidenote_not_images']):
            print(f"\n{'='*80}")
            print("💡 To fix these issues, run:")
            print("   python scripts/fix_thankyou_filenames.py --fix")
            print("=" * 80)


if __name__ == "__main__":
    main()

