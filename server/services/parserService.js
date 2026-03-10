'use strict';

const { GoogleGenerativeAI } = require('@google/generative-ai');
const fetch = require('node-fetch');

const GEMINI_MODEL = 'gemini-1.5-flash';

const EXTRACTION_PROMPT = `You are a grocery receipt and meal-planning assistant.

Analyze the provided image and extract every distinct grocery ingredient or product you can identify.

Return ONLY a valid JSON array — no markdown, no code fences, no explanation. Each element must have exactly these fields:
- "name"     : string  — the ingredient or product name, normalized to title case (e.g. "Whole Milk", "Free-Range Eggs")
- "quantity" : number  — numeric quantity (default 1 if not visible)
- "unit"     : string  — unit of measure (e.g. "kg", "L", "oz", "each"); use "each" when no unit is apparent

Example output:
[
  { "name": "Whole Milk", "quantity": 1, "unit": "L" },
  { "name": "Free-Range Eggs", "quantity": 12, "unit": "each" },
  { "name": "Sourdough Bread", "quantity": 1, "unit": "each" }
]`;

/**
 * Fetch an image from a URL and return it as a Gemini-compatible inlineData part.
 *
 * @param {string} url
 * @returns {Promise<{ inlineData: { mimeType: string, data: string } }>}
 */
async function urlToInlinePart(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch image from URL (${response.status}): ${url}`);
  }

  const contentType = response.headers.get('content-type') || 'image/jpeg';
  const mimeType = contentType.split(';')[0].trim();

  const buffer = await response.buffer();
  const data = buffer.toString('base64');

  return { inlineData: { mimeType, data } };
}

/**
 * Parse grocery ingredients from a receipt image URL or a base64 image payload
 * using the Gemini Vision API.
 *
 * @param {string | { mimeType: string, data: string }} input
 *   - string  → a publicly accessible image URL
 *   - object  → { mimeType: "image/jpeg", data: "<base64 string>" }
 *
 * @returns {Promise<Array<{ name: string, quantity: number, unit: string }>>}
 */
async function parseGroceriesFromInput(input) {
  if (!process.env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY environment variable is not set.');
  }

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  let imagePart;

  if (typeof input === 'string') {
    imagePart = await urlToInlinePart(input);
  } else if (input && typeof input === 'object' && input.mimeType && input.data) {
    imagePart = { inlineData: { mimeType: input.mimeType, data: input.data } };
  } else {
    throw new Error(
      'Invalid `input`: must be a URL string or an object with `mimeType` and `data` (base64) fields.'
    );
  }

  const result = await model.generateContent([EXTRACTION_PROMPT, imagePart]);
  const responseText = result.response.text().trim();

  let parsed;
  try {
    parsed = JSON.parse(responseText);
  } catch {
    // Gemini occasionally wraps output in markdown fences despite the prompt
    const fenceMatch = responseText.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      parsed = JSON.parse(fenceMatch[1].trim());
    } else {
      throw new Error(`Gemini returned non-JSON output: ${responseText.slice(0, 200)}`);
    }
  }

  if (!Array.isArray(parsed)) {
    throw new Error('Gemini response did not contain a JSON array.');
  }

  return parsed.map((item) => ({
    name: String(item.name ?? '').trim(),
    quantity: Number(item.quantity) || 1,
    unit: String(item.unit ?? 'each').trim(),
  }));
}

module.exports = { parseGroceriesFromInput };
