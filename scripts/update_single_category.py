"""
Update sw_templates for a single category at a time.

This script processes one card category folder and uploads to Supabase.

Usage:
    python scripts/update_single_category.py Thanksgiving
    python scripts/update_single_category.py BirthdayCardBasic
"""

import os
import json
import logging
import sys
from pathlib import Path
from typing import Dict, List, Optional
from datetime import datetime

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s - %(message)s'
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
BLANK_IMAGE = "https://kfitmirodgoduifcsyug.supabase.co/storage/v1/object/public/smartwish-assets/templates/images/blank.png"
BLANK_LOGO_IMAGE = "https://kfitmirodgoduifcsyug.supabase.co/storage/v1/object/public/smartwish-assets/templates/images/blank_logo.png"

# Storage base URL
STORAGE_BASE_URL = "https://kfitmirodgoduifcsyug.supabase.co/storage/v1/object/public/smartwish-assets/templates/images"

# Category to Storage URL mapping
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

# Category name mapping (folder name to category name in database)
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
    """Create a URL-friendly slug from filename with optional category prefix."""
    name = Path(filename).stem
    slug = name.lower().replace('_', '-').replace(' ', '-')
    slug = ''.join(c for c in slug if c.isalnum() or c == '-')
    while '--' in slug:
        slug = slug.replace('--', '-')
    slug = slug.strip('-')
    
    # If category prefix provided, prepend it to avoid collisions
    if category_prefix:
        slug = f"{category_prefix}-{slug}"
    
    return slug


def create_title(filename: str) -> str:
    """Create a readable title from filename."""
    name = Path(filename).stem
    title = name.replace('_', ' ').replace('-', ' ')
    title = ' '.join(word.capitalize() for word in title.split())
    return title


def get_storage_url(folder_name: str, filename: str, is_inside: bool = False) -> Optional[str]:
    """Construct the full Supabase storage URL for an image."""
    if folder_name not in CATEGORY_STORAGE_MAP:
        logger.warning(f"No storage mapping for folder: {folder_name}")
        return None
    
    base_url = CATEGORY_STORAGE_MAP[folder_name]
    image_name = f"inside_{filename}" if is_inside else filename
    return f"{base_url}{image_name}"


