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

    // Only track if it has at least 1 reaction to save DB writes on 0 reactions
    if (reactionCount > 0) {
        await upsertScrapbookMessage(
            message.guildId!,
            message.id,
            message.author.id,
            message.cleanContent || '[Media Only]',
            reactionCount,
            0
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
