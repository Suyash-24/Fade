// src/utils/counterUpdater.ts
// Updates counter voice channels every 10 minutes.
// Discord rate-limits channel name changes to 2 per 10 minutes per channel,
// so we batch updates and space them out.
import type { FadeClient } from '../client.js';
import { getCounters } from '../db/queries/counters.js';
import { logger } from './logger.js';

// Resolve the count value for a given counter type
function resolveCount(guild: any, type: string): number {
    switch (type) {
        case 'members':              return guild.memberCount;
        case 'online':               return guild.members.cache.filter((m: any) => m.presence?.status !== 'offline' && m.presence?.status).size;
        case 'bots':                 return guild.members.cache.filter((m: any) => m.user.bot).size;
        case 'humans':               return guild.members.cache.filter((m: any) => !m.user.bot).size;
        case 'roles':                return guild.roles.cache.size - 1;
        case 'channels':             return guild.channels.cache.size;
        case 'boosters':             return guild.premiumSubscriptionCount ?? 0;
        case 'pending':              return guild.members.cache.filter((m: any) => m.pending).size;
        case 'text_channels':        return guild.channels.cache.filter((c: any) => c.type === 0).size;
        case 'voice_channels':       return guild.channels.cache.filter((c: any) => c.type === 2).size;
        case 'categories':           return guild.channels.cache.filter((c: any) => c.type === 4).size;
        case 'announcement_channels':return guild.channels.cache.filter((c: any) => c.type === 5).size;
        case 'stage_channels':       return guild.channels.cache.filter((c: any) => c.type === 13).size;
        default:                     return 0;
    }
}

function resolveTemplate(template: string, count: number): string {
    return template.replace(/{count}/g, count.toLocaleString());
}

export async function updateCounters(client: FadeClient): Promise<void> {
    for (const guild of client.guilds.cache.values()) {
        try {
            const guildCounters = await getCounters(guild.id);
            if (!guildCounters.length) continue;

            for (const counter of guildCounters) {
                if (!counter.enabled) continue;

                const channel = guild.channels.cache.get(counter.channelId);
                if (!channel) continue;

                const count    = resolveCount(guild, counter.type);
                const newName  = resolveTemplate(counter.template, count);

                // Only update if the name actually changed
                if (channel.name === newName) continue;

                await channel.setName(newName, '[Fade] Counter update').catch(() => null);

                // Small delay between updates to avoid rate limits
                await new Promise(r => setTimeout(r, 1_000));
            }
        } catch (err) {
            logger.error('Counter update failed', err, { guildId: guild.id });
        }
    }
}

export function startCounterTimer(client: FadeClient): void {
    // Initial update after 30s (let cache populate first)
    setTimeout(() => updateCounters(client), 30_000);

    // Then every 10 minutes
    setInterval(() => updateCounters(client), 10 * 60 * 1_000);

    logger.info('Counter timer started');
}