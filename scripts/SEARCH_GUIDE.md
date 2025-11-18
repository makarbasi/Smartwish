# 🔍 Semantic Card Search Guide

## Overview

Search your 221 greeting cards by **meaning**, not just keywords! The search uses AI embeddings to understand what you're looking for and find the most relevant cards.

---

## 🚀 Quick Start

### Method 1: Interactive Search (Recommended)

1. **Edit the search script** - Add your API key:
   ```powershell
   # Edit scripts/run_search.ps1, line 5
   $API_KEY = "your_api_key_here"
   ```

2. **Run the search:**
   ```powershell
   .\scripts\run_search.ps1
   ```

3. **Enter your search queries:**
   ```
   🔍 Enter your search query: funny birthday card for best friend
      How many results? (default 5): 5
   ```

### Method 2: Quick Command-Line Search

```powershell
$env:GOOGLE_API_KEY = "your_api_key_here"
python scripts/quick_search.py "your search text" 5
```

### Method 3: Use Pre-existing Embeddings (No API calls)

If you don't want to make API calls for every search, create a cached version (see below).

---

## 💡 Example Searches

### By Occasion & Style
```
"elegant Christmas card with snowman"
"funny birthday card for best friend"
"formal graduation congratulations"
"cute thank you card with flowers"
```

### By Emotion & Tone
```
"heartfelt sympathy message"
"cheerful and bright birthday wishes"
"romantic anniversary card"
"professional thank you note"
```

### By Recipient
```
"birthday card for elderly grandmother"
"congratulations for college graduate"
"Christmas card for business client"
"birthday card for young child"
```

### By Visual Elements
```
"card with cute animals"
"floral design with pastel colors"
"winter scene with snow"
"minimalist black and white design"
```

---

## 📊 Understanding Results

### Similarity Score
- **90-100%**: Extremely similar - almost perfect match
- **80-89%**: Very similar - strong match
- **70-79%**: Similar - good match
- **60-69%**: Somewhat similar - consider it
- **Below 60%**: Low similarity - might not be what you want

### Result Information
Each result shows:
- **Similarity Score**: How well it matches your query
- **Folder**: Category (e.g., BirthdayFunny, ChristmasCardBundle)
- **Filename**: The image file name
- **Title**: Card title from metadata
- **Occasion**: Birthday, Christmas, Graduation, etc.
- **Emotion**: Joy, elegance, humor, etc.
- **Recipient**: Who it's appropriate for
- **Visible Text**: Text shown on the card front
- **Inside Note**: The greeting message inside
- **Keywords**: Tags associated with the card
- **Full Path**: Complete file path to the image

---

## 📁 Search Output Examples

### Example 1: "funny birthday card"
```
#1 - Similarity: 0.8523 (85.2%)
────────────────────────────────────────────────────────────────────────────────
📁 Folder:      BirthdayFunny
📄 Filename:    15.png
🎨 Title:       Hilarious Age Joke
🎉 Occasion:    Birthday
💝 Emotion:     Humor, laughter
👤 Recipient:   Friend, someone with sense of humor
📝 Visible Text: Another Year Older!

💌 Inside Note:
   Don't worry, you're not getting older... you're getting more distinguished! 
   (And by distinguished, I mean distinguished from the young people.)

📍 Full Path:
   C:\Users\makar\OneDrive\...\BirthdayFunny\15.png
```

### Example 2: "Christmas card with snowman"
```
#1 - Match: 78.0%
   Path: C:\...\ChristmasCardBundle\ChristmasCardBundle4_page_4_right.png
   Note: Wishing you a gentle and peaceful Christmas filled with simple joys...
```

---

## 🛠️ Advanced Usage

### Create a Cached Search (Faster, No API Calls)

To avoid API calls for every search, you can create a cached version:

```python
# scripts/cached_search.py
import json
import numpy as np
from pathlib import Path

# Load all cards once
def load_cards_with_metadata():
    # Load all cards and their embeddings
    # Store in memory or cache file
    pass

# Search using cached embeddings
def search_cached(query_embedding, cards):
    # Calculate similarities
    # No API call needed!
    pass
```

### Batch Search Multiple Queries

```python
queries = [
    "funny birthday card",
    "elegant Christmas card",
    "graduation congratulations"
]

for query in queries:
    results = search_cards(query, top_k=3)
    save_results(query, results)
```

### Export Results to CSV

```python
import csv

with open('search_results.csv', 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow(['Rank', 'Score', 'Path', 'Title', 'Occasion'])
    
    for i, (card, score) in enumerate(results, 1):
        writer.writerow([
            i, 
            f"{score:.4f}",
            card['image_path'],
            card['title'],
            card['occasion']
        ])
```

---

## 🔧 Customization

### Change Number of Results

In `search_cards.py`, modify:
```python
top_k = 10  # Default number of results
```

### Adjust Similarity Threshold

Filter out low-similarity results:
```python
results = [r for r in results if r[1] >= 0.70]  # Only 70%+ matches
```

### Search Specific Folders Only

```python
# In load_all_cards(), filter folders:
folders = [d for d in base_path.iterdir() 
           if d.is_dir() and d.name in ['BirthdayFunny', 'Christmas']]
```

### Combine with Filters

```python
# Search + filter by occasion
results = search_cards(query, cards, top_k=20)
birthday_only = [(c, s) for c, s in results if c['occasion'] == 'Birthday']
```

---

## 📝 Scripts Reference

| Script | Purpose | Usage |
|--------|---------|-------|
| `search_cards.py` | Interactive search | `python scripts/search_cards.py` |
| `quick_search.py` | Command-line search | `python scripts/quick_search.py "query" 5` |
| `run_search.ps1` | PowerShell wrapper | `.\scripts\run_search.ps1` |
| `test_search_demo.ps1` | Demo searches | `.\scripts\test_search_demo.ps1` |

---

## ❓ Troubleshooting

### "API key expired" Error
- Get a new key from: https://aistudio.google.com/app/apikey
- Set it: `$env:GOOGLE_API_KEY = "your_new_key"`

### "No cards found" Error
- Make sure embeddings were generated first
- Check the `CARDS_DIRECTORY` path in the script

### Slow Searches
- First search is slower (loads all cards)
- Subsequent searches reuse loaded data
- Consider creating a cached version

### Low Similarity Scores
- Try more specific queries
- Add descriptive terms
- Try different phrasings

---

## 🎯 Tips for Better Searches

1. **Be Specific**: "funny birthday card for 40-year-old man" vs "birthday card"

2. **Describe the Feel**: "warm and heartfelt message" vs "nice card"

3. **Mention Visual Elements**: "card with cute kitten and flowers" 

4. **Combine Attributes**: "elegant formal thank you card for business client"

5. **Use Natural Language**: Write like you're describing to a friend

6. **Try Variations**: If results aren't good, rephrase your query

---

## 🚀 Next Steps

- **Integration**: Add search to your web app or API
- **UI**: Create a visual interface for browsing results
- **Filters**: Combine semantic search with faceted filters
- **Recommendations**: "Cards similar to this one"
- **Collections**: Save and organize favorite searches

---

**Happy Searching!** 🎴✨

Your 221 greeting cards are now searchable by meaning, making it easy to find the perfect card for any occasion!





