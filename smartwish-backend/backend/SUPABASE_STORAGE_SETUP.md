# Supabase Storage Setup Guide

## 🚀 **Cloud Storage for SmartWish Images**

This guide will help you set up Supabase Storage to store your card images in the cloud, making them accessible from anywhere.

## 📋 **Step 1: Create Storage Bucket**

1. **Go to your Supabase Dashboard**
2. **Navigate to "Storage"** in the left sidebar
3. **Click "Create a new bucket"**
4. **Configure the bucket:**
   - **Name:** `smartwish-assets`
   - **Public bucket:** ✅ **Check this** (so images can be accessed publicly)
   - **File size limit:** `50 MB` (or your preferred limit)
   - **Allowed MIME types:** `image/*` (or leave empty for all types)

## 📋 **Step 2: Set Storage Policies**

After creating the bucket, set up RLS policies:

```sql
-- Allow authenticated users to upload images
CREATE POLICY "Users can upload images" ON storage.objects
    FOR INSERT WITH CHECK (bucket_id = 'smartwish-assets');

-- Allow public read access to images
CREATE POLICY "Public read access" ON storage.objects
    FOR SELECT USING (bucket_id = 'smartwish-assets');

-- Allow users to update their own images
CREATE POLICY "Users can update own images" ON storage.objects
    FOR UPDATE USING (bucket_id = 'smartwish-assets');

-- Allow users to delete their own images
CREATE POLICY "Users can delete own images" ON storage.objects
    FOR DELETE USING (bucket_id = 'smartwish-assets');
```

## 📋 **Step 3: Verify Environment Variables**

Make sure your `.env` file has:

```env
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

## 📋 **Step 4: Test the Setup**

1. **Restart your backend**
2. **Create and save a card**
3. **Check the backend logs** - should see "✅ Supabase Storage service initialized"
4. **Check "My Cards"** - should display cloud-stored images
5. **Check Supabase Storage** - should see uploaded images in the bucket

## 🎯 **Benefits of Cloud Storage**

✅ **Global Access** - Images accessible from anywhere
✅ **No Local Storage** - No server disk space needed
✅ **CDN Delivery** - Fast image loading worldwide
✅ **Automatic Backup** - Images backed up by Supabase
✅ **Scalable** - Handles unlimited images
✅ **Public URLs** - Direct access to images

## 📁 **Storage Structure**

Images will be stored in this structure:
```
smartwish-assets/
├── users/
│   ├── 3/
│   │   └── designs/
│   │       └── 1754707261161/
│   │           ├── page_1.png
│   │           ├── page_2.png
│   │           └── page_3.png
│   └── 1/
│       └── designs/
│           └── 1754707261162/
│               ├── page_1.png
│               └── page_2.png
```

## 🔧 **Alternative Cloud Providers**

If you prefer other cloud providers, I can implement:

- **AWS S3** - Most popular, highly scalable
- **Google Cloud Storage** - Good integration with other Google services
- **Azure Blob Storage** - Microsoft's cloud storage
- **Cloudinary** - Specialized for image optimization

Just let me know which one you'd prefer!

## 🚨 **Troubleshooting**

### **Error: "Cloud storage not configured"**
- Check your `.env` file has correct Supabase credentials
- Verify the bucket name is `smartwish-assets`
- Ensure bucket is public

### **Error: "Failed to upload image to cloud storage"**
- Check Supabase Storage policies
- Verify service role key has storage permissions
- Check network connectivity

### **Images not displaying**
- Verify bucket is public
- Check image URLs in browser console
- Ensure CORS is configured properly

## 📊 **Storage Costs**

Supabase Storage pricing:
- **Free tier:** 1 GB storage, 2 GB bandwidth/month
- **Pro tier:** $25/month for 100 GB storage
- **Pay-as-you-go:** $0.021/GB/month

For most users, the free tier is sufficient for thousands of card images.

## 🎉 **Next Steps**

After setup:
1. **Test saving a card** - should upload to cloud
2. **Check "My Cards"** - should show cloud images
3. **Try from different device** - images should load anywhere
4. **Monitor storage usage** - in Supabase dashboard

**Your images are now stored in the cloud and accessible from anywhere!** 🌟

