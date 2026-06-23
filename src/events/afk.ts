// src/events/afk.ts
// Auto-clears AFK when the user sends a message.
// Notifies when a mentioned user is AFK.
import { MessageFlags, ThumbnailBuilder } from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { getAfk, clearAfk } from '../db/queries/afk.js';
import { FadeContainer } from '../components/builders.js';
import { e, Colours } from '../components/emojis.js';
import { logger } from '../utils/logger.js';

// ── Phrase pools ──────────────────────────────────────────────────────────────

const WELCOME_SUBLINES = [
    'Good to have you back!',
    'Welcome back to the land of the living.',
    'You\'re back! The chat missed you.',
    'And they\'re back!',
    'The hero returns.',
    'Back in action.',
    'Presence restored.',
    'Welcome back!',
];

const WELCOME_FILLERS = [
    'Your messages are waiting patiently.',
    'The void has released you.',
    'You can pretend you were never gone.',
    'Rejoining civilization, one message at a time.',
    'The chat is pleased to report your return.',
    'Someone noticed. Maybe.',
    'Ghost mode: off.',
    'Back to being perceived. Congrats.',
];

const ISAFK_FILLERS = [
    'They left before you could even ask.',
    'Some people just disappear like that.',
    'Patience is a virtue. You\'ll need it.',
    'The void claimed them. Temporarily.',
    'Left without warning. Classic.',
    'Currently unreachable by all known means.',
    'No ETA. Just vibes.',
    'They\'re on their own adventure right now.',
];

function pickRandom(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
}

// ── Time formatting ───────────────────────────────────────────────────────────

function formatElapsed(since: Date): string {
    const ms      = Date.now() - new Date(since).getTime();
    const seconds = Math.floor(ms / 1_000);
    const minutes = Math.floor(ms / 60_000);
    const hours   = Math.floor(minutes / 60);
    const days    = Math.floor(hours / 24);

    if (days > 0)    return `${days}d ${hours % 24}h`;
    if (hours > 0)   return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    if (seconds > 5) return `${seconds}s`;
    return 'just now';
}

// ── Card builders ─────────────────────────────────────────────────────────────

function buildWelcomeBackCard(avatarUrl: string | undefined, elapsed: string, reason: string) {
    const subline = pickRandom(WELCOME_SUBLINES);
    const filler  = pickRandom(WELCOME_FILLERS);
    const thumb   = avatarUrl ? new ThumbnailBuilder().setURL(avatarUrl) : undefined;

    const card = new FadeContainer(Colours.SUCCESS);

    if (thumb) {
        card.section(
            [
                `## ${e('welcomeback')}  Welcome back!`,
                `-# ${subline}`,
                `*${filler}*`,
            ],
            thumb,
        );
    } else {
        card.text(`## ${e('welcomeback')}  Welcome back!\n-# ${subline}\n*${filler}*`);
    }

    card
        .separator()
        .text(
            `${e('uptime')}  **Away for** · \`${elapsed}\`\n` +
            `${e('isafk')}  **Reason was** · ${reason}`
        )
        .separator()
        .text(`-# AFK status cleared · You're back online`);

    return card.build();
}

function buildAfkNotifyCard(
    user: { id: string; username: string; displayAvatarURL: (opts: any) => string },
    afkReason: string,
    elapsed: string,
) {
    const filler    = pickRandom(ISAFK_FILLERS);
    const avatarUrl = user.displayAvatarURL({ size: 128, forceStatic: false }) || undefined;
    const thumb     = avatarUrl ? new ThumbnailBuilder().setURL(avatarUrl) : undefined;

    return new FadeContainer(Colours.WARNING)
        .section(
            [
                `## ${e('isafk')}  <@${user.id}> is AFK`,
                `-# They went offline ${elapsed} ago`,
                `*${filler}*`,
            ],
            thumb,
        )
        .separator()
        .text(
            `${e('warn')}  **Reason** · ${afkReason}\n` +
            `-# They'll be notified when they're back`
        )
        .build();
}

// ── Event ─────────────────────────────────────────────────────────────────────

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

                const elapsed   = formatElapsed(senderAfk.createdAt);
                const avatarUrl = message.author.displayAvatarURL({ size: 128, forceStatic: false }) || undefined;
                const card      = buildWelcomeBackCard(avatarUrl, elapsed, senderAfk.reason || 'AFK');

                await message.reply({
                    components:      [card],
                    flags:           MessageFlags.IsComponentsV2,
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
                const card    = buildAfkNotifyCard(user as any, afkEntry.reason || 'AFK', elapsed);

                await message.reply({
                    components:      [card],
                    flags:           MessageFlags.IsComponentsV2,
                    allowedMentions: { repliedUser: false },
                } as any).catch(() => null);

                break; // only notify once per message
            }

        } catch (err) {
            logger.error('AFK event failed', err, { guildId });
        }
    },
};

export default event;
