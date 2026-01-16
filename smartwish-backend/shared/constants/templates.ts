/**
 * SMARTWISH TEMPLATE SYSTEM - SINGLE SOURCE OF TRUTH
 * 
 * This file contains all template definitions, categories, and mappings
 * Used by both frontend and backend for consistency
 * 
 * @version 1.0.0
 * @author SmartWish Team
 */

// Import types for better type safety
import type { Template, Category, TemplatePage, TemplateStats, ValidationResult } from '../types/templates';

// ===== CATEGORIES DEFINITION =====
export const CATEGORIES: Record<string, Category> = {
  BIRTHDAY: {
    id: 'birthday',
    name: 'Birthday',
    displayName: 'Birthday',
    description: 'Celebrate special birthdays with vibrant and fun designs',
    coverImage: '/images/img-cover-1.jpg',
    templateCount: 12, // Updated to include all new templates (temp1-4 + temp21-28)
    sortOrder: 1
  },
  ANNIVERSARY: {
    id: 'anniversary',
    name: 'Anniversary',
    displayName: 'Anniversary',
    description: 'Romantic and elegant designs for anniversaries',
    coverImage: '/images/img-cover-2.jpg',
    templateCount: 4,
    sortOrder: 2
  },
  CONGRATULATIONS: {
    id: 'congratulations',
    name: 'Congratulations',
    displayName: 'Congratulations',
    description: 'Celebrate achievements and milestones',
    coverImage: '/images/img-cover-3.jpg',
    templateCount: 4,
    sortOrder: 3
  },
  THANK_YOU: {
    id: 'thankYou',
    name: 'Thank You',
    displayName: 'Thank You',
    description: 'Express gratitude with heartfelt designs',
    coverImage: '/images/img-cover-4.jpg',
    templateCount: 4,
    sortOrder: 4
  },
  SYMPATHY: {
    id: 'sympathy',
    name: 'Sympathy',
    displayName: 'Sympathy',
    description: 'Thoughtful designs for difficult times',
    coverImage: '/images/img-cover-5.jpg',
    templateCount: 4,
    sortOrder: 5
  },
  WEDDING: {
    id: 'wedding',
    name: 'Wedding',
    displayName: 'Wedding',
    description: 'Beautiful designs for wedding celebrations',
    coverImage: '/images/img-cover-6.jpg',
    templateCount: 4,
    sortOrder: 6
  },
  GRADUATION: {
    id: 'graduation',
    name: 'Graduation',
    displayName: 'Graduation',
    description: 'Celebrate academic achievements',
    coverImage: '/images/img-cover-7.jpg',
    templateCount: 4,
    sortOrder: 7
  },
  HOLIDAY: {
    id: 'holiday',
    name: 'Holiday',
    displayName: 'Holiday',
    description: 'Festive designs for holiday celebrations',
    coverImage: '/images/img-cover-8.jpg',
    templateCount: 4,
    sortOrder: 8
  }
};

