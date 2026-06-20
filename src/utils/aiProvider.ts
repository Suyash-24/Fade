// src/utils/aiProvider.ts
// 4-tier AI generation fallback:
// 1. Groq (Llama 3.1 8B) — fast, free, 14400 req/day
// 2. OpenRouter (Llama free model) — generous free tier
// 3. Cloudflare Workers AI — 10k neurons/day
// 4. Raw fallback — formats top memory as plain text, never fails

import { logger } from './logger.js';

const GROQ_API      = process.env.GROQ_API;
const OPENROUTER_API = process.env.OPENROUTER_API;
const CLOUDFLARE_API = process.env.CLOUDFLARE_API;
// For Cloudflare, we use account ID embedded in the API token or a fixed account ID
// We'll use a lightweight approach: extract account info from a full CF endpoint or env
const CF_ACCOUNT_ID = process.env.CF_ACCOUNT_ID; // optional, for Cloudflare

const SYSTEM_PROMPT = `You are Fade, the memory of a Discord server. 
You answer questions based ONLY on the facts provided to you. 
Keep answers short (2-3 sentences max), conversational, and friendly.
If the facts don't fully answer the question, say you're not sure but share what you know.
Never make up information that isn't in the facts.`;

interface ProviderResult {
    text: string;
    provider: string;
}

async function tryGroq(question: string, context: string): Promise<string> {
    if (!GROQ_API) throw new Error('No Groq key');

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${GROQ_API}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: 'llama-3.1-8b-instant',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `Server facts:\n${context}\n\nQuestion: ${question}` },
            ],
            max_tokens: 200,
            temperature: 0.4,
        }),
        signal: AbortSignal.timeout(8000),
    });

    if (!res.ok) throw new Error(`Groq ${res.status}`);
    const data = await res.json() as any;
    return data.choices[0].message.content.trim();
}

async function tryOpenRouter(question: string, context: string): Promise<string> {
    if (!OPENROUTER_API) throw new Error('No OpenRouter key');

    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${OPENROUTER_API}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'https://github.com/Suyash-24/Fade',
            'X-Title': 'Fade Discord Bot',
        },
        body: JSON.stringify({
            model: 'meta-llama/llama-3.1-8b-instruct:free',
            messages: [
                { role: 'system', content: SYSTEM_PROMPT },
                { role: 'user', content: `Server facts:\n${context}\n\nQuestion: ${question}` },
            ],
            max_tokens: 200,
            temperature: 0.4,
        }),
        signal: AbortSignal.timeout(10000),
    });

    if (!res.ok) throw new Error(`OpenRouter ${res.status}`);
    const data = await res.json() as any;
    return data.choices[0].message.content.trim();
}

async function tryCloudflare(question: string, context: string): Promise<string> {
    if (!CLOUDFLARE_API || !CF_ACCOUNT_ID) throw new Error('No Cloudflare config');

    const prompt = `${SYSTEM_PROMPT}\n\nServer facts:\n${context}\n\nQuestion: ${question}\nAnswer:`;

    const res = await fetch(
        `https://api.cloudflare.com/client/v4/accounts/${CF_ACCOUNT_ID}/ai/run/@cf/meta/llama-3-8b-instruct`,
        {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${CLOUDFLARE_API}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt, max_tokens: 200 }),
            signal: AbortSignal.timeout(12000),
        }
    );

    if (!res.ok) throw new Error(`Cloudflare ${res.status}`);
    const data = await res.json() as any;
    return data.result?.response?.trim() ?? (() => { throw new Error('No response'); })();
}

function rawFallback(memories: string[]): string {
    if (memories.length === 0) return "I don't have any information about that yet.";
    return `Here's what I remember:\n\n${memories.slice(0, 3).map((m, i) => `• ${m}`).join('\n')}`;
}

export async function generateAnswer(
    question: string,
    memories: string[]
): Promise<ProviderResult> {
    const context = memories.map((m, i) => `${i + 1}. ${m}`).join('\n');

    // Tier 1 — Groq
    try {
        const text = await tryGroq(question, context);
        logger.info('[AI] Answered via Groq');
        return { text, provider: 'Groq' };
    } catch (e: any) {
        logger.warn(`[AI] Groq failed: ${e.message}`);
    }

    // Tier 2 — OpenRouter
    try {
        const text = await tryOpenRouter(question, context);
        logger.info('[AI] Answered via OpenRouter');
        return { text, provider: 'OpenRouter' };
    } catch (e: any) {
        logger.warn(`[AI] OpenRouter failed: ${e.message}`);
    }

    // Tier 3 — Cloudflare
    try {
        const text = await tryCloudflare(question, context);
        logger.info('[AI] Answered via Cloudflare AI');
        return { text, provider: 'Cloudflare AI' };
    } catch (e: any) {
        logger.warn(`[AI] Cloudflare failed: ${e.message}`);
    }

    // Tier 4 — Raw fallback
    logger.warn('[AI] All providers failed, using raw fallback');
    return { text: rawFallback(memories), provider: 'Memory' };
}
