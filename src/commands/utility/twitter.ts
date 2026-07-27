// src/commands/utility/twitter.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { handleMediaDownload } from '../../utils/mediaDownloader.js';
import { e } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('twitter')
        .setDescription('Download a Twitter/X video')
        .addStringOption(o => o
            .setName('url')
            .setDescription('The Twitter video URL')
            .setRequired(true)
        ),
    category: 'utility',
    cooldown: 5,
    async execute(interaction) {
        const url = interaction.options.getString('url', true);
        if (!url.includes('twitter.com') && !url.includes('x.com')) {
            return interaction.reply({ content: `${e('error')} Please provide a valid Twitter/X URL.`, ephemeral: true });
        }
        await handleMediaDownload(interaction, url, 'Twitter');
    },
    async prefixExecute(message, args) {
        const url = args[0];
        if (!url) {
            return message.reply(`${e('error')} Please provide a Twitter/X URL to download.`);
        }
        if (!url.includes('twitter.com') && !url.includes('x.com')) {
            return message.reply(`${e('error')} Please provide a valid Twitter/X URL.`);
        }
        await handleMediaDownload(message, url, 'Twitter');
    }
} as Command;
