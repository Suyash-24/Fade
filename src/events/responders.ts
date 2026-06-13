// src/events/responders.ts
// Checks every message against the guild's auto responders.
// Runs after automod so banned content doesn't get a response.
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { getResponders } from '../db/queries/responders.js';
import { logger } from '../utils/logger.js';

// Cache responders per guild to avoid DB hit on every message
// Cache invalidates every 5 minutes
const cache = new Map<string, { data: any[]; expiresAt: number }>();
const TTL   = 5 * 60 * 1_000;

async function getCachedResponders(guildId: string) {
    const cached = cache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    const data = await getResponders(guildId);
    cache.set(guildId, { data, expiresAt: Date.now() + TTL });
    return data;
}

export function invalidateResponderCache(guildId: string) {
    cache.delete(guildId);
}

function resolveVars(text: string, message: any): string {
    return text
        .replace(/{user}/g,    message.author.toString())
        .replace(/{username}/g,message.author.username)
        .replace(/{server}/g,  message.guild?.name ?? '')
        .replace(/{channel}/g, message.channel.toString());
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