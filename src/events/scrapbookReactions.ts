import type { MessageReaction, User, Message } from 'discord.js';
import type { Event } from '../types/event.js';
import { upsertScrapbookMessage } from '../db/queries/scrapbook.js';

async function handleScrapbookReaction(reaction: MessageReaction, user: User) {
    if (user.bot) return;
    if (!reaction.message.guild) return;

    if (reaction.partial) await reaction.fetch().catch(() => null);
    if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

    const message = reaction.message as Message;
    if (message.author?.bot) return; // Ignore bot messages

    const reactionCount = message.reactions.cache.reduce((acc, r) => acc + r.count, 0);

    // Comedy count (😂, 🤣, 💀, 😭) + custom emojis with funny keywords
    const comedyEmojis = ['😂', '🤣', '💀', '😭'];
    const comedyKeywords = ['lmao', 'lol', 'kek', 'skull', 'dead', 'haha', 'funny'];

    let comedyCount = 0;
    for (const r of message.reactions.cache.values()) {
        if (!r.emoji.name) continue;
        const name = r.emoji.name.toLowerCase();
        
        let isComedy = comedyEmojis.includes(r.emoji.name);
        if (!isComedy) {
            for (const kw of comedyKeywords) {
                if (name.includes(kw)) {
                    isComedy = true;
                    break;
                }
            }
        }
        if (isComedy) {
            comedyCount += r.count;
        }
    }

    // Only track if it has at least 1 reaction to save DB writes on 0 reactions
    if (reactionCount > 0) {
        await upsertScrapbookMessage(
            message.guildId!,
            message.id,
            message.author.id,
            message.content || '[Media Only]',
            reactionCount,
            comedyCount
        ).catch(() => null);
    }
}

export const scrapbookReactionAdd: Event<'messageReactionAdd'> = {
    name: 'messageReactionAdd',
    async execute(client, reaction, user) {
        await handleScrapbookReaction(reaction as MessageReaction, user as User);
    },
};

export const scrapbookReactionRemove: Event<'messageReactionRemove'> = {
    name: 'messageReactionRemove',
    async execute(client, reaction, user) {
        await handleScrapbookReaction(reaction as MessageReaction, user as User);
    },
};

export default [scrapbookReactionAdd, scrapbookReactionRemove];
