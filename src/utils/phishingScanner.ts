// src/utils/phishingScanner.ts
import { logger } from './logger.js';

// Simple memory cache to avoid spamming the API for common domains
const safeCache = new Set<string>();
const CACHE_LIMIT = 5000;

export async function checkPhishingDomain(domain: string): Promise<boolean> {
    const cleanDomain = domain.toLowerCase().trim();
    if (!cleanDomain) return false;

    // Check memory cache first
    if (safeCache.has(cleanDomain)) return false;

    try {
        const res = await fetch(`https://phish.sinking.yachts/v2/check/${encodeURIComponent(cleanDomain)}`, {
            headers: {
                'Accept': 'application/json',
                'User-Agent': 'FadeDiscordBot/1.0',
            },
            signal: AbortSignal.timeout(2000), // Fast timeout so it doesn't lag the bot
        });

        if (!res.ok) return false; // Fail open if API is down

        const isPhishing = await res.json() as boolean;

        if (!isPhishing) {
            safeCache.add(cleanDomain);
            // Prevent memory leak
            if (safeCache.size > CACHE_LIMIT) {
                const iterator = safeCache.values();
                const next = iterator.next().value;
                if (next) safeCache.delete(next);
            }
        }

        return isPhishing;
    } catch (err: any) {
        if (err.name !== 'TimeoutError') {
            logger.warn(`[Anti-Phishing] Failed to check domain ${cleanDomain}:`, err.message);
        }
        return false;
    }
}
