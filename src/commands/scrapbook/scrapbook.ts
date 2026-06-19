import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { e, Colours } from '../../components/emojis.js';
import { FadeContainer, sendMessage, sendResponse } from '../../components/builders.js';
import { getLatestScrapbookArchive } from '../../db/queries/scrapbook.js';
import { generateScrapbookCard, ScrapbookData } from '../../utils/canvas/scrapbookCard.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('scrapbook')
        .setDescription('View the Weekly Server Scrapbook (updates every Sunday)'),

    category: 'scrapbook',
    cooldown: 10,

    async prefixExecute(message) {
        const guildId = message.guildId!;
        const archive = await getLatestScrapbookArchive(guildId);

        if (!archive || Object.keys(archive).length === 0) {
            const card = new FadeContainer(Colours.INFO)
                .text(`## ℹ️ No Scrapbook Data\nThe server scrapbook hasn't been generated yet! Check back on Sunday at 12:00 PM UTC.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        // Send a loading message because canvas takes a second
        const loadingCard = new FadeContainer(Colours.FADE)
            .text(`⏳ Fetching this week's scrapbook...`)
            .build();
        const loadingMsg = await message.reply({ components: [loadingCard], flags: (1 << 15) });

        try {
            const buffer = await generateScrapbookCard(archive as ScrapbookData);
            const attachment = new AttachmentBuilder(buffer, { name: 'scrapbook.png' });

            await loadingMsg.delete().catch(() => {});
            await message.reply({
                content: '📸 **Your Weekly Server Scrapbook!**\nHere are the top moments, most active members, and funniest quotes from last week:',
                files: [attachment]
            });
        } catch (err) {
            await loadingMsg.delete().catch(() => {});
            await message.reply('Failed to generate scrapbook image.');
        }
    },

    async execute(interaction) {
        const guildId = interaction.guildId!;
        const archive = await getLatestScrapbookArchive(guildId);

        if (!archive || Object.keys(archive).length === 0) {
            const card = new FadeContainer(Colours.INFO)
                .text(`## ℹ️ No Scrapbook Data\nThe server scrapbook hasn't been generated yet! Check back on Sunday at 12:00 PM UTC.`)
                .build();
            await sendResponse(interaction, [card], false);
            return;
        }

        await interaction.deferReply();

        try {
            const buffer = await generateScrapbookCard(archive as ScrapbookData);
            const attachment = new AttachmentBuilder(buffer, { name: 'scrapbook.png' });

            await interaction.editReply({
                content: '📸 **Your Weekly Server Scrapbook!**\nHere are the top moments, most active members, and funniest quotes from last week:',
                components: [],
                files: [attachment]
            });
        } catch (err) {
            await interaction.editReply({ content: `Failed to generate scrapbook image.` });
        }
    }
};

export default command;
