// src/commands/utility/pinterest.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { handleMediaDownload } from '../../utils/mediaDownloader.js';
import { e } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('pinterest')
        .setDescription('Download a Pinterest video')
        .addStringOption(o => o
            .setName('url')
            .setDescription('The Pinterest video URL')
            .setRequired(true)
        ),
    category: 'utility',
    cooldown: 5,
    async execute(interaction) {
        const url = interaction.options.getString('url', true);
        if (!url.includes('pinterest.')) {
            return interaction.reply({ content: `${e('error')} Please provide a valid Pinterest URL.`, ephemeral: true });
        }
        await handleMediaDownload(interaction, url, 'Pinterest');
    },
    async prefixExecute(message, args) {
        const url = args[0];
        if (!url) {
            return message.reply(`${e('error')} Please provide a Pinterest URL to download.`);
        }
        if (!url.includes('pinterest.')) {
            return message.reply(`${e('error')} Please provide a valid Pinterest URL.`);
        }
        await handleMediaDownload(message, url, 'Pinterest');
    }
} as Command;
