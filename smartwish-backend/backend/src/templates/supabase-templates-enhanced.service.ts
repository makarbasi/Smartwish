import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface Template {
  id: string;
  slug: string;
  title: string;
  category_id: string;
  description?: string;
  author_id?: string;
  price: number;
  language: string;
  region: string;
  status: 'draft' | 'published' | 'archived';
  popularity: number;
  num_downloads: number;
  cover_image?: string;
  current_version?: string;
  created_at: string;
  updated_at: string;
  published_at?: string;
}

export interface Category {
  id: string;
  slug: string;
  name: string;
  display_name: string;
  description?: string;
  cover_image?: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface TemplatePage {
  id: string;
  template_id: string;
  page_index: number;
  header?: string;
  text_content?: string;
  footer?: string;
  image_path?: string;
  created_at: string;
  updated_at: string;
}

export interface TemplateKeyword {
  template_id: string;
  keyword: string;
}

export interface Tag {
  id: string;
  name: string;
  description?: string;
  color?: string;
  created_at: string;
}

export interface TemplateTag {
  template_id: string;
  tag_id: string;
}

export interface SearchResult {
  template: Template;
  relevance_score: number;
  matched_fields: string[];
  category?: Category;
  tags?: Tag[];
}

@Injectable()
export class SupabaseTemplatesEnhancedService {
  private supabase: SupabaseClient;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.warn('Supabase credentials not configured, service will not work');
      return;
    }

