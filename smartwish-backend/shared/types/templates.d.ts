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
}
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
}
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
export interface TemplateStats {
    totalTemplates: number;
    totalCategories: number;
    templatesByCategory: Record<string, number>;
}
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
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings?: string[];
}
export type TemplateId = string;
export type CategoryId = string;
export declare const TEMPLATE_VALIDATION_RULES: {
    readonly MIN_TITLE_LENGTH: 3;
    readonly MAX_TITLE_LENGTH: 100;
    readonly MIN_DESCRIPTION_LENGTH: 10;
    readonly MAX_DESCRIPTION_LENGTH: 500;
    readonly MIN_PAGES: 1;
    readonly MAX_PAGES: 10;
    readonly MIN_HEADER_LENGTH: 1;
    readonly MAX_HEADER_LENGTH: 100;
    readonly MIN_TEXT_LENGTH: 1;
    readonly MAX_TEXT_LENGTH: 2000;
};
export declare const CATEGORY_VALIDATION_RULES: {
    readonly MIN_NAME_LENGTH: 3;
    readonly MAX_NAME_LENGTH: 50;
    readonly MIN_DESCRIPTION_LENGTH: 10;
    readonly MAX_DESCRIPTION_LENGTH: 200;
};
export declare enum TemplateStatus {
    ACTIVE = "active",
    INACTIVE = "inactive",
    DRAFT = "draft",
    ARCHIVED = "archived"
}
export declare enum CategoryStatus {
    ACTIVE = "active",
    INACTIVE = "inactive"
}
export interface ExtendedTemplate extends Template {
    status?: TemplateStatus;
    createdAt?: string;
    updatedAt?: string;
    createdBy?: string;
    tags?: string[];
    difficulty?: 'easy' | 'medium' | 'hard';
    estimatedTime?: number;
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
declare const _default: {
    TEMPLATE_VALIDATION_RULES: {
        readonly MIN_TITLE_LENGTH: 3;
        readonly MAX_TITLE_LENGTH: 100;
        readonly MIN_DESCRIPTION_LENGTH: 10;
        readonly MAX_DESCRIPTION_LENGTH: 500;
        readonly MIN_PAGES: 1;
        readonly MAX_PAGES: 10;
        readonly MIN_HEADER_LENGTH: 1;
        readonly MAX_HEADER_LENGTH: 100;
        readonly MIN_TEXT_LENGTH: 1;
        readonly MAX_TEXT_LENGTH: 2000;
    };
    CATEGORY_VALIDATION_RULES: {
        readonly MIN_NAME_LENGTH: 3;
        readonly MAX_NAME_LENGTH: 50;
        readonly MIN_DESCRIPTION_LENGTH: 10;
        readonly MAX_DESCRIPTION_LENGTH: 200;
    };
    TemplateStatus: typeof TemplateStatus;
    CategoryStatus: typeof CategoryStatus;
};
export default _default;
