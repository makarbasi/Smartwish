# 🎉 Welcome! Start Here for sw_templates Update

**You have everything you need to automatically upload your greeting card data to Supabase!**

---

## ⚡ 30-Second Start

```powershell
# Run this one command:
.\scripts\run_update_templates.ps1
```

That's it! The script will guide you through the rest.

---

## 📚 What You Have

I've created a complete automation system with:

### ✅ Core Scripts
- **update_sw_templates.py** - Uploads cards to Supabase
- **verify_setup.py** - Checks everything is ready
- **run_update_templates.ps1** - Easy interactive runner
- **run_update_templates.bat** - Windows batch alternative

### 📖 Documentation
- **START_HERE.md** (you are here) - Quick start
- **QUICK_START_UPDATE.md** - 5-minute guide
- **README_UPDATE_TEMPLATES.md** - Complete manual
- **CHECKLIST_UPDATE.md** - Step-by-step checklist
- **INDEX_UPDATE_TEMPLATES.md** - Documentation navigator
- **UPDATE_TEMPLATES_SUMMARY.md** - System overview
- **SYSTEM_OVERVIEW.md** - Visual diagrams

### 🗄️ Database
- **setup_database.sql** - Database setup queries
- **requirements_supabase.txt** - Python dependencies

---

## 🎯 Choose Your Path

### Path 1: "Just Do It" (Easiest) 🚀
```powershell
.\scripts\run_update_templates.ps1
```
Follow the prompts. Takes 5 minutes.

### Path 2: "Show Me Step-by-Step" 📋
1. Open: [CHECKLIST_UPDATE.md](CHECKLIST_UPDATE.md)
2. Follow each checkbox
3. Takes 10 minutes

### Path 3: "I Want to Understand" 📚
1. Read: [UPDATE_TEMPLATES_SUMMARY.md](UPDATE_TEMPLATES_SUMMARY.md)
2. Read: [README_UPDATE_TEMPLATES.md](README_UPDATE_TEMPLATES.md)
3. Then run scripts
4. Takes 20 minutes

---

## 🔍 What This Does

### Input (What You Have)
```
📁 Your Card Folders
   ├── BirthdayCardBasic/
   │   ├── metadata.json       (card info)
   │   ├── insidenote.json     (messages + embeddings)
   │   └── *.png               (images)
   ├── BirthdayFloral/
   └── ... more folders (221 cards total)
```

### Output (What You Get)
```
🗄️ Supabase Database
   └── sw_templates table
       └── 221 cards with:
           ✅ Complete metadata
           ✅ Image URLs
           ✅ AI embeddings
           ✅ Search keywords
           ✅ Categories
           ✅ All ready to use!
```

---

## ⚙️ How It Works

```
1. Script scans your card folders
2. Reads metadata.json and insidenote.json
3. Extracts all card data
4. Maps to Supabase storage URLs
5. Creates complete records
6. Uploads to sw_templates table
7. Logs success/failures
```

Simple as that!

---

## ✅ Before You Start

### Required (Check These)
- [ ] Python 3.8+ installed
- [ ] Card folders exist with JSON files
- [ ] Supabase database set up
- [ ] Internet connection

### If Database Not Set Up
Run these queries in Supabase SQL Editor:
1. Copy from [setup_database.sql](setup_database.sql)
2. Paste into Supabase
3. Execute
4. You're ready!

---

## 🚀 Quick Commands

### Install Dependencies
```powershell
pip install -r scripts/requirements_supabase.txt
```

### Verify Everything is Ready
```powershell
python scripts/verify_setup.py
```

### Preview (No Upload)
```powershell
python scripts/update_sw_templates.py --dry-run
```

### Upload for Real
```powershell
python scripts/update_sw_templates.py
```

---

## 📊 What Gets Uploaded

For each of your 221 cards:
- ✅ Title & Description
- ✅ Category (Birthday, Thankyou, etc.)
- ✅ Author (Smartwish Studio)
- ✅ Images (4 pages: front, inside, blank, logo)
- ✅ Message (inside note)
- ✅ Keywords (for search)
- ✅ AI Embedding (768 dimensions)
- ✅ Metadata (occasion, style, audience)
- ✅ Price ($2.99)
- ✅ Status (published)

