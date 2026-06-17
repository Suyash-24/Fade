// src/events/tempVoice.ts
// Handles the core TempVoice logic:
//   - User joins the "join to create" channel → create their temp channel
//   - User leaves their temp channel → delete it if empty
//   - Owner leaves → transfer ownership to next member
import { ChannelType, PermissionFlagsBits } from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import {
    getTempVoiceConfig,
    registerTempChannel,
    getTempChannel,
    deleteTempChannel,
} from '../db/queries/tempvoice.js';
import { logger } from '../utils/logger.js';

const event: Event<'voiceStateUpdate'> = {
    name: 'voiceStateUpdate',

    async execute(client: FadeClient, oldState, newState) {
        if (!newState.guild) return;
        const guild = newState.guild;

        try {
            const config = await getTempVoiceConfig(guild.id);
            if (!config.enabled || !config.joinChannelId) return;

            // ── User joined the "join to create" channel ──────────────────────
            if (newState.channelId === config.joinChannelId && newState.member) {
                const member      = newState.member;
                const channelName = (config.defaultName ?? "{user}'s channel")
                    .replace('{user}', member.displayName);
                const limit = config.defaultLimit ?? 0;

                // Create the temp channel
                const tempChannel = await guild.channels.create({
                    name:   channelName,
                    type:   ChannelType.GuildVoice,
                    parent: config.categoryId ?? undefined,
                    userLimit: limit > 0 ? limit : undefined,
                    permissionOverwrites: [
                        {
                            id:    member.id,
                            allow: [
                                PermissionFlagsBits.ManageChannels,
                                PermissionFlagsBits.MoveMembers,
                                PermissionFlagsBits.MuteMembers,
                            ],
                        },
                        {
                            id:    guild.members.me!.id,
                            allow: [
                                PermissionFlagsBits.ManageChannels,
                                PermissionFlagsBits.MoveMembers,
                                PermissionFlagsBits.ViewChannel,
                                PermissionFlagsBits.Connect,
                            ],
                        },
                    ],
                });

                // Register in DB
                await registerTempChannel(tempChannel.id, guild.id, member.id);

                // Move the member into their new channel
                await member.voice.setChannel(tempChannel).catch(() => null);

                // Note: The interface is no longer sent to the individual channel.
                // The server uses a static global interface channel instead.

                logger.debug('TempVoice: channel created', {
                    channelId: tempChannel.id,
                    ownerId:   member.id,
                    guildId:   guild.id,
                });
            }

            // ── User left a voice channel ──────────────────────────────────────
            if (oldState.channelId && oldState.channelId !== config.joinChannelId) {
                const tempData = await getTempChannel(oldState.channelId);
                if (!tempData) return;

                const channel = guild.channels.cache.get(oldState.channelId);
                if (!channel || channel.type !== ChannelType.GuildVoice) {
                    // Channel already deleted
                    await deleteTempChannel(oldState.channelId);
                    return;
                }

                const voiceChannel = channel as any;
                const memberCount  = voiceChannel.members?.size ?? 0;

                // Empty — delete the channel
                if (memberCount === 0) {
                    await deleteTempChannel(oldState.channelId);
                    await channel.delete('[Fade TempVoice] Channel empty').catch(() => null);
                    return;
                }

                // Owner left but others remain — leave channel ownerless.
                // Remaining members can use /vc claim to take ownership.
            }

        } catch (err) {
            logger.error('TempVoice event failed', err, { guildId: guild.id });
        }
    },
};

export default event;