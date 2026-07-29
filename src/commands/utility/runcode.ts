// src/commands/utility/runcode.ts
import type { Command } from '../../types/command.js';
import type { Message } from 'discord.js';
import { sendMessage, FadeContainer } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const tio = require('tio.js').default || require('tio.js');

// Map common aliases to TIO language IDs
const ALIASES: Record<string, string> = {
    'python': 'python3',
    'python3': 'python3',
    'py': 'python3',
    'javascript': 'javascript-node',
    'js': 'javascript-node',
    'node': 'javascript-node',
    'typescript': 'typescript',
    'ts': 'typescript',
    'c': 'c-gcc',
    'c++': 'cpp-gcc',
    'cpp': 'cpp-gcc',
    'java': 'java-openjdk',
    'go': 'go',
    'rust': 'rust',
    'rs': 'rust',
    'ruby': 'ruby',
    'rb': 'ruby',
    'php': 'php',
    'bash': 'bash',
    'sh': 'bash',
    'swift': 'swift4',
    'c#': 'cs-core',
    'csharp': 'cs-core',
    'cs': 'cs-core',
};

export default {
    data: {
        name: 'runcode',
        description: 'Run code natively in Discord'
    },
    category: 'utility',
    prefixOnly: true,
    cooldown: 5,

    async prefixExecute(message: Message, args: string[]) {
        if (args.length < 2) {
            const usageCard = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} **Usage:**\n\`!runcode <language>\`\n\`\`\`<your code here>\n\`\`\``)
                .build();
            await sendMessage(message, [usageCard]);
            return;
        }

        const rawLanguage = args[0].toLowerCase();
        
        // args.slice(1).join(' ') destroys newlines. Extract directly from raw message content.
        const matchFull = message.content.match(/^\S+\s+\S+\s+([\s\S]+)$/);
        let code = matchFull ? matchFull[1].trim() : '';

        // Parse code blocks if the user used them (e.g., ```python ... ```)
        const codeBlockRegex = /^```(?:[a-z0-9+#]*\n)?([\s\S]*?)```$/i;
        const match = code.match(codeBlockRegex);
        if (match) {
            code = match[1].trim();
        }

        if (!code) {
            const usageCard = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} You must provide code to execute!`)
                .build();
            await sendMessage(message, [usageCard]);
            return;
        }

        const language = ALIASES[rawLanguage] || rawLanguage;

        // Show native typing indicator to bypass the V2 components edit bug
        if ('sendTyping' in message.channel) {
            await message.channel.sendTyping().catch(() => null);
        }

        try {
            // TIO takes the code and the exact language ID
            const res = await tio(code, { language: language as any });

            // If the API somehow errors or language doesn't exist, TIO doesn't throw but returns an error string or empty.
            // Wait, actually TIO doesn't validate language locally, it throws internally or returns weird output.
            // But we will catch whatever it outputs.
            
            let formattedOutput = res.output || "No output returned.";
            if (res.timedOut) {
                formattedOutput += "\n\n[Execution Timed Out]";
            }

            // Truncate if it exceeds Discord's limit
            if (formattedOutput.length > 3000) {
                formattedOutput = formattedOutput.slice(0, 3000) + '\n... (truncated)';
            }

            const isError = res.exitCode !== 0;

            const resultCard = new FadeContainer(isError ? Colours.DANGER : Colours.SUCCESS)
                .text(`**Discord IDE • ${language}**\n\`\`\`\n${formattedOutput}\n\`\`\``)
                .build();

            await sendMessage(message, [resultCard]);
            
        } catch (error: any) {
            console.error('RunCode Error:', error);
            
            // Usually occurs when TIO returns an unexpected response string for syntax errors or unknown languages
            const failCard = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} **Execution failed**\n\nThe code contains syntax errors or the selected language (\`${language}\`) is unsupported.`)
                .build();
            await sendMessage(message, [failCard]);
        }
    },
} as Command;
