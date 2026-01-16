# 🚀 Supabase sw_templates Update Script

Automated script to populate the `sw_templates` table in Supabase with complete greeting card metadata from your local JSON files.

---

## ✨ What This Script Does

1. **Scans all card folders** in your Series directory
2. **Reads metadata** from `metadata.json` and `insidenote.json` files
3. **Constructs complete records** with all required fields
4. **Uploads to Supabase** using batch UPSERT operations
5. **Handles duplicates** by checking existing slugs
6. **Provides detailed logs** of success/failures

---

## 📋 Prerequisites

### 1. Python 3.8+
```powershell
python --version
```

### 2. Card Data Structure
Your cards should be organized like this:
```
Designs/Series1_original/Series/
├── BirthdayCardBasic/
│   ├── metadata.json
│   ├── insidenote.json
│   └── [card images]
├── BirthdayFloral/
│   ├── metadata.json
│   ├── insidenote.json
│   └── [card images]
└── ... more folders
```

### 3. JSON File Format
**metadata.json:**
```json
[
  {
    "filename": "card_1.png",
    "title": "Happy Birthday",
    "description": "Cheerful birthday card",
    "occasion": "Birthday",
    "recipient": "Friend",
    "style": "Modern",
    "keywords": ["birthday", "celebration", "fun"]
  }
]
```

**insidenote.json:**
```json
[
  {
    "filename": "card_1.png",
    "inside_note": "Wishing you a wonderful day!",
    "embedding": [0.123, 0.456, ...] // 768-dimensional vector
  }
]
```

### 4. Supabase Database Tables
The following tables must exist:
- `sw_templates` (target table)
- `sw_categories` (with category names: Birthday, Thankyou, etc.)
- `sw_authors` (with author: "Smartwish Studio")

---

## 🎯 Quick Start

### Option 1: PowerShell (Recommended)
```powershell
.\scripts\run_update_templates.ps1
```

### Option 2: Batch File
```cmd
scripts\run_update_templates.bat
```

### Option 3: Direct Python
```powershell
# Install dependencies
pip install -r scripts/requirements_supabase.txt

# Dry run first (preview only)
python scripts/update_sw_templates.py --dry-run

# Actual update
python scripts/update_sw_templates.py
```

---

## 🔍 Dry Run Mode

**Always run dry-run first** to preview what will be uploaded:

```powershell
python scripts/update_sw_templates.py --dry-run
```

This will:
- ✅ Count how many cards will be processed
- ✅ Show folder breakdown
- ✅ Validate file structure
- ❌ NOT upload anything to Supabase

---

## 📊 Fields Populated

For each card, the script populates these fields in `sw_templates`:

| Field | Source | Example |
|-------|--------|---------|
| `title` | metadata.json or generated | "Happy Birthday Wishes" |
| `slug` | generated from filename | "happy-birthday-wishes" |
| `category_id` | sw_categories table | UUID |
| `author_id` | sw_authors table | UUID |
| `description` | metadata.json | "Cheerful birthday card..." |
| `price` | fixed value | 2.99 |
| `cover_image` | Supabase storage URL | https://...card_1.png |
| `target_audience` | metadata.json[recipient] | "Friend, Family" |
| `occasion_type` | metadata.json[occasion] | "Birthday" |
| `style_type` | metadata.json[style] | "Modern, Colorful" |
| `image_1` | main card image URL | https://...card_1.png |
| `image_2` | inside card image URL | https://...inside_card_1.png |
| `image_3` | blank page path | C:\\...\\blank.png |
| `image_4` | logo page path | C:\\...\\blank_logo.png |
| `message` | insidenote.json[inside_note] | "Wishing you..." |
| `search_keywords` | metadata.json[keywords] | ["birthday", "fun"] |
| `embedding_vector` | insidenote.json[embedding] | [0.123, 0.456, ...] |
| `embedding_updated_at` | current timestamp | 2025-11-13T... |
| `is_featured` | default | false |
| `status` | default | "published" |

---

## 🗂️ Category Mapping

The script automatically maps folder names to Supabase storage URLs:

| Folder Name | Category | Storage URL |
|------------|----------|-------------|
| BirthdayCardBasic | Birthday | .../Birthday/BirthdayCardBasic/ |
| BirthdayFloral | Birthday | .../Birthday/BirthdayFloral/ |
| BirthdayFunny | Birthday | .../Birthday/BirthdayFunny/ |
| Congratulations | Congratulations | .../Congratulation/ |
| ChristmasCardBundle | Holidays | .../Holidays/ |
| Thanksgiving | Thanksgiving | .../Thanksgiving/ |
| Thankyou | Thankyou | .../Thankyou/ |
| Graduation | Graduation | .../Graduation/ |

---

## 📝 Output Example

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

================================================================================
Processing: BirthdayFloral
================================================================================
Skipping card_1.png: slug 'birthday-floral-1' already exists
✅ Successfully upserted 18 cards from BirthdayFloral

