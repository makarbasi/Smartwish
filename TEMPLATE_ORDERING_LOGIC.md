# 📋 Template Display & Ordering Logic

## 🔍 How Templates Are Shown on `/templates` Page

### Summary
Templates are **NOT random** - they are sorted by **newest first** (most recently published).

---

## 📊 The Flow

### 1. Frontend Request
```typescript
// smartwish-frontend/src/app/templates/page.tsx
const apiUrl = `/api/templates${queryString ? `?${queryString}` : ""}`
```

### 2. Next.js API Route
```typescript
// smartwish-frontend/src/app/api/templates/route.ts
if (categoryId && !query && !region && !language && !author) {
  // Simple category filtering
  apiUrl = `/api/simple-templates/category/${categoryId}`
} else {
  // Enhanced search (including no filters)
  apiUrl = `/templates-enhanced/templates/search`
}
```

### 3. Backend Processing

#### Route A: Simple Category Filter
```typescript
// smartwish-backend/backend/src/templates/simple-templates.controller.ts
// Line 72
ORDER BY t.published_at DESC
```
**Ordering:** Newest published first

#### Route B: Enhanced Search (Most Common)
```typescript
// smartwish-backend/backend/src/templates/supabase-templates-enhanced.service.ts
// Line 557
.order('published_at', { ascending: false })
```
**Ordering:** Newest published first

---

## 🎯 Sorting Strategy

### Current Logic: **Published Date (Newest First)**

```sql
ORDER BY published_at DESC
```

**What this means:**
- ✅ Newest templates appear first
- ✅ Recently published content gets visibility
- ✅ Consistent ordering across all pages
- ❌ Popular/downloaded templates might be buried
- ❌ Quality not factored into ordering

---

## 📈 Alternative Sorting Options Available

The system supports multiple sorting fields, though not currently exposed in the UI:

### Available in `templates.service.ts`:
```typescript
const validSortFields = [
  'title',           // Alphabetical
  'created_at',      // When created
  'updated_at',      // When last modified
  'popularity',      // Number of likes/ratings
  'num_downloads',   // Download count
  'price',           // Price (low to high / high to low)
]
```

### Template Bundles Also Support:
```typescript
switch (filters.sortBy) {
  case 'newest':         // Most recent
  case 'price_low':      // Cheapest first
  case 'price_high':     // Most expensive first
  case 'savings':        // Best savings
  default:               // Most downloaded
}
```

---

## 🔮 Potential Improvements

### 1. **Popularity-Based Sorting**
```sql
ORDER BY popularity DESC, published_at DESC
```
Show most-liked templates first, then newest

### 2. **Download-Based Sorting**
```sql
ORDER BY num_downloads DESC, published_at DESC
```
Show most popular/proven templates first

### 3. **Smart Hybrid Sorting**
```sql
ORDER BY (popularity * 0.5 + num_downloads * 0.3 + DAYS_SINCE_PUBLISH * 0.2) DESC
```
Balance popularity, downloads, and freshness

### 4. **Personalized Sorting** (Future)
- Based on user's past purchases
- Based on user's browsing history
- Based on similar users' preferences

### 5. **Featured/Promoted Templates**
```sql
ORDER BY is_featured DESC, popularity DESC, published_at DESC
```
Show hand-picked featured templates at the top

---

## 💡 For Kiosk Mode

### Current Behavior:
- Same sorting as regular mode (newest first)
- All templates visible
- 9 templates per page

### Kiosk-Specific Recommendations:

1. **Show Most Popular First**
   - Kiosk users browse quickly
   - Popular = proven & liked
   - Better conversion rates

2. **Promote Seasonal/Event-Based**
   - Christmas templates in December
   - Birthday templates always visible
   - Regional holidays based on location

3. **Shorter Pagination**
   - Fewer pages (people don't scroll much on kiosks)
   - Show 12-15 top templates
   - "Load More" button instead of pagination

4. **Category-First Approach**
   - Large category buttons
   - Show top 3 from each category
   - Visual category browsing

---

## 🛠️ How to Change Sorting

### Backend Changes:

**File:** `smartwish-backend/backend/src/templates/supabase-templates-enhanced.service.ts`

**Current (Line 557):**
```typescript
.order('published_at', { ascending: false })
```

**Change to Popularity:**
```typescript
.order('popularity', { ascending: false })
.order('published_at', { ascending: false })  // Secondary sort
```

**Change to Downloads:**
```typescript
.order('num_downloads', { ascending: false })
.order('published_at', { ascending: false })
```

**Hybrid Approach:**
```typescript
// Would need a computed column in the database
// Or fetch and sort in memory:
const templates = await queryBuilder;
return templates.sort((a, b) => {
  const scoreA = (a.popularity * 0.5) + (a.num_downloads * 0.3);
  const scoreB = (b.popularity * 0.5) + (b.num_downloads * 0.3);
  return scoreB - scoreA;
});
```

---

## 📊 Current Database Schema

Templates have these sortable fields:
```typescript
{
  id: string
  title: string
  published_at: Date       // ⭐ Currently used for sorting
  created_at: Date
  updated_at: Date
  popularity: number       // 💡 Could be used (likes/ratings)
  num_downloads: number    // 💡 Could be used (popularity)
  price: number
  status: string           // 'published' | 'draft' | 'archived'
  region: string
  language: string
  category_id: string
  author_id: string
}
```

---

## 🎯 Recommendation for Kiosk

**Change ordering to:**
```typescript
// For better kiosk experience
.order('num_downloads', { ascending: false })
.order('popularity', { ascending: false })
.order('published_at', { ascending: false })
```

**Why?**
1. **Downloads** - Proven templates that people actually use
2. **Popularity** - Templates people like (secondary indicator)
3. **Recency** - Tie-breaker for templates with same downloads/popularity

This would show the most successful templates first, which is what kiosk users want to see.

---

## 🔄 No Randomization

**Important:** Templates are NOT fetched randomly. The order is deterministic based on `published_at DESC`. Every user sees the same order (for the same filters) until new templates are published.

