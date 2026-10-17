export const prerender = false;

import type { APIRoute } from 'astro';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { enforceLimit } from '../../lib/rateLimit';
import { withRequestLogging } from '../../lib/api/logger';

const ROUTE = '/api/ai-tutor';

const ALLOWED_ORIGINS = new Set([
  'https://alexle135.de',
  'https://alex-schneider.dev',
  'https://www.alexle135.de',
  'https://www.alex-schneider.dev',
  'http://localhost:4321',
]);

const handlePost: APIRoute = async ({ request, clientAddress }) => {
  try {
    // Strict origin check: Origin header is mandatory.
    const origin = request.headers.get('origin');
    if (!origin || !ALLOWED_ORIGINS.has(origin)) {
      return new Response(JSON.stringify({ error: 'Forbidden' }), {
        status: 403,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const limited = await enforceLimit(request, 'ai-tutor', clientAddress);
    if (limited) return limited;

    const { prompt } = await request.json();

    if (!prompt || typeof prompt !== 'string') {
      return new Response(JSON.stringify({ error: 'No prompt provided' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Limit prompt length to prevent cost abuse
    if (prompt.length > 10000) {
      return new Response(JSON.stringify({ error: 'Prompt too long (max 10000 characters)' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = import.meta.env.GEMINI_API_KEY || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      console.error('Server API Key missing in environment');
      return new Response(JSON.stringify({ error: 'Server configuration error' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    return new Response(JSON.stringify({ text }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  } catch (error: unknown) {
    console.error('AI Tutor API Error:', error);
    return new Response(JSON.stringify({ error: 'Internal Server Error' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
};

export const POST = withRequestLogging(ROUTE, handlePost);
