import { Controller, Get, Post, Put, Delete, Body, Param, Query, HttpException, HttpStatus } from '@nestjs/common';
import { SupabaseTemplatesEnhancedService, Template, Category, SearchResult } from './supabase-templates-enhanced.service';
import { GeminiEmbeddingService } from '../services/gemini-embedding.service';
import { SupabaseService } from '../supabase/supabase.service';
import fetch from 'node-fetch';

@Controller('templates-enhanced')
export class TemplatesEnhancedController {
  constructor(
    private readonly templatesEnhancedService: SupabaseTemplatesEnhancedService,
    private readonly embeddingService: GeminiEmbeddingService,
    private readonly supabaseService: SupabaseService,
  ) { }

  // Category endpoints
  @Get('categories')
  async getAllCategories() {
    try {
      const categories = await this.templatesEnhancedService.getAllCategories();
      return {
        success: true,
        data: categories,
        count: categories.length
      };
    } catch (error) {
      console.error('Error fetching categories:', error);
      throw new HttpException('Failed to fetch categories', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('categories/:id')
  async getCategoryById(@Param('id') id: string) {
    try {
      const category = await this.templatesEnhancedService.getCategoryById(id);
      if (!category) {
        throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
      }
      return {
        success: true,
        data: category
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error fetching category:', error);
      throw new HttpException('Failed to fetch category', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('categories')
  async createCategory(@Body() categoryData: Omit<Category, 'created_at' | 'updated_at'>) {
    try {
      const category = await this.templatesEnhancedService.createCategory(categoryData);
      if (!category) {
        throw new HttpException('Failed to create category', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return {
        success: true,
        data: category
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error creating category:', error);
      throw new HttpException('Failed to create category', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('categories/:id')
  async updateCategory(@Param('id') id: string, @Body() updates: Partial<Category>) {
    try {
      const category = await this.templatesEnhancedService.updateCategory(id, updates);
      if (!category) {
        throw new HttpException('Category not found', HttpStatus.NOT_FOUND);
      }
      return {
        success: true,
        data: category
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error updating category:', error);
      throw new HttpException('Failed to update category', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('categories/:id')
  async deleteCategory(@Param('id') id: string) {
    try {
      const success = await this.templatesEnhancedService.deleteCategory(id);
      if (!success) {
        throw new HttpException('Failed to delete category', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return {
        success: true,
        message: 'Category deleted successfully'
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error deleting category:', error);
      throw new HttpException('Failed to delete category', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Template endpoints
  @Get('templates')
  async getAllTemplates() {
    try {
      const templates = await this.templatesEnhancedService.getAllTemplates();
      return {
        success: true,
        data: templates,
        count: templates.length
      };
    } catch (error) {
      console.error('Error fetching templates:', error);
      throw new HttpException('Failed to fetch templates', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Enhanced search endpoint with filter support (must be before parameterized routes)
  // Now uses HYBRID SEARCH: Embeddings (speed) + Gemini AI (intelligence)
  @Get('templates/search')
  async searchTemplatesWithFilters(
    @Query('q') query?: string,
    @Query('category_id') categoryId?: string,
    @Query('author') author?: string,
    @Query('region') region?: string,
    @Query('language') language?: string,
    @Query('limit') limit?: string
  ) {
    try {
      // If there's a text query, use hybrid semantic search
      if (query && query.trim().length > 0) {
        console.log(`\n🔍 [Hybrid Search] User query: "${query}"`);

        try {
          // Use hybrid search (embeddings + Gemini AI)
          const hybridResults = await this.hybridSemanticSearch(query, {
            categoryId,
            author,
            region,
            language,
            limit: limit ? parseInt(limit) : undefined
          });

          console.log(`✅ [Hybrid Search] Found ${hybridResults.length} results`);

          return {
            success: true,
            data: hybridResults,
            count: hybridResults.length,
            total: hybridResults.length,
            method: 'hybrid-search'
          };
        } catch (hybridError) {
          console.error('[Hybrid Search] Failed, falling back to basic search:', hybridError);
          // Fallback to basic search if hybrid fails
        }
      }

      // No query or hybrid search failed - use basic filter search
      const results = await this.templatesEnhancedService.searchTemplatesWithFilters({
        query,
        categoryId,
        author,
        region,
        language,
        limit: limit ? parseInt(limit) : undefined
      });

      return {
        success: true,
        data: results,
        count: results.length,
        total: results.length,
        method: 'basic-filter'
      };
    } catch (error) {
      console.error('Error searching templates with filters:', error);
      throw new HttpException('Failed to search templates', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('templates/:id')
  async getTemplateById(@Param('id') id: string) {
    try {
      const template = await this.templatesEnhancedService.getTemplateById(id);
      if (!template) {
        throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
      }
      return {
        success: true,
        data: template
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error fetching template:', error);
      throw new HttpException('Failed to fetch template', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('templates/category/:categoryId')
  async getTemplatesByCategory(@Param('categoryId') categoryId: string) {
    try {
      const templates = await this.templatesEnhancedService.getTemplatesByCategory(categoryId);
      return {
        success: true,
        data: templates,
        count: templates.length
      };
    } catch (error) {
      console.error('Error fetching templates by category:', error);
      throw new HttpException('Failed to fetch templates by category', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('templates/:id/full')
  async getTemplateWithPages(@Param('id') id: string) {
    try {
      const result = await this.templatesEnhancedService.getTemplateWithPages(id);
      if (!result) {
        throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
      }
      return {
        success: true,
        data: result
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error fetching template with pages:', error);
      throw new HttpException('Failed to fetch template with pages', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('templates')
  async createTemplate(@Body() templateData: Omit<Template, 'created_at' | 'updated_at'>) {
    try {
      const template = await this.templatesEnhancedService.createTemplate(templateData);
      if (!template) {
        throw new HttpException('Failed to create template', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return {
        success: true,
        data: template
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error creating template:', error);
      throw new HttpException('Failed to create template', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Put('templates/:id')
  async updateTemplate(@Param('id') id: string, @Body() updates: Partial<Template>) {
    try {
      const template = await this.templatesEnhancedService.updateTemplate(id, updates);
      if (!template) {
        throw new HttpException('Template not found', HttpStatus.NOT_FOUND);
      }
      return {
        success: true,
        data: template
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error updating template:', error);
      throw new HttpException('Failed to update template', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Delete('templates/:id')
  async deleteTemplate(@Param('id') id: string) {
    try {
      const success = await this.templatesEnhancedService.deleteTemplate(id);
      if (!success) {
        throw new HttpException('Failed to delete template', HttpStatus.INTERNAL_SERVER_ERROR);
      }
      return {
        success: true,
        message: 'Template deleted successfully'
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error deleting template:', error);
      throw new HttpException('Failed to delete template', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Original search endpoint (keeping for backward compatibility)
  @Post('search')
  async searchTemplates(
    @Body() searchData: {
      query: string;
      categoryId?: string;
      tags?: string[];
      priceRange?: { min: number; max: number };
      limit?: number;
      offset?: number;
    }
  ) {
    try {
      if (!searchData.query) {
        throw new HttpException('Search query is required', HttpStatus.BAD_REQUEST);
      }

      const results = await this.templatesEnhancedService.searchTemplates(
        searchData.query,
        {
          categoryId: searchData.categoryId,
          tags: searchData.tags,
          priceRange: searchData.priceRange,
          limit: searchData.limit || 50,
          offset: searchData.offset || 0
        }
      );

      return {
        success: true,
        data: results,
        count: results.length,
        query: searchData.query
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error searching templates:', error);
      throw new HttpException('Failed to search templates', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Tags endpoints
  @Get('tags')
  async getAllTags() {
    try {
      const tags = await this.templatesEnhancedService.getAllTags();
      return {
        success: true,
        data: tags,
        count: tags.length
      };
    } catch (error) {
      console.error('Error fetching tags:', error);
      throw new HttpException('Failed to fetch tags', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Get('templates/:id/tags')
  async getTemplateTags(@Param('id') templateId: string) {
    try {
      const tags = await this.templatesEnhancedService.getTemplateTags(templateId);
      return {
        success: true,
        data: tags,
        count: tags.length
      };
    } catch (error) {
      console.error('Error fetching template tags:', error);
      throw new HttpException('Failed to fetch template tags', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Keywords endpoints
  @Get('templates/:id/keywords')
  async getTemplateKeywords(@Param('id') templateId: string) {
    try {
      const keywords = await this.templatesEnhancedService.getTemplateKeywords(templateId);
      return {
        success: true,
        data: keywords,
        count: keywords.length
      };
    } catch (error) {
      console.error('Error fetching template keywords:', error);
      throw new HttpException('Failed to fetch template keywords', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  @Post('templates/:id/keywords')
  async addTemplateKeywords(
    @Param('id') templateId: string,
    @Body() data: { keywords: string[] }
  ) {
    try {
      if (!data.keywords || !Array.isArray(data.keywords)) {
        throw new HttpException('Keywords array is required', HttpStatus.BAD_REQUEST);
      }

      const success = await this.templatesEnhancedService.addTemplateKeywords(templateId, data.keywords);
      if (!success) {
        throw new HttpException('Failed to add template keywords', HttpStatus.INTERNAL_SERVER_ERROR);
      }

      return {
        success: true,
        message: 'Keywords added successfully'
      };
    } catch (error) {
      if (error instanceof HttpException) throw error;
      console.error('Error adding template keywords:', error);
      throw new HttpException('Failed to add template keywords', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // Statistics endpoint
  @Get('stats')
  async getStats() {
    try {
      const [templatesCount, categoriesCount] = await Promise.all([
        this.templatesEnhancedService.getTemplatesCount(),
        this.templatesEnhancedService.getCategoriesCount()
      ]);

      return {
        success: true,
        data: {
          templates: templatesCount,
          categories: categoriesCount
        }
      };
    } catch (error) {
      console.error('Error fetching stats:', error);
      throw new HttpException('Failed to fetch statistics', HttpStatus.INTERNAL_SERVER_ERROR);
    }
  }

  // =========================================================================
  // HYBRID SEMANTIC SEARCH (Private Helper Method)
  // =========================================================================

  /**
   * Hybrid search combining embeddings (speed) with Gemini AI (intelligence)
   * Stage 1: Use embeddings to find top 30 candidates quickly
   * Stage 2: Use Gemini AI to understand intent and filter/rank intelligently
   */
  private async hybridSemanticSearch(
    query: string,
    filters?: {
      categoryId?: string;
      author?: string;
      region?: string;
      language?: string;
      limit?: number;
    }
  ): Promise<any[]> {
    const startTime = Date.now();

    // STAGE 1: Use efficient pgvector database search
    console.log('[Stage 1: Vector Search] Generating query embedding...');
    const queryEmbedding = await this.embeddingService.generateEmbedding(query);

    if (!queryEmbedding || queryEmbedding.length === 0) {
      throw new Error('Failed to generate query embedding');
    }

    const supabase = this.supabaseService.getClient();
    const limit = filters?.limit || 20;
    const matchThreshold = 0.25; // Minimum similarity threshold

    // Use the efficient RPC function for vector similarity search
    // This is 10-100x faster than fetching all and calculating client-side!
    console.log('[Stage 1: Vector Search] Searching database with pgvector...');
    
    let searchResults;
    if (filters?.categoryId) {
      // Use category-specific search function
      const { data, error } = await supabase.rpc('match_templates_by_embedding_and_category', {
        query_embedding: queryEmbedding,
        filter_category_id: filters.categoryId,
        match_threshold: matchThreshold,
        match_count: limit * 2 // Get more candidates for Gemini filtering
      });
      
      if (error) {
        console.error('[Vector Search] Database error:', error);
        throw new Error(`Vector search failed: ${error.message}`);
      }
      searchResults = data;
    } else {
      // Use general search function
      const { data, error } = await supabase.rpc('match_templates_by_embedding', {
        query_embedding: queryEmbedding,
        match_threshold: matchThreshold,
        match_count: limit * 2
      });
      
      if (error) {
        console.error('[Vector Search] Database error:', error);
        throw new Error(`Vector search failed: ${error.message}`);
      }
      searchResults = data;
    }

    if (!searchResults || searchResults.length === 0) {
      console.log('[Stage 1: Vector Search] No templates found matching query');
      return [];
    }

    console.log(`[Stage 1: Vector Search] Found ${searchResults.length} candidates (in-database search)`);

    // Enrich results with category and author information
    const enrichedResults = await Promise.all(
      searchResults.map(async (result: any) => {
        try {
          // Fetch category info
          const { data: category } = await supabase
            .from('sw_categories')
            .select('name, display_name')
            .eq('id', result.category_id)
            .single();

          // Fetch author info
          const { data: author } = await supabase
            .from('users')
            .select('name, email')
            .eq('id', result.author_id)
            .single();

          return {
            ...result,
            sw_categories: category,
            users: author,
            similarity_score: result.similarity
          };
        } catch (enrichError) {
          console.warn('Error enriching result:', enrichError);
          return {
            ...result,
            similarity_score: result.similarity
          };
        }
      })
    );

    // STAGE 2: Use Gemini AI for intelligent filtering (optional refinement)
    console.log('[Stage 2: Gemini AI] Analyzing candidates...');

    try {
      const filteredResults = await this.filterWithGeminiAI(query, enrichedResults);

      // Apply final limit
      const results = filteredResults.slice(0, limit);

      // Transform user data to author field
      const resultsWithAuthor = results.map(result => {
        const userData = Array.isArray(result.users) ? result.users[0] : result.users;
        return {
          ...result,
          author: userData?.name || userData?.email || 'Unknown Author'
        };
      });

      const totalTime = Date.now() - startTime;
      console.log(`[Hybrid Search] ✅ Completed in ${totalTime}ms - ${resultsWithAuthor.length} results`);
      console.log(`[Performance] ~${Math.round(totalTime / resultsWithAuthor.length)}ms per result`);

      return resultsWithAuthor;
    } catch (geminiError) {
      console.error('[Stage 2: Gemini AI] Failed:', geminiError);
      // Fallback: return top vector search results without Gemini filtering
      const fallbackResults = enrichedResults.slice(0, limit);
      const totalTime = Date.now() - startTime;
      console.log(`[Hybrid Search] ⚠️ Completed (fallback) in ${totalTime}ms - ${fallbackResults.length} results`);
      
      return fallbackResults.map(result => {
        const userData = Array.isArray(result.users) ? result.users[0] : result.users;
        return {
          ...result,
          author: userData?.name || userData?.email || 'Unknown Author'
        };
      });
    }
  }

  /**
   * Use Gemini AI to deeply understand user intent and filter/rank candidates
   */
  private async filterWithGeminiAI(query: string, candidates: any[]): Promise<any[]> {
    if (!process.env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured');
    }

    // Prepare candidate descriptions
    const candidateDescriptions = candidates.map((c, index) => {
      const category = Array.isArray(c.sw_categories)
        ? c.sw_categories[0]?.display_name || c.sw_categories[0]?.name
        : c.sw_categories?.display_name || c.sw_categories?.name;

      const keywords = Array.isArray(c.search_keywords)
        ? c.search_keywords.join(', ')
        : '';

      return `${index + 1}. ID: ${c.id}
   Title: ${c.title}
   Category: ${category || 'N/A'}
   Description: ${c.description || 'No description'}
   Keywords: ${keywords || 'None'}
   Initial Score: ${c.similarity_score.toFixed(3)}`;
    }).join('\n\n');

    const prompt = `You are an expert AI assistant helping users find the perfect greeting card template. Your job is to deeply understand what the user wants and find the most relevant templates.

USER'S REQUEST:
"${query}"

CANDIDATE TEMPLATES (${candidates.length} options):
${candidateDescriptions}

INSTRUCTIONS:
1. Carefully analyze the user's request - understand ALL details (age, gender, occasion, style, tone, relationships, emotions)
2. Consider synonyms and related concepts:
   - "happy" = "joyful" = "cheerful" = "delighted"
   - "girl" = "daughter" = "female child"
   - "birthday" = "celebration" = "party"
3. Evaluate each candidate to see if it truly matches the user's intent
4. Assign a relevance score from 0-10 for each template (10 = perfect match, 0 = not relevant)
5. Only include templates with score >= 6
6. Rank them by relevance (highest first)

Return ONLY a JSON array:
[
  {"id": "template-id", "relevance": 9, "reason": "Brief explanation why it matches"},
  {"id": "template-id", "relevance": 8, "reason": "Brief explanation"}
]

If no templates are relevant (all score < 6), return an empty array: []`;

    const payload = {
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }],
        },
      ],
      generation_config: {
        temperature: 0.2,
        top_p: 0.9,
        top_k: 40,
        max_output_tokens: 1024,
      },
    };

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      },
    );

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`);
    }

    const data = await response.json();
    const responseText = data?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!responseText) {
      throw new Error('No response from Gemini');
    }

    // Parse response
    let geminiResults: Array<{ id: string; relevance: number; reason: string }>;
    try {
      let jsonText = responseText.trim();
      if (jsonText.includes('```json')) {
        jsonText = jsonText.replace(/```json\s*/, '').replace(/\s*```/, '');
      } else if (jsonText.includes('```')) {
        jsonText = jsonText.replace(/```\s*/, '').replace(/\s*```/, '');
      }

      const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        geminiResults = JSON.parse(jsonMatch[0]);
      } else {
        geminiResults = [];
      }

      console.log(`[Gemini AI] Parsed ${geminiResults.length} relevant templates`);
    } catch (parseError) {
      console.error('[Gemini AI] Parse error:', parseError);
      throw new Error('Failed to parse Gemini response');
    }

    // Map results back to full template objects
    const results = geminiResults
      .map((gr) => {
        const template = candidates.find((c) => c.id === gr.id);
        if (!template) return null;

        return {
          ...template,
          ai_relevance_score: gr.relevance,
          ai_match_reason: gr.reason,
          embedding_score: template.similarity_score,
        };
      })
      .filter((r) => r !== null)
      .sort((a, b) => b.ai_relevance_score - a.ai_relevance_score);

    return results;
  }
}
