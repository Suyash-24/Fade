import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
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
            const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true`;

            // Fetch the generated image buffer
            const res = await fetch(url);
            if (!res.ok) throw new Error('API Error');
            const buffer = Buffer.from(await res.arrayBuffer());

            // Create Discord attachment
            const attachment = new AttachmentBuilder(buffer, { name: 'generation.jpg' });

            const card = new FadeContainer()
                .text(`**Prompt:** ${prompt}`)
                .gallery([{ url: 'attachment://generation.jpg' }])
                .build();

            const payload = { components: [card], files: [attachment], flags: 1 << 13 } as any;
            await interaction.editReply(payload);
        } catch (error) {
            const errCard = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} Failed to generate the image. The AI might be under maintenance!`)
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
            const url = `https://image.pollinations.ai/prompt/${encodedPrompt}?nologo=true`;

            const res = await fetch(url);
            if (!res.ok) throw new Error('API Error');
            const buffer = Buffer.from(await res.arrayBuffer());

            const attachment = new AttachmentBuilder(buffer, { name: 'generation.jpg' });

            const card = new FadeContainer()
                .text(`**Prompt:** ${prompt}`)
                .gallery([{ url: 'attachment://generation.jpg' }])
                .build();

            const payload = { components: [card], files: [attachment], flags: 1 << 13 } as any;
            await message.reply(payload);
        } catch (error) {
            const errCard = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} Failed to generate the image. The AI might be under maintenance!`)
                .build();
            await sendMessage(message, [errCard]);
        }
    }
} as Command;
