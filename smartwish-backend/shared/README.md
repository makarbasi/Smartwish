# SmartWish Template System

## Overview

The SmartWish Template System is a centralized, production-ready solution for managing greeting card templates and categories across the entire application. This system provides a single source of truth for all template definitions, ensuring consistency between frontend and backend components.

## Architecture

### 🏗️ Structure

```
shared/
├── constants/
│   └── templates.js          # Main template definitions and utilities
├── types/
│   └── templates.ts          # TypeScript type definitions
└── README.md                 # This documentation

backend/src/templates/
├── templates.service.ts      # Backend service layer
├── templates.controller.ts   # REST API endpoints
└── templates.module.ts       # NestJS module

frontend/src/services/
└── templateService.js        # Frontend service with API integration
```

### 🎯 Key Features

- **Single Source of Truth**: All templates and categories defined in one place
- **Type Safety**: Full TypeScript support with comprehensive type definitions
- **API Integration**: RESTful endpoints for template operations
- **Fallback Support**: Local fallback when API is unavailable
- **Search Functionality**: Advanced template search with keyword matching
- **Validation**: Built-in template structure validation
- **Production Ready**: Optimized for performance and scalability

## Template Structure

### Template Definition

```javascript
{
  id: 'temp1',                    // Unique identifier
  title: 'Vibrant Birthday',      // Display name
  category: 'birthday',           // Category ID
  description: 'Birthday card..', // Detailed description
  searchKeywords: ['birthday', 'vibrant', 'balloons'],
  pages: [                        // Template pages
    {
      header: 'Happy Birthday!',
      image: 'images/temp1.png',
      text: 'Birthday celebration text',
      footer: '1'
    }
    // ... more pages
  ]
}
```

### Category Definition

```javascript
{
  id: 'birthday',
  name: 'Birthday',
  displayName: 'Birthday',
  description: 'Celebrate special birthdays...',
  coverImage: '/images/img-cover-1.jpg',
  templateCount: 4,
  sortOrder: 1
}
```

## API Endpoints

### Templates

- `GET /api/templates` - Get all templates with filtering
- `GET /api/templates/:id` - Get specific template
- `GET /api/templates/category/:categoryId` - Get templates by category
- `GET /api/templates/search/:searchTerm` - Search templates
- `POST /api/templates/validate` - Validate template structure
- `GET /api/templates/stats` - Get template statistics

### Categories

- `GET /api/categories` - Get all categories
- `GET /api/categories/:id` - Get specific category
- `GET /api/categories/names` - Get category names for dropdowns

## Usage Examples

### Frontend Service Usage

```javascript
import templateService from '../services/templateService.js';

// Get all templates
const templates = await templateService.getAllTemplates();

// Search templates
const results = await templateService.searchTemplates('birthday');

// Get templates by category
const birthdayTemplates = await templateService.getTemplatesByCategory('birthday');

// Get categories
const categories = await templateService.getAllCategories();
```

### Backend Service Usage

```typescript
import { TemplatesService } from './templates/templates.service';

@Controller()
export class MyController {
  constructor(private templatesService: TemplatesService) {}

  @Get('my-templates')
  async getMyTemplates() {
    return await this.templatesService.getAllTemplates({
      category: 'birthday',
      sortBy: 'title'
    });
  }
}
```

## Available Categories

1. **Birthday** - Vibrant birthday celebrations
2. **Anniversary** - Romantic anniversary designs
3. **Congratulations** - Achievement celebrations
4. **Thank You** - Gratitude expressions
5. **Sympathy** - Thoughtful condolence cards
6. **Wedding** - Wedding celebrations
7. **Graduation** - Academic achievements
8. **Holiday** - Festive celebrations

## Available Templates

### Birthday Templates (temp1-temp4)
- `temp1`: Vibrant Birthday Celebration
- `temp2`: Classic Birthday Card
- `temp3`: Minimalist Birthday
- `temp4`: Girly Birthday Celebration

### Anniversary Templates (temp5-temp8)
- `temp5`: Romantic Anniversary
- `temp6`: Couple Anniversary Card
- `temp7`: Detailed Anniversary Story
- `temp8`: Cartoon Anniversary

### Congratulations Templates (temp9-temp12)
- `temp9`: Achievement Congratulations
- `temp10`: Celebration Congratulations
- `temp11`: Professional Congratulations
- `temp12`: Personal Congratulations

## Utility Functions

### Template Operations
- `getAllTemplates()` - Get all templates
- `getTemplateById(id)` - Get specific template
- `getTemplatesByCategory(categoryId)` - Filter by category
- `searchTemplates(searchTerm)` - Search functionality
- `validateTemplate(template)` - Structure validation

### Category Operations
- `getAllCategories()` - Get all categories
- `getCategoryById(id)` - Get specific category
- `getCategoryNames()` - Get names for dropdowns

### Statistics
- `getTemplateStats()` - Get comprehensive statistics

## Integration Guide

### 1. Backend Integration

Add to your NestJS module:

```typescript
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [TemplatesModule],
})
export class AppModule {}
```

### 2. Frontend Integration

Import and use the service:

```javascript
import templateService from './services/templateService.js';

// In your component
useEffect(() => {
  const loadTemplates = async () => {
    const templates = await templateService.getAllTemplates();
    setTemplates(templates);
  };
  loadTemplates();
}, []);
```

### 3. Search Integration

Update your search functionality:

```javascript
const handleSearch = async (searchTerm) => {
  const results = await templateService.searchTemplates(searchTerm);
  setSearchResults(results);
};
```

## Migration Guide

### From Old System

1. **Replace hardcoded template arrays** with service calls
2. **Update category definitions** to use centralized categories
3. **Replace template search logic** with centralized search
4. **Update validation logic** to use centralized validation

### Example Migration

**Before:**
```javascript
const templates = {
  temp1: { title: "Template 1", ... },
  // ... hardcoded templates
};
```

**After:**
```javascript
const templates = await templateService.getAllTemplates();
```

## Performance Considerations

- **Caching**: Templates are cached for optimal performance
- **Lazy Loading**: Templates loaded on demand
- **Fallback**: Local fallback prevents API failures
- **Compression**: Optimized data structures

## Development

### Adding New Templates

1. Add template definition to `shared/constants/templates.js`
2. Update template count in category
3. Add corresponding image assets
4. Test with validation function

### Adding New Categories

1. Add category to `CATEGORIES` object
2. Update sort order
3. Add cover image
4. Update template assignments

## Testing

The system includes comprehensive validation:

```javascript
import { validateTemplate } from '../constants/templates.js';

const isValid = validateTemplate(myTemplate);
console.log('Template is valid:', isValid);
```

## Production Deployment

1. **Environment Variables**: Configure API URLs
2. **Asset Optimization**: Optimize template images
3. **Caching Strategy**: Implement appropriate caching
4. **Monitoring**: Monitor template usage and performance

## Support

For questions or issues with the template system:

1. Check this documentation
2. Review the type definitions in `shared/types/templates.ts`
3. Examine the service implementations
4. Test with the validation utilities

---

**Version**: 1.0.0  
**Last Updated**: 2025-07-19  
**Author**: SmartWish Team
