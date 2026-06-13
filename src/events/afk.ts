// src/events/afk.ts
// Auto-clears AFK when the user sends a message.
// Notifies when a mentioned user is AFK.
import { MessageFlags } from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { getAfk, clearAfk } from '../db/queries/afk.js';
import { FadeContainer } from '../components/builders.js';
import { e, Colours } from '../components/emojis.js';
import { logger } from '../utils/logger.js';

const event: Event<'messageCreate'> = {
    name: 'messageCreate',

    async execute(_client: FadeClient, message) {
        if (message.author.bot || !message.guild) return;

        const guildId = message.guild.id;

        try {
            // ── Auto-clear: sender is AFK ─────────────────────────────────────
            const senderAfk = await getAfk(guildId, message.author.id);
            if (senderAfk) {
                await clearAfk(guildId, message.author.id);

                const elapsed = formatElapsed(senderAfk.createdAt);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('online')}  Welcome back! AFK cleared\n-# You were away for ${elapsed}`)
                    .build();

                await message.reply({
                    components: [card],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { repliedUser: false },
                } as any).catch(() => null);
            }

            // ── Notify: a mentioned user is AFK ──────────────────────────────
            if (!message.mentions.users.size) return;

            for (const [, user] of message.mentions.users) {
                if (user.bot || user.id === message.author.id) continue;

                const afkEntry = await getAfk(guildId, user.id);
                if (!afkEntry) continue;

                const elapsed = formatElapsed(afkEntry.createdAt);
                const card = new FadeContainer(Colours.WARNING)
                    .text(`${e('idle')}  <@${user.id}> is AFK\n-# ${afkEntry.reason} · ${elapsed} ago`)
                    .build();

                await message.reply({
                    components: [card],
                    flags: MessageFlags.IsComponentsV2,
                    allowedMentions: { repliedUser: false },
                } as any).catch(() => null);

                break; // only notify once per message
            }

        } catch (err) {
            logger.error('AFK event failed', err, { guildId });
        }
    },
};

function formatElapsed(since: Date): string {
    const ms      = Date.now() - new Date(since).getTime();
    const minutes = Math.floor(ms / 60_000);
    const hours   = Math.floor(minutes / 60);
    const days    = Math.floor(hours / 24);

    if (days > 0)    return `${days}d ${hours % 24}h`;
    if (hours > 0)   return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m`;
    return 'just now';
}

export default event;
