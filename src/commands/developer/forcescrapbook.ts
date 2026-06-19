import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { e, Colours } from '../../components/emojis.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { processWeeklyScrapbooks } from '../../utils/scrapbookTimer.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('forcescrapbook')
        .setDescription('Force take the weekly scrapbook snapshot right now (Developer only)'),

    category: 'developer',
    ownerOnly: true, // Only bot owners can use this

    async prefixExecute(message) {
        const card = new FadeContainer(Colours.INFO)
            .text(`⏳ Forcing Scrapbook Snapshot across all servers...`)
            .build();
        const msg = await message.reply({ components: [card], flags: (1 << 15) });

        try {
            await processWeeklyScrapbooks(message.client as any);
            const successCard = new FadeContainer(Colours.SUCCESS)
                .text(`## ${e('success')} Snapshot Taken\nThe Weekly Scrapbook data has been successfully archived! You can now run \`f!scrapbook\` to view it.`)
                .build();
            await msg.edit({ components: [successCard] });
        } catch (err) {
            const errCard = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} Failed to take snapshot: ${err}`)
                .build();
            await msg.edit({ components: [errCard] });
        }
    },

    async execute(interaction) {
        await interaction.deferReply({ ephemeral: true });

        try {
            await processWeeklyScrapbooks(interaction.client as any);
            const successCard = new FadeContainer(Colours.SUCCESS)
                .text(`## ${e('success')} Snapshot Taken\nThe Weekly Scrapbook data has been successfully archived! You can now run \`/scrapbook\` to view it.`)
                .build();
            await interaction.editReply({ components: [successCard] });
        } catch (err) {
            const errCard = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} Failed to take snapshot: ${err}`)
                .build();
            await interaction.editReply({ components: [errCard] });
        }
    }
};

export default command;
