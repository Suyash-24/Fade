// src/utils/logSender.ts
// Shared utility for sending log entries to the correct channel.
// Supports both Components v2 cards and classic embeds.
// All log events flow through sendLog() — single point of control.

import {
    type Guild,
    type TextChannel,
    EmbedBuilder,
    MessageFlags,
} from 'discord.js';
import { FadeContainer } from '../components/builders.js';
import { getLogChannel, isEventDisabled, isLogIgnored, type LogCategory } from '../db/queries/logging.js';
import { Colours } from '../components/emojis.js';
import { logger } from './logger.js';

export interface LogEntry {
    guild:     Guild;
    category:  LogCategory;
    event:     string;
    color:     number;
    title:     string;
    fields:    { name: string; value: string; inline?: boolean }[];
    footer?:   string;
    image?:    string;
    userId?:   string;   // if set, suppressed when user is ignored
    channelId?:string;   // if set, suppressed when channel is ignored
}

export async function sendLog(entry: LogEntry): Promise<void> {
    try {
        if (await isEventDisabled(entry.guild.id, entry.event)) return;

        // Check ignore list
        if (entry.userId    && await isLogIgnored(entry.guild.id, entry.userId))    return;
        if (entry.channelId && await isLogIgnored(entry.guild.id, entry.channelId)) return;

        // Get target channel
        const channelId = await getLogChannel(entry.guild.id, entry.category);
        if (!channelId) return;

        const channel = entry.guild.channels.cache.get(channelId) as TextChannel | undefined;
        if (!channel?.isTextBased()) return;

        const botMember = entry.guild.members.me;
        if (!botMember?.permissionsIn(channel).has(['SendMessages', 'ViewChannel'])) return;

        // Build the log card
        const lines = entry.fields.map(f => `**${f.name}** — ${f.value}`);
        if (entry.footer) lines.push(`-# ${entry.footer}`);

        const card = new FadeContainer(entry.color)
            .text(`## ${entry.title}`)
            .separator(true)
            .text(lines.join('\n'));

        if (entry.image) {
            card.gallery([{ url: entry.image, description: entry.title }]);
        }

        await channel.send({
            components:      [card.build()],
            flags:           MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] },
        } as any);

    } catch (err) {
        logger.debug('Log send failed', { event: entry.event, guild: entry.guild.id });
    }
}

// Helpers for common log colours
export const LogColour = {
    CREATE: Colours.SUCCESS,
    DELETE: Colours.DANGER,
    UPDATE: Colours.WARNING,
    INFO:   Colours.FADE,
    MOD:    Colours.DANGER,
    VOICE:  Colours.INFO,
} as const;