"""
Simple script to test if your Google API key is working correctly.
"""
import os
import google.generativeai as genai

# Get API key
API_KEY = os.environ.get('GOOGLE_API_KEY')

if not API_KEY:
    print("❌ ERROR: GOOGLE_API_KEY environment variable not set!")
    print("Please set it using: $env:GOOGLE_API_KEY=\"your_api_key_here\"")
    exit(1)

print(f"✓ API Key found (length: {len(API_KEY)})")
print(f"✓ API Key starts with: {API_KEY[:20]}...")

# Configure the API
try:
    genai.configure(api_key=API_KEY)
    print("✓ API configured successfully")
except Exception as e:
    print(f"❌ Error configuring API: {e}")
    exit(1)

# Test 1: List available models
print("\n" + "="*70)
print("TEST 1: Listing available models...")
print("="*70)
try:
    models = genai.list_models()
    embedding_models = [m for m in models if 'embedding' in m.name.lower()]
    
    print(f"✓ Found {len(list(models))} models total")
    print(f"✓ Embedding models available:")
    for model in embedding_models:
        print(f"  - {model.name}")
except Exception as e:
    print(f"❌ Error listing models: {e}")
    print("\nThis usually means:")
    print("  1. The API key is invalid or expired")
    print("  2. The Generative Language API is not enabled")
    print("  3. The API key doesn't have the right permissions")
    exit(1)

# Test 2: Try to generate a simple embedding
print("\n" + "="*70)
print("TEST 2: Generating test embedding...")
print("="*70)
test_text = "Hello, this is a test."

try:
    result = genai.embed_content(
        model="models/embedding-001",
        content=test_text
    )
    
    # Check response structure
    if isinstance(result, dict) and 'embedding' in result:
        embedding = result['embedding']
        print(f"✓ Successfully generated embedding!")
        print(f"✓ Embedding dimension: {len(embedding)}")
        print(f"✓ First 5 values: {embedding[:5]}")
    else:
        print(f"⚠ Unexpected response structure: {type(result)}")
        print(f"Response keys: {result.keys() if isinstance(result, dict) else 'Not a dict'}")
        
except Exception as e:
    print(f"❌ Error generating embedding: {e}")
    print("\nTroubleshooting:")
    print("  1. Check if 'Generative Language API' is enabled at:")
    print("     https://console.cloud.google.com/apis/library/generativelanguage.googleapis.com")
    print("  2. Try generating a new API key")
    print("  3. Make sure you're using the API key from the correct project")
    exit(1)

print("\n" + "="*70)
print("✅ ALL TESTS PASSED! Your API key is working correctly.")
print("✅ You can now run: python scripts/generate_embeddings.py")
print("="*70)

