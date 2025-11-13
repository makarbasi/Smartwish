import os
import json
import time
import google.generativeai as genai
from pathlib import Path
from typing import List, Dict, Tuple
import logging

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configure Google Gemini API
# Get API key from environment variable for security
API_KEY = os.environ.get('GOOGLE_API_KEY')
if not API_KEY:
    logger.error("ERROR: GOOGLE_API_KEY environment variable not set!")
    logger.error("Please set it using: set GOOGLE_API_KEY=your_api_key_here")
    exit(1)

genai.configure(api_key=API_KEY)

# Configuration
MAIN_DIRECTORY = r"C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Designs\Series1_original\Series"
BATCH_SIZE = 20  # Number of embeddings per API call
EMBEDDING_MODEL = "models/embedding-001"


def create_embedding_text(metadata: Dict, inside_note: str) -> str:
    """
    Create combined text for embedding from metadata and inside note.
    
    Args:
        metadata: Dictionary containing card metadata
        inside_note: The inside note text
    
    Returns:
        Combined text string for embedding
    """
    # Build the text from available fields
    parts = []
    
    if metadata.get('title'):
        parts.append(f"Title: {metadata['title']}")
    
    if metadata.get('description'):
        parts.append(f"Description: {metadata['description']}")
    
    if metadata.get('occasion'):
        parts.append(f"Occasion: {metadata['occasion']}")
    
    if metadata.get('emotion'):
        parts.append(f"Emotion: {metadata['emotion']}")
    
    if metadata.get('recipient'):
        parts.append(f"Recipient: {metadata['recipient']}")
    
    if metadata.get('visible_text'):
        parts.append(f"Visible Text: {metadata['visible_text']}")
    
    if inside_note:
        parts.append(f"Inside Note: {inside_note}")
    
    if metadata.get('keywords'):
        keywords = metadata['keywords']
        if isinstance(keywords, list):
            keywords = ', '.join(keywords)
        parts.append(f"Keywords: {keywords}")
    
    if metadata.get('style'):
        parts.append(f"Style: {metadata['style']}")
    
    if metadata.get('colors'):
        parts.append(f"Colors: {metadata['colors']}")
    
    return '\n'.join(parts)


def generate_embedding_single(text: str, retry_count: int = 3) -> List[float]:
    """
    Generate embedding for a single text using Google Gemini API.
    
    Args:
        text: Text string to embed
        retry_count: Number of retries on failure
    
    Returns:
        Embedding vector or empty list on failure
    """
    for attempt in range(retry_count):
        try:
            response = genai.embed_content(
                model=EMBEDDING_MODEL,
                content=text
            )
            
            # Handle response
            if isinstance(response, dict) and 'embedding' in response:
                return response['embedding']
            else:
                logger.warning(f"Unexpected response format: {type(response)}")
                logger.error(f"Could not extract embedding from response")
                return []
            
        except Exception as e:
            logger.error(f"Error generating embedding (attempt {attempt + 1}/{retry_count}): {e}")
            if attempt < retry_count - 1:
                # Exponential backoff
                wait_time = (2 ** attempt) * 1
                logger.info(f"Retrying in {wait_time} seconds...")
                time.sleep(wait_time)
            else:
                logger.error(f"Failed to generate embedding after {retry_count} attempts")
                return []
    
    return []


def generate_embeddings_batch(texts: List[str]) -> List[List[float]]:
    """
    Generate embeddings for multiple texts by calling API individually for each.
    
    Args:
        texts: List of text strings to embed
    
    Returns:
        List of embedding vectors
    """
    embeddings = []
    for i, text in enumerate(texts):
        embedding = generate_embedding_single(text)
        if embedding:
            embeddings.append(embedding)
        else:
            logger.error(f"Failed to generate embedding for item {i+1}/{len(texts)}")
            # Return empty list to signal failure
            return []
        
        # Small delay between individual requests to avoid rate limiting
        if i < len(texts) - 1:  # Don't delay after last item
            time.sleep(0.1)
    
    return embeddings


