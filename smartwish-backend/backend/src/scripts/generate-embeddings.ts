/**
 * Script to generate embeddings for all templates in the database
 * Run with: npm run generate-embeddings
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';
import { GeminiEmbeddingService } from '../services/gemini-embedding.service';

// Load environment variables
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
const BATCH_SIZE = 10; // Process 10 templates at a time
const DELAY_MS = 150; // 150ms delay between API calls

async function generateEmbeddings() {
    console.log('🚀 Starting embedding generation for templates...\n');

    // Validate environment variables
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
        console.error('❌ Missing required environment variables:');
        console.error('   - SUPABASE_URL');
        console.error('   - SUPABASE_SERVICE_KEY');
        process.exit(1);
    }

    if (!process.env.GEMINI_API_KEY) {
        console.error('❌ Missing GEMINI_API_KEY environment variable');
        process.exit(1);
    }

    // Initialize services
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const embeddingService = new GeminiEmbeddingService();

    try {
        // Fetch all published templates with their categories
        console.log('📊 Fetching templates from database...');
        const { data: templates, error } = await supabase
            .from('sw_templates')
            .select(
                `
        id,
        title,
        description,
        search_keywords,
        tags,
        metadata,
        category_id,
        embedding_vector,
        embedding_updated_at,
        sw_categories (
          name,
          display_name
        )
      `,
            )
            .eq('status', 'published')
            .order('created_at', { ascending: false });

        if (error) {
            throw new Error(`Failed to fetch templates: ${error.message}`);
        }

        if (!templates || templates.length === 0) {
            console.log('ℹ️  No published templates found');
            return;
        }

        console.log(`✅ Found ${templates.length} published templates\n`);

        // Filter templates that need embeddings (no embedding or old embedding)
        const templatesNeedingEmbeddings = templates.filter(
            (t) => !t.embedding_vector || !t.embedding_updated_at,
        );

        console.log(
            `📝 ${templatesNeedingEmbeddings.length} templates need embeddings generated`,
        );
        console.log(
            `✓  ${templates.length - templatesNeedingEmbeddings.length} templates already have embeddings\n`,
        );

        if (templatesNeedingEmbeddings.length === 0) {
            console.log('🎉 All templates already have embeddings!');
            return;
        }

        // Confirm before proceeding
        console.log('⚠️  This will make API calls to Gemini. Estimated time:');
        console.log(
            `   ${Math.ceil((templatesNeedingEmbeddings.length * (DELAY_MS + 100)) / 1000)} seconds\n`,
        );

        // Process templates in batches
        let successCount = 0;
        let failureCount = 0;

        for (let i = 0; i < templatesNeedingEmbeddings.length; i += BATCH_SIZE) {
            const batch = templatesNeedingEmbeddings.slice(i, i + BATCH_SIZE);
            const batchNum = Math.floor(i / BATCH_SIZE) + 1;
            const totalBatches = Math.ceil(templatesNeedingEmbeddings.length / BATCH_SIZE);

            console.log(`\n📦 Processing batch ${batchNum}/${totalBatches} (${batch.length} templates)...`);

            for (const template of batch) {
                try {
                    // Flatten category data (sw_categories is returned as an array by Supabase)
                    const category = Array.isArray(template.sw_categories)
                        ? template.sw_categories[0]
                        : template.sw_categories;
                    const templateWithCategory = {
                        ...template,
                        category_name: category?.name,
                        category_display_name: category?.display_name,
                    };

                    // Generate semantic description
                    const semanticDescription =
                        embeddingService.generateSemanticDescription(templateWithCategory);

                    console.log(`   🔄 [${successCount + failureCount + 1}/${templatesNeedingEmbeddings.length}] Generating embedding for: ${template.title}`);

                    // Generate embedding
                    const embedding = await embeddingService.generateEmbedding(semanticDescription);

                    // Update database
                    const { error: updateError } = await supabase
                        .from('sw_templates')
                        .update({
                            semantic_description: semanticDescription,
                            embedding_vector: JSON.stringify(embedding),
                            embedding_updated_at: new Date().toISOString(),
                        })
                        .eq('id', template.id);

                    if (updateError) {
                        throw new Error(`Database update failed: ${updateError.message}`);
                    }

                    successCount++;
                    console.log(`   ✅ Success (${embedding.length} dimensions)`);

                    // Rate limiting
                    if (i + batch.indexOf(template) < templatesNeedingEmbeddings.length - 1) {
                        await new Promise((resolve) => setTimeout(resolve, DELAY_MS));
                    }
                } catch (error) {
                    failureCount++;
                    console.error(`   ❌ Failed: ${error.message}`);
                    // Continue with next template
                }
            }
        }

        // Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 GENERATION SUMMARY');
        console.log('='.repeat(60));
        console.log(`✅ Successfully generated: ${successCount} embeddings`);
        console.log(`❌ Failed: ${failureCount} embeddings`);
        console.log(`📈 Success rate: ${((successCount / templatesNeedingEmbeddings.length) * 100).toFixed(1)}%`);
        console.log('='.repeat(60) + '\n');

        if (successCount > 0) {
            console.log('🎉 Embedding generation complete!');
            console.log('   You can now use semantic search with these templates.');
        }
    } catch (error) {
        console.error('\n❌ Fatal error:', error.message);
        process.exit(1);
    }
}

// Run the script
generateEmbeddings()
    .then(() => {
        console.log('\n✨ Script completed successfully');
        process.exit(0);
    })
    .catch((error) => {
        console.error('\n💥 Script failed:', error);
        process.exit(1);
    });

