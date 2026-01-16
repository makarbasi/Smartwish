# Contacts API Setup Instructions

## Overview
The contacts API has been integrated and the backend is ready. However, the database tables need to be created in Supabase.

## Foreign Key Constraint Issue - RESOLVED ✅

**Issue**: The contacts table was trying to reference `users.id` (integer), but the JWT tokens contain UUIDs.

**Solution**: The system now uses `users.uuid_id` (UUID) as the foreign key reference instead of `users.id`.

## Required Database Migrations

Run these SQL migrations **in order** in your Supabase SQL editor:

### 1. Ensure users have uuid_id (Run First)
```sql
-- File: migrations/016_ensure_users_uuid_id.sql
-- This ensures all users have a uuid_id for foreign key references
```
Execute the contents of: `f:\Frontend_Smartwish\smartwish-backend\backend\migrations\016_ensure_users_uuid_id.sql`

### 2. Create contacts tables (Run Second)
```sql
-- File: migrations/017_create_contacts_tables.sql
-- This creates contacts, contact_events, and contact_media tables
```
Execute the contents of: `f:\Frontend_Smartwish\smartwish-backend\backend\migrations\017_create_contacts_tables.sql`

## How the Fix Works

1. **JWT Token**: Contains `sub: user.id` (integer from TypeORM users table)
2. **Service Layer**: Queries `users` table to get `uuid_id` for the integer `id`
3. **Foreign Key**: Uses `uuid_id` to reference the user in contacts table

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

1. **Run the migrations above in Supabase**
2. **Backend is already running** on http://localhost:3001
3. **Frontend can now make authenticated requests** to the contacts API

## Migration Files Created

- `migrations/016_ensure_users_uuid_id.sql` - Ensures uuid_id column exists and is populated
- `migrations/017_create_contacts_tables.sql` - Creates contacts, events, and media tables

## Status: ✅ READY TO TEST

The contacts API integration is complete and ready for testing once the database migrations are run.