    this.supabase = createClient(supabaseUrl, supabaseServiceKey);
  }

  // Category operations
  async getAllCategories(): Promise<Category[]> {
    if (!this.supabase) return [];
    
    const { data, error } = await this.supabase
      .from('sw_categories')
      .select('*')
      .eq('is_active', true)
      .order('sort_order', { ascending: true });

    if (error) {
      console.error('Error fetching categories:', error);
      return [];
    }

    return data || [];
  }

  async getCategoryById(id: string): Promise<Category | null> {
    if (!this.supabase) return null;
    
    const { data, error } = await this.supabase
      .from('sw_categories')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching category:', error);
      return null;
    }

    return data;
  }

  async createCategory(category: Omit<Category, 'created_at' | 'updated_at'>): Promise<Category | null> {
    if (!this.supabase) return null;
    
    const { data, error } = await this.supabase
      .from('sw_categories')
      .insert(category)
      .select()
      .single();

    if (error) {
      console.error('Error creating category:', error);
      return null;
    }

    return data;
  }

  async updateCategory(id: string, updates: Partial<Category>): Promise<Category | null> {
    if (!this.supabase) return null;
    
    const { data, error } = await this.supabase
      .from('sw_categories')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating category:', error);
      return null;
    }

    return data;
  }

  async deleteCategory(id: string): Promise<boolean> {
    if (!this.supabase) return false;
    
    const { error } = await this.supabase
      .from('sw_categories')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting category:', error);
      return false;
    }

    return true;
  }

  // Template operations
  async getAllTemplates(): Promise<Template[]> {
    if (!this.supabase) return [];
    
    const { data, error } = await this.supabase
      .from('sw_templates')
      .select('*')
      .eq('status', 'published')
      .order('popularity', { ascending: false });

    if (error) {
      console.error('Error fetching templates:', error);
      return [];
    }

    return data || [];
  }

  async getTemplatesByCategory(categoryId: string): Promise<Template[]> {
    if (!this.supabase) return [];
    
    const { data, error } = await this.supabase
      .from('sw_templates')
      .select('*')
      .eq('category_id', categoryId)
      .eq('status', 'published')
      .order('popularity', { ascending: false });

    if (error) {
      console.error('Error fetching templates by category:', error);
      return [];
    }

    return data || [];
  }

  async getTemplateById(id: string): Promise<Template | null> {
    if (!this.supabase) return null;
    
    const { data, error } = await this.supabase
      .from('sw_templates')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      console.error('Error fetching template:', error);
      return null;
    }

    return data;
  }

  async getTemplateWithPages(id: string): Promise<{ template: Template; pages: TemplatePage[] } | null> {
    if (!this.supabase) return null;
    
    const [templateResult, pagesResult] = await Promise.all([
      this.getTemplateById(id),
      this.getTemplatePages(id)
    ]);

    if (!templateResult) return null;

    return {
      template: templateResult,
      pages: pagesResult
    };
  }

  async createTemplate(template: Omit<Template, 'created_at' | 'updated_at'>): Promise<Template | null> {
    if (!this.supabase) return null;
    
    const { data, error } = await this.supabase
      .from('sw_templates')
      .insert(template)
      .select()
      .single();

    if (error) {
      console.error('Error creating template:', error);
      return null;
    }

    return data;
  }

  async updateTemplate(id: string, updates: Partial<Template>): Promise<Template | null> {
    if (!this.supabase) return null;
    
    const { data, error } = await this.supabase
      .from('sw_templates')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      console.error('Error updating template:', error);
      return null;
    }

    return data;
  }

  async deleteTemplate(id: string): Promise<boolean> {
    if (!this.supabase) return false;
    
    const { error } = await this.supabase
      .from('sw_templates')
      .delete()
      .eq('id', id);

    if (error) {
      console.error('Error deleting template:', error);
      return false;
    }

    return true;
  }

  // Template pages operations
  async getTemplatePages(templateId: string): Promise<TemplatePage[]> {
    if (!this.supabase) return [];
    
    const { data, error } = await this.supabase
      .from('sw_template_pages')
      .select('*')
      .eq('template_id', templateId)
      .order('page_index', { ascending: true });

    if (error) {
      console.error('Error fetching template pages:', error);
      return [];
    }

    return data || [];
  }

  async createTemplatePage(page: Omit<TemplatePage, 'id' | 'created_at' | 'updated_at'>): Promise<TemplatePage | null> {
    if (!this.supabase) return null;
    
    const { data, error } = await this.supabase
      .from('sw_template_pages')
      .insert(page)
      .select()
      .single();

    if (error) {
      console.error('Error creating template page:', error);
      return null;
    }

    return data;
  }

  // Keywords operations
  async getTemplateKeywords(templateId: string): Promise<string[]> {
    if (!this.supabase) return [];
    
    const { data, error } = await this.supabase
      .from('sw_template_keywords')
      .select('keyword')
      .eq('template_id', templateId);

    if (error) {
      console.error('Error fetching template keywords:', error);
      return [];
    }

    return data?.map(k => k.keyword) || [];
  }

  async addTemplateKeywords(templateId: string, keywords: string[]): Promise<boolean> {
    if (!this.supabase) return false;
    
    const keywordData = keywords.map(keyword => ({
      template_id: templateId,
      keyword: keyword.toLowerCase().trim()
    }));

    const { error } = await this.supabase
      .from('sw_template_keywords')
      .upsert(keywordData, { onConflict: 'template_id,keyword' });

    if (error) {
      console.error('Error adding template keywords:', error);
      return false;
    }

    return true;
  }

  // Tags operations
  async getAllTags(): Promise<Tag[]> {
    if (!this.supabase) return [];
    
    const { data, error } = await this.supabase
      .from('sw_tags')
      .select('*')
      .order('name', { ascending: true });

    if (error) {
      console.error('Error fetching tags:', error);
      return [];
    }

    return data || [];
  }

  async getTemplateTags(templateId: string): Promise<Tag[]> {
    if (!this.supabase) return [];
    
    const { data, error } = await this.supabase
      .from('sw_template_tags')
      .select(`
        tag_id,
        sw_tags (
          id,
          name,
          description,
          color,
          created_at
        )
      `)
      .eq('template_id', templateId);

    if (error) {
      console.error('Error fetching template tags:', error);
      return [];
    }

    return data?.map(item => item.sw_tags).filter(Boolean).flat() || [];
  }

  // Advanced search operations
  async searchTemplates(query: string, options: {
    categoryId?: string;
    tags?: string[];
    priceRange?: { min: number; max: number };
    limit?: number;
    offset?: number;
  } = {}): Promise<SearchResult[]> {
    if (!this.supabase) return [];
    
    let queryBuilder = this.supabase
      .from('sw_templates')
      .select(`
        *,
        sw_categories (
          id,
          name,
          display_name,
          description,
          cover_image
        )
      `)
      .eq('status', 'published');

    // Apply filters
    if (options.categoryId) {
      queryBuilder = queryBuilder.eq('category_id', options.categoryId);
    }

    if (options.priceRange) {
      if (options.priceRange.min !== undefined) {
        queryBuilder = queryBuilder.gte('price', options.priceRange.min);
      }
      if (options.priceRange.max !== undefined) {
        queryBuilder = queryBuilder.lte('price', options.priceRange.max);
      }
    }

    // Apply limit and offset
    if (options.limit) {
      queryBuilder = queryBuilder.limit(options.limit);
    }
    if (options.offset) {
      queryBuilder = queryBuilder.range(options.offset, options.offset + (options.limit || 50) - 1);
    }

    const { data, error } = await queryBuilder;

    if (error) {
      console.error('Error searching templates:', error);
      return [];
    }

    // Process results and calculate relevance scores
    const results: SearchResult[] = [];
    
    for (const template of data || []) {
      const relevanceScore = this.calculateRelevanceScore(query, template);
      const matchedFields = this.getMatchedFields(query, template);
      
      if (relevanceScore > 0) {
        results.push({
          template,
          relevance_score: relevanceScore,
          matched_fields: matchedFields,
          category: template.sw_categories
        });
      }
    }

    // Sort by relevance score
    results.sort((a, b) => b.relevance_score - a.relevance_score);

    return results;
  }

  private calculateRelevanceScore(query: string, template: any): number {
    const queryLower = query.toLowerCase();
    let score = 0;

    // Title match (highest weight)
    if (template.title?.toLowerCase().includes(queryLower)) {
      score += 10;
    }

    // Description match
    if (template.description?.toLowerCase().includes(queryLower)) {
      score += 5;
    }

    // Category match
    if (template.sw_categories?.name?.toLowerCase().includes(queryLower)) {
      score += 3;
    }

    // Keyword matches (will be enhanced with actual keywords table)
    // This is a placeholder for now

    return score;
  }

  private getMatchedFields(query: string, template: any): string[] {
    const queryLower = query.toLowerCase();
    const fields: string[] = [];

    if (template.title?.toLowerCase().includes(queryLower)) {
      fields.push('title');
    }
    if (template.description?.toLowerCase().includes(queryLower)) {
      fields.push('description');
    }
    if (template.sw_categories?.name?.toLowerCase().includes(queryLower)) {
      fields.push('category');
    }

    return fields;
  }

  // Utility methods
  async getTemplatesCount(): Promise<number> {
    if (!this.supabase) return 0;
    
    const { count, error } = await this.supabase
      .from('sw_templates')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'published');

    if (error) {
      console.error('Error getting templates count:', error);
      return 0;
    }

    return count || 0;
  }

  async getCategoriesCount(): Promise<number> {
    if (!this.supabase) return 0;
    
    const { count, error } = await this.supabase
      .from('sw_categories')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true);

    if (error) {
      console.error('Error getting categories count:', error);
      return 0;
    }

    return count || 0;
  }
}
