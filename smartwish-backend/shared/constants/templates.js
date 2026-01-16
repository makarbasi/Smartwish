"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getTemplateStats = exports.validateTemplate = exports.getTemplateKeys = exports.searchTemplates = exports.getTemplatesByCategory = exports.getAllTemplates = exports.getTemplateById = exports.getCategoryById = exports.getCategoryNames = exports.getAllCategories = exports.TEMPLATES = exports.CATEGORIES = void 0;
exports.CATEGORIES = {
    BIRTHDAY: {
        id: 'birthday',
        name: 'Birthday',
        displayName: 'Birthday',
        description: 'Celebrate special birthdays with vibrant and fun designs',
        coverImage: '/images/img-cover-1.jpg',
        templateCount: 4,
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
exports.TEMPLATES = {
    temp1: {
        id: 'temp1',
        title: 'Vibrant Birthday Celebration',
        category: exports.CATEGORIES.BIRTHDAY.id,
        description: 'Birthday card with vibrant colors, fun design, balloons, and gifts. Perfect for birthday celebrations.',
        searchKeywords: ['birthday', 'vibrant', 'colorful', 'balloons', 'gifts', 'celebration', 'party'],
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
        category: exports.CATEGORIES.BIRTHDAY.id,
        description: 'Simple and elegant birthday design with big text and classic styling.',
        searchKeywords: ['birthday', 'classic', 'simple', 'elegant', 'traditional'],
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
        category: exports.CATEGORIES.BIRTHDAY.id,
        description: 'Clean and minimalist birthday design with simple, mono color theme.',
        searchKeywords: ['birthday', 'minimalist', 'simple', 'clean', 'mono', 'modern'],
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
        category: exports.CATEGORIES.BIRTHDAY.id,
        description: 'Feminine birthday design with balloons, cake, and girly elements.',
        searchKeywords: ['birthday', 'girly', 'feminine', 'balloons', 'cake', 'pink', 'cute'],
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
    temp5: {
        id: 'temp5',
        title: 'Romantic Anniversary',
        category: exports.CATEGORIES.ANNIVERSARY.id,
        description: 'Romantic anniversary design with flowers and big text for couples.',
        searchKeywords: ['anniversary', 'romantic', 'flowers', 'love', 'couple', 'romance'],
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
        category: exports.CATEGORIES.ANNIVERSARY.id,
        description: 'Anniversary card focused on couples with big text and romantic elements.',
        searchKeywords: ['anniversary', 'couple', 'together', 'love', 'relationship'],
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
        category: exports.CATEGORIES.ANNIVERSARY.id,
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
        category: exports.CATEGORIES.ANNIVERSARY.id,
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
    temp9: {
        id: 'temp9',
        title: 'Achievement Congratulations',
        category: exports.CATEGORIES.CONGRATULATIONS.id,
        description: 'Congratulations card for achievements with big text and celebration elements.',
        searchKeywords: ['congratulations', 'achievement', 'success', 'celebration', 'milestone'],
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
        category: exports.CATEGORIES.CONGRATULATIONS.id,
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
        category: exports.CATEGORIES.CONGRATULATIONS.id,
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
        category: exports.CATEGORIES.CONGRATULATIONS.id,
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
    }
};
const getAllCategories = () => {
    return Object.values(exports.CATEGORIES).sort((a, b) => a.sortOrder - b.sortOrder);
};
exports.getAllCategories = getAllCategories;
const getCategoryNames = () => {
    return (0, exports.getAllCategories)().map(cat => cat.name);
};
exports.getCategoryNames = getCategoryNames;
const getCategoryById = (categoryId) => {
    return Object.values(exports.CATEGORIES).find(cat => cat.id === categoryId) || null;
};
exports.getCategoryById = getCategoryById;
const getTemplateById = (templateId) => {
    return exports.TEMPLATES[templateId] || null;
};
exports.getTemplateById = getTemplateById;
const getAllTemplates = () => {
    return Object.values(exports.TEMPLATES);
};
exports.getAllTemplates = getAllTemplates;
const getTemplatesByCategory = (categoryId) => {
    return Object.values(exports.TEMPLATES).filter(template => template.category === categoryId);
};
exports.getTemplatesByCategory = getTemplatesByCategory;
const searchTemplates = (searchTerm) => {
    if (!searchTerm || searchTerm.trim() === '') {
        return [];
    }
    const term = searchTerm.toLowerCase().trim();
    return Object.values(exports.TEMPLATES).filter(template => {
        return (template.title.toLowerCase().includes(term) ||
            template.description.toLowerCase().includes(term) ||
            template.searchKeywords.some(keyword => keyword.toLowerCase().includes(term)) ||
            template.pages.some(page => page.header.toLowerCase().includes(term) ||
                page.text.toLowerCase().includes(term)));
    });
};
exports.searchTemplates = searchTemplates;
const getTemplateKeys = () => {
    return Object.keys(exports.TEMPLATES);
};
exports.getTemplateKeys = getTemplateKeys;
const validateTemplate = (template) => {
    if (!template || typeof template !== 'object')
        return false;
    const requiredFields = ['id', 'title', 'category', 'description', 'pages'];
    const hasRequiredFields = requiredFields.every(field => template.hasOwnProperty(field));
    if (!hasRequiredFields)
        return false;
    if (!Array.isArray(template.pages) || template.pages.length === 0)
        return false;
    return template.pages.every((page) => page.hasOwnProperty('header') &&
        page.hasOwnProperty('image') &&
        page.hasOwnProperty('text') &&
        page.hasOwnProperty('footer'));
};
exports.validateTemplate = validateTemplate;
const getTemplateStats = () => {
    const templates = (0, exports.getAllTemplates)();
    const categories = (0, exports.getAllCategories)();
    const stats = {
        totalTemplates: templates.length,
        totalCategories: categories.length,
        templatesByCategory: {}
    };
    categories.forEach(category => {
        stats.templatesByCategory[category.id] = (0, exports.getTemplatesByCategory)(category.id).length;
    });
    return stats;
};
exports.getTemplateStats = getTemplateStats;
exports.default = {
    CATEGORIES: exports.CATEGORIES,
    TEMPLATES: exports.TEMPLATES,
    getAllCategories: exports.getAllCategories,
    getCategoryNames: exports.getCategoryNames,
    getCategoryById: exports.getCategoryById,
    getTemplateById: exports.getTemplateById,
    getAllTemplates: exports.getAllTemplates,
    getTemplatesByCategory: exports.getTemplatesByCategory,
    searchTemplates: exports.searchTemplates,
    getTemplateKeys: exports.getTemplateKeys,
    validateTemplate: exports.validateTemplate,
    getTemplateStats: exports.getTemplateStats
};
//# sourceMappingURL=templates.js.map