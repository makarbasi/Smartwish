import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export interface DbTemplate {
  id: string;
  title: string;
  category: string;
  description: string;
  search_keywords: string[] | null;
  upload_time?: string | null;
  author?: string | null;
  price?: number | null;
  language?: string | null;
  region?: string | null;
  popularity?: number | null;
  num_downloads?: number | null;
  pages: any; // JSONB
}

export interface DbCategory {
  id: string;
  name: string;
  display_name: string;
  description?: string | null;
  cover_image?: string | null;
  sort_order?: number | null;
}

@Injectable()
export class SupabaseTemplatesService {
  private supabase: SupabaseClient | null = null;

  constructor() {
    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (supabaseUrl && serviceRoleKey) {
      this.supabase = createClient(supabaseUrl, serviceRoleKey);
      console.log('✅ SupabaseTemplatesService initialized');
    } else {
      console.warn('SupabaseTemplatesService not configured (missing env)');
    }
  }

  isConfigured(): boolean {
    return !!this.supabase;
  }

  async getAllCategories(): Promise<DbCategory[]> {
    if (!this.supabase) throw new Error('Supabase not configured');
    const { data, error } = await this.supabase
      .from('sw_categories')
      .select('*')
      .order('sort_order', { ascending: true });
    if (error) throw error;
    return data as DbCategory[];
  }

  async getCategoryById(categoryId: string): Promise<DbCategory | null> {
    if (!this.supabase) throw new Error('Supabase not configured');
    const { data, error } = await this.supabase
      .from('sw_categories')
      .select('*')
      .eq('id', categoryId)
      .single();
    if (error) return null;
    return data as DbCategory;
  }

  async getAllTemplates(): Promise<DbTemplate[]> {
    if (!this.supabase) throw new Error('Supabase not configured');
    const { data, error } = await this.supabase
      .from('sw_templates')
      .select('*');
    if (error) throw error;
    return data as DbTemplate[];
  }

  async getTemplateById(templateId: string): Promise<DbTemplate | null> {
    if (!this.supabase) throw new Error('Supabase not configured');
    const { data, error } = await this.supabase
      .from('sw_templates')
      .select('*')
      .eq('id', templateId)
      .single();
    if (error) return null;
    return data as DbTemplate;
  }

  async getTemplatesByCategory(categoryId: string): Promise<DbTemplate[]> {
    if (!this.supabase) throw new Error('Supabase not configured');
    const { data, error } = await this.supabase
      .from('sw_templates')
      .select('*')
      .eq('category', categoryId);
    if (error) throw error;
    return data as DbTemplate[];
  }

  async searchTemplates(searchTerm: string): Promise<DbTemplate[]> {
    if (!this.supabase) throw new Error('Supabase not configured');
    const term = searchTerm.toLowerCase();
    // Basic search across title/description/keywords using ilike/or
    const { data, error } = await this.supabase
      .from('sw_templates')
      .select('*')
      .or(
        `title.ilike.%${term}%,description.ilike.%${term}%,search_keywords.cs.{${term}}`,
      );
    if (error) throw error;
    return data as DbTemplate[];
  }
}


