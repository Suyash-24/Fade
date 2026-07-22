// src/commands/utility/ask.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('askai')
        .setDescription('Ask the AI a question')
        .addStringOption(o => o
            .setName('prompt')
            .setDescription('What do you want to ask?')
            .setRequired(true)
        ),

    category: 'utility',
    prefixOnly: true,
    cooldown: 5,

    async execute(interaction) {
        const prompt = interaction.options.getString('prompt', true);
        await interaction.deferReply();

        try {
            const res = await fetch('https://text.pollinations.ai/openai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'openai',
                    messages: [
                        { role: 'system', content: 'You are a helpful Discord bot named Fade. You MUST refuse to answer any NSFW, explicit, or sexually suggestive prompts.' },
                        { role: 'user', content: prompt }
                    ],
                }),
            });

            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            const answer = data.choices[0].message.content;

            const card = new FadeContainer()
                .text(`**Q:** ${prompt}\n\n${answer}`)
                .build();

            await sendResponse(interaction as any, [card]);
        } catch (error) {
            console.error('AskAI Error (slash):', error);
            const errCard = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} The AI system is currently under maintenance. We will be back soon!`)
                .build();
            await sendResponse(interaction as any, [errCard], true);
        }
    },

    async prefixExecute(message, args) {
        if (!args.length) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} You need to provide a question! Example: \`!askai What is the capital of France?\``)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        const prompt = args.join(' ');
        
        // Show typing indicator since AI generation takes a few seconds
        if ('sendTyping' in message.channel) {
            await message.channel.sendTyping().catch(() => null);
        }

        try {
            const res = await fetch('https://text.pollinations.ai/openai', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model: 'openai',
                    messages: [
                        { role: 'system', content: 'You are a helpful Discord bot named Fade. You MUST refuse to answer any NSFW, explicit, or sexually suggestive prompts.' },
                        { role: 'user', content: prompt }
                    ],
                }),
            });

            if (!res.ok) throw new Error('API Error');
            const data = await res.json();
            let answer = data.choices[0].message.content;
            
            // Discord limits messages to 4096 characters in embeds (or 2000 in regular text). 
            // We truncate if it's too long.
            if (answer.length > 3900) {
                answer = answer.slice(0, 3900) + '... (Response truncated)';
            }

            const card = new FadeContainer()
                .text(`**Q:** ${prompt}\n\n${answer}`)
                .build();

            await sendMessage(message, [card]);
        } catch (error) {
            console.error('AskAI Error (prefix):', error);
            const errCard = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} The AI system is currently under maintenance. We will be back soon!`)
                .build();
            await sendMessage(message, [errCard]);
        }
    }
} as Command;
