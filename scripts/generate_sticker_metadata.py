"""
AI-powered metadata generation for sticker images using Google Gemini.

This script:
1. Scans the stickers directory for PNG files
2. Uses Gemini Vision to analyze each sticker and generate metadata
3. Generates embeddings using Gemini Embedding model
4. Inserts records into Supabase stickers table

Usage:
    # Option 1: Use .env file (recommended)
    # The script will automatically load from:
    #   - smartwish-backend/backend/.env
    #   - .env (project root)
    # Required variables in .env:
    #   GEMINI_API_KEY=your_api_key (or GOOGLE_API_KEY)
    #   SUPABASE_URL=your_supabase_url
    #   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
    
    # Process all subdirectories:
    python scripts/generate_sticker_metadata.py
    
    # Process a specific folder with a custom category:
    python scripts/generate_sticker_metadata.py --folder "D:\\path\\to\\folder" --category "bookish"
    
    # Automatically upload images to Supabase Storage:
    python scripts/generate_sticker_metadata.py --folder "D:\\path\\to\\folder" --category "bookish" --upload-images
    
    # Option 2: Set environment variables manually (Windows PowerShell):
    $Env:GOOGLE_API_KEY = "your_api_key"
    $Env:SUPABASE_URL = "your_supabase_url"
    $Env:SUPABASE_SERVICE_ROLE_KEY = "your_service_role_key"
    python scripts/generate_sticker_metadata.py
    
    # Or with custom paths:
    python scripts/generate_sticker_metadata.py --stickers-dir "D:\\path\\to\\stickers" --base-url "https://your-url"
"""

from __future__ import annotations

import os
import sys
import json
import time
import re
import argparse
import logging
from pathlib import Path
from typing import List, Dict, Optional, Tuple
from dataclasses import dataclass
from urllib.parse import quote
import base64

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Try to import required packages
try:
    from google import genai
    from google.genai import types
    from PIL import Image
    from supabase import create_client, Client
    from dotenv import load_dotenv
except ImportError as e:
    logger.error(f"Missing required package: {e}")
    logger.error("Install with: pip install google-genai pillow supabase python-dotenv")
    sys.exit(1)

# Configuration
DEFAULT_STICKERS_DIR = r"D:\Projects\Smartwish\assets\Stickers"
DEFAULT_SUPABASE_STORAGE_URL = "https://kfitmirodgoduifcsyug.supabase.co/storage/v1/object/public/smartwish-assets/Stickers"

# Rate limiting
REQUESTS_PER_MINUTE = 15
REQUEST_DELAY = 60.0 / REQUESTS_PER_MINUTE  # seconds between requests


@dataclass
class StickerMetadata:
    """Metadata extracted from a sticker image"""
    title: str
    description: str
    category: str
    tags: List[str]
    search_keywords: List[str]
    slug: str
    image_url: str
    embedding: Optional[List[float]] = None


def slugify(text: str) -> str:
    """Convert text to URL-friendly slug"""
    text = text.lower().strip()
    text = re.sub(r'[^\w\s-]', '', text)
    text = re.sub(r'[-\s]+', '-', text)
    return text[:100]


def get_category_from_folder(folder_name: str) -> str:
    """Map folder name to a clean category name"""
    category_map = {
        'cats': 'cats',
        'dogs': 'dogs',
        'kids': 'kids',
        'kidsvalentines': 'valentines',
        'valentine animals': 'valentines',
        'reading_girly': 'bookish',
        'smuttybook': 'bookish',
        'bookish': 'bookish',
    }
    folder_lower = folder_name.lower()
    return category_map.get(folder_lower, folder_lower)


