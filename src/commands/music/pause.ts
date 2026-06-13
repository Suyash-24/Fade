// src/commands/music/pause.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requirePlayer, musicReply } from '../../music/utils.js';
import { buildMusicInfoCard, buildMusicErrorCard } from '../../music/cards.js';

export default {
    data: new SlashCommandBuilder()
        .setName('pause')
        .setDescription('Pause or resume the current track'),

    category:  'music',
    guildOnly: true,
    aliases:   ['pause', 'resume'],
    cooldown:  2,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!pause` to pause/resume.', flags: 64 });
    },

    async prefixExecute(message, args, client) {
        const player = await requirePlayer(message, client);
        if (!player) return;

        if (message.member?.voice?.channelId !== player.voiceId) {
            await musicReply(message, [buildMusicErrorCard(`Join <#${player.voiceId}> to control the player.`)]);
            return;
        }

        await player.pause(!player.paused);
        const state = player.paused ? 'Paused' : 'Resumed';
        const icon  = player.paused ? '⏸' : '▶';
        const card  = buildMusicInfoCard(
            `${icon} ${state}`,
            `-# Use \`f!pause\` again to ${player.paused ? 'resume' : 'pause'}.`
        );
        await musicReply(message, [card]);
    },
} satisfies Command;
