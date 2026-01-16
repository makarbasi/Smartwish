# Supabase Integration Setup Guide

## Overview
This guide will help you set up Supabase integration for the SmartWish application. The backend is already configured to use Supabase when credentials are available, with automatic fallback to file-based storage.

## Prerequisites
1. A Supabase account (free tier available)
2. Node.js and npm installed
3. The backend dependencies installed (`npm install`)

## Step 1: Create a Supabase Project

1. Go to [https://supabase.com](https://supabase.com)
2. Sign up or log in to your account
3. Click "New Project"
4. Choose your organization
5. Enter project details:
   - **Name**: `smartwish-db` (or your preferred name)
   - **Database Password**: Create a strong password
   - **Region**: Choose the closest region to your users
6. Click "Create new project"
7. Wait for the project to be created (usually takes 1-2 minutes)

## Step 2: Get Your Supabase Credentials

1. In your Supabase project dashboard, go to **Settings** → **API**
2. Copy the following values:
   - **Project URL** (e.g., `https://your-project-id.supabase.co`)
   - **anon public** key (starts with `eyJ...`)

## Step 3: Set Up Environment Variables

1. Create a `.env` file in the `backend` directory (if it doesn't exist)
2. Add the following variables:

```env
# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here

# Other existing variables...
PORT=3001
NODE_ENV=development
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password
FRONTEND_URL=http://localhost:3000
GEMINI_API_KEY=your-gemini-api-key
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5173,https://smartwish.onrender.com,https://app.smartwish.us
```

## Step 4: Run the Database Migration

1. In your Supabase project dashboard, go to **SQL Editor**
2. Copy the contents of `backend/migrations/001_create_saved_designs_table.sql`
3. Paste it into the SQL Editor
4. Click "Run" to execute the migration

This will create:
- The `saved_designs` table with all necessary columns
- Indexes for better performance
- Row Level Security (RLS) policies
- A trigger for automatic `updated_at` updates
- A `published_designs` view for public access

## Step 5: Test the Integration

1. Start the backend server:
   ```bash
   cd backend
   npm run start:dev
   ```

2. Test saving a design through the frontend
3. Check the backend logs to see if Supabase is being used:
   - Look for "Supabase not available, falling back to file storage" messages
   - If you see this, it means the environment variables aren't set correctly

## Step 6: Verify Data Persistence

1. Save a design through the frontend
2. Check your Supabase dashboard → **Table Editor** → **saved_designs**
3. You should see your saved design in the database

## Troubleshooting

### "Supabase not configured" errors
- Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set correctly
- Verify the environment variables are loaded (check backend logs)

### Database connection errors
- Ensure your Supabase project is active
- Check that the migration was run successfully
- Verify the RLS policies are in place

### Permission errors
- Make sure the `anon` key has the correct permissions
- Check that the RLS policies allow the operations you're trying to perform

## Migration from File Storage

If you have existing designs in file storage that you want to migrate to Supabase:

1. The system will automatically use Supabase for new saves
2. Existing designs will remain in file storage
3. You can manually migrate by:
   - Reading the file storage designs
   - Saving them again through the API (they'll go to Supabase)

## Production Deployment

For production deployment:

1. Set up environment variables in your hosting platform
2. Use a strong `JWT_SECRET`
3. Configure proper CORS origins
4. Set `NODE_ENV=production`

## API Endpoints

The following endpoints are now available:

### Save Design
- `POST /saved-designs`
- Saves a design to Supabase (with file fallback)

### Get User Designs
- `GET /saved-designs`
- Retrieves all designs for the authenticated user

### Get Design by ID
- `GET /saved-designs/:id`
- Retrieves a specific design

### Update Design
- `PUT /saved-designs/:id`
- Updates a design

### Delete Design
- `DELETE /saved-designs/:id`
- Deletes a design

### Publish Design
- `POST /saved-designs/:id/publish`
- Publishes a design (sets status to 'published')

### Unpublish Design
- `POST /saved-designs/:id/unpublish`
- Unpublishes a design (sets status to 'draft')

### Get Published Designs
- `GET /saved-designs/published/all`
- Retrieves all published designs (public endpoint)

## Security Features

- **Row Level Security (RLS)**: Users can only access their own designs
- **Authentication Required**: Most endpoints require JWT authentication
- **Public Access**: Published designs can be accessed without authentication
- **Automatic Timestamps**: `created_at` and `updated_at` are managed automatically

## Performance Considerations

- **Indexes**: Created on `user_id`, `category`, `status`, and `created_at`
- **JSONB**: Design data is stored as JSONB for efficient querying
- **Views**: `published_designs` view for efficient public access

## Next Steps

1. Test the integration thoroughly
2. Monitor the Supabase dashboard for any issues
3. Consider setting up monitoring and alerts
4. Plan for data backup strategies
5. Consider implementing caching for frequently accessed designs