// ===== TEMPLATE DEFINITIONS =====
export const TEMPLATES: Record<string, Template> = {
  // BIRTHDAY TEMPLATES (temp1-temp4)
  temp1: {
    id: 'temp1',
    title: 'Vibrant Birthday Celebration',
    category: CATEGORIES.BIRTHDAY.id,
    description: 'Birthday card with vibrant colors, fun design, balloons, and gifts. Perfect for birthday celebrations.',
    searchKeywords: ['birthday', 'vibrant', 'colorful', 'balloons', 'gifts', 'celebration', 'party'],
    upload_time: '2024-01-15T10:30:00Z',
    author: 'SmartWish',
    price: 2.99,
    language: 'en',
    region: 'US',
    popularity: 95,
    num_downloads: 1247,
    pages: [
      {
        header: 'Happy Birthday!',
        image: 'images/temp1.png',
        text: 'Birthday, vibrant colors, and a fun design, Balloons, gifts',
        footer: '1'
      },
      {
        header: 'Celebrate Today',
        image: 'images/blank.jpg',
        text: 'Birthday, big text',
        footer: '2'
      },
      {
        header: 'Special Day',
        image: 'images/blank.jpg',
        text: 'Birthday, simple, mono color',
        footer: '3'
      },
      {
        header: 'Birthday Wishes',
        image: 'images/blank_logo.png',
        text: 'Birthday, girly, Balloons, cake',
        footer: '4'
      }
    ]
  },
  temp2: {
    id: 'temp2',
    title: 'Classic Birthday Card',
    category: CATEGORIES.BIRTHDAY.id,
    description: 'Simple and elegant birthday design with big text and classic styling.',
    searchKeywords: ['birthday', 'classic', 'simple', 'elegant', 'traditional'],
    upload_time: '2024-01-20T14:15:00Z',
    author: 'Emma Rodriguez',
    price: 1.99,
    language: 'en',
    region: 'US',
    popularity: 87,
    num_downloads: 892,
    pages: [
      {
        header: 'Birthday Greetings',
        image: 'images/temp2.jpg',
        text: 'Birthday, big text',
        footer: '1'
      },
      {
        header: 'Another Year',
        image: 'images/blank.png',
        text: 'Birthday celebration',
        footer: '2'
      },
      {
        header: 'Special Moment',
        image: 'images/blank.png',
        text: 'Birthday wishes',
        footer: '3'
      },
      {
        header: 'Celebrate',
        image: 'images/blank_logo.png',
        text: 'Birthday joy',
        footer: '4'
      }
    ]
  },
  temp3: {
    id: 'temp3',
    title: 'Minimalist Birthday',
    category: CATEGORIES.BIRTHDAY.id,
    description: 'Clean and minimalist birthday design with simple, mono color theme.',
    searchKeywords: ['birthday', 'minimalist', 'simple', 'clean', 'mono', 'modern'],
    upload_time: '2024-02-05T09:45:00Z',
    author: 'SmartWish',
    price: 0.99,
    language: 'en',
    region: 'US',
    popularity: 78,
    num_downloads: 654,
    pages: [
      {
        header: 'Simple Birthday',
        image: 'images/temp3.jpg',
        text: 'Birthday, simple, mono color',
        footer: '1'
      },
      {
        header: 'Clean Design',
        image: 'images/blank.png',
        text: 'Minimalist birthday',
        footer: '2'
      },
      {
        header: 'Modern Style',
        image: 'images/blank.png',
        text: 'Contemporary birthday',
        footer: '3'
      },
      {
        header: 'Elegant',
        image: 'images/blank_logo.png',
        text: 'Sophisticated birthday',
        footer: '4'
      }
    ]
  },
  temp4: {
    id: 'temp4',
    title: 'Girly Birthday Celebration',
    category: CATEGORIES.BIRTHDAY.id,
    description: 'Feminine birthday design with balloons, cake, and girly elements.',
    searchKeywords: ['birthday', 'girly', 'feminine', 'balloons', 'cake', 'pink', 'cute'],
    upload_time: '2024-02-10T16:20:00Z',
    author: 'Alex Thompson',
    price: 3.49,
    language: 'en',
    region: 'US',
    popularity: 92,
    num_downloads: 1103,
    pages: [
      {
        header: 'Sweet Birthday',
        image: 'images/temp4.jpg',
        text: 'Birthday, girly, Balloons, cake',
        footer: '1'
      },
      {
        header: 'Princess Day',
        image: 'images/blank.png',
        text: 'Girly birthday celebration',
        footer: '2'
      },
      {
        header: 'Sweet Treats',
        image: 'images/blank.png',
        text: 'Birthday cake and balloons',
        footer: '3'
      },
      {
        header: 'Special Girl',
        image: 'images/blank_logo.png',
        text: 'Feminine birthday wishes',
        footer: '4'
      }
    ]
  },

  // ANNIVERSARY TEMPLATES (temp5-temp8)
  temp5: {
    id: 'temp5',
    title: 'Romantic Anniversary',
    category: CATEGORIES.ANNIVERSARY.id,
    description: 'Romantic anniversary design with flowers and big text for couples.',
    searchKeywords: ['anniversary', 'romantic', 'flowers', 'love', 'couple', 'romance'],
    upload_time: '2024-02-15T11:30:00Z',
    author: 'SmartWish',
    price: 2.49,
    language: 'en',
    region: 'US',
    popularity: 89,
    num_downloads: 756,
    pages: [
      {
        header: 'Happy Anniversary',
        image: 'images/temp5.jpg',
        text: 'Anniversary, big text, flowers',
        footer: '1'
      },
      {
        header: 'Love Story',
        image: 'images/blank.png',
        text: 'Anniversary, couple, big text',
        footer: '2'
      },
      {
        header: 'Together Forever',
        image: 'images/blank.png',
        text: 'Anniversary, lots of text, couples',
        footer: '3'
      },
      {
        header: 'Eternal Love',
        image: 'images/blank_logo.png',
        text: 'Anniversary, cartoon, couples',
        footer: '4'
      }
    ]
  },
  temp6: {
    id: 'temp6',
    title: 'Couple Anniversary Card',
    category: CATEGORIES.ANNIVERSARY.id,
    description: 'Anniversary card focused on couples with big text and romantic elements.',
    searchKeywords: ['anniversary', 'couple', 'together', 'love', 'relationship'],
    upload_time: '2024-02-18T14:45:00Z',
    author: 'Maria Garcia',
    price: 1.79,
    language: 'en',
    region: 'US',
    popularity: 76,
    num_downloads: 432,
    pages: [
      {
        header: 'Our Anniversary',
        image: 'images/temp6.jpg',
        text: 'Anniversary, couple, big text',
        footer: '1'
      },
      {
        header: 'Years Together',
        image: 'images/blank.png',
        text: 'Anniversary celebration',
        footer: '2'
      },
      {
        header: 'Love Grows',
        image: 'images/blank.png',
        text: 'Anniversary memories',
        footer: '3'
      },
      {
        header: 'Forever Yours',
        image: 'images/blank_logo.png',
        text: 'Anniversary love',
        footer: '4'
      }
    ]
  },
  temp7: {
    id: 'temp7',
    title: 'Detailed Anniversary Story',
    category: CATEGORIES.ANNIVERSARY.id,
    description: 'Anniversary card with lots of text space for sharing your love story.',
    searchKeywords: ['anniversary', 'story', 'detailed', 'text', 'memories', 'journey'],
    pages: [
      {
        header: 'Our Journey',
        image: 'images/temp7.jpg',
        text: 'Anniversary, lots of text, couples',
        footer: '1'
      },
      {
        header: 'Love Story',
        image: 'images/blank.png',
        text: 'Anniversary memories and milestones',
        footer: '2'
      },
      {
        header: 'Through the Years',
        image: 'images/blank.png',
        text: 'Anniversary journey together',
        footer: '3'
      },
      {
        header: 'Our Future',
        image: 'images/blank_logo.png',
        text: 'Anniversary dreams and plans',
        footer: '4'
      }
    ]
  },
  temp8: {
    id: 'temp8',
    title: 'Cartoon Anniversary',
    category: CATEGORIES.ANNIVERSARY.id,
    description: 'Fun cartoon-style anniversary card perfect for playful couples.',
    searchKeywords: ['anniversary', 'cartoon', 'fun', 'playful', 'cute', 'animated'],
    pages: [
      {
        header: 'Cartoon Love',
        image: 'images/temp8.jpg',
        text: 'Anniversary, cartoon, couples',
        footer: '1'
      },
      {
        header: 'Fun Together',
        image: 'images/blank.png',
        text: 'Playful anniversary',
        footer: '2'
      },
      {
        header: 'Cute Couple',
        image: 'images/blank.png',
        text: 'Cartoon anniversary',
        footer: '3'
      },
      {
        header: 'Happy Pair',
        image: 'images/blank_logo.png',
        text: 'Fun anniversary celebration',
        footer: '4'
      }
    ]
  },

  // CONGRATULATIONS TEMPLATES (temp9-temp12)
  temp9: {
    id: 'temp9',
    title: 'Achievement Congratulations',
    category: CATEGORIES.CONGRATULATIONS.id,
    description: 'Congratulations card for achievements with big text and celebration elements.',
    searchKeywords: ['congratulations', 'achievement', 'success', 'celebration', 'milestone'],
    upload_time: '2024-02-25T09:15:00Z',
    author: 'David Chen',
    price: 1.99,
    language: 'en',
    region: 'US',
    popularity: 83,
    num_downloads: 567,
    pages: [
      {
        header: 'Congratulations!',
        image: 'images/temp9.jpg',
        text: 'Congratulations, big text',
        footer: '1'
      },
      {
        header: 'Well Done',
        image: 'images/blank.png',
        text: 'Achievement celebration',
        footer: '2'
      },
      {
        header: 'Success',
        image: 'images/blank.png',
        text: 'Congratulations message',
        footer: '3'
      },
      {
        header: 'Proud of You',
        image: 'images/blank_logo.png',
        text: 'Success celebration',
        footer: '4'
      }
    ]
  },
  temp10: {
    id: 'temp10',
    title: 'Celebration Congratulations',
    category: CATEGORIES.CONGRATULATIONS.id,
    description: 'Festive congratulations card with celebration theme and confetti.',
    searchKeywords: ['congratulations', 'celebration', 'festive', 'confetti', 'party'],
    pages: [
      {
        header: 'Celebrate Success',
        image: 'images/temp10.jpg',
        text: 'Congratulations, celebration',
        footer: '1'
      },
      {
        header: 'Amazing Achievement',
        image: 'images/blank.png',
        text: 'Celebration time',
        footer: '2'
      },
      {
        header: 'You Did It',
        image: 'images/blank.png',
        text: 'Congratulations celebration',
        footer: '3'
      },
      {
        header: 'Victory',
        image: 'images/blank_logo.png',
        text: 'Success party',
        footer: '4'
      }
    ]
  },
  temp11: {
    id: 'temp11',
    title: 'Professional Congratulations',
    category: CATEGORIES.CONGRATULATIONS.id,
    description: 'Professional congratulations card suitable for work achievements.',
    searchKeywords: ['congratulations', 'professional', 'work', 'career', 'business'],
    pages: [
      {
        header: 'Professional Success',
        image: 'images/temp11.jpg',
        text: 'Lorem ipsum dolor sit amet, consectetur adipiscing elit. In cursus mollis nibh, non convallis ex convallis eu.',
        footer: '1'
      },
      {
        header: 'Career Milestone',
        image: 'images/blank.png',
        text: 'Professional achievement congratulations',
        footer: '2'
      },
      {
        header: 'Excellence',
        image: 'images/blank.png',
        text: 'Work success celebration',
        footer: '3'
      },
      {
        header: 'Outstanding',
        image: 'images/blank_logo.png',
        text: 'Professional congratulations',
        footer: '4'
      }
    ]
  },
  temp12: {
    id: 'temp12',
    title: 'Personal Congratulations',
    category: CATEGORIES.CONGRATULATIONS.id,
    description: 'Personal congratulations card for life achievements and milestones.',
    searchKeywords: ['congratulations', 'personal', 'life', 'milestone', 'achievement'],
    pages: [
      {
        header: 'Life Achievement',
        image: 'images/temp12.jpg',
        text: 'Personal congratulations',
        footer: '1'
      },
      {
        header: 'Milestone Reached',
        image: 'images/blank.png',
        text: 'Life celebration',
        footer: '2'
      },
      {
        header: 'Personal Victory',
        image: 'images/blank.png',
        text: 'Achievement unlocked',
        footer: '3'
      },
      {
        header: 'Well Deserved',
        image: 'images/blank_logo.png',
        text: 'Personal success',
        footer: '4'
      }
    ]
  },

  // HOLIDAY TEMPLATES (temp17-temp20)
  temp17: {
    id: 'temp17',
    title: 'Festive Holiday Greetings',
    category: CATEGORIES.HOLIDAY.id,
    description: 'Beautiful holiday card with festive decorations and warm wishes.',
    searchKeywords: ['holiday', 'festive', 'celebration', 'warm', 'wishes'],
    upload_time: '2024-01-15T10:30:00Z',
    author: 'SmartWish',
    price: 2.99,
    language: 'en',
    region: 'US',
    popularity: 88,
    num_downloads: 956,
    pages: [
      {
        header: 'Happy Holidays!',
        image: 'images/temp17.jpg',
        text: 'Holiday, festive decorations, warm wishes',
        footer: '1'
      },
      {
        header: 'Season\'s Greetings',
        image: 'images/blank.jpg',
        text: 'Holiday, celebration, joy',
        footer: '2'
      },
      {
        header: 'Warm Wishes',
        image: 'images/blank.jpg',
        text: 'Holiday, peace, love',
        footer: '3'
      },
      {
        header: 'Happy New Year',
        image: 'images/blank_logo.png',
        text: 'Holiday, new beginnings, hope',
        footer: '4'
      }
    ]
  },

  // NEW TEMPLATE EXAMPLE - How to add a new design
  temp21: {
    id: 'temp21',
    title: 'New Custom Design',
    category: CATEGORIES.BIRTHDAY.id, // Choose appropriate category
    description: 'A brand new custom design template with modern styling.',
    searchKeywords: ['custom', 'modern', 'new', 'design', 'birthday'],
    upload_time: '2024-01-20T12:00:00Z',
    author: 'SmartWish',
    price: 3.99,
    language: 'en',
    region: 'US',
    popularity: 95,
    num_downloads: 0,
    pages: [
      {
        header: 'Custom Header',
        image: 'images/temp21.jpg', // Add your image file
        text: 'Custom design text and content',
        footer: '1'
      },
      {
        header: 'Page Two',
        image: 'images/blank.jpg',
        text: 'Second page content',
        footer: '2'
      },
      {
        header: 'Page Three',
        image: 'images/blank.jpg',
        text: 'Third page content',
        footer: '3'
      },
      {
        header: 'Final Page',
        image: 'images/blank_logo.png',
        text: 'Final page with logo',
        footer: '4'
      }
    ]
  },

  // Additional templates for testing carousel
  temp22: {
    id: 'temp22',
    title: 'Modern Birthday Celebration',
    category: CATEGORIES.BIRTHDAY.id,
    description: 'A modern, vibrant birthday design with contemporary styling and bold colors.',
    searchKeywords: ['birthday', 'modern', 'vibrant', 'celebration', 'contemporary'],
    upload_time: '2024-01-21T10:00:00Z',
    author: 'Emma Rodriguez',
    price: 4.99,
    language: 'en',
    region: 'US',
    popularity: 92,
    num_downloads: 156,
    pages: [
      {
        header: 'Happy Birthday!',
        image: 'images/temp22.jpg',
        text: 'Modern birthday celebration with vibrant colors',
        footer: '1'
      },
      {
        header: 'Celebrate Today',
        image: 'images/blank.jpg',
        text: 'Contemporary birthday design',
        footer: '2'
      },
      {
        header: 'Special Day',
        image: 'images/blank.jpg',
        text: 'Modern birthday wishes',
        footer: '3'
      },
      {
        header: 'Birthday Joy',
        image: 'images/blank_logo.png',
        text: 'Contemporary birthday celebration',
        footer: '4'
      }
    ]
  },

  temp23: {
    id: 'temp23',
    title: 'Elegant Birthday Wishes',
    category: CATEGORIES.BIRTHDAY.id,
    description: 'Sophisticated birthday design with elegant typography and refined styling.',
    searchKeywords: ['birthday', 'elegant', 'sophisticated', 'refined', 'typography'],
    upload_time: '2024-01-22T14:30:00Z',
    author: 'Alex Thompson',
    price: 3.49,
    language: 'en',
    region: 'US',
    popularity: 88,
    num_downloads: 89,
    pages: [
      {
        header: 'Birthday Wishes',
        image: 'images/temp23.jpg',
        text: 'Elegant birthday celebration',
        footer: '1'
      },
      {
        header: 'Special Celebration',
        image: 'images/blank.jpg',
        text: 'Sophisticated design',
        footer: '2'
      },
      {
        header: 'Joyful Day',
        image: 'images/blank.jpg',
        text: 'Elegant birthday wishes',
        footer: '3'
      },
      {
        header: 'Celebrate Life',
        image: 'images/blank_logo.png',
        text: 'Refined birthday celebration',
        footer: '4'
      }
    ]
  },

  temp24: {
    id: 'temp24',
    title: 'Fun Birthday Party',
    category: CATEGORIES.BIRTHDAY.id,
    description: 'Playful and fun birthday design perfect for children and young adults.',
    searchKeywords: ['birthday', 'fun', 'playful', 'party', 'children', 'young'],
    upload_time: '2024-01-23T16:45:00Z',
    author: 'SmartWish',
    price: 2.99,
    language: 'en',
    region: 'US',
    popularity: 85,
    num_downloads: 234,
    pages: [
      {
        header: 'Party Time!',
        image: 'images/temp24.jpg',
        text: 'Fun birthday party celebration',
        footer: '1'
      },
      {
        header: 'Let\'s Celebrate',
        image: 'images/blank.jpg',
        text: 'Playful birthday design',
        footer: '2'
      },
      {
        header: 'Birthday Fun',
        image: 'images/blank.jpg',
        text: 'Fun birthday wishes',
        footer: '3'
      },
      {
        header: 'Party On!',
        image: 'images/blank_logo.png',
        text: 'Fun birthday celebration',
        footer: '4'
      }
    ]
  },

  // Additional birthday templates for carousel testing
  temp25: {
    id: 'temp25',
    title: 'Vintage Birthday Charm',
    category: CATEGORIES.BIRTHDAY.id,
    description: 'Retro-inspired birthday design with vintage charm and nostalgic elements.',
    searchKeywords: ['birthday', 'vintage', 'retro', 'nostalgic', 'charm', 'classic'],
    upload_time: '2024-01-24T11:20:00Z',
    author: 'Emma Rodriguez',
    price: 3.99,
    language: 'en',
    region: 'US',
    popularity: 91,
    num_downloads: 187,
    pages: [
      {
        header: 'Vintage Birthday',
        image: 'images/temp25.jpg',
        text: 'Retro birthday celebration',
        footer: '1'
      },
      {
        header: 'Classic Charm',
        image: 'images/blank.jpg',
        text: 'Vintage birthday design',
        footer: '2'
      },
      {
        header: 'Nostalgic Wishes',
        image: 'images/blank.jpg',
        text: 'Retro birthday celebration',
        footer: '3'
      },
      {
        header: 'Timeless Joy',
        image: 'images/blank_logo.png',
        text: 'Vintage birthday charm',
        footer: '4'
      }
    ]
  },

  temp26: {
    id: 'temp26',
    title: 'Luxury Birthday Celebration',
    category: CATEGORIES.BIRTHDAY.id,
    description: 'Premium birthday design with elegant typography and sophisticated styling.',
    searchKeywords: ['birthday', 'luxury', 'premium', 'elegant', 'sophisticated', 'premium'],
    upload_time: '2024-01-25T14:30:00Z',
    author: 'Alex Thompson',
    price: 5.99,
    language: 'en',
    region: 'US',
    popularity: 94,
    num_downloads: 156,
    pages: [
      {
        header: 'Luxury Birthday',
        image: 'images/temp26.jpg',
        text: 'Premium birthday celebration',
        footer: '1'
      },
      {
        header: 'Elegant Design',
        image: 'images/blank.jpg',
        text: 'Sophisticated birthday',
        footer: '2'
      },
      {
        header: 'Premium Wishes',
        image: 'images/blank.jpg',
        text: 'Luxury birthday design',
        footer: '3'
      },
      {
        header: 'Sophisticated Joy',
        image: 'images/blank_logo.png',
        text: 'Premium birthday celebration',
        footer: '4'
      }
    ]
  },

  temp27: {
    id: 'temp27',
    title: 'Adventure Birthday',
    category: CATEGORIES.BIRTHDAY.id,
    description: 'Dynamic birthday design with adventure themes and exciting visuals.',
    searchKeywords: ['birthday', 'adventure', 'dynamic', 'exciting', 'exploration', 'journey'],
    upload_time: '2024-01-26T09:15:00Z',
    author: 'SmartWish',
    price: 3.49,
    language: 'en',
    region: 'US',
    popularity: 89,
    num_downloads: 203,
    pages: [
      {
        header: 'Adventure Awaits',
        image: 'images/temp27.jpg',
        text: 'Dynamic birthday adventure',
        footer: '1'
      },
      {
        header: 'Explore Today',
        image: 'images/blank.jpg',
        text: 'Adventure birthday design',
        footer: '2'
      },
      {
        header: 'Journey Begins',
        image: 'images/blank.jpg',
        text: 'Exciting birthday wishes',
        footer: '3'
      },
      {
        header: 'New Horizons',
        image: 'images/blank_logo.png',
        text: 'Adventure birthday celebration',
        footer: '4'
      }
    ]
  },

  temp28: {
    id: 'temp28',
    title: 'Cozy Birthday Warmth',
    category: CATEGORIES.BIRTHDAY.id,
    description: 'Warm and cozy birthday design with comforting colors and gentle styling.',
    searchKeywords: ['birthday', 'cozy', 'warm', 'comforting', 'gentle', 'soft'],
    upload_time: '2024-01-27T16:45:00Z',
    author: 'Emma Rodriguez',
    price: 2.49,
    language: 'en',
    region: 'US',
    popularity: 87,
    num_downloads: 178,
    pages: [
      {
        header: 'Cozy Birthday',
        image: 'images/temp28.jpg',
        text: 'Warm birthday celebration',
        footer: '1'
      },
      {
        header: 'Warm Wishes',
        image: 'images/blank.jpg',
        text: 'Comforting birthday design',
        footer: '2'
      },
      {
        header: 'Gentle Joy',
        image: 'images/blank.jpg',
        text: 'Soft birthday wishes',
        footer: '3'
      },
      {
        header: 'Warmth & Love',
        image: 'images/blank_logo.png',
        text: 'Cozy birthday celebration',
        footer: '4'
      }
    ]
  }
};

