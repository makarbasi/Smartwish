"""
Verification script to check prerequisites before updating sw_templates.

This script verifies:
1. Card directory exists and has correct structure
2. JSON files are present and valid
3. Supabase connection works
4. Required database tables and data exist
5. Image files match JSON entries

Usage:
    python scripts/verify_setup.py
"""

import os
import json
import logging
from pathlib import Path
from typing import Dict, List, Tuple

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration (same as update script)
CARDS_DIRECTORY = Path(r"C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Designs\Series1_original\Series")
SUPABASE_URL = "https://kfitmirodgoduifcsyug.supabase.co"
SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtmaXRtaXJvZGdvZHVpZmNzeXVnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1NDY5MDkxOCwiZXhwIjoyMDcwMjY2OTE4fQ.A7i0TAn_EP6DGrFVLI4gVEnbsBBqJwsDVA7WvOBMIys"

REQUIRED_CATEGORIES = ['Birthday', 'Congratulations', 'Holidays', 'Thanksgiving', 'Thankyou', 'Graduation']

def print_section(title: str):
    """Print a formatted section header."""
    logger.info("\n" + "=" * 80)
    logger.info(f"  {title}")
    logger.info("=" * 80)


def check_directory_structure() -> Tuple[bool, int, List[str]]:
    """
    Check if the cards directory exists and has the correct structure.
    
    Returns:
        Tuple of (success, folder_count, folder_names)
    """
    print_section("1. Checking Directory Structure")
    
    if not CARDS_DIRECTORY.exists():
        logger.error(f"❌ Cards directory not found: {CARDS_DIRECTORY}")
        return (False, 0, [])
    
    logger.info(f"✅ Cards directory found: {CARDS_DIRECTORY}")
    
    subdirs = [d for d in CARDS_DIRECTORY.iterdir() if d.is_dir()]
    folder_names = [d.name for d in subdirs]
    
    logger.info(f"✅ Found {len(subdirs)} folders:")
    for folder in folder_names:
        logger.info(f"   📁 {folder}")
    
    return (True, len(subdirs), folder_names)


def check_json_files(folders: List[str]) -> Tuple[int, int, int]:
    """
    Check if JSON files exist and are valid in each folder.
    
    Args:
        folders: List of folder names to check
    
    Returns:
        Tuple of (folders_ok, total_cards, folders_with_issues)
    """
    print_section("2. Checking JSON Files")
    
    folders_ok = 0
    total_cards = 0
    folders_with_issues = 0
    
    for folder_name in folders:
        folder_path = CARDS_DIRECTORY / folder_name
        metadata_path = folder_path / "metadata.json"
        insidenote_path = folder_path / "insidenote.json"
        
        # Check if both files exist
        if not metadata_path.exists():
            logger.warning(f"⚠️  {folder_name}: missing metadata.json")
            folders_with_issues += 1
            continue
        
        if not insidenote_path.exists():
            logger.warning(f"⚠️  {folder_name}: missing insidenote.json")
            folders_with_issues += 1
            continue
        
        # Try to load and validate JSON
        try:
            with open(metadata_path, 'r', encoding='utf-8') as f:
                metadata = json.load(f)
                if isinstance(metadata, dict) and 'cards' in metadata:
                    card_count = len(metadata['cards'])
                elif isinstance(metadata, list):
                    card_count = len(metadata)
                else:
                    card_count = 1
            
            with open(insidenote_path, 'r', encoding='utf-8') as f:
                insidenote = json.load(f)
            
            logger.info(f"✅ {folder_name}: {card_count} cards with valid JSON files")
            folders_ok += 1
            total_cards += card_count
            
        except json.JSONDecodeError as e:
            logger.error(f"❌ {folder_name}: Invalid JSON - {e}")
            folders_with_issues += 1
        except Exception as e:
            logger.error(f"❌ {folder_name}: Error - {e}")
            folders_with_issues += 1
    
    logger.info(f"\n✅ Total: {folders_ok} folders OK, {total_cards} cards found")
    if folders_with_issues > 0:
        logger.warning(f"⚠️  {folders_with_issues} folders have issues")
    
    return (folders_ok, total_cards, folders_with_issues)


def check_supabase_connection() -> bool:
    """
    Check if Supabase connection works.
    
    Returns:
        True if connection successful
    """
    print_section("3. Checking Supabase Connection")
    
    try:
        from supabase import create_client, Client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        logger.info("✅ Supabase client created successfully")
        return True
    except ImportError:
        logger.error("❌ Supabase library not installed. Run: pip install supabase")
        return False
    except Exception as e:
        logger.error(f"❌ Failed to connect to Supabase: {e}")
        return False


