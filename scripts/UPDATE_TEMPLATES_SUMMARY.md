# 📦 Supabase sw_templates Update - Complete Solution

## 🎯 What Was Created

I've created a complete automation system to update your Supabase `sw_templates` table with all your greeting card metadata from JSON files.

---

## 📁 Files Created

### 1. **Main Script** 🚀
- `update_sw_templates.py` - Core script that performs the upload
  - Scans all card folders
  - Reads metadata.json and insidenote.json
  - Constructs complete records
  - Performs batch UPSERT to Supabase
  - Handles duplicates and errors

### 2. **Verification Script** ✅
- `verify_setup.py` - Pre-flight checks before upload
  - Validates directory structure
  - Checks JSON files
  - Tests Supabase connection
  - Verifies database tables
  - Checks embeddings

### 3. **Automation Scripts** 🔄
- `run_update_templates.ps1` - PowerShell wrapper (interactive)
- `run_update_templates.bat` - Batch file wrapper (Windows)

### 4. **Documentation** 📚
- `README_UPDATE_TEMPLATES.md` - Complete detailed guide
- `QUICK_START_UPDATE.md` - Quick start guide
- `UPDATE_TEMPLATES_SUMMARY.md` - This file
- `setup_database.sql` - SQL setup and verification queries

### 5. **Requirements** 📦
- `requirements_supabase.txt` - Python dependencies

---

## 🚀 How to Use

### Quick Start (Recommended)
```powershell
# Run the automated script
.\scripts\run_update_templates.ps1
```

This will:
1. ✅ Install dependencies
2. ✅ Run dry-run preview
3. ✅ Ask for confirmation
4. ✅ Perform actual upload

### Manual Steps
```powershell
# 1. Install dependencies
pip install -r scripts/requirements_supabase.txt

# 2. Verify setup
python scripts/verify_setup.py

# 3. Preview (dry run)
python scripts/update_sw_templates.py --dry-run

# 4. Actual upload
python scripts/update_sw_templates.py
```

---

## 📊 What Gets Uploaded

For each card in your folders, the script uploads:

### Basic Information
- ✅ `title` - From metadata or generated from filename
- ✅ `slug` - URL-friendly version of filename
- ✅ `description` - From metadata.json

### Categories & Classification
- ✅ `category_id` - Linked to sw_categories table
- ✅ `occasion_type` - From metadata (Birthday, etc.)
- ✅ `style_type` - From metadata (Modern, etc.)
- ✅ `target_audience` - From metadata (recipient)

### Images
- ✅ `cover_image` - Main card image URL
- ✅ `image_1` - Main card (Supabase storage URL)
- ✅ `image_2` - Inside card (Supabase storage URL)
- ✅ `image_3` - Blank page path
- ✅ `image_4` - Logo page path

### Content
- ✅ `message` - Inside note from insidenote.json
- ✅ `search_keywords` - Keywords array from metadata

### AI & Search
- ✅ `embedding_vector` - 768-dimensional vector from insidenote.json
- ✅ `embedding_updated_at` - Current timestamp

### Metadata
- ✅ `author_id` - Linked to sw_authors (Smartwish Studio)
- ✅ `price` - Default $2.99
- ✅ `is_featured` - Default false
- ✅ `status` - Default "published"

---

## 🗂️ Folder Structure Expected

```
C:\Users\makar\OneDrive\OLD\E-Learning\projects\SmartWish\Designs\Series1_original\Series\
│
├── BirthdayCardBasic/
│   ├── metadata.json        ← Card metadata
│   ├── insidenote.json      ← Inside notes + embeddings
│   ├── card_1.png           ← Card images
│   ├── inside_card_1.png    ← Inside images
│   └── ...
│
├── BirthdayFloral/
│   ├── metadata.json
│   ├── insidenote.json
│   └── ...
│
├── Congratulations/
├── Thanksgiving/
├── Thankyou/
├── Graduation/
└── ... more folders
```

---

## 🔧 Configuration

### Category Mapping
The script automatically maps folder names to Supabase storage URLs:

| Folder | Category | Storage Path |
|--------|----------|--------------|
| BirthdayCardBasic | Birthday | .../Birthday/BirthdayCardBasic/ |
| BirthdayFloral | Birthday | .../Birthday/BirthdayFloral/ |
| BirthdayFunny | Birthday | .../Birthday/BirthdayFunny/ |
| Congratulations | Congratulations | .../Congratulation/ |
| ChristmasCardBundle | Holidays | .../Holidays/ |
| Thanksgiving | Thanksgiving | .../Thanksgiving/ |
| Thankyou | Thankyou | .../Thankyou/ |
| Graduation | Graduation | .../Graduation/ |

### Customization
You can customize in `update_sw_templates.py`:
- Cards directory path
- Storage URLs
- Default price
- Category mappings
- Field mappings

---

## ✅ Safety Features

### Duplicate Prevention
- ✅ Checks for existing slugs
- ✅ Automatically skips duplicates
- ✅ Logs skipped cards

### Error Handling
- ✅ Validates JSON files before processing
- ✅ Catches and logs individual errors
- ✅ Continues processing other cards on error
- ✅ Provides detailed error messages

### Dry Run Mode
- ✅ Preview before uploading
- ✅ Count cards that will be processed
- ✅ No changes to database
- ✅ Validates configuration

---

## 📈 Expected Output

### Dry Run
```
================================================================================
Starting sw_templates Update
================================================================================
🔍 DRY RUN MODE - No data will be uploaded
Found 8 folders to process

Would process category: Birthday
Would process 25 cards from BirthdayCardBasic
...
Total: 221 cards would be processed
```

