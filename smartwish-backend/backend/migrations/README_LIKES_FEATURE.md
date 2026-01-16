# Like Feature Setup Guide

This guide explains how to set up and use the like/favorite feature for templates and saved designs.

## Database Migration

### Running the Migration

Execute the SQL migration to create the necessary tables:

```bash
psql -U your_username -d your_database -f migrations/create_likes_tables.sql
```

Or using a database client:
1. Open your database management tool (pgAdmin, DBeaver, etc.)
2. Execute the contents of `migrations/create_likes_tables.sql`

### What the Migration Creates

1. **sw_template_likes** table:
   - Tracks user likes for templates
   - Unique constraint: one like per user per template
   - Automatically updates template popularity

2. **saved_design_likes** table:
   - Tracks user likes for published saved designs
   - Unique constraint: one like per user per design
   - Automatically updates design popularity

3. **Helper Functions**:
   - `get_template_likes_count(template_id)` - Get like count for a template
   - `get_saved_design_likes_count(design_id)` - Get like count for a design
   - `has_user_liked_template(template_id, user_id)` - Check if user liked a template
   - `has_user_liked_design(design_id, user_id)` - Check if user liked a design

## API Endpoints

### Template Likes

**Like a template:**
```http
POST /api/templates/:id/like
Authorization: Bearer <token>
```

**Unlike a template:**
```http
DELETE /api/templates/:id/like
Authorization: Bearer <token>
```

**Get like status:**
```http
GET /api/templates/:id/like-status
Authorization: Bearer <token>
```

**Batch status (for multiple templates):**
```http
GET /api/templates/likes/batch-status?ids=id1,id2,id3
Authorization: Bearer <token>
```

**Get user's liked templates:**
```http
GET /api/templates/likes/user
Authorization: Bearer <token>
```

### Saved Design Likes

**Like a design:**
```http
POST /api/saved-designs/:id/like
Authorization: Bearer <token>
```

**Unlike a design:**
```http
DELETE /api/saved-designs/:id/like
Authorization: Bearer <token>
```

**Get like status:**
```http
GET /api/saved-designs/:id/like-status
Authorization: Bearer <token>
```

**Batch status (for multiple designs):**
```http
GET /api/saved-designs/likes/batch-status?ids=id1,id2,id3
Authorization: Bearer <token>
```

**Get user's liked designs:**
```http
GET /api/saved-designs/likes/user
Authorization: Bearer <token>
```

## Frontend Usage

### Template Cards

The `TemplateCard` component automatically handles likes:

- Shows outline heart when not liked
- Shows filled red heart when liked
- Displays like count
- Optimistic updates for instant feedback
- Requires authentication

### How Popularity Works

- Each like increments the `popularity` field by 1
- Each unlike decrements the `popularity` field by 1
- Popularity never goes below 0
- Higher popularity = more discoverable in search/sort

## Testing the Feature

1. **Setup**:
   ```bash
   # Run the migration
   psql -U postgres -d smartwish -f migrations/create_likes_tables.sql
   
   # Restart your backend
   npm run start:dev
   ```

2. **Test in Browser**:
   - Navigate to `/templates`
   - Login as a user
   - Click the heart icon on any template card
   - The heart should turn red and the count should increase
   - Click again to unlike
   - Refresh the page - your like status should persist

3. **Verify in Database**:
   ```sql
   -- Check likes for a specific template
   SELECT * FROM sw_template_likes WHERE template_id = 'your-template-id';
   
   -- Check template popularity
   SELECT id, title, popularity FROM sw_templates WHERE id = 'your-template-id';
   
   -- Check likes count
   SELECT get_template_likes_count('your-template-id');
   ```

## Architecture

### Backend

- **Entities**: `TemplateLike`, `SavedDesignLike`
- **Services**: `TemplateLikesService`, `SavedDesignLikesService`
- **Controllers**: `TemplateLikesController`, `SavedDesignLikesController`
- **Modules**: Registered in `TemplatesModule` and `SavedDesignsModule`

### Frontend

- **Components**: `TemplateCard` with like button
- **State Management**: Local state + server sync
- **Authentication**: Requires logged-in user
- **UX**: Optimistic updates with error rollback

## Troubleshooting

### "Template already liked" error
- This is a conflict error (HTTP 409)
- Occurs when trying to like something already liked
- Frontend should handle this gracefully

### Like count doesn't update
- Check if the migration was run successfully
- Verify the user is authenticated
- Check browser console for errors
- Verify API endpoints are accessible

### Migration fails
- Ensure tables `sw_templates` and `saved_designs` exist
- Check if tables already exist (migration is idempotent)
- Verify database user has CREATE TABLE permissions

## Future Enhancements

- [ ] Add "My Liked Templates" page
- [ ] Add like sorting option
- [ ] Add "Most Liked" category
- [ ] Add like notifications for creators
- [ ] Add analytics for like trends