def analyze_sticker_with_gemini(
    client: genai.Client,
    image_path: Path,
    category_hint: str
) -> Optional[Dict]:
    """
    Use Gemini Vision to analyze a sticker image and extract metadata.
    """
    try:
        # Read and encode image
        with open(image_path, 'rb') as f:
            image_data = f.read()
        
        prompt = f"""Analyze this sticker image and provide metadata for a sticker marketplace.

Category hint: {category_hint}

Return ONLY a valid JSON object with these exact keys:
{{
    "title": "Short descriptive title (2-5 words, max 40 chars)",
    "description": "1-2 sentence description for semantic search, describing what the sticker shows, style, mood, and potential uses",
    "tags": ["array", "of", "5-10", "relevant", "tags"],
    "search_keywords": ["array", "of", "keywords", "someone", "might", "search", "for"]
}}

Guidelines:
- Title should be catchy and descriptive (e.g., "Cute Ginger Cat", "Happy Birthday Balloon")
- Description should mention visual elements, style (cartoon, realistic, kawaii), mood, and use cases
- Tags should include: subject, style, colors, mood, use cases
- Search keywords should include variations people might search for

Return ONLY the JSON, no markdown, no explanation."""

        # Create image part
        image_part = types.Part.from_bytes(
            data=image_data,
            mime_type="image/png"
        )
        
        response = client.models.generate_content(
            model="gemini-2.0-flash",
            contents=[prompt, image_part]
        )
        
        # Parse response
        text = response.text.strip()
        
        # Try to extract JSON from response
        if text.startswith('```'):
            # Remove markdown code blocks
            text = re.sub(r'^```(?:json)?\n?', '', text)
            text = re.sub(r'\n?```$', '', text)
        
        # Find JSON object in text
        start = text.find('{')
        end = text.rfind('}') + 1
        if start != -1 and end > start:
            text = text[start:end]
        
        data = json.loads(text)
        
        # Validate required fields
        required = ['title', 'description', 'tags', 'search_keywords']
        for field in required:
            if field not in data:
                logger.warning(f"Missing field '{field}' in response for {image_path.name}")
                return None
        
        return data
        
    except json.JSONDecodeError as e:
        logger.error(f"Failed to parse JSON for {image_path.name}: {e}")
        return None
    except Exception as e:
        logger.error(f"Error analyzing {image_path.name}: {e}")
        return None