// ===== UTILITY FUNCTIONS =====

/**
 * Get all categories as an array
 * @returns Array of category objects
 */
export const getAllCategories = (): Category[] => {
  return Object.values(CATEGORIES).sort((a, b) => a.sortOrder - b.sortOrder);
};

/**
 * Get category names only (for dropdowns)
 * @returns Array of category names
 */
export const getCategoryNames = (): string[] => {
  return getAllCategories().map(cat => cat.name);
};

/**
 * Get category by ID
 * @param categoryId - Category ID
 * @returns Category object or null
 */
export const getCategoryById = (categoryId: string): Category | null => {
  return Object.values(CATEGORIES).find(cat => cat.id === categoryId) || null;
};

/**
 * Get template by ID
 * @param templateId - Template ID
 * @returns Template object or null
 */
export const getTemplateById = (templateId: string): Template | null => {
  return TEMPLATES[templateId] || null;
};

/**
 * Get all templates as an array
 * @returns Array of template objects
 */
export const getAllTemplates = (): Template[] => {
  return Object.values(TEMPLATES);
};

/**
 * Get templates by category
 * @param categoryId - Category ID
 * @returns Array of templates in the category
 */
export const getTemplatesByCategory = (categoryId: string): Template[] => {
  return Object.values(TEMPLATES).filter(template => template.category === categoryId);
};