================================================================================
FINAL SUMMARY
================================================================================
✅ Successfully uploaded: 198 cards
⏭️  Skipped (already exist): 23 cards
📁 Processed folders: 8

================================================================================
Breakdown by Folder:
================================================================================
📂 BirthdayCardBasic (Birthday)
   ✅ Uploaded: 25
   ⏭️  Skipped: 0

📂 BirthdayFloral (Birthday)
   ✅ Uploaded: 18
   ⏭️  Skipped: 7

...

================================================================================
Update Complete!
================================================================================
```

---

## ⚙️ Configuration

You can customize these settings in `update_sw_templates.py`:

### Change Cards Directory
```python
CARDS_DIRECTORY = Path(r"C:\Your\Custom\Path\Series")
```

### Add New Category Mapping
```python
CATEGORY_STORAGE_MAP = {
    'NewCategory': f'{STORAGE_BASE_URL}/NewCategory/',
    # ... existing mappings
}

CATEGORY_NAME_MAP = {
    'NewCategory': 'New Category Name',
    # ... existing mappings
}
```

### Change Default Price
```python
'price': 4.99,  # instead of 2.99
```

---

## 🔒 Security

- ✅ Credentials are in the script (for automation)
- ✅ Service role key has full access
- ⚠️ **Do not commit this script to public repos**
- ⚠️ Keep your Supabase keys secure

### Best Practices:
1. Use environment variables for production
2. Rotate keys if exposed
3. Restrict service role key permissions

---

## 🐛 Troubleshooting

### "Category not found in database"
**Solution:** Ensure the category exists in `sw_categories` table:
```sql
SELECT * FROM sw_categories WHERE name = 'Birthday';
```

### "Author not found in database"
**Solution:** Ensure "Smartwish Studio" exists in `sw_authors` table:
```sql
SELECT * FROM sw_authors WHERE name = 'Smartwish Studio';
```

### "Missing JSON files"
**Solution:** Ensure both `metadata.json` and `insidenote.json` exist in each folder.

### "Failed to connect to Supabase"
**Solution:** Verify credentials:
- SUPABASE_URL is correct
- SUPABASE_SERVICE_ROLE_KEY is valid

### Slug Already Exists
**Solution:** This is normal - the script skips duplicates. To force update, manually delete from database first.

---

## 📊 Database Schema

The script expects `sw_templates` table with these columns:

```sql
CREATE TABLE sw_templates (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title VARCHAR(255) NOT NULL,
  slug VARCHAR(255) UNIQUE NOT NULL,
  category_id UUID REFERENCES sw_categories(id),
  author_id UUID REFERENCES sw_authors(id),
  description TEXT,
  price DECIMAL(10,2),
  cover_image TEXT,
  target_audience TEXT,
  occasion_type TEXT,
  style_type TEXT,
  image_1 TEXT,
  image_2 TEXT,
  image_3 TEXT,
  image_4 TEXT,
  message TEXT,
  search_keywords TEXT[],
  embedding_vector VECTOR(768),
  embedding_updated_at TIMESTAMP,
  is_featured BOOLEAN DEFAULT false,
  status VARCHAR(50) DEFAULT 'published',
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## ✅ Verification

After running, verify in Supabase:

```sql
-- Count total templates
SELECT COUNT(*) FROM sw_templates;

-- Count by category
SELECT c.name, COUNT(t.id) 
FROM sw_templates t
JOIN sw_categories c ON t.category_id = c.id
GROUP BY c.name;

-- Check recent uploads
SELECT title, category_id, created_at 
FROM sw_templates 
ORDER BY created_at DESC 
LIMIT 10;

-- Verify embeddings
SELECT title, 
       ARRAY_LENGTH(embedding_vector, 1) as embedding_size,
       embedding_updated_at
FROM sw_templates 
WHERE embedding_vector IS NOT NULL
LIMIT 10;
```

---

## 🎉 Success Indicators

After running successfully, you should see:
- ✅ All cards uploaded to `sw_templates` table
- ✅ Correct category associations
- ✅ All image URLs pointing to Supabase storage
- ✅ Embeddings properly stored
- ✅ No duplicate slugs
- ✅ All required fields populated

---

## 🚀 Next Steps

1. **Verify data in Supabase dashboard**
2. **Test queries** on the sw_templates table
3. **Check image URLs** are accessible
4. **Test embedding search** functionality
5. **Update your frontend** to use the new data

---

## 📞 Support

If you encounter issues:
1. Check the logs for specific error messages
2. Verify JSON file format matches expected structure
3. Ensure Supabase tables and data exist
4. Run in dry-run mode to diagnose issues

---

## 📚 Related Scripts

| Script | Purpose |
|--------|---------|
| `generate_embeddings.py` | Generate embeddings for inside notes |
| `search_cards.py` | Search cards using embeddings |
| `verify_embeddings.py` | Verify embeddings exist |

---

**Your sw_templates table is now ready to power your SmartWish application!** 🎉

