// src/commands/music/volume.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requirePlayer, musicReply } from '../../music/utils.js';
import { buildMusicInfoCard, buildMusicErrorCard } from '../../music/cards.js';

export default {
    data: new SlashCommandBuilder()
        .setName('volume')
        .setDescription('Set the player volume (1-200)'),

    category:  'music',
    guildOnly: true,
    aliases:   ['volume', 'vol', 'v'],
    cooldown:  2,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!vol <1-200>` to set volume.', flags: 64 });
    },

    async prefixExecute(message, args, client) {
        const player = await requirePlayer(message, client);
        if (!player) return;

        if (message.member?.voice?.channelId !== player.voiceId) {
            await musicReply(message, [buildMusicErrorCard(`Join <#${player.voiceId}> to control the player.`)]);
            return;
        }

        if (!args[0]) {
            const icon = player.volume <= 30 ? '🔈' : player.volume <= 70 ? '🔉' : '🔊';
            await musicReply(message, [buildMusicInfoCard(`${icon} Volume`, `Current volume: **${player.volume}%**\n-# Use \`f!vol <1-200>\` to change it.`)]);
            return;
        }

        const vol = parseInt(args[0], 10);
        if (isNaN(vol) || vol < 1 || vol > 200) {
            await musicReply(message, [buildMusicErrorCard('Volume must be between **1** and **200**.')]);
            return;
        }

        await player.setVolume(vol);
        const icon = vol <= 30 ? '🔈' : vol <= 70 ? '🔉' : '🔊';
        await musicReply(message, [buildMusicInfoCard(`${icon} Volume Updated`, `Volume set to **${vol}%**.`)]);
    },
} satisfies Command;
