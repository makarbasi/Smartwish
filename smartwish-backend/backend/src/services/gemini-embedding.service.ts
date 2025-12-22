import { Injectable } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

@Injectable()
export class GeminiEmbeddingService {
  private genAI: GoogleGenerativeAI | null = null;
  private embeddingModel: any = null;

  constructor() {
    // Check for GEMINI_API_KEY first (preferred), then fallback to GOOGLE_API_KEY
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    
    if (!apiKey) {
      console.warn('⚠️  GEMINI_API_KEY or GOOGLE_API_KEY not set - embedding service will be limited');
      return;
    }

    try {
      this.genAI = new GoogleGenerativeAI(apiKey);
      this.embeddingModel = this.genAI.getGenerativeModel({ model: 'embedding-001' });
      console.log('✅ Gemini Embedding Service initialized');
    } catch (error) {
      console.error('❌ Failed to initialize Gemini Embedding Service:', error);
    }
  }

  /**
   * Generate embedding for a text string
   */
  async generateEmbedding(text: string): Promise<number[]> {
    if (!this.genAI || !this.embeddingModel) {
      console.warn('Gemini not configured, cannot generate embedding');
      return [];
    }

    try {
      const result = await this.embeddingModel.embedContent(text);
      return result.embedding.values || [];
    } catch (error) {
      console.error('Error generating embedding:', error);
      return [];
    }
  }

  /**
   * Calculate cosine similarity between two vectors
   */
  cosineSimilarity(vec1: number[], vec2: number[]): number {
    if (!vec1 || !vec2 || vec1.length === 0 || vec2.length === 0) {
      return 0;
    }

    if (vec1.length !== vec2.length) {
      console.warn(`Vector length mismatch: ${vec1.length} vs ${vec2.length}`);
      return 0;
    }

    try {
      let dotProduct = 0;
      let norm1 = 0;
      let norm2 = 0;

      for (let i = 0; i < vec1.length; i++) {
        dotProduct += vec1[i] * vec2[i];
        norm1 += vec1[i] * vec1[i];
        norm2 += vec2[i] * vec2[i];
      }

      norm1 = Math.sqrt(norm1);
      norm2 = Math.sqrt(norm2);

      if (norm1 === 0 || norm2 === 0) {
        return 0;
      }

      return dotProduct / (norm1 * norm2);
    } catch (error) {
      console.error('Error calculating cosine similarity:', error);
      return 0;
    }
  }

  /**
   * Generate a semantic description from template data for embedding
   */
  generateSemanticDescription(template: any): string {
    const parts: string[] = [];

    // Title (most important)
    if (template.title) {
      parts.push(`Title: ${template.title}`);
    }

    // Category information
    if (template.category_name || template.category_display_name) {
      const categoryName = template.category_display_name || template.category_name;
      parts.push(`Category: ${categoryName}`);
    }

    // Description
    if (template.description) {
      parts.push(`Description: ${template.description}`);
    }

    // Message/Inside note
    if (template.message) {
      parts.push(`Message: ${template.message}`);
    }

    // Target audience
    if (template.target_audience) {
      parts.push(`For: ${template.target_audience}`);
    }

    // Occasion type
    if (template.occasion_type) {
      parts.push(`Occasion: ${template.occasion_type}`);
    }

    // Style
    if (template.style_type) {
      parts.push(`Style: ${template.style_type}`);
    }

    // Keywords (if available)
    if (template.search_keywords && Array.isArray(template.search_keywords)) {
      parts.push(`Keywords: ${template.search_keywords.join(', ')}`);
    }

    return parts.join('. ');
  }

  /**
   * Check if the service is properly configured
   */
  isConfigured(): boolean {
    return this.genAI !== null && this.embeddingModel !== null;
  }
}

