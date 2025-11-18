# 🎴 Greeting Card AI Search System

Complete AI-powered semantic search system for your 221 greeting cards.

---

## ✅ What's Been Done

### 1. **Embeddings Generated** ✅
- 221 cards processed across 8 folders
- 768-dimensional semantic embeddings
- All stored in `insidenote.json` files

### 2. **Search System Created** ✅
- Semantic search by meaning
- Multiple search interfaces
- Real-time similarity scoring
- Complete file path results

---

## 🚀 How to Use

### Option 1: Interactive Search (Best for Exploring)

```powershell
# 1. Edit scripts/run_search.ps1 - add your API key on line 5
# 2. Run:
.\scripts\run_search.ps1

# 3. Enter queries:
🔍 Enter your search query: funny birthday card for best friend
   How many results? (default 5): 5
```

### Option 2: Quick Command-Line Search

```powershell
# Set API key
$env:GOOGLE_API_KEY = "your_api_key_here"

# Search
python scripts/quick_search.py "elegant Christmas card with snowman" 5
```

### Option 3: Python Script

```python
from search_cards import search_cards, load_all_cards

# Load cards once
cards = load_all_cards()

# Search multiple queries
results = search_cards("funny birthday card", cards, top_k=5)

# Process results
for card, score in results:
    print(f"{card['image_path']} - {score:.2%} match")
```

---

## 📂 File Structure

```
scripts/
├── generate_embeddings.py      # Generate embeddings (DONE ✅)
├── search_cards.py             # Interactive search
├── quick_search.py             # Command-line search
├── verify_embeddings.py        # Verify embeddings exist
├── test_api_key.py             # Test API key
├── run_search.ps1              # PowerShell search wrapper
├── test_search_demo.ps1        # Demo searches
├── SEARCH_GUIDE.md             # Detailed search guide
├── COMPLETION_SUMMARY.md       # Embedding generation summary
└── README.md                   # This file
```

---

## 💡 Example Searches

### By Occasion
```
"funny birthday card for best friend"
"elegant Christmas card with snowman"
"formal graduation congratulations"
"heartfelt thank you message"
```

### By Visual Style
```
"card with cute animals and flowers"
"minimalist black and white design"
"vintage floral illustration"
"modern geometric pattern"
```

### By Recipient
```
"birthday card for elderly grandmother"
"congratulations for college graduate"
"Christmas card for business client"
```

### By Emotion/Tone
```
"warm and heartfelt message"
"cheerful and uplifting wishes"
"professional thank you note"
"humorous greeting"
```

---

## 📊 How It Works

### 1. **Query Processing**
```
Your Query → API → 768D Embedding Vector
```

### 2. **Similarity Calculation**
```
Query Embedding × Card Embeddings → Cosine Similarity Scores
```

### 3. **Ranking & Results**
```
Sort by Similarity → Return Top K Cards
```

### Example Flow:
```
Input: "funny birthday card"
       ↓
Generate Embedding: [-0.023, 0.145, -0.089, ...]
       ↓
Compare with 221 cards
       ↓
Top Match: BirthdayFunny/15.png (85.2% similar)
```

---

## 📈 Search Results Format

### Interactive Search Output:
```
#1 - Similarity: 0.8523 (85.2%)
────────────────────────────────────────────────────────────────────
📁 Folder:       BirthdayFunny
📄 Filename:     15.png
🎨 Title:        Hilarious Age Joke Birthday Card
🎉 Occasion:     Birthday
💝 Emotion:      Humor, laughter, fun
👤 Recipient:    Friend, someone with good sense of humor
📝 Visible Text: Another Year Older!
🏷️  Keywords:     funny, humor, birthday, joke, age

💌 Inside Note:
   Don't worry, you're not getting older... you're getting more 
   distinguished! (And by distinguished, I mean distinguished 
   from the young people.)

📍 Full Path:
   C:\Users\makar\OneDrive\OLD\E-Learning\projects\
   SmartWish\Designs\Series1_original\Series\
   BirthdayFunny\15.png
```

### Quick Search Output:
```
#1 - Match: 85.2%
   Path: C:\...\BirthdayFunny\15.png
   Note: Don't worry, you're not getting older...
```

