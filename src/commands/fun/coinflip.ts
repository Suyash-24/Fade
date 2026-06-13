// src/commands/fun/coinflip.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendResponse, sendMessage, FadeContainer } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Flip a coin')
        .addStringOption(o => o
            .setName('guess')
            .setDescription('Your guess: heads or tails')
            .addChoices(
                { name: 'Heads', value: 'heads' },
                { name: 'Tails', value: 'tails' },
            )
        ),

    category: 'fun',
    cooldown: 3,

    async execute(interaction) {
        const guess  = interaction.options.getString('guess');
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const coin   = result === 'heads' ? '🪙 Heads' : '🌑 Tails';

        let text = `${coin}`;
        if (guess) {
            const won = guess === result;
            text += `\n-# You guessed **${guess}** — ${won ? `${e('success')} Correct!` : `${e('error')} Wrong!`}`;
        }

        const card = new FadeContainer(guess ? (guess === result ? Colours.SUCCESS : Colours.DANGER) : Colours.FADE)
            .text(text)
            .build();
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args) {
        const guess  = args[0]?.toLowerCase();
        const valid  = guess === 'heads' || guess === 'tails' ? guess : null;
        const result = Math.random() < 0.5 ? 'heads' : 'tails';
        const coin   = result === 'heads' ? '🪙 Heads' : '🌑 Tails';

        let text = `${coin}`;
        if (valid) {
            const won = valid === result;
            text += `\n-# You guessed **${valid}** — ${won ? `${e('success')} Correct!` : `${e('error')} Wrong!`}`;
        }

        const card = new FadeContainer(valid ? (valid === result ? Colours.SUCCESS : Colours.DANGER) : Colours.NONE)
            .text(text)
            .build();
        await sendMessage(message, [card]);
    },

    aliases: ['cf', 'flip'],
} satisfies Command;
