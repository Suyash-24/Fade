// src/commands/utility/instagram.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { handleMediaDownload } from '../../utils/mediaDownloader.js';
import { e } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('instagram')
        .setDescription('Download an Instagram Reel/Video')
        .addStringOption(o => o
            .setName('url')
            .setDescription('The Instagram video URL')
            .setRequired(true)
        ),
    category: 'utility',
    cooldown: 5,
    async execute(interaction) {
        const url = interaction.options.getString('url', true);
        if (!url.includes('instagram.com')) {
            return interaction.reply({ content: `${e('error')} Please provide a valid Instagram URL.`, ephemeral: true });
        }
        await handleMediaDownload(interaction, url, 'Instagram');
    },
    async prefixExecute(message, args) {
        const url = args[0];
        if (!url) {
            return message.reply(`${e('error')} Please provide an Instagram URL to download.`);
        }
        if (!url.includes('instagram.com')) {
            return message.reply(`${e('error')} Please provide a valid Instagram URL.`);
        }
        await handleMediaDownload(message, url, 'Instagram');
    }
} as Command;
