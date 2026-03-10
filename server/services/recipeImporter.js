'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch');

const GEMINI_MODEL = 'gemini-1.5-flash';

const RECIPE_PROMPT = `You are a recipe parsing assistant.

The following text is the raw HTML or plain text content of a recipe webpage. Extract the recipe information and return ONLY a valid JSON object — no markdown, no code fences, no explanation.

The JSON must have exactly these fields:
- "title"             : string  — recipe title
- "health_score"      : number  — estimated health score 1–10 (1=very unhealthy, 10=very healthy/whole-food)
- "prep_time_minutes" : number  — prep time in minutes (null if not found)
- "cook_time_minutes" : number  — cook time in minutes (null if not found)
- "image_url"         : string  — main image URL from the page (null if not found)
- "ingredients"       : array   — list of ingredients, each with:
    - "name"     : string
    - "quantity" : string (e.g. "2", "1/2", "a handful")
    - "unit"     : string (e.g. "cups", "tbsp", "each", "")
    - "category" : string — one of: "produce", "meat_seafood", "dairy", "pantry", "other"

Example:
{
  "title": "Lemon Herb Chicken",
  "health_score": 8,
  "prep_time_minutes": 15,
  "cook_time_minutes": 30,
  "image_url": "https://example.com/chicken.jpg",
  "ingredients": [
    { "name": "Chicken Breast", "quantity": "2", "unit": "each", "category": "meat_seafood" },
    { "name": "Lemon", "quantity": "1", "unit": "each", "category": "produce" }
  ]
}`;

/**
 * Fetch a recipe webpage and extract structured recipe data using Gemini.
 *
 * @param {string} url  Publicly accessible recipe page URL.
 * @returns {Promise<{
 *   title: string,
 *   health_score: number|null,
 *   prep_time_minutes: number|null,
 *   cook_time_minutes: number|null,
 *   image_url: string|null,
 *   ingredients: Array<{ name: string, quantity: string, unit: string, category: string }>
 * }>}
 */
async function importRecipeFromUrl(url) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  // Fetch the page content
  const pageResponse = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; ClearCart-recipe-importer/1.0)',
    },
    timeout: 15000,
  });

  if (!pageResponse.ok) {
    throw new Error(`Could not fetch recipe page (${pageResponse.status}): ${url}`);
  }

  const html = await pageResponse.text();

  // Strip most HTML tags to reduce token usage while preserving text content
  const plainText = html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .trim()
    .slice(0, 12000); // cap at 12k chars to stay within context limits

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  const prompt = `${RECIPE_PROMPT}\n\n--- PAGE CONTENT ---\n${plainText}`;
  const result = await model.generateContent(prompt);
  const responseText = result.response.text().trim();

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    const fenceMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      parsed = JSON.parse(fenceMatch[1].trim());
    } else {
      throw new Error(`Gemini returned non-JSON output: ${responseText.slice(0, 200)}`);
    }
  }

  return {
    title: String(parsed.title ?? 'Untitled Recipe').trim(),
    health_score: typeof parsed.health_score === 'number' ? parsed.health_score : null,
    prep_time_minutes: typeof parsed.prep_time_minutes === 'number' ? parsed.prep_time_minutes : null,
    cook_time_minutes: typeof parsed.cook_time_minutes === 'number' ? parsed.cook_time_minutes : null,
    image_url: typeof parsed.image_url === 'string' ? parsed.image_url : null,
    ingredients: Array.isArray(parsed.ingredients)
      ? parsed.ingredients.map((ing) => ({
          name: String(ing.name ?? '').trim(),
          quantity: String(ing.quantity ?? ''),
          unit: String(ing.unit ?? ''),
          category: ['produce', 'meat_seafood', 'dairy', 'pantry', 'other'].includes(ing.category)
            ? ing.category
            : 'other',
        }))
      : [],
  };
}

module.exports = { importRecipeFromUrl };
