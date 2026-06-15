// src/utils/birthdayTimer.ts
// Checks for birthdays once per hour. Announces at midnight in the user's timezone.
import { MessageFlags, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import type { FadeClient } from '../client.js';
import { getTodaysBirthdays, getBirthdayConfig } from '../db/queries/birthdays.js';
import { buildScriptedEmbed, buildScriptedCard } from './welcomecard.js';
import { Colours } from '../components/emojis.js';
import { logger } from './logger.js';

// Track which birthdays we've already announced today (guildId:userId)
const announced = new Set<string>();

// Reset at midnight UTC
function scheduleReset() {
    const now  = new Date();
    const next = new Date(now);
    next.setUTCHours(24, 0, 0, 0);
    setTimeout(() => {
        announced.clear();
        scheduleReset();
    }, next.getTime() - now.getTime());
}

export function startBirthdayTimer(client: FadeClient): void {
    scheduleReset();

    setInterval(async () => {
        try {
            const now    = new Date();
            const month  = String(now.getUTCMonth() + 1).padStart(2, '0');
            const day    = String(now.getUTCDate()).padStart(2, '0');
            const today  = `${month}-${day}`;

            const entries = await getTodaysBirthdays(today);
            if (!entries.length) return;

            // Group by guild
            const byGuild = new Map<string, typeof entries>();
            for (const entry of entries) {
                if (!byGuild.has(entry.guildId)) byGuild.set(entry.guildId, []);
                byGuild.get(entry.guildId)!.push(entry);
            }

            for (const [guildId, users] of byGuild) {
                const config = await getBirthdayConfig(guildId);
                if (!config?.channelId || config.enabled === false) continue;

                const guild = client.guilds.cache.get(guildId);
                if (!guild) continue;

                const channel = guild.channels.cache.get(config.channelId) as any;
                if (!channel?.isTextBased()) continue;

                for (const entry of users) {
                    const key = `${guildId}:${entry.userId}`;
                    if (announced.has(key)) continue;
                    announced.add(key);

                    const member = await guild.members.fetch(entry.userId).catch(() => null);
                    if (!member) continue;

                    // Grant birthday role if configured
                    if (config.roleId) {
                        await member.roles.add(config.roleId, '[Fade] Birthday role').catch(() => null);
                        // Remove after 24h
                        setTimeout(async () => {
                            await member.roles.remove(config.roleId!, '[Fade] Birthday role expired').catch(() => null);
                        }, 24 * 60 * 60 * 1000);
                    }

                    let text = config.message
                        ? config.message
                            .replace(/{user}/g, member.toString())
                            .replace(/{date}/g, entry.birthday)
                        : `🎂 Happy Birthday ${member.toString()}! 🎉`;
                    
                    text = text.replace(/^[ ]+/gm, (spaces) => '\u2800'.repeat(spaces.length));

                    const style = (config as any).style ?? 'text';

                    const sendDefault = async () => {
                        const card = new ContainerBuilder()
                            .setAccentColor(Colours.SUCCESS)
                            .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));
                        await channel.send({ content: member.toString(), components: [card], flags: MessageFlags.IsComponentsV2 } as any).catch(() => null);
                    };

                    try {
                        if (style === 'embed' && config.message) {
                            const { embed, content, buttons } = buildScriptedEmbed(config.message, member as any);
                            const payload: any = { embeds: [embed] };
                            if (content) payload.content = content;
                            if (buttons) payload.components = [buttons];
                            await channel.send(payload).catch(() => null);
                        } else if (style === 'card' && config.message) {
                            const { container } = buildScriptedCard(config.message, member as any);
                            await channel.send({ content: member.toString(), components: [container], flags: MessageFlags.IsComponentsV2 } as any).catch(() => null);
                        } else {
                            await sendDefault();
                        }
                    } catch {
                        // Malformed script — fall back to plain text silently
                        await sendDefault();
                    }
                }
            }
        } catch (err) {
            logger.error('Birthday timer failed', err);
        }
    }, 60 * 60 * 1000); // check every hour

    logger.info('Birthday timer started');
}
