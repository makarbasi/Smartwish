"""
Quick script to verify embeddings were added successfully.
"""
import json
from pathlib import Path

# Check a sample file
sample_file = Path(r"C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Designs\Series1_original\Series\BirthdayFloral\insidenote.json")

with open(sample_file, 'r', encoding='utf-8') as f:
    data = json.load(f)

print("=" * 70)
print("EMBEDDING VERIFICATION")
print("=" * 70)
print(f"\nFile: {sample_file.name}")
print(f"Total cards in file: {len(data)}")

# Check first card
card = data[0]
print(f"\n--- Sample Card ---")
print(f"Filename: {card['filename']}")
print(f"Inside Note: {card['inside_note'][:80]}...")
print(f"\nEmbedding Stats:")
print(f"  - Has embedding: {'embedding' in card}")
print(f"  - Embedding length: {len(card['embedding']) if 'embedding' in card else 0}")
print(f"  - First 5 values: {card['embedding'][:5] if 'embedding' in card else 'N/A'}")
print(f"  - Data type: {type(card['embedding'][0]) if 'embedding' in card else 'N/A'}")

# Count cards with embeddings
cards_with_embeddings = sum(1 for c in data if 'embedding' in c and len(c.get('embedding', [])) > 0)
print(f"\n--- Summary ---")
print(f"Cards with embeddings: {cards_with_embeddings}/{len(data)}")
print(f"Success rate: {cards_with_embeddings/len(data)*100:.1f}%")

if cards_with_embeddings == len(data):
    print("\n✅ ALL EMBEDDINGS PRESENT!")
else:
    print(f"\n⚠️  Missing embeddings: {len(data) - cards_with_embeddings}")

print("=" * 70)





