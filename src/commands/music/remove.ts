// src/commands/music/remove.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requirePlayer, musicReply } from '../../music/utils.js';
import { buildMusicInfoCard, buildMusicErrorCard } from '../../music/cards.js';

export default {
    data: new SlashCommandBuilder()
        .setName('remove')
        .setDescription('Remove a track from the queue by position'),

    category:  'music',
    guildOnly: true,
    aliases:   ['remove', 'rm'],
    cooldown:  2,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!remove <position>` to remove a track.', flags: 64 });
    },

    async prefixExecute(message, args, client) {
        const player = await requirePlayer(message, client);
        if (!player) return;

        if (message.member?.voice?.channelId !== player.voiceId) {
            await musicReply(message, [buildMusicErrorCard(`Join <#${player.voiceId}> to control the player.`)]);
            return;
        }

        const pos = parseInt(args[0] ?? '', 10);
        if (isNaN(pos) || pos < 1 || pos > player.queue.length) {
            await musicReply(message, [buildMusicErrorCard(
                `Invalid position. Queue has **${player.queue.length}** track(s).\n-# Use \`f!queue\` to see positions.`
            )]);
            return;
        }

        const removed = player.queue[pos - 1];
        player.queue.remove(pos - 1);
        await musicReply(message, [buildMusicInfoCard(
            '🗑 Removed',
            `Removed **[${removed.title}](${removed.uri ?? 'https://discord.com'})** from the queue.`
        )]);
    },
} satisfies Command;
