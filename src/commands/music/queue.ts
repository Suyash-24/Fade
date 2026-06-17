// src/commands/music/queue.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requirePlayer, musicReply } from '../../music/utils.js';
import { buildQueueCard } from '../../music/cards.js';

export default {
    data: new SlashCommandBuilder()
        .setName('queue')
        .setDescription('View the music queue'),

    category:  'music',
    guildOnly: true,
    aliases:   ['queue'],
    cooldown:  3,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!queue` to see the queue.', flags: 64 });
    },

    async prefixExecute(message, args, client) {
        const player = await requirePlayer(message, client);
        if (!player) return;

        const page = args[0] ? parseInt(args[0], 10) : 1;
        const card = buildQueueCard(player, isNaN(page) ? 1 : page);
        await musicReply(message, [card]);
    },
} satisfies Command;