def process_folder(folder_path: Path) -> Tuple[int, int]:
    """
    Process a single folder containing metadata.json and insidenote.json.
    
    Args:
        folder_path: Path to the folder to process
    
    Returns:
        Tuple of (successful_count, failed_count)
    """
    metadata_path = folder_path / "metadata.json"
    insidenote_path = folder_path / "insidenote.json"
    
    # Check if both files exist
    if not metadata_path.exists() or not insidenote_path.exists():
        logger.warning(f"Skipping {folder_path.name}: missing JSON files")
        return (0, 0)
    
    try:
        # Load JSON files
        with open(metadata_path, 'r', encoding='utf-8') as f:
            metadata_data = json.load(f)
            # Handle both formats: direct array or {"cards": [...]}
            if isinstance(metadata_data, dict) and 'cards' in metadata_data:
                metadata_list = metadata_data['cards']
            else:
                metadata_list = metadata_data
        
        with open(insidenote_path, 'r', encoding='utf-8') as f:
            insidenote_data = json.load(f)
            # Handle both formats: direct array or {"cards": [...]}
            if isinstance(insidenote_data, dict) and 'cards' in insidenote_data:
                insidenote_list = insidenote_data['cards']
            else:
                insidenote_list = insidenote_data
        
        # Create filename to data mappings
        metadata_map = {item['filename']: item for item in metadata_list}
        insidenote_map = {item['filename']: item for item in insidenote_list}
        
        # Prepare batch data
        batch_data = []
        
        for filename in insidenote_map.keys():
            if filename not in metadata_map:
                logger.warning(f"No metadata found for {filename} in {folder_path.name}")
                continue
            
            metadata = metadata_map[filename]
            inside_note = insidenote_map[filename].get('inside_note', '')
            
            # Create embedding text
            embedding_text = create_embedding_text(metadata, inside_note)
            
            batch_data.append({
                'filename': filename,
                'text': embedding_text
            })
        
        if not batch_data:
            logger.warning(f"No valid card data found in {folder_path.name}")
            return (0, 0)
        
        # Process in batches
        successful = 0
        failed = 0
        
        for i in range(0, len(batch_data), BATCH_SIZE):
            batch = batch_data[i:i + BATCH_SIZE]
            texts = [item['text'] for item in batch]
            
            logger.info(f"Processing batch {i//BATCH_SIZE + 1} ({len(batch)} items) in {folder_path.name}")
            
            embeddings = generate_embeddings_batch(texts)
            
            if len(embeddings) != len(batch):
                logger.error(f"Embedding count mismatch: expected {len(batch)}, got {len(embeddings)}")
                failed += len(batch)
                continue
            
            # Update insidenote entries with embeddings
            for j, item in enumerate(batch):
                filename = item['filename']
                embedding = embeddings[j]
                
                # Find and update the entry in insidenote_list
                for entry in insidenote_list:
                    if entry['filename'] == filename:
                        entry['embedding'] = embedding
                        successful += 1
                        break
            
            # Small delay to avoid rate limiting
            time.sleep(0.5)
        
        # Save updated insidenote.json (preserve original format)
        with open(insidenote_path, 'w', encoding='utf-8') as f:
            if isinstance(insidenote_data, dict) and 'cards' in insidenote_data:
                # Preserve the {"cards": [...]} format
                insidenote_data['cards'] = insidenote_list
                json.dump(insidenote_data, f, indent=2, ensure_ascii=False)
            else:
                # Direct array format
                json.dump(insidenote_list, f, indent=2, ensure_ascii=False)
        
        logger.info(f"✅ Completed {folder_path.name}: {successful} embeddings added")
        return (successful, failed)
        
    except Exception as e:
        logger.error(f"Error processing {folder_path.name}: {e}")
        return (0, len(insidenote_list) if 'insidenote_list' in locals() else 0)


def main():
    """Main function to process all folders."""
    main_path = Path(MAIN_DIRECTORY)
    
    if not main_path.exists():
        logger.error(f"Main directory does not exist: {MAIN_DIRECTORY}")
        return
    
    # Get all subdirectories
    subdirs = [d for d in main_path.iterdir() if d.is_dir()]
    
    logger.info(f"Found {len(subdirs)} folders to process")
    logger.info("=" * 70)
    
    total_folders = 0
    total_successful = 0
    total_failed = 0
    
    for subdir in subdirs:
        logger.info(f"\nProcessing folder: {subdir.name}")
        successful, failed = process_folder(subdir)
        
        if successful > 0 or failed > 0:
            total_folders += 1
            total_successful += successful
            total_failed += failed
    
    # Final summary
    logger.info("\n" + "=" * 70)
    logger.info("FINAL SUMMARY")
    logger.info("=" * 70)
    logger.info(f"✅ Processed {total_folders} folders")
    logger.info(f"✅ Successfully added embeddings to {total_successful} cards")
    if total_failed > 0:
        logger.info(f"❌ Failed to process {total_failed} cards")
    logger.info("=" * 70)


if __name__ == "__main__":
    main()

