// src/commands/music/skip.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requirePlayer, musicReply } from '../../music/utils.js';
import { buildMusicInfoCard, buildMusicErrorCard, msToTimestamp } from '../../music/cards.js';

export default {
    data: new SlashCommandBuilder()
        .setName('skip')
        .setDescription('Skip the current track'),

    category:  'music',
    guildOnly: true,
    aliases:   ['skip', 'sk', 'next'],
    cooldown:  2,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!skip` to skip the current track.', flags: 64 });
    },

    async prefixExecute(message, args, client) {
        const player = await requirePlayer(message, client);
        if (!player) return;

        // Check user is in the same VC
        const vcId = message.member?.voice?.channelId;
        if (vcId !== player.voiceId) {
            await musicReply(message, [buildMusicErrorCard(`Join <#${player.voiceId}> to control the player.`)]);
            return;
        }

        const skipped = player.queue.current!;
        const skipTo  = args[0] ? parseInt(args[0], 10) : 1;

        if (isNaN(skipTo) || skipTo < 1) {
            await musicReply(message, [buildMusicErrorCard('Invalid skip amount.')]);
            return;
        }

        // Skip multiple tracks
        if (skipTo > 1) {
            for (let i = 0; i < skipTo - 1; i++) player.queue.remove(0);
        }

        player.skip();

        const card = buildMusicInfoCard(
            '⏭ Skipped',
            `Skipped **${skipTo > 1 ? `${skipTo} tracks` : `[${skipped.title}](${skipped.uri ?? 'https://discord.com'})`}**` +
            (player.queue.current ? `\n-# Now playing: **${player.queue.current.title}**` : '\n-# Queue is now empty.')
        );
        await musicReply(message, [card]);
    },
} satisfies Command;
