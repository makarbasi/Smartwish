# 📚 sw_templates Update - Complete Documentation Index

**Complete automation system for updating Supabase sw_templates table with greeting card metadata.**

---

## 🎯 What You Need to Know

This system automates the process of uploading your greeting card metadata from local JSON files to your Supabase database. It handles:
- Reading metadata and inside notes from JSON files
- Mapping cards to categories and storage URLs
- Uploading complete records to sw_templates table
- Managing duplicates and errors
- Providing detailed logging and verification

---

## 🚀 Quick Access

### For First-Time Users
1. Start here: [QUICK_START_UPDATE.md](QUICK_START_UPDATE.md) 📖
2. Then use: [CHECKLIST_UPDATE.md](CHECKLIST_UPDATE.md) ✅

### For Detailed Information
- Complete Guide: [README_UPDATE_TEMPLATES.md](README_UPDATE_TEMPLATES.md) 📚
- Summary: [UPDATE_TEMPLATES_SUMMARY.md](UPDATE_TEMPLATES_SUMMARY.md) 📝

### For Database Setup
- SQL Commands: [setup_database.sql](setup_database.sql) 🗄️

---

## 📁 All Files in This System

### 🔧 Executable Scripts

| File | Purpose | When to Use |
|------|---------|-------------|
| `update_sw_templates.py` | Main upload script | Upload cards to Supabase |
| `verify_setup.py` | Verification script | Before uploading |
| `run_update_templates.ps1` | PowerShell automation | Easy interactive upload |
| `run_update_templates.bat` | Batch automation | Windows command prompt |

### 📚 Documentation

| File | Type | For |
|------|------|-----|
| `INDEX_UPDATE_TEMPLATES.md` | Index | Finding other docs (this file) |
| `QUICK_START_UPDATE.md` | Quick Guide | Getting started fast |
| `README_UPDATE_TEMPLATES.md` | Full Guide | Complete details |
| `UPDATE_TEMPLATES_SUMMARY.md` | Summary | Overview of system |
| `CHECKLIST_UPDATE.md` | Checklist | Step-by-step verification |

### 🗄️ Database & Config

| File | Purpose |
|------|---------|
| `setup_database.sql` | Database setup and verification queries |
| `requirements_supabase.txt` | Python dependencies |

---

## 📖 Documentation Guide

### When to Read What

#### 🎯 "I want to upload cards NOW"
→ Read: [QUICK_START_UPDATE.md](QUICK_START_UPDATE.md)  
→ Use: `run_update_templates.ps1`

#### ✅ "I want to make sure everything is set up correctly"
→ Use: [CHECKLIST_UPDATE.md](CHECKLIST_UPDATE.md)  
→ Run: `verify_setup.py`

#### 📚 "I want to understand how it works"
→ Read: [UPDATE_TEMPLATES_SUMMARY.md](UPDATE_TEMPLATES_SUMMARY.md)  
→ Read: [README_UPDATE_TEMPLATES.md](README_UPDATE_TEMPLATES.md)

#### 🗄️ "I need to set up the database"
→ Use: [setup_database.sql](setup_database.sql)  
→ Copy queries to Supabase SQL Editor

#### 🐛 "Something went wrong"
→ Check: [README_UPDATE_TEMPLATES.md](README_UPDATE_TEMPLATES.md) Troubleshooting section  
→ Run: `verify_setup.py`  
→ Review: Script logs

#### 🔧 "I want to customize the script"
→ Read: Script comments in `update_sw_templates.py`  
→ Review: Configuration section in README

---

## 🎓 Learning Path

### Beginner Path
1. **Read**: QUICK_START_UPDATE.md (5 min)
2. **Follow**: CHECKLIST_UPDATE.md (ensure prerequisites)
3. **Run**: `verify_setup.py` (check setup)
4. **Execute**: `run_update_templates.ps1` (upload)
5. **Verify**: Use SQL queries from setup_database.sql

### Advanced Path
1. **Read**: UPDATE_TEMPLATES_SUMMARY.md (understand system)
2. **Read**: README_UPDATE_TEMPLATES.md (full details)
3. **Review**: `update_sw_templates.py` (understand code)
4. **Customize**: Modify configuration as needed
5. **Run**: `python update_sw_templates.py` (with custom settings)

---

## 🔍 Quick Reference

