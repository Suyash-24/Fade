// src/commands/music/stop.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { musicReply } from '../../music/utils.js';
import { buildMusicInfoCard, buildMusicErrorCard } from '../../music/cards.js';
import { get247 } from '../../db/queries/twentyFourSeven.js';

export default {
    data: new SlashCommandBuilder()
        .setName('stop')
        .setDescription('Stop music and clear the queue'),

    category:  'music',
    guildOnly: true,
    aliases:   ['stop', 'disconnect', 'dc', 'leave'],
    cooldown:  2,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!stop` to stop playback and clear the queue.', flags: 64 });
    },

    async prefixExecute(message, args, client) {
        const player = client.music?.players.get(message.guild!.id);
        const botVoiceChannelId = message.guild!.members.me?.voice?.channelId;

        if (!player && !botVoiceChannelId) {
            await musicReply(message, [buildMusicErrorCard('I am not connected to a voice channel.')]);
            return;
        }

        if (botVoiceChannelId && message.member?.voice?.channelId !== botVoiceChannelId) {
            await musicReply(message, [buildMusicErrorCard(`Join <#${botVoiceChannelId}> to control the player.`)]);
            return;
        }

        const is247 = await get247(message.guild!.id);

        if (is247) {
            if (player) {
                player.queue.clear();
                if (player.queue.current) {
                    player.skip();
                }
            }
            const card = buildMusicInfoCard(
                '⏹ Stopped',
                'Queue cleared.\n-# 24/7 Mode is enabled, so I will stay in the voice channel. Use `f!247` to disable.'
            );
            await musicReply(message, [card]);
            return;
        }

        // Clear queue and destroy
        if (player) {
            player.queue.clear();
            player.destroy();
        } else if (botVoiceChannelId) {
            message.guild!.members.me?.voice?.disconnect();
        }

        const card = buildMusicInfoCard(
            '⏹ Stopped',
            'Queue cleared and disconnected from voice.\n-# Use `f!play` to start a new session.'
        );
        await musicReply(message, [card]);
    },
} satisfies Command;
