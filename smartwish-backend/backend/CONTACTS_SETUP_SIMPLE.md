# Contacts API Setup Instructions (Reverted to Simple Approach)

## Overview
The contacts API has been **reverted to a simple, working state** that avoids foreign key constraint issues.

## What Changed (Reverted) ✅

- **Removed complex UUID lookup logic**
- **Uses userId directly from JWT token**
- **No foreign key constraints in database**
- **Simple text-based user_id column**

## Required Database Migration

Run this **single SQL migration** in your Supabase SQL editor:

### Create contacts tables (Simple version)
```sql
-- File: migrations/018_create_contacts_simple.sql
-- This creates contacts, contact_events, and contact_media tables without foreign key constraints
```
Execute the contents of: `f:\Frontend_Smartwish\smartwish-backend\backend\migrations\018_create_contacts_simple.sql`

## How It Works Now

1. **JWT Token**: Contains the user identifier in the `sub` field
2. **Service Layer**: Uses `userId` directly without conversion
3. **Database**: Stores `user_id` as TEXT (supports any identifier format)
4. **No Foreign Keys**: Avoids all constraint issues

## Database Schema (Simple)

```sql
CREATE TABLE contacts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL,  -- Simple text field, no constraints
    first_name VARCHAR(255),
    last_name VARCHAR(255),
    email VARCHAR(255),
    -- ... other fields
);
```

## API Endpoints Available

All endpoints require JWT authentication:

- `POST /contacts` - Create a new contact
- `GET /contacts` - Get all contacts for the authenticated user  
- `GET /contacts/:id` - Get a specific contact
- `PUT /contacts/:id` - Update a contact
- `DELETE /contacts/:id` - Delete a contact
- `POST /contacts/:contactId/events` - Add an event to a contact
- `PUT /contacts/events/:eventId` - Update an event
- `DELETE /contacts/events/:eventId` - Delete an event
- `GET /contacts/calendar/upcoming` - Get upcoming events
- `POST /contacts/:contactId/media` - Upload media for a contact
- `GET /contacts/media/:mediaId` - Get media file
- `DELETE /contacts/media/:mediaId` - Delete media
- `GET /contacts/search/:query` - Search contacts

## Frontend Integration

The frontend has been updated to use the request utilities with JWT authentication:

- Uses `authGet`, `postRequest`, `putRequest`, `deleteRequest` from `request_utils.ts`
- All API calls include the JWT token automatically
- Error handling and logging implemented
- Contact types updated to use string UUIDs instead of numbers

## Testing

1. **Run the simple migration above in Supabase**
2. **Backend is running** on http://localhost:3001
3. **Test the contacts API** - should work without foreign key errors

## Migration Files

- `migrations/018_create_contacts_simple.sql` - Simple contacts tables without constraints

## Status: ✅ READY TO TEST

The contacts API has been reverted to a simple, working state that avoids all foreign key constraint issues.