### Commands

```powershell
# Interactive upload (easiest)
.\scripts\run_update_templates.ps1

# Manual steps
pip install -r scripts/requirements_supabase.txt
python scripts/verify_setup.py
python scripts/update_sw_templates.py --dry-run
python scripts/update_sw_templates.py
```

### File Purposes

```
update_sw_templates.py     → Main upload logic
verify_setup.py            → Pre-flight checks
run_update_templates.ps1   → User-friendly wrapper
setup_database.sql         → Database setup
```

### Documentation Purposes

```
QUICK_START_UPDATE.md      → Get started in 5 minutes
README_UPDATE_TEMPLATES.md → Complete reference
UPDATE_TEMPLATES_SUMMARY.md → System overview
CHECKLIST_UPDATE.md        → Step-by-step guide
INDEX_UPDATE_TEMPLATES.md  → This navigation file
```

---

## 📊 File Dependencies

```
run_update_templates.ps1
    ↓ installs
requirements_supabase.txt
    ↓ runs
update_sw_templates.py
    ↓ connects to
Supabase Database
    ↓ requires
setup_database.sql (for initial setup)
```

---

## 🎯 Common Tasks

### Task: First-Time Upload
**Files Needed:**
1. QUICK_START_UPDATE.md (read)
2. setup_database.sql (run in Supabase)
3. verify_setup.py (run locally)
4. run_update_templates.ps1 (run locally)

**Time:** 10-15 minutes

---

### Task: Add New Cards
**Files Needed:**
1. update_sw_templates.py (run directly)

**Time:** 2-3 minutes

---

### Task: Troubleshooting
**Files Needed:**
1. verify_setup.py (diagnose issues)
2. README_UPDATE_TEMPLATES.md (troubleshooting section)
3. setup_database.sql (check database)

**Time:** 5-10 minutes

---

### Task: Customize Configuration
**Files Needed:**
1. update_sw_templates.py (modify)
2. README_UPDATE_TEMPLATES.md (configuration guide)

**Time:** 5-10 minutes

---

## 📈 Success Metrics

After using this system, you should have:
- ✅ All cards uploaded to sw_templates
- ✅ Correct categorization
- ✅ Valid image URLs
- ✅ Embeddings stored
- ✅ No duplicate entries
- ✅ Searchable card database

---

## 🔗 Related Systems

This update system works with:
- **generate_embeddings.py** - Generates embeddings (prerequisite)
- **search_cards.py** - Searches cards (uses uploaded data)
- **verify_embeddings.py** - Verifies embeddings exist

---

## 💡 Tips for Using This Documentation

1. **Start with Quick Start** if you're in a hurry
2. **Use the Checklist** to ensure nothing is missed
3. **Refer to README** for detailed explanations
4. **Keep Index open** for quick navigation
5. **Bookmark this page** for future reference

---

## 📞 Getting Help

If you need help:
1. **Check the relevant doc** using this index
2. **Run verify_setup.py** to diagnose issues
3. **Review logs** from the script
4. **Check Supabase dashboard** for data
5. **Read troubleshooting section** in README

---

## 🎉 You're Ready!

Pick your starting point:
- **Quick Upload**: → [QUICK_START_UPDATE.md](QUICK_START_UPDATE.md)
- **Careful Setup**: → [CHECKLIST_UPDATE.md](CHECKLIST_UPDATE.md)
- **Deep Dive**: → [README_UPDATE_TEMPLATES.md](README_UPDATE_TEMPLATES.md)

---

## 📝 Documentation Map

```
INDEX_UPDATE_TEMPLATES.md (you are here)
    ├── QUICK_START_UPDATE.md
    │   └── Commands and basic usage
    │
    ├── CHECKLIST_UPDATE.md
    │   └── Step-by-step verification
    │
    ├── README_UPDATE_TEMPLATES.md
    │   ├── Complete documentation
    │   ├── Configuration guide
    │   ├── Troubleshooting
    │   └── Advanced usage
    │
    ├── UPDATE_TEMPLATES_SUMMARY.md
    │   ├── System overview
    │   ├── Features list
    │   └── What gets uploaded
    │
    └── setup_database.sql
        ├── Table creation
        ├── Index creation
        └── Verification queries
```

---

**Use this index to navigate the documentation efficiently!**

All files are in the `scripts/` directory.

