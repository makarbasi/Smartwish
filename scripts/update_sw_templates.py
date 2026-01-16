"""
Automated script to update sw_templates table in Supabase with greeting card metadata.

This script:
1. Scans all card folders for metadata.json and insidenote.json files
2. Extracts relevant data from JSON files
3. Constructs complete records for sw_templates table
4. Performs batch UPSERT operations to Supabase

Usage:
    python scripts/update_sw_templates.py
    python scripts/update_sw_templates.py --dry-run  # Preview without uploading
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from datetime import datetime
from supabase import create_client, Client

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Supabase Configuration
SUPABASE_URL = "https://kfitmirodgoduifcsyug.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaXRtaXJvZGdvZHVpZmNzeXVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MDkxOCwiZXhwIjoyMDcwMjY2OTE4fQ.A7i0TAn_EP6DGrFVLI4gVEnbsBBqJwsDVA7WvOBMIys"

# Fixed Author ID
AUTHOR_ID = "5934ceee-181a-4258-9fed-5ff536e5464e"

# Cards Directory
CARDS_DIRECTORY = Path(r"C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Designs\Series1_original\Series")

# Blank image paths
BLANK_IMAGE = "C:\\Users\\makar\\OneDrive\\OLD\\E-Learning\\projects\\SmartWish\\Code\\Smartwish\\scripts\\blank.png"
BLANK_LOGO_IMAGE = "C:\\Users\\makar\\OneDrive\\OLD\\E-Learning\\projects\\SmartWish\\Code\\Smartwish\\scripts\\blank_logo.png"

# Category to Storage URL mapping
STORAGE_BASE_URL = "https://kfitmirodgoduifcsyug.supabase.co/storage/v1/object/public/smartwish-assets/templates/images"

CATEGORY_STORAGE_MAP = {
    'BirthdayCardsBasic': f'{STORAGE_BASE_URL}/Birthday/BirthdayCardBasic/',
    'BirthdayFloral': f'{STORAGE_BASE_URL}/Birthday/BirthdayFloral/',
    'BirthdayFunny': f'{STORAGE_BASE_URL}/Birthday/BirthdayFunny/',
    'Congratulations': f'{STORAGE_BASE_URL}/Congratulation/',
    'ChristmasCardBundle': f'{STORAGE_BASE_URL}/Holidays/',
    'FallGreetingCardBundlePDF': f'{STORAGE_BASE_URL}/Thanksgiving/',
    'Thankyou': f'{STORAGE_BASE_URL}/Thankyou/',
    'Graduation': f'{STORAGE_BASE_URL}/Graduation/',
}

# Category name mapping (folder name to category name)
CATEGORY_NAME_MAP = {
    'BirthdayCardsBasic': 'Birthday',
    'BirthdayFloral': 'Birthday',
    'BirthdayFunny': 'Birthday',
    'Congratulations': 'Congratulations',
    'ChristmasCardBundle': 'Holidays',
    'FallGreetingCardBundlePDF': 'Thanksgiving',
    'Thankyou': 'Thank You',  # Note: "Thank You" with space in database
    'Graduation': 'Graduation',
}


def create_slug(filename: str, category_prefix: str = None) -> str:
    """
    Create a URL-friendly slug from filename with optional category prefix.
    
    Args:
        filename: Original filename (e.g., "Birthday_Card_1.png")
        category_prefix: Optional category prefix to avoid collisions (e.g., "birthday")
    
    Returns:
        Slug (e.g., "birthday-card-1" or "birthday-1")
    """
    # Remove extension
    name = Path(filename).stem
    # Replace underscores with spaces, lowercase, and replace spaces with hyphens
    slug = name.lower().replace('_', '-').replace(' ', '-')
    # Remove any non-alphanumeric characters except hyphens
    slug = ''.join(c for c in slug if c.isalnum() or c == '-')
    # Remove multiple consecutive hyphens
    while '--' in slug:
        slug = slug.replace('--', '-')
    slug = slug.strip('-')
    
    # If category prefix provided, prepend it to avoid collisions across categories
    if category_prefix:
        slug = f"{category_prefix}-{slug}"
    
    return slug


def create_title(filename: str) -> str:
    """
    Create a readable title from filename.
    
    Args:
        filename: Original filename
    
    Returns:
        Human-readable title
    """
    name = Path(filename).stem
    # Replace underscores and hyphens with spaces
    title = name.replace('_', ' ').replace('-', ' ')
    # Capitalize each word
    title = ' '.join(word.capitalize() for word in title.split())
    return title


def get_storage_url(folder_name: str, filename: str, is_inside: bool = False) -> Optional[str]:
    """
    Construct the full Supabase storage URL for an image.
    
    Args:
        folder_name: Name of the card category folder
        filename: Name of the image file
        is_inside: Whether this is an inside page (prepends "inside_")
    
    Returns:
        Full storage URL or None if folder not mapped
    """
    if folder_name not in CATEGORY_STORAGE_MAP:
        logger.warning(f"No storage mapping for folder: {folder_name}")
        return None
    
    base_url = CATEGORY_STORAGE_MAP[folder_name]
    image_name = f"inside_{filename}" if is_inside else filename
    return f"{base_url}{image_name}"


def get_category_id(supabase: Client, category_name: str) -> Optional[str]:
    """
    Get category_id from sw_categories table.
    
    Args:
        supabase: Supabase client
        category_name: Name of the category
    
    Returns:
        UUID of the category or None
    """
    try:
        response = supabase.table('sw_categories').select('id').eq('name', category_name).execute()
        if response.data and len(response.data) > 0:
            return response.data[0]['id']
        logger.warning(f"Category not found: {category_name}")
        return None
    except Exception as e:
        logger.error(f"Error fetching category ID for {category_name}: {e}")
        return None


def get_author_id(supabase: Client, author_name: str = "Smartwish Studio") -> Optional[str]:
    """
    Get author_id - using fixed author ID.
    
    Args:
        supabase: Supabase client (not used, for compatibility)
        author_name: Name of the author (not used, for compatibility)
    
    Returns:
        Fixed author UUID
    """
    return AUTHOR_ID


def process_card_folder(folder_path: Path, folder_name: str, supabase: Client, 
                       category_id: str, author_id: str) -> Tuple[int, int, List[str]]:
    """
    Process a single card folder and extract data from JSON files.
    
    Args:
        folder_path: Path to the folder
        folder_name: Name of the folder (category)
        supabase: Supabase client
        category_id: UUID of the category
        author_id: UUID of the author
    
    Returns:
        Tuple of (successful_count, skipped_count, failed_filenames)
    """
    metadata_path = folder_path / "metadata.json"
    insidenote_path = folder_path / "insidenote.json"
    
    # Check if both files exist
    if not metadata_path.exists() or not insidenote_path.exists():
        logger.warning(f"Skipping {folder_name}: missing JSON files")
        return (0, 0, [])
    
    try:
        # Load JSON files
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata_data = json.load(f)
            # Handle both formats: direct array or {"cards": [...]}
            if isinstance(metadata_data, dict) and 'cards' in metadata_data:
                metadata_list = metadata_data['cards']
            else:
                metadata_list = metadata_data if isinstance(metadata_data, list) else [metadata_data]
        
        with open(insidenote_path, 'r', encoding='utf-8') as f:
            insidenote_data = json.load(f)
            # Handle both formats: direct array or {"cards": [...]}
            if isinstance(insidenote_data, dict) and 'cards' in insidenote_data:
                insidenote_list = insidenote_data['cards']
            else:
                insidenote_list = insidenote_data if isinstance(insidenote_data, list) else [insidenote_data]
        
        # Create mappings
        metadata_map = {item['filename']: item for item in metadata_list}
        insidenote_map = {item['filename']: item for item in insidenote_list}
        
        # Prepare records for upsert
        records = []
        successful = 0
        skipped = 0
        failed_files = []
        
        for filename in metadata_map.keys():
            try:
                metadata = metadata_map[filename]
                insidenote = insidenote_map.get(filename, {})
                
                # Create slug with folder-specific prefix to avoid collisions
                # Use folder name for unique slugs (e.g., birthdaycardsbasic-1, birthdayfloral-1)
                folder_slug = folder_name.lower().replace(' ', '-')
                slug = create_slug(filename, category_prefix=folder_slug)
                
                # Check if slug already exists
                existing = supabase.table('sw_templates').select('id').eq('slug', slug).execute()
                if existing.data and len(existing.data) > 0:
                    logger.info(f"Skipping {filename}: slug '{slug}' already exists")
                    skipped += 1
                    continue
                
                # Construct the record - only include fields that exist in your table
                record = {
                    'title': metadata.get('title') or create_title(filename),
                    'slug': slug,
                    'category_id': category_id,
                    'author_id': author_id,
                    'description': metadata.get('description', ''),
                    'price': 2.99,
                    'cover_image': get_storage_url(folder_name, filename, is_inside=False),
                    'target_audience': metadata.get('recipient', ''),
                    'occasion_type': metadata.get('occasion', ''),
                    'style_type': metadata.get('style', ''),
                    'image_1': get_storage_url(folder_name, filename, is_inside=False),
                    'image_2': get_storage_url(folder_name, filename, is_inside=True),
                    'image_3': BLANK_IMAGE,
                    'image_4': BLANK_LOGO_IMAGE,
                    'message': insidenote.get('inside_note', ''),
                    'search_keywords': metadata.get('keywords', []),
                    'embedding_vector': insidenote.get('embedding', []),
                    'embedding_updated_at': datetime.utcnow().isoformat(),
                }
                
                records.append(record)
                
            except Exception as e:
                logger.error(f"Error processing {filename} in {folder_name}: {e}")
                failed_files.append(filename)
                continue
        
        # Batch upsert to database
        if records:
            try:
                response = supabase.table('sw_templates').upsert(records).execute()
                successful = len(records)
                logger.info(f"✅ Successfully upserted {successful} cards from {folder_name}")
            except Exception as e:
                logger.error(f"Error upserting records for {folder_name}: {e}")
                failed_files.extend([r['title'] for r in records])
                return (0, skipped, failed_files)
        
        return (successful, skipped, failed_files)
        
    except Exception as e:
        logger.error(f"Error processing folder {folder_name}: {e}")
        return (0, 0, [])


def main(dry_run: bool = False):
    """
    Main function to process all card folders and update sw_templates.
    
    Args:
        dry_run: If True, only preview without uploading
    """
    logger.info("=" * 80)
    logger.info("Starting sw_templates Update")
    logger.info("=" * 80)
    
    # Check if cards directory exists
    if not CARDS_DIRECTORY.exists():
        logger.error(f"Cards directory not found: {CARDS_DIRECTORY}")
        return
    
    # Initialize Supabase client
    if not dry_run:
        try:
            supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            logger.info("✅ Connected to Supabase")
        except Exception as e:
            logger.error(f"Failed to connect to Supabase: {e}")
            return
    else:
        supabase = None
        logger.info("🔍 DRY RUN MODE - No data will be uploaded")
    
    # Get all subdirectories
    subdirs = [d for d in CARDS_DIRECTORY.iterdir() if d.is_dir()]
    logger.info(f"Found {len(subdirs)} folders to process")
    
    # Statistics
    total_successful = 0
    total_skipped = 0
    total_failed = 0
    all_failed_files = []
    processed_folders = []
    
    for subdir in subdirs:
        folder_name = subdir.name
        logger.info(f"\n{'='*80}")
        logger.info(f"Processing: {folder_name}")
        logger.info(f"{'='*80}")
        
        # Get category name and ID
        category_name = CATEGORY_NAME_MAP.get(folder_name, folder_name)
        
        if dry_run:
            logger.info(f"Would process category: {category_name}")
            # In dry run, just count files
            metadata_path = subdir / "metadata.json"
            if metadata_path.exists():
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                    if isinstance(data, dict) and 'cards' in data:
                        count = len(data['cards'])
                    elif isinstance(data, list):
                        count = len(data)
                    else:
                        count = 1
                    logger.info(f"Would process {count} cards from {folder_name}")
                    total_successful += count
            continue
        
        category_id = get_category_id(supabase, category_name)
        if not category_id:
            logger.error(f"Cannot process {folder_name}: category '{category_name}' not found in database")
            continue
        
        author_id = get_author_id(supabase, "Smartwish Studio")
        if not author_id:
            logger.error(f"Cannot process {folder_name}: author 'Smartwish Studio' not found in database")
            continue
        
        # Process the folder
        successful, skipped, failed_files = process_card_folder(
            subdir, folder_name, supabase, category_id, author_id
        )
        
        total_successful += successful
        total_skipped += skipped
        total_failed += len(failed_files)
        all_failed_files.extend(failed_files)
        
        if successful > 0 or skipped > 0:
            processed_folders.append({
                'folder': folder_name,
                'category': category_name,
                'successful': successful,
                'skipped': skipped,
                'failed': len(failed_files)
            })
    
    # Final Summary
    logger.info("\n" + "=" * 80)
    logger.info("FINAL SUMMARY")
    logger.info("=" * 80)
    logger.info(f"✅ Successfully uploaded: {total_successful} cards")
    logger.info(f"⏭️  Skipped (already exist): {total_skipped} cards")
    if total_failed > 0:
        logger.info(f"❌ Failed: {total_failed} cards")
    logger.info(f"📁 Processed folders: {len(processed_folders)}")
    
    if processed_folders:
        logger.info("\n" + "=" * 80)
        logger.info("Breakdown by Folder:")
        logger.info("=" * 80)
        for folder in processed_folders:
            logger.info(f"📂 {folder['folder']} ({folder['category']})")
            logger.info(f"   ✅ Uploaded: {folder['successful']}")
            logger.info(f"   ⏭️  Skipped: {folder['skipped']}")
            if folder['failed'] > 0:
                logger.info(f"   ❌ Failed: {folder['failed']}")
    
    if all_failed_files:
        logger.info("\n" + "=" * 80)
        logger.info("Failed Files:")
        logger.info("=" * 80)
        for file in all_failed_files:
            logger.info(f"   ❌ {file}")
    
    logger.info("\n" + "=" * 80)
    logger.info("Update Complete!")
    logger.info("=" * 80)


if __name__ == "__main__":
    import argparse
    
    parser = argparse.ArgumentParser(description="Update sw_templates table with card metadata")
    parser.add_argument('--dry-run', action='store_true', help='Preview without uploading')
    args = parser.parse_args()
    
    main(dry_run=args.dry_run)

