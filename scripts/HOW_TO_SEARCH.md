# 🔍 How to Search Your Cards (Step by Step)

## Super Simple Method

### Step 1: Set Your API Key
```powershell
$env:GOOGLE_API_KEY = "your_api_key_here"
```

### Step 2: Start the Search
```powershell
python scripts/search_cards.py
```

### Step 3: Enter Your Search
The script will ask you for input:

```
🔍 Enter your search query (or 'quit' to exit): 
```

Just type what you're looking for and press Enter!

---

## Example Session

Here's what a complete search session looks like:

```
================================================================================
🎴  SEMANTIC CARD SEARCH  🎴
================================================================================

Search greeting cards by meaning, not just keywords!
Try queries like:
  - 'funny birthday card for best friend'
  - 'elegant Christmas card with snowman'
  - 'heartfelt graduation message'
  - 'cute card with animals for children'

--------------------------------------------------------------------------------

Loading cards from 8 folders...
✅ Loaded 221 cards with embeddings


🔍 Enter your search query (or 'quit' to exit): funny birthday card for friend
   How many results? (default 5): 3

🔍 Searching for: "funny birthday card for friend"
Generating query embedding...
Calculating similarities...

================================================================================
TOP 3 MATCHING CARDS
================================================================================

#1 - Similarity: 0.8456 (84.6%)
--------------------------------------------------------------------------------
📁 Folder:      BirthdayFunny
📄 Filename:    15.png
🎨 Title:       Hilarious Birthday Joke
🎉 Occasion:    Birthday
💝 Emotion:     Humor, laughter
👤 Recipient:   Friend, someone with good sense of humor
📝 Visible Text: Another Year Older!
🏷️  Keywords:    funny, humor, birthday, joke

💌 Inside Note:
   Don't worry, you're not getting older... you're getting more distinguished!

📍 Full Path:
   C:\Users\makar\OneDrive\...\BirthdayFunny\15.png

#2 - Similarity: 0.8234 (82.3%)
--------------------------------------------------------------------------------
📁 Folder:      BirthdayFunny
📄 Filename:    23.png
...

================================================================================

🔍 Enter your search query (or 'quit' to exit): elegant christmas card
   How many results? (default 5): 5

... (search results) ...

🔍 Enter your search query (or 'quit' to exit): quit

👋 Thank you for using Semantic Card Search!
```

---

## What You Can Search For

### ✅ By Occasion
- "birthday card for mom"
- "Christmas greetings"
- "graduation congratulations"
- "thank you card"

### ✅ By Style
- "elegant and sophisticated"
- "cute and playful"
- "minimalist design"
- "vintage floral"

### ✅ By Emotion
- "funny and humorous"
- "warm and heartfelt"
- "cheerful and uplifting"
- "formal and professional"

### ✅ By Recipient
- "card for elderly grandmother"
- "birthday for best friend"
- "professional thank you for client"
- "card for young child"

### ✅ By Visual Elements
- "card with animals"
- "snowman design"
- "floral pattern"
- "balloons and confetti"

---

## Quick Commands

### Option 1: Using PowerShell Script
```powershell
# Edit scripts/run_search.ps1 with your API key, then:
.\scripts\run_search.ps1
```

### Option 2: Direct Python Command
```powershell
# Set API key once
$env:GOOGLE_API_KEY = "your_key"

# Run search
python scripts/search_cards.py
```

### Option 3: Quick One-Time Search
```powershell
$env:GOOGLE_API_KEY = "your_key"
python scripts/quick_search.py "your search text" 5
```

---

## Understanding Results

### Similarity Score
- **85%+** = Excellent match! 🎯
- **75-84%** = Very good match ✅
- **65-74%** = Good match 👍
- **Below 65%** = Possible match 🤔

### Result Information
Each result shows:
1. **Similarity Score** - How well it matches (0-100%)
2. **Folder** - Category (Birthday, Christmas, etc.)
3. **Filename** - The image file name
4. **Title** - Card title
5. **Occasion** - What event it's for
6. **Emotion** - The feeling it conveys
7. **Recipient** - Who it's appropriate for
8. **Visible Text** - Text on the card front
9. **Keywords** - Associated tags
10. **Inside Note** - The greeting message
11. **Full Path** - Complete path to the image file

---

## Tips for Better Results

### 🎯 Be Specific
❌ "card"
✅ "funny birthday card for best friend"

### 🎯 Describe the Feel
❌ "nice card"
✅ "warm heartfelt thank you message"

### 🎯 Mention Details
❌ "Christmas card"
✅ "elegant Christmas card with snowman and winter scene"

### 🎯 Use Natural Language
Write like you're describing it to a friend:
- "I need a card that's funny but not too silly"
- "Something elegant for a business client"
- "Cute card with animals for my niece"

---

## Keyboard Shortcuts

- **Enter** - Submit search
- **Ctrl+C** - Exit immediately
- Type **quit**, **exit**, or **q** - Exit gracefully

---

## Troubleshooting

### "API key not set"
```powershell
# Set it first:
$env:GOOGLE_API_KEY = "your_key_here"
```

### "No cards found"
Make sure embeddings were generated. Run:
```powershell
python scripts/verify_embeddings.py
```

### Search is slow
First search loads all 221 cards (~2-3 seconds). Subsequent searches are much faster!

### Low similarity scores
- Try rephrasing your query
- Be more specific
- Add more descriptive terms

---

## Example Searches to Try

```
1. "funny birthday card for 30 year old friend"
2. "elegant Christmas card with snowman"
3. "heartfelt graduation congratulations"
4. "cute thank you card with flowers"
5. "professional congratulations for coworker"
6. "warm birthday wishes for grandmother"
7. "humorous card about getting older"
8. "festive holiday greetings"
9. "sophisticated thank you for business client"
10. "cheerful card with balloons"
```

---

## That's It!

Just run the script, type what you want, and get results! 🎉

**Questions?** See `SEARCH_GUIDE.md` for more details.

