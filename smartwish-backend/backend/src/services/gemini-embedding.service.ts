import { Injectable, Logger } from '@nestjs/common';
import fetch from 'node-fetch';

/**
 * Service for generating and working with Gemini embeddings for semantic search
 */
@Injectable()
export class GeminiEmbeddingService {
    private readonly logger = new Logger(GeminiEmbeddingService.name);
    private readonly embeddingModel = process.env.GEMINI_EMBEDDING_MODEL || 'text-embedding-004';
    private readonly apiKey = process.env.GEMINI_API_KEY;

    /**
     * Generate an embedding vector for the given text using Gemini API
     * @param text Text to generate embedding for
     * @returns Embedding vector as number array (768 dimensions for text-embedding-004)
     */
    async generateEmbedding(text: string): Promise<number[]> {
        if (!this.apiKey) {
            throw new Error('GEMINI_API_KEY not configured');
        }

        if (!text || text.trim().length === 0) {
            throw new Error('Text cannot be empty');
        }

        const url = `https://generativelanguage.googleapis.com/v1beta/models/${this.embeddingModel}:embedContent?key=${this.apiKey}`;

        try {
            const startTime = Date.now();

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    content: {
                        parts: [
                            {
                                text: text.slice(0, 10000), // Limit text length to avoid API limits
                            },
                        ],
                    },
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(`Gemini API error (${response.status}): ${errorText}`);
            }

            const data = await response.json();
            const embedding = data.embedding?.values;

            if (!embedding || !Array.isArray(embedding)) {
                throw new Error('Invalid embedding response from Gemini API');
            }

            const duration = Date.now() - startTime;
            this.logger.debug(
                `Generated embedding in ${duration}ms (${embedding.length} dimensions)`,
            );

            return embedding;
        } catch (error) {
            this.logger.error('Failed to generate embedding', error);
            throw error;
        }
    }

    /**
     * Calculate cosine similarity between two vectors
     * @param vecA First vector
     * @param vecB Second vector
     * @returns Similarity score between 0 and 1 (1 = identical, 0 = completely different)
     */
    cosineSimilarity(vecA: number[], vecB: number[]): number {
        if (!vecA || !vecB || vecA.length !== vecB.length) {
            throw new Error('Vectors must have the same length');
        }

        let dotProduct = 0;
        let magnitudeA = 0;
        let magnitudeB = 0;

        for (let i = 0; i < vecA.length; i++) {
            dotProduct += vecA[i] * vecB[i];
            magnitudeA += vecA[i] * vecA[i];
            magnitudeB += vecB[i] * vecB[i];
        }

        magnitudeA = Math.sqrt(magnitudeA);
        magnitudeB = Math.sqrt(magnitudeB);

        if (magnitudeA === 0 || magnitudeB === 0) {
            return 0;
        }

        return dotProduct / (magnitudeA * magnitudeB);
    }

    /**
     * Generate a rich semantic description from template data
     * This combines various fields to create a comprehensive text for embedding
     * @param template Template object with title, description, keywords, category, etc.
     * @returns Formatted semantic description
     */
    generateSemanticDescription(template: any): string {
        const parts: string[] = [];

        // Title (most important)
        if (template.title) {
            parts.push(`Title: ${template.title}`);
        }

        // Category/Occasion
        if (template.category_name || template.category_display_name) {
            const category = template.category_display_name || template.category_name;
            parts.push(`Occasion: ${category}`);
        }

        // Description
        if (template.description) {
            parts.push(`Description: ${template.description}`);
        }

        // Keywords (if available)
        if (template.search_keywords && Array.isArray(template.search_keywords)) {
            const keywords = template.search_keywords.join(', ');
            if (keywords.length > 0) {
                parts.push(`Keywords: ${keywords}`);
            }
        }

        // Tags (if available)
        if (template.tags && Array.isArray(template.tags)) {
            const tags = template.tags.join(', ');
            if (tags.length > 0) {
                parts.push(`Tags: ${tags}`);
            }
        }

        // Metadata fields that might be useful
        if (template.metadata) {
            const metadata = typeof template.metadata === 'string'
                ? JSON.parse(template.metadata)
                : template.metadata;

            if (metadata.style) {
                parts.push(`Style: ${metadata.style}`);
            }
            if (metadata.tone) {
                parts.push(`Tone: ${metadata.tone}`);
            }
            if (metadata.audience) {
                parts.push(`Audience: ${metadata.audience}`);
            }
        }

        return parts.join('\n');
    }

    /**
     * Batch generate embeddings for multiple templates
     * Includes rate limiting to avoid API throttling
     * @param templates Array of template objects
     * @param delayMs Delay between requests in milliseconds (default: 100ms)
     * @returns Array of objects with template id and embedding
     */
    async batchGenerateEmbeddings(
        templates: any[],
        delayMs: number = 100,
    ): Promise<Array<{ id: string; embedding: number[]; semanticDescription: string }>> {
        const results: Array<{ id: string; embedding: number[]; semanticDescription: string }> = [];

        for (let i = 0; i < templates.length; i++) {
            const template = templates[i];

            try {
                const semanticDescription = this.generateSemanticDescription(template);
                const embedding = await this.generateEmbedding(semanticDescription);

                results.push({
                    id: template.id,
                    embedding,
                    semanticDescription,
                });

                this.logger.log(
                    `Generated embedding ${i + 1}/${templates.length} for template: ${template.title}`,
                );

                // Rate limiting
                if (i < templates.length - 1 && delayMs > 0) {
                    await new Promise((resolve) => setTimeout(resolve, delayMs));
                }
            } catch (error) {
                this.logger.error(
                    `Failed to generate embedding for template ${template.id} (${template.title})`,
                    error,
                );
                // Continue with other templates
            }
        }

        return results;
    }
}

