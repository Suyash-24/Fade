// src/commands/music/stop.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requirePlayer, musicReply } from '../../music/utils.js';
import { buildMusicInfoCard, buildMusicErrorCard } from '../../music/cards.js';

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
        const player = await requirePlayer(message, client);
        if (!player) return;

        if (message.member?.voice?.channelId !== player.voiceId) {
            await musicReply(message, [buildMusicErrorCard(`Join <#${player.voiceId}> to control the player.`)]);
            return;
        }

        // Clear queue and destroy
        player.queue.clear();
        player.destroy();

        const card = buildMusicInfoCard(
            '⏹ Stopped',
            'Queue cleared and disconnected from voice.\n-# Use `f!play` to start a new session.'
        );
        await musicReply(message, [card]);
    },
} satisfies Command;
