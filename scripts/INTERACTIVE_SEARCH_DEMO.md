# 🎴 Interactive Search - Complete Demo

## ✅ Your Script is Ready!

The `search_cards.py` script **already does exactly what you want**:
1. ✅ Asks for your input
2. ✅ Searches using embeddings  
3. ✅ Returns found cards with full paths

---

## 🚀 How to Run It

### Method 1: PowerShell (Recommended)
```powershell
# Step 1: Set your API key
$env:GOOGLE_API_KEY = "AIzaSyD7NTFVL1scbd81tbvDrqEI84nQ2cMsmEI"

# Step 2: Run the search
python scripts/search_cards.py
```

### Method 2: Use the Launcher
```powershell
# Edit scripts/start_search.ps1 with your API key, then:
.\scripts\start_search.ps1
```

### Method 3: Batch File
```cmd
scripts\search.bat
```

---

## 📺 What Happens (Visual Walkthrough)

### When You Start the Script:

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
```

### The Script Asks for Your Input:

```
🔍 Enter your search query (or 'quit' to exit): ▊
```

**👆 You type here!** For example:
```
🔍 Enter your search query (or 'quit' to exit): funny birthday card
```

### Then It Asks How Many Results You Want:

```
   How many results? (default 5): ▊
```

**👆 Press Enter for 5, or type a number** like 3 or 10:
```
   How many results? (default 5): 3
```

### The Script Searches:

```
🔍 Searching for: "funny birthday card"
Generating query embedding...
Calculating similarities...
```

### You Get Results:

```
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
   Don't worry, you're not getting older... you're getting more 
   distinguished! (And by distinguished, I mean distinguished 
   from the young people.)

📍 Full Path:
   C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\
   Designs\Series1_original\Series\BirthdayFunny\15.png

#2 - Similarity: 0.8234 (82.3%)
--------------------------------------------------------------------------------
📁 Folder:      BirthdayFunny
📄 Filename:    23.png
🎨 Title:       Age is Just a Number
...
(continues with all results)
```

### Then It Asks Again (Continuous Loop):

```
================================================================================

🔍 Enter your search query (or 'quit' to exit): ▊
```

**👆 You can search again!** Try different queries:
- "christmas card with snowman"
- "elegant thank you"
- "cute card for kids"

### To Exit:

```
🔍 Enter your search query (or 'quit' to exit): quit

👋 Thank you for using Semantic Card Search!
```

---

## 🎯 Complete Example Session

```powershell
PS> $env:GOOGLE_API_KEY = "your_key_here"
PS> python scripts/search_cards.py

================================================================================
🎴  SEMANTIC CARD SEARCH  🎴
================================================================================
...
✅ Loaded 221 cards with embeddings


🔍 Enter your search query (or 'quit' to exit): funny birthday
   How many results? (default 5): 3

🔍 Searching for: "funny birthday"
Generating query embedding...
Calculating similarities...

... (3 results shown) ...

🔍 Enter your search query (or 'quit' to exit): christmas snowman
   How many results? (default 5): 5

🔍 Searching for: "christmas snowman"
Generating query embedding...
Calculating similarities...

... (5 results shown) ...

🔍 Enter your search query (or 'quit' to exit): elegant thank you
   How many results? (default 5): 

🔍 Searching for: "elegant thank you"
Generating query embedding...
Calculating similarities...

... (5 results shown) ...

🔍 Enter your search query (or 'quit' to exit): quit

👋 Thank you for using Semantic Card Search!
```

---

## 💡 Search Examples to Try

Copy and paste these when prompted:

### Birthday Cards
```
funny birthday card for best friend
elegant birthday wishes for mom
cute birthday card with animals
milestone birthday celebration
```

### Christmas Cards
```
elegant Christmas card with snowman
festive holiday greetings
warm Christmas wishes
vintage Christmas design
```

### Other Occasions
```
heartfelt graduation congratulations
professional thank you for client
cute thank you card with flowers
formal congratulations message
```

### By Visual Style
```
card with cute kitten
floral design pastel colors
minimalist elegant card
colorful festive design
```

---

## 📊 What Each Result Gives You

### Full Information:
- ✅ **Similarity Score** (how well it matches)
- ✅ **Folder Name** (category)
- ✅ **File Name** (image file)
- ✅ **Title** (card title)
- ✅ **Occasion** (birthday, Christmas, etc.)
- ✅ **Emotion** (funny, elegant, warm, etc.)
- ✅ **Recipient** (friend, mom, client, etc.)
- ✅ **Visible Text** (what's on the front)
- ✅ **Keywords** (tags)
- ✅ **Inside Note** (the greeting message)
- ✅ **Full Path** (complete file location) 👈 **This is what you need!**

### The Path is Ready to Use:
```
C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\
Designs\Series1_original\Series\BirthdayFunny\15.png
```

You can:
- Copy it to open the image
- Use it in your application
- Save it to a list
- Share it with others

---

## 🎨 Tips for Better Searches

### ✅ DO:
- Be descriptive: "funny birthday card for 30-year-old friend"
- Combine attributes: "elegant floral thank you card"
- Use natural language: "warm heartfelt message for mom"
- Try different phrasings if results aren't good

### ❌ DON'T:
- Use just one word: "card"
- Be too vague: "something nice"
- Use technical terms: "high-resolution JPEG"

---

## 🔄 Workflow

```
1. Run script → 2. Enter search → 3. See results → 4. Copy path → 5. Search again or quit
     ↑                                                                      ↓
     └──────────────────────────────────────────────────────────────────────┘
```

---

## 🚀 You're Ready!

Your interactive search is **fully functional** and ready to use right now!

Just run:
```powershell
$env:GOOGLE_API_KEY = "your_key"
python scripts/search_cards.py
```

And start searching! 🎉

---

## 📝 Quick Reference Card

```
┌─────────────────────────────────────────────────────────────┐
│  INTERACTIVE CARD SEARCH - QUICK REFERENCE                  │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  START:                                                       │
│  $env:GOOGLE_API_KEY = "key"                                │
│  python scripts/search_cards.py                              │
│                                                               │
│  SEARCH:                                                      │
│  • Type your query naturally                                 │
│  • Press Enter                                               │
│  • Choose number of results (or press Enter for 5)          │
│                                                               │
│  RESULTS:                                                     │
│  • Similarity score (85%+ is excellent)                      │
│  • Full file path to image                                   │
│  • All card details                                          │
│                                                               │
│  REPEAT:                                                      │
│  • Enter new search or type 'quit' to exit                  │
│                                                               │
│  TIPS:                                                        │
│  • Be specific and descriptive                               │
│  • Try different phrasings                                   │
│  • Search by occasion, style, emotion, or visuals           │
│                                                               │
└─────────────────────────────────────────────────────────────┘
```

Happy Searching! 🎴✨





