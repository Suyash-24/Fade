// src/events/reactionTriggers.ts
// Listens to messages and reacts with configured emojis when triggers match.
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { getReactionTriggers } from '../db/queries/reactionTriggers.js';
import { logger } from '../utils/logger.js';

// Simple cache — same pattern as responders
const cache = new Map<string, { data: any[]; expiresAt: number }>();
const TTL   = 5 * 60 * 1_000;

async function getCached(guildId: string) {
    const cached = cache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) return cached.data;
    const data = await getReactionTriggers(guildId);
    cache.set(guildId, { data, expiresAt: Date.now() + TTL });
    return data;
}

export function invalidateReactionTriggerCache(guildId: string) {
    cache.delete(guildId);
}

const event: Event<'messageCreate'> = {
    name: 'messageCreate',
    async execute(client: FadeClient, message) {
        if (message.author.bot || !message.guild) return;

        try {
            const triggers = await getCached(message.guild.id);
            if (!triggers.length) return;

            const content = message.content.toLowerCase();

            for (const trigger of triggers) {
                if (!trigger.enabled) continue;

                const t = trigger.trigger.toLowerCase();
                let matched = false;

                if      (trigger.matchType === 'exact')      matched = content === t;
                else if (trigger.matchType === 'startsWith') matched = content.startsWith(t);
                else                                          matched = content.includes(t);

                if (matched) {
                    await message.react(trigger.emoji).catch(() => null);
                    // Don't return — multiple triggers can fire on one message
                }
            }

        } catch (err) {
            logger.error('Reaction trigger event failed', err, { guildId: message.guild.id });
        }
    },
};

export default event;