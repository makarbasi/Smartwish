"""
Quick Card Search - Non-interactive version
Usage: python quick_search.py "your search query" [number_of_results]
"""
import sys
import os
import json
import google.generativeai as genai
from pathlib import Path
import numpy as np
from typing import List, Dict

# Configuration
API_KEY = os.environ.get('GOOGLE_API_KEY')
if not API_KEY:
    print("❌ ERROR: GOOGLE_API_KEY environment variable not set!")
    exit(1)

genai.configure(api_key=API_KEY)
EMBEDDING_MODEL = "models/embedding-001"
CARDS_DIRECTORY = r"C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Designs\Series1_original\Series"


def generate_embedding(text: str) -> List[float]:
    """Generate embedding for a search query."""
    response = genai.embed_content(model=EMBEDDING_MODEL, content=text)
    return response['embedding'] if isinstance(response, dict) and 'embedding' in response else []


def cosine_similarity(vec1: List[float], vec2: List[float]) -> float:
    """Calculate cosine similarity between two vectors."""
    vec1, vec2 = np.array(vec1), np.array(vec2)
    return np.dot(vec1, vec2) / (np.linalg.norm(vec1) * np.linalg.norm(vec2))


def load_all_cards() -> List[Dict]:
    """Load all cards with embeddings."""
    all_cards = []
    base_path = Path(CARDS_DIRECTORY)
    
    for folder in [d for d in base_path.iterdir() if d.is_dir()]:
        insidenote_path = folder / "insidenote.json"
        if not insidenote_path.exists():
            continue
        
        try:
            with open(insidenote_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                cards = data['cards'] if isinstance(data, dict) and 'cards' in data else data
            
            for card in cards:
                if 'embedding' in card and card['embedding']:
                    all_cards.append({
                        'filename': card['filename'],
                        'folder': folder.name,
                        'image_path': str(folder / card['filename']),
                        'inside_note': card.get('inside_note', ''),
                        'embedding': card['embedding']
                    })
        except:
            continue
    
    return all_cards


def search_cards(query: str, top_k: int = 5):
    """Search and display results."""
    print(f"\n🔍 Searching for: \"{query}\"")
    
    # Load cards
    cards = load_all_cards()
    print(f"✅ Loaded {len(cards)} cards")
    
    # Generate query embedding
    query_embedding = generate_embedding(query)
    
    # Calculate similarities
    similarities = [(card, cosine_similarity(query_embedding, card['embedding'])) for card in cards]
    similarities.sort(key=lambda x: x[1], reverse=True)
    
    # Display results
    print(f"\n{'='*80}")
    print(f"TOP {top_k} RESULTS")
    print(f"{'='*80}\n")
    
    for i, (card, score) in enumerate(similarities[:top_k], 1):
        print(f"#{i} - Match: {score*100:.1f}%")
        print(f"   Path: {card['image_path']}")
        print(f"   Note: {card['inside_note'][:100]}...")
        print()


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python quick_search.py \"your search query\" [number_of_results]")
        print("\nExample:")
        print('  python quick_search.py "funny birthday card" 5')
        exit(1)
    
    query = sys.argv[1]
    top_k = int(sys.argv[2]) if len(sys.argv) > 2 else 5
    
    search_cards(query, top_k)



