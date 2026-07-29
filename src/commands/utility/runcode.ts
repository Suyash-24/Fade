import { Message } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendMessage, FadeContainer } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import fetch from 'node-fetch';

export default {
    data: {
        name: 'runcode',
        description: 'Run code natively'
    },
    category: 'utility',
    prefixOnly: true,
    cooldown: 5,
    aliases: ['run', 'evalcode', 'execute'],

    async prefixExecute(message: Message, args: string[]) {
        if (args.length < 2) {
            const usageCard = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} **Usage:** \`!runcode [language] [code]\`\n\nExample:\n\`!runcode python \nprint("Hello")\``)
                .build();
            await sendMessage(message, [usageCard]);
            return;
        }

        const language = args[0].toLowerCase();
        
        // Extract raw code directly from message.content to preserve spaces/tabs exactly
        // Syntax: !runcode python ```...```
        let code = '';
        const rawContent = message.content;
        
        // Find the language argument index to skip the prefix and language
        const langIndex = rawContent.toLowerCase().indexOf(language);
        if (langIndex !== -1) {
            code = rawContent.slice(langIndex + language.length).trim();
        }

        // If the user wrapped the code in markdown code blocks, strip them
        const codeBlockRegex = /^```(?:[a-z0-9_]+\n)?([\s\S]*?)```$/i;
        const match = code.match(codeBlockRegex);
        if (match) {
            code = match[1];
        }

        if (!code || code.trim() === '') {
            const emptyCard = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} Please provide some code to run!`)
                .build();
            await sendMessage(message, [emptyCard]);
            return;
        }

        if ('sendTyping' in message.channel) {
            await message.channel.sendTyping().catch(() => null);
        }

        try {
            // Using Piston API (Free open source execution engine)
            const response = await fetch('https://emkc.org/api/v2/piston/execute', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    language: language,
                    version: '*', // Uses latest available version for that language
                    files: [{ content: code }]
                })
            });

            const data: any = await response.json();

            if (data.message && !data.run) {
                // Usually indicates unsupported language
                const errorCard = new FadeContainer(Colours.DANGER)
                    .text(`${e('error')} API Error: ${data.message}`)
                    .build();
                await sendMessage(message, [errorCard]);
                return;
            }

            const output = data.run.output || '*(No output)*';
            
            // Format output safely (max 4096 chars for embed descriptions)
            let formattedOutput = output;
            if (formattedOutput.length > 3900) {
                formattedOutput = formattedOutput.slice(0, 3900) + '\n... (Output truncated)';
            }

            const resultCard = new FadeContainer(data.run.code === 0 ? Colours.SUCCESS : Colours.DANGER)
                .text(`**Discord IDE • ${data.language} (${data.version})**\n\`\`\`\n${formattedOutput}\n\`\`\``)
                .build();

            await sendMessage(message, [resultCard]);
            
        } catch (error: any) {
            console.error('RunCode Error:', error);
            const failCard = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} Failed to contact execution server. Please try again later.`)
                .build();
            await sendMessage(message, [failCard]);
        }
    },
} as Command;
