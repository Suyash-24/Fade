// src/utils/stickyMessages.ts
import type { Message } from 'discord.js';
import { getStickyByChannel, updateStickyState } from '../db/queries/stickyMessages.js';
import { logger } from './logger.js';

const stickyLocks = new Set<string>();

export async function handleStickyMessage(message: Message): Promise<void> {
    if (message.author.bot || !message.guild) return;
    const channel = message.channel;
    if (!channel?.isTextBased()) return;
    if (!('send' in channel)) return;

    const key = `${message.guild.id}:${message.channel.id}`;
    if (stickyLocks.has(key)) return;
    stickyLocks.add(key);

    try {
        const sticky = await getStickyByChannel(message.guild.id, message.channel.id);
        if (!sticky || !sticky.enabled) return;

        const nowMs = Date.now();
        const lastSentMs = sticky.lastSent
            ? new Date(sticky.lastSent as any).getTime()
            : 0;
        const cooldownMs = Math.max(5, Number(sticky.cooldown ?? 30)) * 1000;

        if (lastSentMs && nowMs - lastSentMs < cooldownMs) return;

        if (sticky.lastMessageId && 'messages' in channel) {
            await channel.messages.delete(sticky.lastMessageId).catch(() => null);
        }

        const sent = await channel.send({ content: sticky.message }).catch(() => null);
        if (sent) {
            await updateStickyState(sticky.id, {
                lastMessageId: sent.id,
                lastSent: new Date(),
            });
        }
    } catch (err) {
        logger.error('Sticky message failed', err, {
            guild: message.guild.id,
            channel: message.channel.id,
        });
    } finally {
        stickyLocks.delete(key);
    }
}
