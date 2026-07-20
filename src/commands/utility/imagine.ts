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
    cooldown: 45,

    async execute(interaction) {
        const prompt = interaction.options.getString('prompt', true);
        await interaction.deferReply();

        try {
            // URL Encode the prompt and add a random seed so duplicate prompts generate unique images
            const encodedPrompt = encodeURIComponent(prompt);
            const seed = Math.floor(Math.random() * 1000000);
            const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&model=flux&seed=${seed}`;

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

        let loadingMsg: any = null;
        try {
            // Send a temporary loading message
            const loadingCard = new FadeContainer(Colours.FADE)
                .text(`${e('loading') || '⏳'} Generating your image, please wait...`)
                .build();
            loadingMsg = await sendMessage(message, [loadingCard]);

            const encodedPrompt = encodeURIComponent(prompt);
            const seed = Math.floor(Math.random() * 1000000);
            const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true&model=flux&seed=${seed}`;

            // Pre-warm the generation so it's ready when Discord fetches it
            const res = await fetch(url);
            if (!res.ok) throw new Error('API Error');

            const card = new FadeContainer()
                .text(`**Prompt:** ${prompt}`)
                .gallery([{ url }])
                .build();

            await loadingMsg.edit({ components: [card] });
        } catch (error) {
            const errCard = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} The AI system is currently under maintenance. We will be back soon!`)
                .build();
            if (loadingMsg) {
                await loadingMsg.edit({ components: [errCard] }).catch(() => null);
            } else {
                await sendMessage(message, [errCard]);
            }
        }
    }
} as Command;