def generate_embedding(client: genai.Client, text: str, retry_count: int = 3) -> Optional[List[float]]:
    """
    Generate embedding for text using Gemini Embedding API.
    """
    for attempt in range(retry_count):
        try:
            response = client.models.embed_content(
                model="text-embedding-004",
                contents=text
            )
            
            if response and response.embeddings:
                return list(response.embeddings[0].values)
            else:
                logger.warning(f"Unexpected embedding response format")
                return None
                
        except Exception as e:
            logger.error(f"Error generating embedding (attempt {attempt + 1}/{retry_count}): {e}")
            if attempt < retry_count - 1:
                wait_time = (2 ** attempt) * 2
                logger.info(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                return None
    
    return None


def collect_sticker_images(stickers_dir: Path, target_folder: Optional[Path] = None, target_category: Optional[str] = None) -> List[Tuple[Path, str]]:
    """
    Collect all PNG images from stickers directory.
    
    Args:
        stickers_dir: Base directory containing sticker folders (used if target_folder is None)
        target_folder: Optional specific folder to process
        target_category: Optional category to assign (required if target_folder is provided)
    """
    images = []
    
    if target_folder:
        # Process a specific folder
        if not target_folder.exists():
            logger.error(f"Target folder not found: {target_folder}")
            return []
        
        if not target_folder.is_dir():
            logger.error(f"Target path is not a directory: {target_folder}")
            return []
        
        if not target_category:
            logger.error("--category is required when using --folder")
            return []
        
        category = target_category
        # Get images directly from this folder (not subdirectories)
        for img_path in target_folder.glob("*.png"):
            images.append((img_path, category))
        
        logger.info(f"Found {len(images)} sticker images in {target_folder} (category: {category})")
    else:
        # Original behavior: process all subdirectories
        for folder in stickers_dir.iterdir():
            if not folder.is_dir():
                continue
                
            category = get_category_from_folder(folder.name)
            
            for img_path in folder.glob("*.png"):
                images.append((img_path, category))
        
        logger.info(f"Found {len(images)} sticker images in {stickers_dir}")
    
    return images


def upload_image_to_storage(
    supabase: Client,
    image_path: Path,
    category: str,
    bucket_name: str = "smartwish-assets"
) -> Optional[str]:
    """
    Upload an image to Supabase Storage and return the public URL.
    
    Args:
        supabase: Supabase client
        image_path: Path to the image file
        category: Category name (used as folder in storage)
        bucket_name: Storage bucket name
        
    Returns:
        Public URL of the uploaded image, or None if upload failed
    """
    try:
        # Read image file
        with open(image_path, 'rb') as f:
            image_data = f.read()
        
        # Build storage path: Stickers/{category}/{filename}
        storage_path = f"Stickers/{category}/{image_path.name}"
        
        # Upload to Supabase Storage
        upload_result = supabase.storage.from_(bucket_name).upload(
            path=storage_path,
            file=image_data,
            file_options={
                "content-type": "image/png",
                "cache-control": "3600",
                "upsert": False  # Don't overwrite existing files
            }
        )
        
        # Check for errors (Python client returns dict with 'error' key or raises exception)
        if isinstance(upload_result, dict) and upload_result.get('error'):
            error_msg = str(upload_result['error'])
            # Check if file already exists (that's okay)
            if "already exists" in error_msg.lower() or "duplicate" in error_msg.lower():
                logger.info(f"Image already exists in storage: {storage_path}")
            else:
                logger.error(f"Upload error for {image_path.name}: {error_msg}")
                return None
        
        # Get public URL
        url_result = supabase.storage.from_(bucket_name).get_public_url(storage_path)
        
        # The get_public_url returns a dict with 'publicUrl' key
        if isinstance(url_result, dict) and 'publicUrl' in url_result:
            return url_result['publicUrl']
        elif hasattr(url_result, 'public_url'):
            return url_result.public_url
        else:
            # Fallback: construct URL manually
            supabase_url = os.environ.get('SUPABASE_URL', '').rstrip('/')
            return f"{supabase_url}/storage/v1/object/public/{bucket_name}/{storage_path}"
            
    except Exception as e:
        logger.error(f"Error uploading {image_path.name} to storage: {e}")
        return None


def build_image_url(base_url: str, folder_name: str, filename: str, category: Optional[str] = None) -> str:
    """
    Build the Supabase storage URL for a sticker image.
    
    Args:
        base_url: Base URL for Supabase storage
        folder_name: Folder name (or category if provided)
        filename: Image filename
        category: Optional category to use instead of folder_name for URL path
    """
    # Use category for URL path if provided, otherwise use folder_name
    url_path = category if category else folder_name
    # URL encode the filename to handle spaces and special characters
    encoded_filename = quote(filename)
    return f"{base_url}/{url_path}/{encoded_filename}"


def process_sticker(
    client: genai.Client,
    image_path: Path,
    category: str,
    base_url: str,
    existing_slugs: set,
    supabase: Optional[Client] = None,
    upload_images: bool = False
) -> Optional[StickerMetadata]:
    """
    Process a single sticker image: analyze with AI and generate embedding.
    """
    # Analyze with Gemini Vision
    metadata = analyze_sticker_with_gemini(client, image_path, category)
    
    if not metadata:
        # Fallback to filename-based metadata
        filename_base = image_path.stem
        # Clean up filename for title
        clean_name = re.sub(r'[\(\)\d\-_]+', ' ', filename_base).strip()
        if not clean_name:
            clean_name = category
        metadata = {
            'title': clean_name.title()[:40],
            'description': f"A cute {category} sticker featuring {clean_name.lower()}",
            'tags': [category, 'sticker', 'round', 'cute'],
            'search_keywords': [category, clean_name.lower(), 'sticker']
        }
        logger.warning(f"Using fallback metadata for {image_path.name}")
    
    # Generate unique slug
    base_slug = slugify(metadata['title'])
    if not base_slug:
        base_slug = slugify(category + '-sticker')
    slug = base_slug
    counter = 1
    while slug in existing_slugs:
        slug = f"{base_slug}-{counter}"
        counter += 1
    existing_slugs.add(slug)
    
    # Upload image to storage if requested, otherwise build URL from base_url
    if upload_images and supabase:
        # Upload image and get the actual URL
        image_url = upload_image_to_storage(supabase, image_path, category)
        if not image_url:
            logger.warning(f"Failed to upload {image_path.name}, skipping...")
            return None
        logger.info(f"  Uploaded to storage: {image_path.name}")
    else:
        # Build image URL from base_url (assumes images are already uploaded)
        folder_name = image_path.parent.name
        image_url = build_image_url(base_url, folder_name, image_path.name, category=category)
    
    # Generate embedding from description and keywords
    embedding_text = f"""
Title: {metadata['title']}
Category: {category}
Description: {metadata['description']}
Tags: {', '.join(metadata['tags'])}
Keywords: {', '.join(metadata['search_keywords'])}
"""
    
    time.sleep(REQUEST_DELAY)  # Rate limiting
    embedding = generate_embedding(client, embedding_text.strip())
    
    return StickerMetadata(
        title=metadata['title'][:255],
        description=metadata['description'],
        category=category,
        tags=metadata['tags'][:20],  # Limit tags
        search_keywords=metadata['search_keywords'][:30],  # Limit keywords
        slug=slug,
        image_url=image_url,
        embedding=embedding
    )


def insert_sticker_raw(
    supabase: Client,
    sticker: StickerMetadata
) -> bool:
    """
    Insert sticker using direct table insert, then update embedding separately.
    """
    try:
        # First insert without embedding
        data = {
            'title': sticker.title,
            'slug': sticker.slug,
            'category': sticker.category,
            'description': sticker.description,
            'image_url': sticker.image_url,
            'tags': sticker.tags,
            'search_keywords': sticker.search_keywords,
            'popularity': 0,
            'num_downloads': 0,
            'status': 'active',
        }
        
        result = supabase.table('stickers').insert(data).execute()
        
        if not result.data:
            logger.error(f"Insert returned no data for {sticker.slug}")
            return False
        
        sticker_id = result.data[0]['id']
        
        # Update embedding using RPC function
        if sticker.embedding:
            try:
                supabase.rpc('set_sticker_embedding', {
                    'sticker_id': sticker_id,
                    'embedding': sticker.embedding
                }).execute()
            except Exception as emb_err:
                logger.warning(f"Could not set embedding for {sticker.slug}: {emb_err}")
                # Continue anyway - sticker is inserted
        
        return True
        
    except Exception as e:
        logger.error(f"Failed to insert sticker {sticker.slug}: {e}")
        return False


def main():
    parser = argparse.ArgumentParser(description="Generate sticker metadata using Gemini AI")
    parser.add_argument(
        "--stickers-dir",
        type=Path,
        default=Path(DEFAULT_STICKERS_DIR),
        help="Directory containing sticker folders"
    )
    parser.add_argument(
        "--base-url",
        type=str,
        default=DEFAULT_SUPABASE_STORAGE_URL,
        help="Base URL for Supabase storage"
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Analyze images but don't insert into database"
    )
    parser.add_argument(
        "--limit",
        type=int,
        default=None,
        help="Limit number of stickers to process"
    )
    parser.add_argument(
        "--folder",
        type=Path,
        default=None,
        help="Process a specific folder instead of all subdirectories (requires --category)"
    )
    parser.add_argument(
        "--category",
        type=str,
        default=None,
        help="Category to assign stickers (required when using --folder, e.g., 'bookish')"
    )
    parser.add_argument(
        "--upload-images",
        action="store_true",
        help="Automatically upload images to Supabase Storage (otherwise assumes images are already uploaded)"
    )
    args = parser.parse_args()
    
    # Validate folder/category combination
    if args.folder and not args.category:
        logger.error("--category is required when using --folder")
        logger.error("Example: --folder 'D:\\path\\to\\folder' --category 'bookish'")
        sys.exit(1)
    
    if args.category and not args.folder:
        logger.warning("--category is ignored when not using --folder")
        logger.warning("Use --folder to process a specific folder with a custom category")
    
    # Load environment variables from .env file
    # Try to load from backend/.env first, then from project root
    backend_env = Path(__file__).parent.parent / "smartwish-backend" / "backend" / ".env"
    root_env = Path(__file__).parent.parent / ".env"
    
    if backend_env.exists():
        load_dotenv(backend_env)
        logger.info(f"Loaded environment variables from {backend_env}")
    elif root_env.exists():
        load_dotenv(root_env)
        logger.info(f"Loaded environment variables from {root_env}")
    else:
        logger.warning("No .env file found. Trying environment variables...")
    
    # Check environment variables
    # Support both GEMINI_API_KEY (from .env) and GOOGLE_API_KEY
    api_key = os.environ.get('GEMINI_API_KEY') or os.environ.get('GOOGLE_API_KEY')
    if not api_key:
        logger.error("API key not found!")
        logger.error("Set GEMINI_API_KEY or GOOGLE_API_KEY in:")
        logger.error(f"  - {backend_env}")
        logger.error(f"  - {root_env}")
        logger.error("  - Or as environment variable: $Env:GOOGLE_API_KEY = 'your_key'")
        sys.exit(1)
    
    supabase_url = os.environ.get('SUPABASE_URL')
    supabase_key = os.environ.get('SUPABASE_SERVICE_ROLE_KEY')
    
    # Require Supabase credentials if uploading images or not in dry-run mode
    if args.upload_images and (not supabase_url or not supabase_key):
        logger.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required when using --upload-images!")
        logger.error("Set them in:")
        logger.error(f"  - {backend_env}")
        logger.error(f"  - {root_env}")
        logger.error("  - Or as environment variables:")
        logger.error("    $Env:SUPABASE_URL = 'your_url'")
        logger.error("    $Env:SUPABASE_SERVICE_ROLE_KEY = 'your_key'")
        sys.exit(1)
    
    if not args.dry_run and (not supabase_url or not supabase_key):
        logger.error("SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set!")
        logger.error("Set them in:")
        logger.error(f"  - {backend_env}")
        logger.error(f"  - {root_env}")
        logger.error("  - Or as environment variables:")
        logger.error("    $Env:SUPABASE_URL = 'your_url'")
        logger.error("    $Env:SUPABASE_SERVICE_ROLE_KEY = 'your_key'")
        sys.exit(1)
    
    # Validate stickers directory or target folder
    if args.folder:
        # Validate target folder
        if not args.folder.exists():
            logger.error(f"Target folder not found: {args.folder}")
            sys.exit(1)
        if not args.folder.is_dir():
            logger.error(f"Target path is not a directory: {args.folder}")
            sys.exit(1)
    else:
        # Validate stickers directory
        if not args.stickers_dir.exists():
            logger.error(f"Stickers directory not found: {args.stickers_dir}")
            sys.exit(1)
    
    # Initialize Gemini client
    client = genai.Client(api_key=api_key)
    logger.info("Initialized Gemini client")
    
    # Initialize Supabase client
    supabase: Optional[Client] = None
    if not args.dry_run or args.upload_images:
        if not supabase_url or not supabase_key:
            logger.error("Supabase credentials required for this operation")
            sys.exit(1)
        supabase = create_client(supabase_url, supabase_key)
        logger.info("Connected to Supabase")
    
    # Collect images
    images = collect_sticker_images(
        args.stickers_dir,
        target_folder=args.folder,
        target_category=args.category
    )
    
    if args.limit:
        images = images[:args.limit]
        logger.info(f"Limited to {args.limit} stickers")
    
    # Track existing slugs
    existing_slugs = set()
    if supabase:
        try:
            result = supabase.table('stickers').select('slug').execute()
            existing_slugs = {r['slug'] for r in result.data if r['slug']}
            logger.info(f"Found {len(existing_slugs)} existing slugs in database")
        except Exception as e:
            logger.warning(f"Could not fetch existing slugs: {e}")
    
    # Process stickers
    successful = 0
    failed = 0
    
    logger.info("=" * 60)
    logger.info(f"Processing {len(images)} stickers...")
    logger.info("=" * 60)
    
    for i, (image_path, category) in enumerate(images):
        logger.info(f"\n[{i+1}/{len(images)}] Processing: {image_path.name} (category: {category})")
        
        # Rate limiting
        time.sleep(REQUEST_DELAY)
        
        try:
            sticker = process_sticker(
                client,
                image_path,
                category,
                args.base_url,
                existing_slugs,
                supabase=supabase,
                upload_images=args.upload_images
            )
            
            if sticker:
                logger.info(f"  Title: {sticker.title}")
                logger.info(f"  Tags: {', '.join(sticker.tags[:5])}...")
                logger.info(f"  Has embedding: {sticker.embedding is not None}")
                
                if args.dry_run:
                    logger.info("  [DRY RUN] Would insert to database")
                    successful += 1
                else:
                    if insert_sticker_raw(supabase, sticker):
                        logger.info(f"  ✅ Inserted: {sticker.slug}")
                        successful += 1
                    else:
                        logger.error(f"  ❌ Failed to insert")
                        failed += 1
            else:
                logger.error(f"  ❌ Failed to process")
                failed += 1
                
        except Exception as e:
            logger.error(f"  ❌ Error: {e}")
            failed += 1
    
    # Summary
    logger.info("\n" + "=" * 60)
    logger.info("SUMMARY")
    logger.info("=" * 60)
    logger.info(f"✅ Successful: {successful}")
    logger.info(f"❌ Failed: {failed}")
    logger.info(f"📊 Total: {len(images)}")
    
    if args.dry_run:
        logger.info("\n[DRY RUN] No changes were made to the database")


if __name__ == "__main__":
    main()
