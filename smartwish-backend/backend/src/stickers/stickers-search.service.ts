import { Injectable } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { GoogleGenerativeAI } from '@google/generative-ai';

export interface StickerSearchResult {
  id: string;
  title: string;
  slug: string;
  description?: string;
  category: string;
  image_url: string;
  thumbnail_url?: string;
  tags: string[];
  search_keywords?: string[];
  popularity: number;
  num_downloads: number;
  similarity?: number;
  matched_by: 'semantic' | 'keyword' | 'hybrid';
}

export interface SearchOptions {
  category?: string;
  limit?: number;
  minSimilarity?: number;
}

@Injectable()
export class StickersSearchService {
  private supabase: SupabaseClient | null = null;
  private genAI: GoogleGenerativeAI | null = null;
  private embeddingModel: any = null;

  constructor() {
    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Supabase credentials not configured for sticker search');
      this.supabase = null;
    } else {
      this.supabase = createClient(supabaseUrl, supabaseKey);
      console.log('✅ Sticker search service connected to Supabase');
    }

    // Initialize Google Gemini for embeddings
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) {
      console.warn('⚠️ GEMINI_API_KEY or GOOGLE_API_KEY not set - semantic search will be limited');
      this.genAI = null;
    } else {
      try {
        this.genAI = new GoogleGenerativeAI(apiKey);
        this.embeddingModel = this.genAI.getGenerativeModel({ model: 'embedding-001' });
        console.log('✅ Sticker search service initialized with Gemini');
      } catch (error) {
        console.error('❌ Failed to initialize Gemini for sticker search:', error);
      }
    }
  }

  /**
   * Generate embedding for a search query using Google Gemini
   */
  private async generateQueryEmbedding(query: string): Promise<number[]> {
    if (!this.genAI || !this.embeddingModel) {
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
   * Search stickers using vector similarity (semantic search)
   */
  async searchByEmbedding(
    query: string,
    options: SearchOptions = {},
  ): Promise<StickerSearchResult[]> {
    if (!this.supabase) {
      console.error('Supabase not configured');
      return [];
    }

    const limit = options.limit || 20;
    const minSimilarity = options.minSimilarity || 0.3;

    // Generate embedding for search query
    console.log('🔍 Generating embedding for sticker query:', query);
    const queryEmbedding = await this.generateQueryEmbedding(query);

    if (!queryEmbedding || queryEmbedding.length === 0) {
      console.warn('Could not generate query embedding, falling back to keyword search');
      return this.keywordSearch(query, options);
    }

    try {
      let rpcName = 'match_stickers_by_embedding';
      let rpcParams: any = {
        query_embedding: queryEmbedding,
        match_threshold: minSimilarity,
        match_count: limit,
      };

      // Use category-specific search if category filter provided
      if (options.category) {
        rpcName = 'match_stickers_by_embedding_and_category';
        rpcParams.filter_category = options.category;
      }

      const { data, error } = await this.supabase.rpc(rpcName, rpcParams);

      if (error) {
        console.error('Error in sticker vector search:', error);
        return this.keywordSearch(query, options);
      }

      // Transform results
      const results: StickerSearchResult[] = (data || []).map((item: any) => ({
        id: item.id,
        title: item.title,
        slug: item.slug,
        description: item.description,
        category: item.category,
        image_url: item.image_url,
        thumbnail_url: item.thumbnail_url,
        tags: item.tags || [],
        search_keywords: item.search_keywords || [],
        popularity: item.popularity || 0,
        num_downloads: item.num_downloads || 0,
        similarity: item.similarity,
        matched_by: 'semantic' as const,
      }));

      console.log(`✅ Found ${results.length} stickers with semantic search`);
      return results;
    } catch (error) {
      console.error('Error in semantic search:', error);
      return this.keywordSearch(query, options);
    }
  }

  /**
   * Keyword-based search for stickers (fallback)
   */
  async keywordSearch(
    query: string,
    options: SearchOptions = {},
  ): Promise<StickerSearchResult[]> {
    if (!this.supabase) return [];

    const limit = options.limit || 20;
    const term = query.toLowerCase();

    try {
      let queryBuilder = this.supabase
        .from('stickers')
        .select('*')
        .eq('status', 'active')
        .or(
          `title.ilike.%${term}%,description.ilike.%${term}%,category.ilike.%${term}%`,
        )
        .order('popularity', { ascending: false })
        .limit(limit);

      // Apply category filter
      if (options.category) {
        queryBuilder = queryBuilder.eq('category', options.category);
      }

      const { data, error } = await queryBuilder;

      if (error) {
        console.error('Error in keyword search:', error);
        return [];
      }

      // Calculate simple relevance scores
      const results: StickerSearchResult[] = (data || []).map((sticker: any) => {
        const titleMatch = sticker.title?.toLowerCase().includes(term) ? 0.4 : 0;
        const descMatch = sticker.description?.toLowerCase().includes(term) ? 0.3 : 0;
        const categoryMatch = sticker.category?.toLowerCase().includes(term) ? 0.2 : 0;
        const tagMatch = sticker.tags?.some((t: string) => t.toLowerCase().includes(term)) ? 0.1 : 0;

        const score = titleMatch + descMatch + categoryMatch + tagMatch;

        return {
          id: sticker.id,
          title: sticker.title,
          slug: sticker.slug,
          description: sticker.description,
          category: sticker.category,
          image_url: sticker.image_url,
          thumbnail_url: sticker.thumbnail_url,
          tags: sticker.tags || [],
          search_keywords: sticker.search_keywords || [],
          popularity: sticker.popularity || 0,
          num_downloads: sticker.num_downloads || 0,
          similarity: score,
          matched_by: 'keyword' as const,
        };
      });

      // Sort by score
      results.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

      console.log(`✅ Found ${results.length} stickers with keyword search`);
      return results;
    } catch (error) {
      console.error('Error in keyword search:', error);
      return [];
    }
  }

  /**
   * Hybrid search: Combines semantic and keyword search
   */
  async hybridSearch(
    query: string,
    options: SearchOptions = {},
  ): Promise<StickerSearchResult[]> {
    const limit = options.limit || 20;

    // Run both searches in parallel
    const [semanticResults, keywordResults] = await Promise.all([
      this.searchByEmbedding(query, { ...options, limit }),
      this.keywordSearch(query, { ...options, limit }),
    ]);

    // Merge results, avoiding duplicates
    const seenIds = new Set<string>();
    const mergedResults: StickerSearchResult[] = [];

    // Add semantic results first (higher priority)
    for (const result of semanticResults) {
      if (!seenIds.has(result.id)) {
        seenIds.add(result.id);
        mergedResults.push({
          ...result,
          matched_by: 'hybrid',
        });
      }
    }

    // Add keyword results that weren't found by semantic search
    for (const result of keywordResults) {
      if (!seenIds.has(result.id)) {
        seenIds.add(result.id);
        mergedResults.push({
          ...result,
          matched_by: 'hybrid',
        });
      }
    }

    // Sort by similarity score
    mergedResults.sort((a, b) => (b.similarity || 0) - (a.similarity || 0));

    // Limit results
    return mergedResults.slice(0, limit);
  }

  /**
   * Find similar stickers to a given sticker (recommendations)
   */
  async findSimilarStickers(
    stickerId: string,
    options: { limit?: number; minSimilarity?: number } = {},
  ): Promise<StickerSearchResult[]> {
    if (!this.supabase) return [];

    const limit = options.limit || 10;
    const minSimilarity = options.minSimilarity || 0.6;

    try {
      // Get the sticker's embedding
      const { data: sticker, error } = await this.supabase
        .from('stickers')
        .select('embedding_vector')
        .eq('id', stickerId)
        .single();

      if (error || !sticker?.embedding_vector) {
        console.error('Error getting sticker embedding:', error);
        return [];
      }

      // Use RPC function to find similar stickers
      const { data, error: searchError } = await this.supabase.rpc(
        'match_stickers_by_embedding',
        {
          query_embedding: sticker.embedding_vector,
          match_threshold: minSimilarity,
          match_count: limit + 1, // +1 because the sticker itself will be in results
        },
      );

      if (searchError) {
        console.error('Error finding similar stickers:', searchError);
        return [];
      }

      // Filter out the original sticker
      const results = (data || [])
        .filter((item: any) => item.id !== stickerId)
        .map((item: any) => ({
          id: item.id,
          title: item.title,
          slug: item.slug,
          description: item.description,
          category: item.category,
          image_url: item.image_url,
          thumbnail_url: item.thumbnail_url,
          tags: item.tags || [],
          search_keywords: item.search_keywords || [],
          popularity: item.popularity || 0,
          num_downloads: item.num_downloads || 0,
          similarity: item.similarity,
          matched_by: 'semantic' as const,
        }));

      return results.slice(0, limit);
    } catch (error) {
      console.error('Error finding similar stickers:', error);
      return [];
    }
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return this.supabase !== null;
  }

  /**
   * Check if semantic search is available
   */
  isSemanticSearchAvailable(): boolean {
    return this.genAI !== null && this.embeddingModel !== null;
  }
}