All automatically! No manual data entry.

---

## 🎓 Learning Resources

### Quick Guides
- [QUICK_START_UPDATE.md](QUICK_START_UPDATE.md) - Get started fast
- [CHECKLIST_UPDATE.md](CHECKLIST_UPDATE.md) - Don't miss a step
- [SYSTEM_OVERVIEW.md](SYSTEM_OVERVIEW.md) - Visual diagrams

### Complete References
- [README_UPDATE_TEMPLATES.md](README_UPDATE_TEMPLATES.md) - Everything
- [UPDATE_TEMPLATES_SUMMARY.md](UPDATE_TEMPLATES_SUMMARY.md) - Overview
- [INDEX_UPDATE_TEMPLATES.md](INDEX_UPDATE_TEMPLATES.md) - Navigator

### Database & Technical
- [setup_database.sql](setup_database.sql) - SQL queries
- Comments in Python scripts - Code documentation

---

## 🐛 If Something Goes Wrong

### Step 1: Run Verification
```powershell
python scripts/verify_setup.py
```
This will tell you exactly what's wrong.

### Step 2: Check Documentation
- [README_UPDATE_TEMPLATES.md](README_UPDATE_TEMPLATES.md) has a Troubleshooting section
- Look at the error message
- Search the README for that error

### Step 3: Common Issues
- **"Directory not found"** → Update path in script
- **"Category not found"** → Run setup_database.sql
- **"Author not found"** → Add "Smartwish Studio" to sw_authors
- **"JSON error"** → Check JSON file format

---

## 💡 Pro Tips

1. **Always run dry-run first** to preview
2. **Verify setup** before uploading
3. **Check Supabase dashboard** after upload
4. **Safe to re-run** - skips duplicates automatically
5. **Logs everything** - check console output

---

## 📈 After Upload

### Verify in Supabase
```sql
-- Count total cards
SELECT COUNT(*) FROM sw_templates;

-- View recent uploads
SELECT * FROM sw_templates 
ORDER BY created_at DESC LIMIT 10;

-- Count by category
SELECT c.name, COUNT(t.id) 
FROM sw_templates t
JOIN sw_categories c ON t.category_id = c.id
GROUP BY c.name;
```

### Use in Your App
Your cards are now in the database and ready to:
- Display in your application
- Search semantically with embeddings
- Filter by category, occasion, style
- Show to users

---

## 🎯 Success Checklist

After running the script:
- [ ] All cards uploaded (check count)
- [ ] No errors in logs
- [ ] Data visible in Supabase dashboard
- [ ] Image URLs work
- [ ] Categories correct
- [ ] Embeddings present
- [ ] Search works (if implemented)

---

## 🔄 For Future Updates

When you have new cards:
1. Add to appropriate folders
2. Generate metadata.json
3. Generate insidenote.json (with embeddings)
4. Run: `python scripts/update_sw_templates.py`
5. Done! (Skips existing cards)

---

## 🎉 You're Ready!

Everything is set up. Just run:

```powershell
.\scripts\run_update_templates.ps1
```

Or follow any guide that suits your style:
- Quick: [QUICK_START_UPDATE.md](QUICK_START_UPDATE.md)
- Careful: [CHECKLIST_UPDATE.md](CHECKLIST_UPDATE.md)
- Detailed: [README_UPDATE_TEMPLATES.md](README_UPDATE_TEMPLATES.md)

---

## 📞 Need Help?

1. Run `verify_setup.py` to diagnose
2. Check the [README troubleshooting](README_UPDATE_TEMPLATES.md)
3. Review error messages in console
4. Check Supabase dashboard

---

## 🚀 Let's Go!

**Time to upload your cards!**

Choose your preferred method above and get started.

Your 221 greeting cards will be in Supabase in just a few minutes! 🎉

---

**Questions?** Check [INDEX_UPDATE_TEMPLATES.md](INDEX_UPDATE_TEMPLATES.md) to find the right documentation.

