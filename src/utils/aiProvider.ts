// src/utils/aiProvider.ts
import { logger } from './logger.js';

interface AIProvider {
    name: string;
    generate: (prompt: string, systemPrompt: string) => Promise<string>;
}

export const providers: AIProvider[] = [
    {
        name: 'DevToolBox',
        generate: async (prompt, systemPrompt) => {
            const res = await fetch('https://devtoolbox-api.devtoolbox-api.workers.dev/ai/generate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ prompt: systemPrompt + '\n\n' + prompt }),
            });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            return data.response || (typeof data === 'string' ? data : JSON.stringify(data));
        },
    },
    {
        name: 'Hercai',
        generate: async (prompt, systemPrompt) => {
            const res = await fetch('https://hercai.onrender.com/v3/hercai?question=' + encodeURIComponent(prompt));
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            return data.reply;
        },
    },
    {
        name: 'Google Gemini',
        generate: async (prompt, systemPrompt) => {
            const key = process.env.GEMINI_API_KEY;
            if (!key) throw new Error('GEMINI_API_KEY is not set');

            const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash-latest:generateContent?key=${key}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    system_instruction: { parts: { text: systemPrompt } },
                    contents: [{ parts: [{ text: prompt }] }],
                }),
            });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            return data.candidates[0].content.parts[0].text;
        },
    },
    {
        name: 'Nvidia',
        generate: async (prompt, systemPrompt) => {
            const key = process.env.NVIDIA_API_KEY;
            if (!key) throw new Error('NVIDIA_API_KEY is not set');

            const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify({
                    model: 'meta/llama-3.1-405b-instruct',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt },
                    ],
                }),
            });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            return data.choices[0].message.content;
        },
    },
    {
        name: 'OpenRouter',
        generate: async (prompt, systemPrompt) => {
            const key = process.env.OPENROUTER_API;
            if (!key) throw new Error('OPENROUTER_API is not set');

            const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify({
                    model: 'meta-llama/llama-3-8b-instruct:free',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt },
                    ],
                }),
            });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            return data.choices[0].message.content;
        },
    },
    {
        name: 'Groq',
        generate: async (prompt, systemPrompt) => {
            const key = process.env.GROQ_API;
            if (!key) throw new Error('GROQ_API is not set');

            const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify({
                    model: 'llama3-8b-8192',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt },
                    ],
                }),
            });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            return data.choices[0].message.content;
        },
    },
    {
        name: 'Pollinations',
        generate: async (prompt, systemPrompt) => {
            // Keep this as a final fallback in case Heroku IP unban happens
            const res = await fetch('https://text.pollinations.ai/openai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'openai',
                    messages: [
                        { role: 'system', content: systemPrompt },
                        { role: 'user', content: prompt },
                    ],
                }),
            });
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            return data.choices[0].message.content;
        },
    },
];

export async function generateAIResponse(
    prompt: string, 
    systemPrompt: string,
    customProviders: AIProvider[] = providers
): Promise<{ text: string; provider: string }> {
    for (const provider of customProviders) {
        try {
            logger.debug(`[AskAI] Attempting provider: ${provider.name}`);
            const text = await provider.generate(prompt, systemPrompt);
            if (text && text.length > 0) {
                return { text, provider: provider.name };
            }
        } catch (error: any) {
            // Silently fail and try the next one
            logger.debug(`[AskAI] Provider ${provider.name} failed: ${error.message}`);
            continue;
        }
    }
    throw new Error('All AI providers failed');
}

export async function generateAnswer(
    question: string,
    memories: string[]
): Promise<{ text: string; provider: string }> {
    const context = memories.map((m, i) => `${i + 1}. ${m}`).join('\n');
    const systemPrompt = `You are Fade — a powerful, all-in-one Discord bot built by Suyash. 
You have 115+ commands covering moderation, music, leveling, welcome cards, giveaways, tickets, economy, and much more.
You also have a server memory system: admins teach you facts about their server and you recall them to answer questions.
Answer questions based ONLY on the facts provided to you. Keep answers short (2-3 sentences max), conversational and friendly.
If the facts don't fully answer the question, say you're not sure but share what you know.
Never make up information that isn't in the provided facts.
Speak with confidence and personality — you're Fade, not a generic chatbot.

Server facts:
${context}`;

    try {
        // For memory AI, Groq and OpenRouter are preferred for their speed and logic
        const memoryProviders = [
            providers.find(p => p.name === 'Groq')!,
            providers.find(p => p.name === 'OpenRouter')!,
            providers.find(p => p.name === 'Google Gemini')!,
            ...providers.filter(p => !['Groq', 'OpenRouter', 'Google Gemini'].includes(p.name))
        ];
        return await generateAIResponse(question, systemPrompt, memoryProviders);
    } catch (e: any) {
        logger.warn('[AI] All providers failed, using raw fallback');
        if (memories.length === 0) return { text: "I don't have any information about that yet.", provider: 'Memory' };
        return { text: `Here's what I remember:\n\n${memories.slice(0, 3).map((m, i) => `• ${m}`).join('\n')}`, provider: 'Memory' };
    }
}