---

## 🎯 What You Can Do

### 1. **Find Cards Quickly**
Instead of browsing 221 files, search by describing what you want.

### 2. **Discover Similar Cards**
Found a card you like? Search for "cards like this one"

### 3. **Build Recommendations**
Integrate into your app to recommend cards to users

### 4. **Create Collections**
Save search results as curated collections

### 5. **API Integration**
Add search endpoint to your web application

---

## 🔧 Customization

### Change Search Sensitivity

```python
# In search_cards.py, filter by minimum similarity
MIN_SIMILARITY = 0.70
results = [(c, s) for c, s in results if s >= MIN_SIMILARITY]
```

### Search Specific Categories

```python
# Only search birthday cards
folders = ['BirthdayCardsBasic', 'BirthdayFloral', 'BirthdayFunny']
```

### Export Results

```python
# Save to JSON
import json
with open('results.json', 'w') as f:
    json.dump([{
        'path': card['image_path'],
        'score': score,
        'title': card['title']
    } for card, score in results], f)
```

---

## 📊 Performance

- **Initial Load**: ~2-3 seconds (loads 221 cards)
- **Search Query**: ~0.5-1 second (API call + similarity calc)
- **Subsequent Searches**: ~0.5 seconds (cards already loaded)

### Optimization Tips:
1. Load cards once, search multiple times
2. Cache embeddings in memory
3. Use batch queries for multiple searches
4. Consider vector database for production (Pinecone, Weaviate)

---

## 🔒 Security

- ✅ API keys in environment variables
- ✅ No hardcoded credentials
- ✅ Scripts have placeholder reminders

**Remember to:**
- Keep API keys secure
- Don't commit keys to git
- Revoke exposed keys immediately
- Use API key restrictions in Google Cloud

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| `SEARCH_GUIDE.md` | Comprehensive search guide |
| `COMPLETION_SUMMARY.md` | Embedding generation summary |
| `API_KEY_SETUP_GUIDE.md` | API key setup instructions |
| `QUICK_START.md` | Quick start guide |
| `README.md` | This file |

---

## 🎓 Technical Details

### Embedding Model
- **Model**: Google Gemini `models/embedding-001`
- **Dimension**: 768
- **Type**: Text embeddings optimized for semantic similarity

### Similarity Metric
- **Method**: Cosine similarity
- **Range**: 0.0 to 1.0 (0% to 100%)
- **Formula**: `cos(θ) = (A·B) / (||A|| × ||B||)`

### Text Components
Each embedding combines:
1. Title
2. Description  
3. Occasion
4. Emotion
5. Recipient
6. Visible Text
7. Inside Note
8. Keywords
9. Style
10. Colors

---

## ❓ Troubleshooting

### "No cards found"
- Run `python scripts/verify_embeddings.py`
- Make sure embeddings were generated
- Check `CARDS_DIRECTORY` path

### "API key error"
- Get new key: https://aistudio.google.com/app/apikey
- Set: `$env:GOOGLE_API_KEY = "key"`
- Or edit PowerShell scripts

### Low similarity scores
- Try more specific queries
- Add descriptive details
- Rephrase your search

### Slow performance
- Normal on first load
- Subsequent searches are faster
- Consider caching for production

---

## 🚀 Next Steps

### Immediate
- ✅ Test with various queries
- ✅ Explore different search terms
- ✅ Find cards for upcoming occasions

### Short-term
- 📝 Create saved searches
- 📊 Export favorite results
- 🎨 Build visual browser

### Long-term
- 🌐 Web interface
- 📱 Mobile app
- 🤖 Recommendation engine
- 💾 Vector database integration

---

## 🎉 Summary

You now have:
- ✅ 221 cards with AI embeddings
- ✅ Semantic search capability
- ✅ Multiple search interfaces
- ✅ Complete file path results
- ✅ Comprehensive documentation

**Your greeting card collection is now AI-powered!** 🚀

Search by meaning, discover by similarity, and find the perfect card every time.

---

**Questions?** Check `SEARCH_GUIDE.md` for detailed instructions!





