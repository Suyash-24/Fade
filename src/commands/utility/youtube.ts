// src/commands/utility/youtube.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { handleMediaDownload } from '../../utils/mediaDownloader.js';
import { e } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('youtube')
        .setDescription('Download a YouTube Shorts/Video')
        .addStringOption(o => o
            .setName('url')
            .setDescription('The YouTube video URL')
            .setRequired(true)
        ),
    category: 'utility',
    cooldown: 5,
    async execute(interaction) {
        const url = interaction.options.getString('url', true);
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            return interaction.reply({ content: `${e('error')} Please provide a valid YouTube URL.`, ephemeral: true });
        }
        await handleMediaDownload(interaction, url, 'YouTube');
    },
    async prefixExecute(message, args) {
        const url = args[0];
        if (!url) {
            return message.reply(`${e('error')} Please provide a YouTube URL to download.`);
        }
        if (!url.includes('youtube.com') && !url.includes('youtu.be')) {
            return message.reply(`${e('error')} Please provide a valid YouTube URL.`);
        }
        await handleMediaDownload(message, url, 'YouTube');
    }
} as Command;
