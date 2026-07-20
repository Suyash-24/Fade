import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('imagine')
        .setDescription('Generate an AI image for free')
        .addStringOption(o => o
            .setName('prompt')
            .setDescription('What do you want to generate?')
            .setRequired(true)
        ),

    category: 'utility',
    cooldown: 10,

    async execute(interaction) {
        const prompt = interaction.options.getString('prompt', true);
        await interaction.deferReply();

        try {
            // URL Encode the prompt for the URL path
            const encodedPrompt = encodeURIComponent(prompt);
            const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&model=flux`;

            // Pre-warm the generation so it's ready when Discord fetches it
            const res = await fetch(url);
            if (!res.ok) throw new Error('API Error');

            const card = new FadeContainer()
                .text(`**Prompt:** ${prompt}`)
                .gallery([{ url }])
                .build();

            await sendResponse(interaction as any, [card]);
        } catch (error) {
            console.error('[Imagine Command Error (Slash)]', error);
            const errCard = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} The AI system is currently under maintenance. We will be back soon!`)
                .build();
            await sendResponse(interaction as any, [errCard], true);
        }
    },

    async prefixExecute(message, args) {
        if (!args.length) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} You need to provide a prompt! Example: \`!imagine A futuristic cyberpunk city\``)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        const prompt = args.join(' ');
        
        // Show typing indicator
        if ('sendTyping' in message.channel) {
            await message.channel.sendTyping().catch(() => null);
        }

        try {
            const encodedPrompt = encodeURIComponent(prompt);
            const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&model=flux`;

            // Pre-warm the generation so it's ready when Discord fetches it
            const res = await fetch(url);
            if (!res.ok) throw new Error('API Error');

            const card = new FadeContainer()
                .text(`**Prompt:** ${prompt}`)
                .gallery([{ url }])
                .build();

            await sendMessage(message, [card]);
        } catch (error) {
            const errCard = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} The AI system is currently under maintenance. We will be back soon!`)
                .build();
            await sendMessage(message, [errCard]);
        }
    }
} as Command;
