/**
 * SMARTWISH TEMPLATE SYSTEM - TYPE DEFINITIONS
 * 
 * TypeScript definitions for template and category structures
 * Ensures type safety across frontend and backend
 * 
 * @version 1.0.0
 * @author SmartWish Team
 */

// ===== BASIC TYPES =====

export interface TemplatePage {
  header: string;
  image: string;
  text: string;
  footer: string;
}

export interface Category {
  id: string;
  name: string;
  displayName: string;
  description: string;
  coverImage: string;
  templateCount: number;
  sortOrder: number;
}

export interface Template {
  id: string;
  title: string;
  category: string;
  description: string;
  searchKeywords: string[];
  pages: TemplatePage[];
  // Metadata fields
  upload_time?: string;
  author?: string;
  price?: number;
  language?: string;
  region?: string;
  popularity?: number;
  num_downloads?: number;
}

// ===== DESIGN DATA TYPES =====

export interface EditedPages {
  [pageIndex: string]: Partial<TemplatePage>;
}

export interface DesignData {
  templateKey: string;
  pages: TemplatePage[];
  editedPages?: EditedPages;
}

export interface SavedDesign {
  id?: string;
  title: string;
  description: string;
  category: string;
  designData: DesignData;
  userId?: number;
  createdAt?: string;
  updatedAt?: string;
  // Additional metadata fields for consistency with Template
  author?: string;
  upload_time?: string;
  price?: number;
  language?: string;
  region?: string;
  popularity?: number;
  num_downloads?: number;
  searchKeywords?: string[];
  // Status field for future use
  status?: 'draft' | 'published' | 'archived';
  // Thumbnail for preview
  thumbnail?: string;
}

// ===== SEARCH AND FILTER TYPES =====

export interface SearchResult {
  template: Template;
  matchScore: number;
  matchedFields: string[];
}

export interface TemplateFilter {
  category?: string;
  searchTerm?: string;
  sortBy?: 'title' | 'category' | 'recent';
  sortOrder?: 'asc' | 'desc';
}

// ===== STATISTICS TYPES =====

export interface TemplateStats {
  totalTemplates: number;
  totalCategories: number;
  templatesByCategory: Record<string, number>;
}

// ===== API RESPONSE TYPES =====

export interface TemplateResponse {
  success: boolean;
  data?: Template | Template[];
  error?: string;
  message?: string;
}

export interface CategoryResponse {
  success: boolean;
  data?: Category | Category[];
  error?: string;
  message?: string;
}

// ===== VALIDATION TYPES =====

export interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings?: string[];
}

// ===== UTILITY TYPES =====

// Template ID type will be inferred from the TEMPLATES object
export type TemplateId = string;
export type CategoryId = string;

// ===== CONSTANTS =====

export const TEMPLATE_VALIDATION_RULES = {
  MIN_TITLE_LENGTH: 3,
  MAX_TITLE_LENGTH: 100,
  MIN_DESCRIPTION_LENGTH: 10,
  MAX_DESCRIPTION_LENGTH: 500,
  MIN_PAGES: 1,
  MAX_PAGES: 10,
  MIN_HEADER_LENGTH: 1,
  MAX_HEADER_LENGTH: 100,
  MIN_TEXT_LENGTH: 1,
  MAX_TEXT_LENGTH: 2000
} as const;

export const CATEGORY_VALIDATION_RULES = {
  MIN_NAME_LENGTH: 3,
  MAX_NAME_LENGTH: 50,
  MIN_DESCRIPTION_LENGTH: 10,
  MAX_DESCRIPTION_LENGTH: 200
} as const;

// ===== ENUMS =====

export enum TemplateStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  DRAFT = 'draft',
  ARCHIVED = 'archived'
}

export enum CategoryStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive'
}

// ===== EXTENDED INTERFACES FOR FUTURE USE =====

export interface ExtendedTemplate extends Template {
  status?: TemplateStatus;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
  tags?: string[];
  difficulty?: 'easy' | 'medium' | 'hard';
  estimatedTime?: number; // in minutes
  popularity?: number;
  rating?: number;
}

export interface ExtendedCategory extends Category {
  status?: CategoryStatus;
  createdAt?: string;
  updatedAt?: string;
  parentCategory?: string;
  subcategories?: string[];
  isDefault?: boolean;
}

// ===== FUNCTION SIGNATURES =====

export interface TemplateService {
  getAllTemplates(): Template[];
  getTemplateById(id: string): Template | null;
  getTemplatesByCategory(categoryId: string): Template[];
  searchTemplates(searchTerm: string): Template[];
  validateTemplate(template: Template): ValidationResult;
  createTemplate(template: Omit<Template, 'id'>): Template;
  updateTemplate(id: string, updates: Partial<Template>): Template | null;
  deleteTemplate(id: string): boolean;
}

export interface CategoryService {
  getAllCategories(): Category[];
  getCategoryById(id: string): Category | null;
  getCategoryNames(): string[];
  validateCategory(category: Category): ValidationResult;
  createCategory(category: Omit<Category, 'id'>): Category;
  updateCategory(id: string, updates: Partial<Category>): Category | null;
  deleteCategory(id: string): boolean;
}

// ===== DEFAULT EXPORT =====

export default {
  TEMPLATE_VALIDATION_RULES,
  CATEGORY_VALIDATION_RULES,
  TemplateStatus,
  CategoryStatus
};
