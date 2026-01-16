/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import { GoogleGenAI } from '@google/genai';

const API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || '';
const genAI = new GoogleGenAI({ apiKey: API_KEY });

interface Hotspot {
  x: number;
  y: number;
}

function fileToGenerativePart(file: File): Promise<{ inlineData: { data: string; mimeType: string } }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64Data = reader.result as string;
      const base64Content = base64Data.split(',')[1]; // Remove data:image/jpeg;base64, prefix
      resolve({
        inlineData: {
          data: base64Content,
          mimeType: file.type,
        },
      });
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function dataURLToGenerativePart(dataURL: string): { inlineData: { data: string; mimeType: string } } {
  const [header, data] = dataURL.split(',');
  const mimeType = header.match(/:(.*?);/)?.[1] || 'image/jpeg';
  return {
    inlineData: {
      data,
      mimeType,
    },
  };
}

function handleGeminiResponse(response: any): string {
  if (!response || !response.response) {
    throw new Error('Invalid response from Gemini API');
  }

  const result = response.response;
  
  // Check for safety issues
  if (result.promptFeedback?.blockReason) {
    throw new Error(`Content blocked: ${result.promptFeedback.blockReason}`);
  }

  // Check for finish reason issues
  const candidate = result.candidates?.[0];
  if (!candidate) {
    throw new Error('No response generated');
  }

  if (candidate.finishReason === 'SAFETY') {
    throw new Error('Response blocked due to safety concerns');
  }

  if (candidate.finishReason === 'RECITATION') {
    throw new Error('Response blocked due to recitation concerns');
  }

  const text = candidate.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error('No text content in response');
  }

  return text;
}

export async function generateEditedImage(
  imageFile: File | string,
  prompt: string,
  hotspots: Hotspot[] = []
): Promise<string> {
  try {

    let imagePart;
    if (typeof imageFile === 'string') {
      imagePart = dataURLToGenerativePart(imageFile);
    } else {
      imagePart = await fileToGenerativePart(imageFile);
    }

    let fullPrompt = `You are an expert photo editor. Edit this image based on the following request: "${prompt}"

IMPORTANT GUIDELINES:
- Make realistic, natural-looking edits
- Preserve the original image quality and style
- Blend changes seamlessly with the existing image
- Maintain proper lighting, shadows, and perspective
- Keep the overall composition and mood intact
- For skin tone adjustments: Only adjust lighting, warmth, or saturation. NEVER change racial characteristics or ethnic features.
- For background changes: Ensure proper depth of field and lighting consistency
- For object removal: Fill in naturally with appropriate background elements
- For color adjustments: Maintain natural color relationships

Return only the edited image, no text or explanations.`;

    if (hotspots.length > 0) {
      const hotspotText = hotspots.map((h, i) => `Hotspot ${i + 1}: (${h.x}, ${h.y})`).join(', ');
      fullPrompt += `\n\nFocus your edits on these specific areas: ${hotspotText}`;
    }

    const result = await genAI.models.generateContent({
      model: 'gemini-2.0-flash-exp',
      contents: [{
        role: 'user',
        parts: [{ text: fullPrompt }, imagePart]
      }]
    });
    return handleGeminiResponse(result);
  } catch (error) {
    console.error('Error generating edited image:', error);
    throw error;
  }
}