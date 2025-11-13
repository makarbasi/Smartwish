import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface SemanticSearchResult {
  template: any;
  similarity_score: number;
  matched_by: 'semantic' | 'keyword' | 'hybrid';
}

@Injectable()
export class SemanticSearchService {
  private supabase: SupabaseClient | null;
  private genAI: GoogleGenerativeAI | null;
  private embeddingModel: any;

  constructor() {
    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase credentials not configured');
      this.supabase = null;
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey);
    }

    // Initialize Google Gemini for embeddings
    const apiKey = process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.warn('⚠️  GOOGLE_API_KEY not set - semantic search will be limited');
      this.genAI = null;
    } else {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.embeddingModel = this.genAI.getGenerativeModel({ model: 'embedding-001' });
    }
  }

  /**
   * Generate embedding for a search query using Google Gemini
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    if (!this.genAI) {
      console.warn('Gemini not configured, cannot generate embedding');
      return [];
    }

    try {
      const result = await this.embeddingModel.embedContent(query);
      return result.embedding.values || [];
    } catch (error) {
      console.error('Error generating query embedding:', error);
      return [];
    }
  }

  /**
   * Search templates using vector similarity (semantic search)
   * Uses Supabase's pgvector extension for efficient similarity search
   */
  async searchByEmbedding(
    query: string,
    options: {
      categoryId?: string;
      limit?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    if (!this.supabase) {
      console.error('Supabase not configured');
      return [];
    }

    const limit = options.limit || 20;
    const minSimilarity = options.minSimilarity || 0.5;

    // Generate embedding for search query
    console.log('🔍 Generating embedding for query:', query);
    const queryEmbedding = await this.generateQueryEmbedding(query);

    if (!queryEmbedding || queryEmbedding.length === 0) {
      console.warn('Could not generate query embedding, falling back to keyword search');
      return this.keywordSearch(query, options);
    }

    try {
      // Use Supabase RPC function for vector similarity search
      // This requires a database function to be created (see setup below)
      let rpcQuery = this.supabase
        .rpc('match_templates_by_embedding', {
          query_embedding: queryEmbedding,
          match_threshold: minSimilarity,
          match_count: limit,
        });

      // Apply category filter if provided
      if (options.categoryId) {
        // Note: This filter should be added to the RPC function for efficiency
        // For now, we'll filter results after retrieval
      }

      const { data, error } = await rpcQuery;

      if (error) {
        console.error('Error in vector search:', error);
        return this.keywordSearch(query, options);
      }

      // Transform results
      const results: SemanticSearchResult[] = (data || []).map((item: any) => ({
        template: item,
        similarity_score: item.similarity || 0,
        matched_by: 'semantic' as const,
      }));

      // Apply category filter if needed (client-side filtering as fallback)
      let filteredResults = results;
      if (options.categoryId) {
        filteredResults = results.filter(
          (r) => r.template.category_id === options.categoryId
        );
      }

      console.log(`✅ Found ${filteredResults.length} results with semantic search`);
      return filteredResults;

    } catch (error) {
      console.error('Error in semantic search:', error);
      return this.keywordSearch(query, options);
    }
  }

  /**
   * Hybrid search: Combines semantic and keyword search
   * Returns results that match either by meaning or by keywords
   */
  async hybridSearch(
    query: string,
    options: {
      categoryId?: string;
      limit?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    const limit = options.limit || 20;

    // Run both searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      this.searchByEmbedding(query, { ...options, limit: limit }),
      this.keywordSearch(query, { ...options, limit: limit }),
    ]);

    // Merge results, avoiding duplicates
    const seenIds = new Set<string>();
    const mergedResults: SemanticSearchResult[] = [];

    // Add semantic results first (higher priority)
    for (const result of semanticResults) {
      if (!seenIds.has(result.template.id)) {
        seenIds.add(result.template.id);
        mergedResults.push({
          ...result,
          matched_by: 'hybrid',
        });
      }
    }

    // Add keyword results that weren't found by semantic search
    for (const result of keywordResults) {
      if (!seenIds.has(result.template.id)) {
        seenIds.add(result.template.id);
        mergedResults.push({
          ...result,
          matched_by: 'hybrid',
        });
      }
    }

    // Sort by similarity score
    mergedResults.sort((a, b) => b.similarity_score - a.similarity_score);

    // Limit results
    return mergedResults.slice(0, limit);
  }

  /**
   * Fallback keyword search for when semantic search fails
   */
  private async keywordSearch(
    query: string,
    options: {
      categoryId?: string;
      limit?: number;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    if (!this.supabase) return [];

    const limit = options.limit || 20;
    const term = query.toLowerCase();

    try {
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
        .or(
          `title.ilike.%${term}%,description.ilike.%${term}%,message.ilike.%${term}%,occasion_type.ilike.%${term}%`
        )
        .limit(limit);

      // Apply category filter
      if (options.categoryId) {
        queryBuilder = queryBuilder.eq('category_id', options.categoryId);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Error in keyword search:', error);
        return [];
      }

      // Calculate simple relevance scores based on keyword matches
      const results: SemanticSearchResult[] = (data || []).map((template) => {
        const titleMatch = template.title?.toLowerCase().includes(term) ? 0.4 : 0;
        const descMatch = template.description?.toLowerCase().includes(term) ? 0.3 : 0;
        const messageMatch = template.message?.toLowerCase().includes(term) ? 0.2 : 0;
        const occasionMatch = template.occasion_type?.toLowerCase().includes(term) ? 0.1 : 0;
        
        const score = titleMatch + descMatch + messageMatch + occasionMatch;

        return {
          template,
          similarity_score: score,
          matched_by: 'keyword' as const,
        };
      });

      // Sort by score
      results.sort((a, b) => b.similarity_score - a.similarity_score);

      console.log(`✅ Found ${results.length} results with keyword search`);
      return results;

    } catch (error) {
      console.error('Error in keyword search:', error);
      return [];
    }
  }

  /**
   * Get similar templates to a given template (recommendations)
   */
  async findSimilarTemplates(
    templateId: string,
    options: {
      limit?: number;
      minSimilarity?: number;
    } = {}
  ): Promise<SemanticSearchResult[]> {
    if (!this.supabase) return [];

    const limit = options.limit || 10;
    const minSimilarity = options.minSimilarity || 0.7;

    try {
      // Get the template's embedding
      const { data: template, error } = await this.supabase
        .from('sw_templates')
        .select('embedding_vector')
        .eq('id', templateId)
        .single();

      if (error || !template?.embedding_vector) {
        console.error('Error getting template embedding:', error);
        return [];
      }

      // Use RPC function to find similar templates
      const { data, error: searchError } = await this.supabase
        .rpc('match_templates_by_embedding', {
          query_embedding: template.embedding_vector,
          match_threshold: minSimilarity,
          match_count: limit + 1, // +1 because the template itself will be in results
        });

      if (searchError) {
        console.error('Error finding similar templates:', searchError);
        return [];
      }

      // Filter out the original template
      const results = (data || [])
        .filter((item: any) => item.id !== templateId)
        .map((item: any) => ({
          template: item,
          similarity_score: item.similarity || 0,
          matched_by: 'semantic' as const,
        }));

      return results.slice(0, limit);

    } catch (error) {
      console.error('Error finding similar templates:', error);
      return [];
    }
  }
}

