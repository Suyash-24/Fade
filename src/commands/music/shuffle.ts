// src/commands/music/shuffle.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requirePlayer, musicReply } from '../../music/utils.js';
import { buildMusicInfoCard, buildMusicErrorCard } from '../../music/cards.js';

export default {
    data: new SlashCommandBuilder()
        .setName('shuffle')
        .setDescription('Shuffle the current queue'),

    category:  'music',
    guildOnly: true,
    aliases:   ['shuffle', 'sh'],
    cooldown:  2,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!shuffle` to shuffle the queue.', flags: 64 });
    },

    async prefixExecute(message, args, client) {
        const player = await requirePlayer(message, client);
        if (!player) return;

        if (message.member?.voice?.channelId !== player.voiceId) {
            await musicReply(message, [buildMusicErrorCard(`Join <#${player.voiceId}> to control the player.`)]);
            return;
        }

        if (!player.queue.length) {
            await musicReply(message, [buildMusicErrorCard('The queue only has one track — nothing to shuffle.')]);
            return;
        }

        player.queue.shuffle();
        await musicReply(message, [buildMusicInfoCard(
            '🔀 Shuffled',
            `Shuffled **${player.queue.length} tracks** in the queue.`
        )]);
    },
} satisfies Command;
