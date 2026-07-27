// src/commands/utility/tiktok.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { handleMediaDownload } from '../../utils/mediaDownloader.js';
import { e } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('tiktok')
        .setDescription('Download a TikTok video without watermarks')
        .addStringOption(o => o
            .setName('url')
            .setDescription('The TikTok video URL')
            .setRequired(true)
        ),
    category: 'utility',
    cooldown: 5,
    async execute(interaction) {
        const url = interaction.options.getString('url', true);
        if (!url.includes('tiktok.com')) {
            return interaction.reply({ content: `${e('error')} Please provide a valid TikTok URL.`, ephemeral: true });
        }
        await handleMediaDownload(interaction, url, 'TikTok');
    },
    async prefixExecute(message, args) {
        const url = args[0];
        if (!url) {
            return message.reply(`${e('error')} Please provide a TikTok URL to download.`);
        }
        if (!url.includes('tiktok.com')) {
            return message.reply(`${e('error')} Please provide a valid TikTok URL.`);
        }
        await handleMediaDownload(message, url, 'TikTok');
    }
} as Command;