def process_category(folder_name: str, dry_run: bool = False):
    """
    Process a single category folder.
    
    Args:
        folder_name: Name of the folder to process (e.g., 'Thanksgiving')
        dry_run: If True, preview without uploading
    """
    logger.info("=" * 80)
    logger.info(f"Processing Category: {folder_name}")
    logger.info("=" * 80)
    
    # Check if folder exists
    folder_path = CARDS_DIRECTORY / folder_name
    if not folder_path.exists():
        logger.error(f"Folder not found: {folder_path}")
        return
    
    logger.info(f"Folder path: {folder_path}")
    
    # Check for JSON files
    metadata_path = folder_path / "metadata.json"
    insidenote_path = folder_path / "insidenote.json"
    
    if not metadata_path.exists():
        logger.error(f"metadata.json not found in {folder_name}")
        return
    
    if not insidenote_path.exists():
        logger.error(f"insidenote.json not found in {folder_name}")
        return
    
    logger.info(f"✅ Found metadata.json")
    logger.info(f"✅ Found insidenote.json")
    
    # Load JSON files
    try:
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata_data = json.load(f)
            if isinstance(metadata_data, dict) and 'cards' in metadata_data:
                metadata_list = metadata_data['cards']
            else:
                metadata_list = metadata_data if isinstance(metadata_data, list) else [metadata_data]
        
        with open(insidenote_path, 'r', encoding='utf-8') as f:
            insidenote_data = json.load(f)
            if isinstance(insidenote_data, dict) and 'cards' in insidenote_data:
                insidenote_list = insidenote_data['cards']
            else:
                insidenote_list = insidenote_data if isinstance(insidenote_data, list) else [insidenote_data]
        
        logger.info(f"✅ Loaded {len(metadata_list)} cards from metadata.json")
        logger.info(f"✅ Loaded {len(insidenote_list)} cards from insidenote.json")
        
    except Exception as e:
        logger.error(f"Error loading JSON files: {e}")
        return
    
    # Create mappings
    metadata_map = {item['filename']: item for item in metadata_list}
    insidenote_map = {item['filename']: item for item in insidenote_list}
    
    logger.info(f"\n{'='*80}")
    logger.info("Card Details:")
    logger.info(f"{'='*80}")
    
    # Get category info
    category_name = CATEGORY_NAME_MAP.get(folder_name, folder_name)
    storage_url_base = CATEGORY_STORAGE_MAP.get(folder_name, '')
    
    logger.info(f"Category name: {category_name}")
    logger.info(f"Storage URL base: {storage_url_base}")
    
    # Initialize Supabase if not dry run
    supabase = None
    category_id = None
    
    if not dry_run:
        try:
            from supabase import create_client, Client
            supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
            logger.info("✅ Connected to Supabase")
            
            # Get category ID
            response = supabase.table('sw_categories').select('id').eq('name', category_name).execute()
            if response.data and len(response.data) > 0:
                category_id = response.data[0]['id']
                logger.info(f"✅ Found category ID: {category_id}")
            else:
                logger.error(f"❌ Category '{category_name}' not found in database")
                return
            
            # Use fixed author ID
            logger.info(f"✅ Using author ID: {AUTHOR_ID}")
            
        except ImportError:
            logger.error("❌ Supabase library not installed. Run: pip install supabase")
            return
        except Exception as e:
            logger.error(f"❌ Error connecting to Supabase: {e}")
            return
    
    # Process cards
    records = []
    successful = 0
    skipped = 0
    
    logger.info(f"\n{'='*80}")
    logger.info("Processing Cards:")
    logger.info(f"{'='*80}\n")
    
    for i, filename in enumerate(metadata_map.keys(), 1):
        metadata = metadata_map[filename]
        insidenote = insidenote_map.get(filename, {})
        
        # Create slug with folder-specific prefix to avoid collisions
        # Use folder name for unique slugs (e.g., birthdaycardsbasic-1, birthdayfloral-1)
        folder_slug = folder_name.lower().replace(' ', '-')
        slug = create_slug(filename, category_prefix=folder_slug)
        title = metadata.get('title') or create_title(filename)
        
        logger.info(f"[{i}/{len(metadata_map)}] {filename}")
        logger.info(f"  Title: {title}")
        logger.info(f"  Slug: {slug}")
        
        # Check if slug already exists (if not dry run)
        if not dry_run and supabase:
            existing = supabase.table('sw_templates').select('id').eq('slug', slug).execute()
            if existing.data and len(existing.data) > 0:
                logger.info(f"  ⏭️  SKIPPED (already exists)")
                skipped += 1
                continue
        
        # Build URLs
        image_1_url = get_storage_url(folder_name, filename, is_inside=False)
        image_2_url = get_storage_url(folder_name, filename, is_inside=True)
        
        logger.info(f"  Image 1: {image_1_url}")
        logger.info(f"  Image 2: {image_2_url}")
        logger.info(f"  Keywords: {metadata.get('keywords', [])}")
        
        if not dry_run:
            # Construct the record - only include fields that exist in your table
            record = {
                'title': title,
                'slug': slug,
                'category_id': category_id,
                'author_id': AUTHOR_ID,
                'description': metadata.get('description', ''),
                'price': 2.99,
                'cover_image': image_1_url,
                'target_audience': metadata.get('recipient', ''),
                'occasion_type': metadata.get('occasion', ''),
                'style_type': metadata.get('style', ''),
                'image_1': image_1_url,
                'image_2': image_2_url,
                'image_3': BLANK_IMAGE,
                'image_4': BLANK_LOGO_IMAGE,
                'message': insidenote.get('inside_note', ''),
                'search_keywords': metadata.get('keywords', []),
                'embedding_vector': insidenote.get('embedding', []),  # Supabase will convert list to vector type
                'embedding_updated_at': datetime.utcnow().isoformat(),
            }
            
            records.append(record)
        
        logger.info("")
    
    # Upload to Supabase
    if not dry_run and records:
        logger.info(f"{'='*80}")
        logger.info(f"Uploading {len(records)} cards to Supabase...")
        logger.info(f"{'='*80}\n")
        
        try:
            response = supabase.table('sw_templates').upsert(records).execute()
            successful = len(records)
            logger.info(f"✅ Successfully uploaded {successful} cards!")
        except Exception as e:
            logger.error(f"❌ Error uploading to Supabase: {e}")
            return
    
    # Summary
    logger.info(f"\n{'='*80}")
    logger.info("SUMMARY")
    logger.info(f"{'='*80}")
    logger.info(f"Category: {folder_name} ({category_name})")
    logger.info(f"Total cards found: {len(metadata_map)}")
    
    if dry_run:
        logger.info(f"Mode: DRY RUN (preview only)")
        logger.info(f"Would upload: {len(metadata_map)} cards")
    else:
        logger.info(f"✅ Uploaded: {successful}")
        if skipped > 0:
            logger.info(f"⏭️  Skipped: {skipped} (already exist)")
    
    logger.info(f"{'='*80}\n")


def main():
    """Main function."""
    import argparse
    
    parser = argparse.ArgumentParser(description="Update sw_templates for a single category")
    parser.add_argument('category', type=str, help='Category folder name (e.g., Thanksgiving)')
    parser.add_argument('--dry-run', action='store_true', help='Preview without uploading')
    args = parser.parse_args()
    
    # Check if category folder exists
    folder_path = CARDS_DIRECTORY / args.category
    if not folder_path.exists():
        logger.error(f"Category folder not found: {args.category}")
        logger.info(f"\nAvailable folders in {CARDS_DIRECTORY}:")
        for folder in CARDS_DIRECTORY.iterdir():
            if folder.is_dir():
                logger.info(f"  - {folder.name}")
        return
    
    # Process the category
    process_category(args.category, dry_run=args.dry_run)


if __name__ == "__main__":
    main()

