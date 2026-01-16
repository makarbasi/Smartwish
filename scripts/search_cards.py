"""
Semantic Card Search using Embeddings
Search greeting cards by meaning, not just keywords!
"""
import os
import json
import google.generativeai as genai
from pathlib import Path
import numpy as np
from typing import List, Dict, Tuple

# Configuration
API_KEY = os.environ.get('GOOGLE_API_KEY')
if not API_KEY:
    print("❌ ERROR: GOOGLE_API_KEY environment variable not set!")
    print("Please set it using: $env:GOOGLE_API_KEY=\"your_api_key_here\"")
    exit(1)

genai.configure(api_key=API_KEY)
EMBEDDING_MODEL = "models/embedding-001"
CARDS_DIRECTORY = r"C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Designs\Series1_original\Series"


def generate_embedding(text: str) -> List[float]:
    """Generate embedding for a search query."""
    try:
        response = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=text
        )
        if isinstance(response, dict) and 'embedding' in response:
            return response['embedding']
        else:
            print(f"⚠️  Unexpected response format")
            return []
    except Exception as e:
        print(f"❌ Error generating embedding: {e}")
        return []


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    vec1 = np.array(vec1)
    vec2 = np.array(vec2)
    
    dot_product = np.dot(vec1, vec2)
    norm1 = np.linalg.norm(vec1)
    norm2 = np.linalg.norm(vec2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return dot_product / (norm1 * norm2)


def load_all_cards() -> List[Dict]:
    """
    Load all cards with embeddings from all folders.
    Returns list of dicts with card info and file paths.
    """
    all_cards = []
    base_path = Path(CARDS_DIRECTORY)
    
    if not base_path.exists():
        print(f"❌ Directory not found: {CARDS_DIRECTORY}")
        return []
    
    # Get all subdirectories
    folders = [d for d in base_path.iterdir() if d.is_dir()]
    
    print(f"Loading cards from {len(folders)} folders...")
    
    for folder in folders:
        insidenote_path = folder / "insidenote.json"
        metadata_path = folder / "metadata.json"
        
        if not insidenote_path.exists():
            continue
        
        try:
            # Load insidenote with embeddings
            with open(insidenote_path, 'r', encoding='utf-8') as f:
                insidenote_data = json.load(f)
                # Handle both formats
                if isinstance(insidenote_data, dict) and 'cards' in insidenote_data:
                    insidenote_list = insidenote_data['cards']
                else:
                    insidenote_list = insidenote_data
            
            # Load metadata for additional info
            metadata_list = []
            if metadata_path.exists():
                with open(metadata_path, 'r', encoding='utf-8') as f:
                    metadata_data = json.load(f)
                    if isinstance(metadata_data, dict) and 'cards' in metadata_data:
                        metadata_list = metadata_data['cards']
                    else:
                        metadata_list = metadata_data
            
            # Create metadata lookup
            metadata_map = {item['filename']: item for item in metadata_list}
            
            # Process each card
            for card in insidenote_list:
                if 'embedding' not in card or not card['embedding']:
                    continue
                
                filename = card['filename']
                metadata = metadata_map.get(filename, {})
                
                # Full path to the image
                image_path = folder / filename
                
                card_info = {
                    'filename': filename,
                    'folder': folder.name,
                    'image_path': str(image_path),
                    'inside_note': card.get('inside_note', ''),
                    'embedding': card['embedding'],
                    # Metadata
                    'title': metadata.get('title', 'N/A'),
                    'description': metadata.get('description', ''),
                    'occasion': metadata.get('occasion', 'N/A'),
                    'emotion': metadata.get('emotion', 'N/A'),
                    'visible_text': metadata.get('visible_text', 'N/A'),
                    'recipient': metadata.get('recipient', 'N/A'),
                    'keywords': metadata.get('keywords', []),
                }
                
                all_cards.append(card_info)
        
        except Exception as e:
            print(f"⚠️  Error loading {folder.name}: {e}")
            continue
    
    print(f"✅ Loaded {len(all_cards)} cards with embeddings\n")
    return all_cards


def search_cards(query: str, cards: List[Dict], top_k: int = 5) -> List[Tuple[Dict, float]]:
    """
    Search for cards matching the query.
    
    Args:
        query: Search text
        cards: List of all cards with embeddings
        top_k: Number of results to return
    
    Returns:
        List of (card, similarity_score) tuples
    """
    print(f"🔍 Searching for: \"{query}\"")
    print("Generating query embedding...")
    
    # Generate embedding for query
    query_embedding = generate_embedding(query)
    
    if not query_embedding:
        print("❌ Failed to generate query embedding")
        return []
    
    print("Calculating similarities...")
    
    # Calculate similarity with all cards
    similarities = []
    for card in cards:
        similarity = cosine_similarity(query_embedding, card['embedding'])
        similarities.append((card, similarity))
    
    # Sort by similarity (highest first)
    similarities.sort(key=lambda x: x[1], reverse=True)
    
    # Return top K results
    return similarities[:top_k]


def display_results(results: List[Tuple[Dict, float]]):
    """Display search results in a nice format."""
    if not results:
        print("No results found.")
        return
    
    print("\n" + "="*80)
    print(f"TOP {len(results)} MATCHING CARDS")
    print("="*80)
    
    for i, (card, score) in enumerate(results, 1):
        print(f"\n#{i} - Similarity: {score:.4f} ({score*100:.1f}%)")
        print("-" * 80)
        print(f"📁 Folder:      {card['folder']}")
        print(f"📄 Filename:    {card['filename']}")
        print(f"🎨 Title:       {card['title']}")
        print(f"🎉 Occasion:    {card['occasion']}")
        print(f"💝 Emotion:     {card['emotion']}")
        print(f"👤 Recipient:   {card['recipient']}")
        print(f"📝 Visible Text: {card['visible_text']}")
        if card['keywords']:
            keywords_str = ', '.join(card['keywords']) if isinstance(card['keywords'], list) else card['keywords']
            print(f"🏷️  Keywords:    {keywords_str}")
        print(f"\n💌 Inside Note:")
        print(f"   {card['inside_note'][:150]}{'...' if len(card['inside_note']) > 150 else ''}")
        print(f"\n📍 Full Path:")
        print(f"   {card['image_path']}")


def main():
    """Main search interface."""
    print("\n" + "="*80)
    print("🎴  SEMANTIC CARD SEARCH  🎴")
    print("="*80)
    print("\nSearch greeting cards by meaning, not just keywords!")
    print("Try queries like:")
    print("  - 'funny birthday card for best friend'")
    print("  - 'elegant Christmas card with snowman'")
    print("  - 'heartfelt graduation message'")
    print("  - 'cute card with animals for children'")
    print("\n" + "-"*80 + "\n")
    
    # Load all cards
    cards = load_all_cards()
    
    if not cards:
        print("❌ No cards found. Make sure embeddings have been generated.")
        return
    
    # Interactive search loop
    while True:
        try:
            query = input("\n🔍 Enter your search query (or 'quit' to exit): ").strip()
            
            if query.lower() in ['quit', 'exit', 'q']:
                print("\n👋 Thank you for using Semantic Card Search!")
                break
            
            if not query:
                print("⚠️  Please enter a search query.")
                continue
            
            # Ask for number of results
            try:
                top_k_input = input("   How many results? (default 5): ").strip()
                top_k = int(top_k_input) if top_k_input else 5
                top_k = max(1, min(top_k, 20))  # Between 1 and 20
            except ValueError:
                top_k = 5
            
            # Perform search
            results = search_cards(query, cards, top_k)
            
            # Display results
            display_results(results)
            
            print("\n" + "="*80)
            
        except KeyboardInterrupt:
            print("\n\n👋 Search interrupted. Goodbye!")
            break
        except Exception as e:
            print(f"\n❌ Error: {e}")
            continue


if __name__ == "__main__":
    main()





