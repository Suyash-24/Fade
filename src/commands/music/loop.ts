// src/commands/music/loop.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requirePlayer, musicReply } from '../../music/utils.js';
import { buildMusicInfoCard, buildMusicErrorCard } from '../../music/cards.js';

const MODES: Record<string, string> = {
    none:  '➡ Loop Off',
    track: '🔂 Track Loop',
    queue: '🔁 Queue Loop',
};

export default {
    data: new SlashCommandBuilder()
        .setName('loop')
        .setDescription('Set loop mode: off / track / queue'),

    category:  'music',
    guildOnly: true,
    aliases:   ['loop', 'repeat'],
    cooldown:  2,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!loop [off|track|queue]` to set loop mode.', flags: 64 });
    },

    async prefixExecute(message, args, client) {
        const player = await requirePlayer(message, client);
        if (!player) return;

        if (message.member?.voice?.channelId !== player.voiceId) {
            await musicReply(message, [buildMusicErrorCard(`Join <#${player.voiceId}> to control the player.`)]);
            return;
        }

        // Cycle through modes if no arg given
        let mode: 'none' | 'track' | 'queue';
        const arg = args[0]?.toLowerCase();

        if (!arg) {
            // Cycle: none → track → queue → none
            if (player.loop === 'none')  mode = 'track';
            else if (player.loop === 'track') mode = 'queue';
            else mode = 'none';
        } else if (arg === 'off' || arg === 'none' || arg === 'disable') {
            mode = 'none';
        } else if (arg === 'track' || arg === 'song' || arg === 'one') {
            mode = 'track';
        } else if (arg === 'queue' || arg === 'all') {
            mode = 'queue';
        } else {
            await musicReply(message, [buildMusicErrorCard('Valid modes: `off`, `track`, `queue`.')]);
            return;
        }

        player.setLoop(mode);
        await musicReply(message, [buildMusicInfoCard(MODES[mode], `-# Loop mode changed to **${mode}**.`)]);
    },
} satisfies Command;