/**
 * Search templates by keywords
 * @param searchTerm - Search term
 * @returns Array of matching templates
 */
export const searchTemplates = (searchTerm: string): Template[] => {
  if (!searchTerm || searchTerm.trim() === '') {
    return [];
  }

  const term = searchTerm.toLowerCase().trim();
  return Object.values(TEMPLATES).filter(template => {
    return (
      template.title.toLowerCase().includes(term) ||
      template.description.toLowerCase().includes(term) ||
      template.searchKeywords.some(keyword => keyword.toLowerCase().includes(term)) ||
      template.pages.some(page =>
        page.header.toLowerCase().includes(term) ||
        page.text.toLowerCase().includes(term)
      )
    );
  });
};

/**
 * Get template keys only
 * @returns Array of template keys
 */
export const getTemplateKeys = (): string[] => {
  return Object.keys(TEMPLATES);
};

/**
 * Validate template data structure
 * @param template - Template object to validate
 * @returns True if valid
 */
export const validateTemplate = (template: any): boolean => {
  if (!template || typeof template !== 'object') return false;

  const requiredFields = ['id', 'title', 'category', 'description', 'pages'];
  const hasRequiredFields = requiredFields.every(field => template.hasOwnProperty(field));

  if (!hasRequiredFields) return false;

  // Validate pages structure
  if (!Array.isArray(template.pages) || template.pages.length === 0) return false;

  return template.pages.every((page: any) =>
    page.hasOwnProperty('header') &&
    page.hasOwnProperty('image') &&
    page.hasOwnProperty('text') &&
    page.hasOwnProperty('footer')
  );
};

/**
 * Get template statistics
 * @returns Statistics object
 */
export const getTemplateStats = (): TemplateStats => {
  const templates = getAllTemplates();
  const categories = getAllCategories();

  const stats: TemplateStats = {
    totalTemplates: templates.length,
    totalCategories: categories.length,
    templatesByCategory: {}
  };

  categories.forEach(category => {
    stats.templatesByCategory[category.id] = getTemplatesByCategory(category.id).length;
  });

  return stats;
};

// ===== EXPORT DEFAULT =====
export default {
  CATEGORIES,
  TEMPLATES,
  getAllCategories,
  getCategoryNames,
  getCategoryById,
  getTemplateById,
  getAllTemplates,
  getTemplatesByCategory,
  searchTemplates,
  getTemplateKeys,
  validateTemplate,
  getTemplateStats
};