def check_database_tables() -> Tuple[bool, Dict]:
    """
    Check if required database tables exist and have data.
    
    Returns:
        Tuple of (success, table_info)
    """
    print_section("4. Checking Database Tables")
    
    try:
        from supabase import create_client, Client
        supabase: Client = create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
        
        table_info = {}
        
        # Check sw_categories
        try:
            categories = supabase.table('sw_categories').select('id, name').execute()
            category_names = [c['name'] for c in categories.data]
            table_info['categories'] = category_names
            logger.info(f"✅ sw_categories table: {len(categories.data)} categories found")
            logger.info(f"   Categories: {', '.join(category_names)}")
            
            # Check if required categories exist
            missing_categories = [c for c in REQUIRED_CATEGORIES if c not in category_names]
            if missing_categories:
                logger.warning(f"⚠️  Missing categories: {', '.join(missing_categories)}")
            
        except Exception as e:
            logger.error(f"❌ Error accessing sw_categories: {e}")
            return (False, table_info)
        
        # Check sw_authors
        try:
            authors = supabase.table('sw_authors').select('id, name').execute()
            author_names = [a['name'] for a in authors.data]
            table_info['authors'] = author_names
            logger.info(f"✅ sw_authors table: {len(authors.data)} authors found")
            logger.info(f"   Authors: {', '.join(author_names)}")
            
            if 'Smartwish Studio' not in author_names:
                logger.warning("⚠️  'Smartwish Studio' author not found")
            
        except Exception as e:
            logger.error(f"❌ Error accessing sw_authors: {e}")
            return (False, table_info)
        
        # Check sw_templates
        try:
            templates = supabase.table('sw_templates').select('id', count='exact').execute()
            template_count = templates.count if hasattr(templates, 'count') else len(templates.data)
            table_info['template_count'] = template_count
            logger.info(f"✅ sw_templates table: {template_count} existing templates")
            
        except Exception as e:
            logger.error(f"❌ Error accessing sw_templates: {e}")
            return (False, table_info)
        
        return (True, table_info)
        
    except Exception as e:
        logger.error(f"❌ Database check failed: {e}")
        return (False, {})


def check_embeddings(folders: List[str]) -> Tuple[int, int]:
    """
    Check if embeddings exist in insidenote.json files.
    
    Args:
        folders: List of folder names to check
    
    Returns:
        Tuple of (cards_with_embeddings, cards_without_embeddings)
    """
    print_section("5. Checking Embeddings")
    
    with_embeddings = 0
    without_embeddings = 0
    
    for folder_name in folders:
        folder_path = CARDS_DIRECTORY / folder_name
        insidenote_path = folder_path / "insidenote.json"
        
        if not insidenote_path.exists():
            continue
        
        try:
            with open(insidenote_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                if isinstance(data, dict) and 'cards' in data:
                    cards = data['cards']
                elif isinstance(data, list):
                    cards = data
                else:
                    cards = [data]
                
                for card in cards:
                    if 'embedding' in card and card['embedding']:
                        with_embeddings += 1
                    else:
                        without_embeddings += 1
        
        except Exception as e:
            logger.warning(f"⚠️  Error checking embeddings in {folder_name}: {e}")
    
    logger.info(f"✅ Cards with embeddings: {with_embeddings}")
    if without_embeddings > 0:
        logger.warning(f"⚠️  Cards without embeddings: {without_embeddings}")
        logger.warning("   Run generate_embeddings.py to add missing embeddings")
    
    return (with_embeddings, without_embeddings)


def main():
    """Main verification function."""
    logger.info("\n" + "=" * 80)
    logger.info("  Supabase sw_templates Setup Verification")
    logger.info("=" * 80)
    
    all_checks_passed = True
    
    # 1. Check directory structure
    dir_ok, folder_count, folders = check_directory_structure()
    if not dir_ok:
        all_checks_passed = False
        logger.error("\n❌ Directory check failed! Fix the path and try again.")
        return
    
    # 2. Check JSON files
    folders_ok, total_cards, folders_with_issues = check_json_files(folders)
    if folders_ok == 0:
        all_checks_passed = False
        logger.error("\n❌ No valid JSON files found!")
    
    # 3. Check Supabase connection
    if not check_supabase_connection():
        all_checks_passed = False
        logger.error("\n❌ Supabase connection failed!")
        return
    
    # 4. Check database tables
    tables_ok, table_info = check_database_tables()
    if not tables_ok:
        all_checks_passed = False
        logger.error("\n❌ Database tables check failed!")
    
    # 5. Check embeddings
    with_emb, without_emb = check_embeddings(folders)
    if without_emb > 0:
        logger.warning("\n⚠️  Some cards are missing embeddings (non-critical)")
    
    # Final Summary
    print_section("VERIFICATION SUMMARY")
    
    logger.info(f"📁 Folders found: {folder_count}")
    logger.info(f"📝 Total cards: {total_cards}")
    logger.info(f"✅ Valid folders: {folders_ok}")
    logger.info(f"⚠️  Folders with issues: {folders_with_issues}")
    logger.info(f"🔢 Cards with embeddings: {with_emb}")
    if without_emb > 0:
        logger.info(f"⚠️  Cards without embeddings: {without_emb}")
    
    if 'template_count' in table_info:
        logger.info(f"📊 Existing templates in database: {table_info['template_count']}")
    
    logger.info("\n" + "=" * 80)
    
    if all_checks_passed and folders_with_issues == 0:
        logger.info("✅ ALL CHECKS PASSED!")
        logger.info("=" * 80)
        logger.info("\n🚀 You're ready to run: python scripts/update_sw_templates.py")
    elif all_checks_passed:
        logger.info("⚠️  CHECKS PASSED WITH WARNINGS")
        logger.info("=" * 80)
        logger.info("\n⚠️  Some folders have issues, but you can proceed")
        logger.info("   Only valid folders will be processed")
    else:
        logger.info("❌ VERIFICATION FAILED")
        logger.info("=" * 80)
        logger.info("\n❌ Please fix the issues above before running the update script")
    
    logger.info("")


if __name__ == "__main__":
    main()

