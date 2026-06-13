// src/commands/moderation/enlarge.ts
// Sends a custom emoji as a full-size image
import { Message } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import type { FadeClient } from '../../client.js';

const CUSTOM_EMOJI_REGEX = /<(a?):(\w+):(\d+)>/;

export default {
    data: { name: 'enlarge', description: 'Enlarge a custom emoji to full size.' },
    prefixOnly: true,
    aliases: ['bigemoji', 'e'],
    category: 'utility',
    cooldown: 3,

    async prefixExecute(message: Message, args: string[], _client: FadeClient) {
        const input = args.join(' ');
        const match = CUSTOM_EMOJI_REGEX.exec(input);

        if (!match) {
            await message.reply(`${e('error')} Please provide a custom emoji. (Unicode emojis can't be enlarged.)`);
            return;
        }

        const [, animated, name, id] = match;
        const ext = animated ? 'gif' : 'png';
        const url = `https://cdn.discordapp.com/emojis/${id}.${ext}?size=4096`;

        const card = new FadeContainer()
            .text(`## :${name}:\n[Open full size](${url})`)
            .build();

        await message.reply({
            files: [{ attachment: url, name: `${name}.${ext}` }],
        });
    },
} satisfies Command;
