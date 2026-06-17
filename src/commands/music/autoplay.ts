// src/commands/music/autoplay.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requirePlayer, musicReply } from '../../music/utils.js';
import { buildMusicInfoCard, buildMusicErrorCard } from '../../music/cards.js';
import { toggleAutoplay, isAutoplay } from '../../music/manager.js';

export default {
    data: new SlashCommandBuilder()
        .setName('autoplay')
        .setDescription('Toggle autoplay'),

    category:  'music',
    guildOnly: true,
    aliases:   ['autoplay', 'ap'],
    cooldown:  3,

    async execute(interaction) {
        await interaction.reply({
            content: 'Use `f!autoplay` to toggle automatic track suggestions when the queue ends.',
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

        const guildId = message.guild!.id;
        const enabled = toggleAutoplay(guildId);

        if (enabled) {
            await musicReply(message, [
                buildMusicInfoCard(
                    '♾️ Autoplay Enabled',
                    'Autoplay is now **on**. When the queue ends, Fade will automatically queue similar tracks.\n-# Use `f!autoplay` again to disable.',
                ),
            ]);
        } else {
            await musicReply(message, [
                buildMusicInfoCard(
                    '⏹ Autoplay Disabled',
                    'Autoplay is now **off**. The player will stop when the queue ends.\n-# Use `f!autoplay` again to enable.',
                ),
            ]);
        }
    },
} satisfies Command;
