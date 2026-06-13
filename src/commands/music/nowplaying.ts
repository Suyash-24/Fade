// src/commands/music/nowplaying.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requirePlayer, musicReply } from '../../music/utils.js';
import { buildNowPlayingCard } from '../../music/cards.js';

export default {
    data: new SlashCommandBuilder()
        .setName('nowplaying')
        .setDescription('Show the currently playing track'),

    category:  'music',
    guildOnly: true,
    aliases:   ['nowplaying', 'np', 'song', 'current'],
    cooldown:  3,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!np` to see what\'s playing.', flags: 64 });
    },

    async prefixExecute(message, args, client) {
        const player = await requirePlayer(message, client);
        if (!player) return;

        const card = buildNowPlayingCard(player, player.queue.current!);
        await musicReply(message, [card]);
    },
} satisfies Command;
