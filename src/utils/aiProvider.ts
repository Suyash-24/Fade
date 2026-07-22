// src/utils/aiProvider.ts
import { logger } from './logger.js';

interface AIProvider {
    name: string;
    generate: (prompt: string, systemPrompt: string) => Promise<string>;
}

export const providers: AIProvider[] = [
    {
        name: 'DevToolBox API',
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
        name: 'Groq',
        generate: async (prompt, systemPrompt) => {
            const key = process.env.GROQ_API_KEY;
            if (!key) throw new Error('GROQ_API_KEY is not set');

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
        name: 'OpenRouter',
        generate: async (prompt, systemPrompt) => {
            const key = process.env.OPENROUTER_API_KEY;
            if (!key) throw new Error('OPENROUTER_API_KEY is not set');

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
        name: 'Hercai',
        generate: async (prompt, systemPrompt) => {
            const res = await fetch('https://hercai.onrender.com/v3/hercai?question=' + encodeURIComponent(prompt));
            if (!res.ok) throw new Error(`Status ${res.status}`);
            const data = await res.json();
            return data.reply;
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

export async function generateAIResponse(prompt: string, systemPrompt: string): Promise<{ text: string; provider: string }> {
    for (const provider of providers) {
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
