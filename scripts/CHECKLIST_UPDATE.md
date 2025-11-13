# ✅ sw_templates Update Checklist

Use this checklist to ensure a smooth upload process.

---

## 📋 Pre-Upload Checklist

### 1. Environment Setup
- [ ] Python 3.8+ installed
- [ ] pip package manager available
- [ ] Internet connection active

### 2. Files & Folders
- [ ] Cards directory exists at correct path
- [ ] Each folder has `metadata.json`
- [ ] Each folder has `insidenote.json`
- [ ] Image files match JSON filenames
- [ ] Embeddings generated in insidenote.json

### 3. Database Setup
- [ ] Supabase account created
- [ ] Database tables exist:
  - [ ] `sw_categories` table
  - [ ] `sw_authors` table
  - [ ] `sw_templates` table
- [ ] pgvector extension enabled
- [ ] Categories populated (Birthday, Thankyou, etc.)
- [ ] "Smartwish Studio" author exists

### 4. Credentials
- [ ] Supabase URL available
- [ ] Service role key available
- [ ] Credentials added to script

---

## 🚀 Upload Process

### Step 1: Install Dependencies
```powershell
pip install -r scripts/requirements_supabase.txt
```
- [ ] Dependencies installed successfully
- [ ] No error messages

### Step 2: Verify Setup
```powershell
python scripts/verify_setup.py
```
- [ ] Directory structure OK
- [ ] JSON files valid
- [ ] Supabase connection works
- [ ] Database tables exist
- [ ] All checks passed

### Step 3: Dry Run
```powershell
python scripts/update_sw_templates.py --dry-run
```
- [ ] Card count matches expectations
- [ ] Folder list correct
- [ ] No error messages
- [ ] Preview looks good

### Step 4: Actual Upload
```powershell
python scripts/update_sw_templates.py
```
- [ ] Connection successful
- [ ] Cards uploading
- [ ] Progress showing
- [ ] Upload completed

---

## ✅ Post-Upload Verification

### 1. Check Logs
- [ ] Success count matches expectations
- [ ] Skipped count reasonable
- [ ] No failed cards (or acceptable number)
- [ ] All folders processed

### 2. Verify in Supabase Dashboard
```sql
SELECT COUNT(*) FROM sw_templates;
```
- [ ] Total count correct

```sql
SELECT c.name, COUNT(t.id) 
FROM sw_templates t
JOIN sw_categories c ON t.category_id = c.id
GROUP BY c.name;
```
- [ ] Cards distributed across categories

```sql
SELECT * FROM sw_templates 
ORDER BY created_at DESC LIMIT 10;
```
- [ ] Recent uploads look correct
- [ ] All fields populated
- [ ] Image URLs valid

### 3. Test Data Quality
- [ ] Titles readable and correct
- [ ] Slugs unique and valid
- [ ] Descriptions present
- [ ] Images accessible
- [ ] Keywords present
- [ ] Embeddings exist (768 dimensions)

### 4. Test Functionality
- [ ] Cards appear in application
- [ ] Categories filter works
- [ ] Search returns results
- [ ] Images display correctly
- [ ] Semantic search works (if implemented)

---

## 🐛 Troubleshooting Checklist

If something goes wrong:

- [ ] Read error messages carefully
- [ ] Check verify_setup.py output
- [ ] Verify JSON file format
- [ ] Confirm database tables exist
- [ ] Check Supabase credentials
- [ ] Review script configuration
- [ ] Check logs for specific errors
- [ ] Try dry-run mode again

---

## 🔄 For Future Updates

When adding new cards:

- [ ] Add cards to appropriate folders
- [ ] Generate metadata.json
- [ ] Generate insidenote.json
- [ ] Generate embeddings
- [ ] Run verify_setup.py
- [ ] Run update script (will skip existing)

---

## 📊 Quick Stats

Fill in after upload:

- **Total Cards**: _____
- **Categories**: _____
- **Upload Date**: _____
- **Time Taken**: _____
- **Success Rate**: _____%

---

## ✅ Final Checks

- [ ] All cards uploaded successfully
- [ ] Data verified in Supabase
- [ ] Application updated (if needed)
- [ ] Documentation updated
- [ ] Backup created (if needed)
- [ ] Team notified (if applicable)

---

## 🎉 Success!

- [ ] sw_templates table populated
- [ ] Cards accessible in application
- [ ] Search functionality working
- [ ] Ready for production!

---

**Save this checklist and check off items as you go!**

Print or keep open during upload process for reference.

