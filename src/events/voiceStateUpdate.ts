// src/events/voiceStateUpdate.ts
import type { Event } from '../types/event.js';
import type { FadeClient } from '../client.js';
import { AuditLogEvent, TextChannel } from 'discord.js';
import { get247, set247 } from '../db/queries/twentyFourSeven.js';
import { e, Colours } from '../components/emojis.js';
import { FadeContainer } from '../components/builders.js';
import { logger } from '../utils/logger.js';
import { StatsTracker } from '../utils/statsTracker.js';

const event: Event<'voiceStateUpdate'> = {
    name: 'voiceStateUpdate',
    async execute(client: FadeClient, oldState, newState) {
        // --- Analytics Tracking ---
        if (!oldState.member?.user.bot) {
            if (!oldState.channelId && newState.channelId) {
                StatsTracker.voiceJoin(newState.guild.id, newState.id, newState.channelId, newState.channel?.parentId ?? null);
            } else if (oldState.channelId && !newState.channelId) {
                StatsTracker.voiceLeave(oldState.id);
            } else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
                StatsTracker.voiceSwitch(newState.guild.id, newState.id, newState.channelId, newState.channel?.parentId ?? null);
            }
        }

        // We only care if the bot itself triggered a state change for 24/7
        if (oldState.id !== client.user?.id) return;
        
        const guildId = oldState.guild.id;

        // --- 1. Bot was MOVED to another channel ---
        if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            try {
                const is247 = await get247(guildId);
                // If 24/7 is enabled, update the DB to the new channel so it stays there!
                if (is247) {
                    await set247(guildId, newState.channelId, is247.textId);
                    logger.info(`[24/7] Bot was moved to ${newState.channelId} in ${guildId}. Updated 24/7 config.`);
                }
            } catch (err) {
                logger.error('[24/7] Error updating 24/7 status on move', err);
            }
            return;
        }

        // --- 2. Bot was DISCONNECTED (channelId changed to null) ---
        if (oldState.channelId && !newState.channelId) {
            try {
                const is247 = await get247(guildId);
                if (is247 && is247.voiceId === oldState.channelId) {
                    logger.info(`[24/7] Bot disconnected from ${oldState.channelId} in ${guildId}. Rejoining...`);

                    // Re-create the player to rejoin after 1 second
                    setTimeout(async () => {
                        // Wait for discord to update audit log
                        let executorId: string | null = null;
                        try {
                            const auditLogs = await oldState.guild.fetchAuditLogs({
                                limit: 1,
                                type: AuditLogEvent.MemberDisconnect,
                            });
                            const log = auditLogs.entries.first();
                            // Verify the log targets the bot and happened in the last 10 seconds
                            if (log && log.target?.id === client.user?.id && Date.now() - log.createdTimestamp < 10000) {
                                executorId = log.executor?.id ?? null;
                            }
                        } catch (e) {
                            logger.error('[24/7] Failed to fetch audit logs', e);
                        }

                        if (!client.music) return;
                        try {
                            await client.music.createPlayer({
                                guildId:    guildId,
                                voiceId:    is247.voiceId,
                                textId:     is247.textId,
                                deaf:       true,
                                volume:     80,
                            });
                            logger.info(`[24/7] Successfully rejoined ${is247.voiceId} in ${guildId}`);

                            // Send message in the configured text channel
                            let textChannel = client.channels.cache.get(is247.textId) as TextChannel;
                            if (!textChannel) {
                                textChannel = await client.channels.fetch(is247.textId).catch(() => null) as TextChannel;
                            }
                            
                            if (textChannel) {
                                const mention = executorId ? `<@${executorId}> ` : '';
                                const card = new FadeContainer(Colours.FADE)
                                    .text(`## ☀️ 24/7 Mode Active\n-# ${mention}I am forced to stay in the voice channel because **24/7 Mode** is currently enabled.\n-# To make me leave, an admin must use the \`/247\` command to disable it first!`)
                                    .build();
                                await textChannel.send({ components: [card] }).catch(() => null);
                            }

                        } catch (e) {
                            logger.error(`[24/7] Failed to rejoin ${is247.voiceId}`, e);
                        }
                    }, 1500); // 1.5s delay to let Discord close the previous connection and update audit logs
                }
            } catch (err) {
                logger.error('[24/7] Error checking 24/7 status on disconnect', err);
            }
        }
    },
};

export default event;
