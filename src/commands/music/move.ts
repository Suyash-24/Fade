// src/commands/music/move.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requirePlayer, musicReply } from '../../music/utils.js';
import { buildMusicInfoCard, buildMusicErrorCard } from '../../music/cards.js';

export default {
    data: new SlashCommandBuilder()
        .setName('move')
        .setDescription('Move a track in the queue'),

    category:  'music',
    guildOnly: true,
    aliases:   ['move', 'mv'],
    cooldown:  2,

    async execute(interaction) {
        await interaction.reply({
            content: 'Use `f!move <from> <to>` to reposition a track in the queue.',
            flags: 64,
        });
    },

    async prefixExecute(message, args, client) {
        const player = await requirePlayer(message, client);
        if (!player) return;

        // Require user in same VC
        if (message.member?.voice?.channelId !== player.voiceId) {
            await musicReply(message, [buildMusicErrorCard(`Join <#${player.voiceId}> to control the player.`)]);
            return;
        }

        const queueLen = player.queue.length;
        if (queueLen < 2) {
            await musicReply(message, [buildMusicErrorCard('You need at least **2 tracks** in the queue to move one.')]);
            return;
        }

        const from = parseInt(args[0] ?? '', 10);
        const to   = parseInt(args[1] ?? '', 10);

        if (isNaN(from) || isNaN(to)) {
            await musicReply(message, [buildMusicErrorCard('Usage: `f!move <from> <to>`\n-# Both positions must be numbers.')]);
            return;
        }

        if (from < 1 || from > queueLen) {
            await musicReply(message, [buildMusicErrorCard(`\`from\` must be between **1** and **${queueLen}**.\n-# Use \`f!queue\` to see track positions.`)]);
            return;
        }

        if (to < 1 || to > queueLen) {
            await musicReply(message, [buildMusicErrorCard(`\`to\` must be between **1** and **${queueLen}**.\n-# Use \`f!queue\` to see track positions.`)]);
            return;
        }

        if (from === to) {
            await musicReply(message, [buildMusicErrorCard('`from` and `to` positions are the same.')]);
            return;
        }

        // Mutate the queue directly (KazagumoQueue extends Array)
        const [track] = (player.queue as any[]).splice(from - 1, 1);
        (player.queue as any[]).splice(to - 1, 0, track);

        await musicReply(message, [
            buildMusicInfoCard(
                '↕ Track Moved',
                `Moved **[${track.title}](${track.uri ?? 'https://discord.com'})** from position **#${from}** to **#${to}**.`,
            ),
        ]);
    },
} satisfies Command;
