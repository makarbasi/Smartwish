# ⚡ Quick Start: Update sw_templates

**Goal:** Upload all your greeting card metadata from JSON files to Supabase `sw_templates` table.

---

## 🎯 1-Minute Start

```powershell
# Option 1: Run the automated script (easiest)
.\scripts\run_update_templates.ps1

# Option 2: Manual steps
pip install -r scripts/requirements_supabase.txt
python scripts/verify_setup.py
python scripts/update_sw_templates.py --dry-run
python scripts/update_sw_templates.py
```

---

## 📋 Step-by-Step Guide

### Step 1: Verify Prerequisites ✅

Run the verification script:
```powershell
python scripts/verify_setup.py
```

This checks:
- ✅ Cards directory exists
- ✅ JSON files are valid
- ✅ Supabase connection works
- ✅ Database tables exist
- ✅ Embeddings are present

**Expected output:**
```
✅ ALL CHECKS PASSED!
🚀 You're ready to run: python scripts/update_sw_templates.py
```

---

### Step 2: Preview (Dry Run) 👀

See what will be uploaded WITHOUT actually uploading:

```powershell
python scripts/update_sw_templates.py --dry-run
```

**Expected output:**
```
Found 8 folders to process
Would process category: Birthday
Would process 25 cards from BirthdayCardBasic
Would process 18 cards from BirthdayFloral
...
✅ Successfully uploaded: 221 cards (preview)
```

---

### Step 3: Run the Update 🚀

Upload to Supabase:

```powershell
python scripts/update_sw_templates.py
```

**Expected output:**
```
Starting sw_templates Update
✅ Connected to Supabase
Found 8 folders to process

Processing: BirthdayCardBasic
✅ Successfully upserted 25 cards from BirthdayCardBasic

...

FINAL SUMMARY
✅ Successfully uploaded: 221 cards
⏭️  Skipped (already exist): 0 cards
📁 Processed folders: 8
```

---

## 🎉 That's It!

Your cards are now in Supabase! 

---

## 🔍 Verify in Supabase

Go to your Supabase dashboard and run:

```sql
-- Count templates
SELECT COUNT(*) FROM sw_templates;

-- View recent uploads
SELECT title, category_id, created_at 
FROM sw_templates 
ORDER BY created_at DESC 
LIMIT 10;
```

---

## 🐛 Troubleshooting

### "Cards directory not found"
**Fix:** Update the path in `update_sw_templates.py`:
```python
CARDS_DIRECTORY = Path(r"C:\Your\Actual\Path\Series")
```

### "Category not found in database"
**Fix:** Add missing categories to `sw_categories` table:
```sql
INSERT INTO sw_categories (name, slug, description)
VALUES ('Birthday', 'birthday', 'Birthday cards');
```

### "Author not found"
**Fix:** Add "Smartwish Studio" to `sw_authors` table:
```sql
INSERT INTO sw_authors (name, bio)
VALUES ('Smartwish Studio', 'Official SmartWish card designer');
```

### "Slug already exists"
**Fix:** This is normal - duplicates are automatically skipped. To force re-upload, delete existing record first.

---

## ⚙️ Advanced Options

### Update Specific Folder Only

Edit `update_sw_templates.py` and modify:
```python
# Only process specific folders
subdirs = [d for d in CARDS_DIRECTORY.iterdir() 
           if d.is_dir() and d.name in ['BirthdayCardBasic', 'Thankyou']]
```

### Change Price

```python
'price': 4.99,  # Change from default 2.99
```

### Add Custom Fields

```python
record = {
    # ... existing fields ...
    'custom_field': metadata.get('custom_value', ''),
}
```

---

## 📊 What Gets Uploaded

For each card, the script uploads:

✅ **Basic Info:** title, slug, description  
✅ **Categories:** category_id, occasion_type, style_type  
✅ **Images:** cover_image, image_1, image_2, image_3, image_4  
✅ **Content:** message, search_keywords  
✅ **AI Data:** embedding_vector (768 dimensions)  
✅ **Metadata:** price, target_audience, author_id  

---

## 🔄 Re-Running the Script

The script is **safe to re-run**:
- ✅ Skips existing slugs automatically
- ✅ Only uploads new cards
- ✅ No duplicates created

To force re-upload:
1. Delete old records from Supabase
2. Run script again

---

## 📚 Full Documentation

For complete details, see:
- 📖 [README_UPDATE_TEMPLATES.md](README_UPDATE_TEMPLATES.md) - Complete guide
- 🔧 [verify_setup.py](verify_setup.py) - Setup verification
- 🚀 [update_sw_templates.py](update_sw_templates.py) - Main script

---

## 💡 Tips

1. **Always run dry-run first** to preview changes
2. **Verify prerequisites** before uploading
3. **Check Supabase dashboard** after upload
4. **Keep credentials secure** - don't commit to git
5. **Back up your database** before major updates

---

**Ready to go? Run the script!** 🚀

```powershell
.\scripts\run_update_templates.ps1
```

