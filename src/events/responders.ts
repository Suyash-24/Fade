// src/events/responders.ts
// Checks every message against the guild's auto responders.
// Runs after automod so banned content doesn't get a response.
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { getResponders } from '../db/queries/responders.js';
import { logger } from '../utils/logger.js';

// Cache responders per guild to avoid DB hit on every message
// Cache invalidates every 5 minutes
const cache = new Map<string, Promise<{ data: any[]; expiresAt: number }>>();
const TTL   = 2 * 60 * 1_000;

function getCachedResponders(guildId: string) {
    const hit = cache.get(guildId);
    if (hit) {
        return hit.then(entry => {
            if (entry.expiresAt > Date.now()) return entry.data;
            return fetchAndCache(guildId);
        });
    }
    return fetchAndCache(guildId);
}

async function fetchAndCache(guildId: string) {
    const promise = (async () => {
        const data = await getResponders(guildId);
        return { data, expiresAt: Date.now() + TTL };
    })();
    promise.catch(err => cache.delete(guildId));
    cache.set(guildId, promise);
    return (await promise).data;
}

export function invalidateResponderCache(guildId: string) {
    cache.delete(guildId);
}

function resolveVars(text: string, message: any): string {
    const resolved = text
        .replace(/{user}/g,    message.author.toString())
        .replace(/{username}/g,message.author.username)
        .replace(/{server}/g,  message.guild?.name ?? '')
        .replace(/{channel}/g, message.channel.toString());
    
    // Bleed-style space preservation
    return resolved.replace(/^[ ]+/gm, (spaces) => '\u2800'.repeat(spaces.length));
}

const event: Event<'messageCreate'> = {
    name: 'messageCreate',
    async execute(client: FadeClient, message) {
        if (message.author.bot || !message.guild) return;

        try {
            const responders = await getCachedResponders(message.guild.id);
            if (!responders.length) return;

            const content = message.content.toLowerCase();

            for (const responder of responders) {
                if (!responder.enabled) continue;

                const trigger = responder.trigger.toLowerCase();
                let matched   = false;

                if (responder.matchType === 'exact') {
                    matched = content === trigger;
                } else if (responder.matchType === 'startsWith') {
                    matched = content.startsWith(trigger);
                } else {
                    // contains (default)
                    matched = content.includes(trigger);
                }

                if (matched) {
                    const response = resolveVars(responder.response, message);
                    await message.reply({
                        content:          response,
                        allowedMentions:  { repliedUser: false },
                    }).catch(() => null);
                    return; // Only one responder fires per message
                }
            }

        } catch (err) {
            logger.error('Responder event failed', err, { guildId: message.guild.id });
        }
    },
};

export default event;