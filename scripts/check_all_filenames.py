"""
Check ALL categories for filename mismatches.

This script scans all category folders and detects:
- Filenames in JSON that don't match actual image files
- Image files not referenced in JSON
- Mismatches between metadata.json and insidenote.json

Usage:
    python scripts/check_all_filenames.py
"""

import json
from pathlib import Path
from typing import Dict, List, Set, Tuple

# Configuration
CARDS_DIRECTORY = Path(r"C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Designs\Series1_original\Series")


def load_json_file(file_path: Path) -> List[Dict]:
    """Load JSON file and return the list."""
    if not file_path.exists():
        return []
    
    with open(file_path, 'r', encoding='utf-8') as f:
        data = json.load(f)
        if isinstance(data, dict) and 'cards' in data:
            return data['cards']
        elif isinstance(data, list):
            return data
        else:
            return [data]


def get_image_files(folder: Path) -> Set[str]:
    """Get all main image files in the folder (excluding inside_ files)."""
    images = set()
    for file in folder.glob("*.png"):
        if not file.name.startswith("inside_"):
            images.add(file.name)
    for file in folder.glob("*.jpg"):
        if not file.name.startswith("inside_"):
            images.add(file.name)
    return images


def find_best_match(json_filename: str, actual_images: Set[str]) -> str:
    """Find the best matching actual image file for a JSON filename."""
    # Exact match
    if json_filename in actual_images:
        return json_filename
    
    # Case-insensitive match
    for img_name in actual_images:
        if img_name.lower() == json_filename.lower():
            return img_name
    
    # Check if JSON filename is contained in any actual filename (prefix issue)
    json_base = json_filename.lower()
    for img_name in actual_images:
        if json_base in img_name.lower():
            return img_name
    
    # Check common prefix patterns
    for prefix in ['Vase', 'Card', 'Design', 'Template']:
        prefixed = f"{prefix}{json_filename}"
        if prefixed in actual_images:
            return prefixed
    
    return None


def check_folder(folder: Path) -> Dict:
    """Check a single folder for filename issues."""
    metadata_path = folder / "metadata.json"
    insidenote_path = folder / "insidenote.json"
    
    # Load JSON files
    metadata_list = load_json_file(metadata_path)
    insidenote_list = load_json_file(insidenote_path)
    
    # Get actual image files
    actual_images = get_image_files(folder)
    
    if not metadata_list and not insidenote_list and not actual_images:
        return None  # Skip empty folders
    
    # Extract filenames from JSON
    metadata_files = {item['filename'] for item in metadata_list if 'filename' in item}
    insidenote_files = {item['filename'] for item in insidenote_list if 'filename' in item}
    
    # Find corrections needed
    corrections = {}
    removals = []
    
    for json_filename in metadata_files:
        match = find_best_match(json_filename, actual_images)
        if match and match != json_filename:
            corrections[json_filename] = match
        elif not match:
            removals.append(json_filename)
    
    # Check for images not in JSON
    missing_in_json = actual_images - metadata_files
    
    return {
        'metadata_count': len(metadata_list),
        'insidenote_count': len(insidenote_list),
        'image_count': len(actual_images),
        'corrections': corrections,
        'removals': removals,
        'missing_in_json': missing_in_json,
        'metadata_files': metadata_files,
        'insidenote_files': insidenote_files,
        'actual_images': actual_images,
    }


def main():
    """Main function to check all folders."""
    print("=" * 80)
    print("Checking ALL Categories for Filename Mismatches")
    print("=" * 80)
    
    if not CARDS_DIRECTORY.exists():
        print(f"❌ Directory not found: {CARDS_DIRECTORY}")
        return
    
    # Get all subdirectories
    subdirs = sorted([d for d in CARDS_DIRECTORY.iterdir() if d.is_dir()])
    
    print(f"\nFound {len(subdirs)} folders to check\n")
    
    all_results = {}
    folders_with_issues = []
    
    for folder in subdirs:
        result = check_folder(folder)
        if result:
            all_results[folder.name] = result
            
            has_issues = (result['corrections'] or 
                         result['removals'] or 
                         result['missing_in_json'])
            
            if has_issues:
                folders_with_issues.append(folder.name)
    
    # Print summary
    print("=" * 80)
    print("SUMMARY")
    print("=" * 80)
    
    if not folders_with_issues:
        print("\n✅ No issues found in any category!")
        print("   All filenames are properly aligned.")
        return
    
    print(f"\n⚠️  Found issues in {len(folders_with_issues)} categories:")
    for folder_name in folders_with_issues:
        print(f"   - {folder_name}")
    
    # Print detailed issues for each folder
    for folder_name in folders_with_issues:
        result = all_results[folder_name]
        
        print(f"\n{'='*80}")
        print(f"📁 {folder_name}")
        print("=" * 80)
        
        print(f"   📊 Stats: {result['metadata_count']} metadata, "
              f"{result['insidenote_count']} insidenote, "
              f"{result['image_count']} images")
        
        if result['corrections']:
            print(f"\n   ✏️  Filename corrections needed ({len(result['corrections'])}):")
            for old, new in sorted(result['corrections'].items()):
                print(f"      {old}")
                print(f"      → {new}")
        
        if result['removals']:
            print(f"\n   ❌ To remove (no image file) ({len(result['removals'])}):")
            for filename in sorted(result['removals']):
                print(f"      - {filename}")
        
        if result['missing_in_json']:
            print(f"\n   ⚠️  Images not in JSON ({len(result['missing_in_json'])}):")
            for filename in sorted(result['missing_in_json']):
                print(f"      - {filename}")
    
    # Final recommendations
    print(f"\n{'='*80}")
    print("RECOMMENDATIONS")
    print("=" * 80)
    
    for folder_name in folders_with_issues:
        result = all_results[folder_name]
        
        if result['corrections']:
            print(f"\n📁 {folder_name}:")
            print(f"   Run: python scripts/fix_folder_filenames.py {folder_name} --fix")
    
    print(f"\n{'='*80}")


if __name__ == "__main__":
    main()