### Actual Run
```
================================================================================
Starting sw_templates Update
================================================================================
✅ Connected to Supabase
Found 8 folders to process

================================================================================
Processing: BirthdayCardBasic
================================================================================
✅ Successfully upserted 25 cards from BirthdayCardBasic

...

================================================================================
FINAL SUMMARY
================================================================================
✅ Successfully uploaded: 221 cards
⏭️  Skipped (already exist): 0 cards
📁 Processed folders: 8

Breakdown by Folder:
================================================================================
📂 BirthdayCardBasic (Birthday)
   ✅ Uploaded: 25
📂 BirthdayFloral (Birthday)
   ✅ Uploaded: 18
...
```

---

## 🔍 Verification

### In Your Terminal
```powershell
python scripts/verify_setup.py
```

### In Supabase Dashboard
```sql
-- Count total templates
SELECT COUNT(*) FROM sw_templates;

-- Count by category
SELECT c.name, COUNT(t.id) 
FROM sw_templates t
JOIN sw_categories c ON t.category_id = c.id
GROUP BY c.name;

-- View recent uploads
SELECT title, category_id, created_at 
FROM sw_templates 
ORDER BY created_at DESC 
LIMIT 10;

-- Check embeddings
SELECT 
    title, 
    ARRAY_LENGTH(embedding_vector, 1) as dimensions
FROM sw_templates 
WHERE embedding_vector IS NOT NULL
LIMIT 10;
```

---

## 🐛 Common Issues & Solutions

### "Cards directory not found"
**Problem:** Path is incorrect  
**Solution:** Update `CARDS_DIRECTORY` in script

### "Category not found in database"
**Problem:** Category doesn't exist in sw_categories  
**Solution:** Run SQL from `setup_database.sql` to create categories

### "Author not found"
**Problem:** "Smartwish Studio" doesn't exist  
**Solution:** Run SQL to insert author:
```sql
INSERT INTO sw_authors (name, bio) 
VALUES ('Smartwish Studio', 'Official designer');
```

### "Missing JSON files"
**Problem:** Folder lacks metadata.json or insidenote.json  
**Solution:** Run generation scripts first, or skip that folder

### "Slug already exists"
**Problem:** Card was already uploaded  
**Solution:** Normal - duplicates are automatically skipped

---

## 📊 Database Requirements

### Required Tables
1. **sw_categories** - Card categories
2. **sw_authors** - Card authors
3. **sw_templates** - Main templates table (target)

### Required Data
- Categories: Birthday, Thankyou, Congratulations, Graduation, Holidays, Thanksgiving
- Author: "Smartwish Studio"

### Extensions
- **pgvector** - For embedding storage and similarity search

---

## 🎯 Complete Workflow

### First Time Setup
```powershell
# 1. Set up database tables (in Supabase SQL Editor)
# Copy from setup_database.sql

# 2. Generate embeddings (if not done)
python scripts/generate_embeddings.py

# 3. Verify setup
python scripts/verify_setup.py

# 4. Upload to Supabase
.\scripts\run_update_templates.ps1
```

### Updating/Adding New Cards
```powershell
# 1. Add new cards to folders with JSON files

# 2. Generate embeddings for new cards
python scripts/generate_embeddings.py

# 3. Upload (will skip existing)
python scripts/update_sw_templates.py
```

---

## 🔐 Security Notes

- ⚠️ **Credentials are in the script** for automation
- ⚠️ **Service role key has full access**
- ⚠️ **Don't commit to public repos**
- ⚠️ **Keep Supabase keys secure**

### For Production
Consider:
- Use environment variables
- Rotate keys regularly
- Restrict service role permissions
- Use row-level security (RLS)

---

## 📚 Documentation Files

| File | Purpose |
|------|---------|
| `README_UPDATE_TEMPLATES.md` | Complete detailed documentation |
| `QUICK_START_UPDATE.md` | Quick start guide |
| `UPDATE_TEMPLATES_SUMMARY.md` | This summary |
| `setup_database.sql` | Database setup queries |
| `update_sw_templates.py` | Main script (with inline docs) |
| `verify_setup.py` | Verification script |

---

## ✨ Features

### Automation
- ✅ Batch processing of all folders
- ✅ Automatic slug generation
- ✅ Duplicate detection
- ✅ Error recovery

### Data Quality
- ✅ Validates JSON before upload
- ✅ Checks required fields
- ✅ Verifies embeddings
- ✅ Links to categories/authors

### Performance
- ✅ Batch UPSERT operations
- ✅ Efficient database queries
- ✅ Minimal API calls

### User Experience
- ✅ Detailed logging
- ✅ Progress indicators
- ✅ Dry run mode
- ✅ Interactive scripts

---

## 🎉 Success Criteria

After running successfully:
- ✅ All cards uploaded to sw_templates
- ✅ Correct category associations
- ✅ Valid Supabase storage URLs
- ✅ Embeddings properly stored
- ✅ No duplicate slugs
- ✅ All required fields populated

---

## 🚀 Next Steps

1. **Run the script** to upload your cards
2. **Verify in Supabase** that data looks correct
3. **Test queries** on sw_templates table
4. **Update your frontend** to use the data
5. **Test search functionality** with embeddings

---

## 💡 Tips

- Always run dry-run first
- Verify setup before uploading
- Check Supabase dashboard after upload
- Keep credentials secure
- Back up database before major updates

---

## 📞 Need Help?

1. Check `verify_setup.py` output for specific issues
2. Review logs for error messages
3. Consult `README_UPDATE_TEMPLATES.md` for detailed info
4. Check `setup_database.sql` for database requirements

---

**You're all set! Your automation system is ready to populate sw_templates.** 🎉

Run the script whenever you have new cards to upload!

