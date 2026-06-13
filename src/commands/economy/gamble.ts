// src/commands/economy/gamble.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { gamble as doGamble, getEconomyConfig, formatCooldown, parseBetAmount } from '../../db/queries/economy.js';
import { e, Colours } from '../../components/emojis.js';

const WIN_LINES = [
    `The odds bent to your will tonight.`,
    `High risk, higher reward. You played it perfectly.`,
    `Fortune favours the bold — and tonight, that's you.`,
    `You read the room and walked out richer.`,
    `Clutch. Absolutely clutch.`,
];

const LOSE_LINES = [
    `The house always wins... except when it doesn't.`,
    `Rough break. Better luck next time.`,
    `The streak ends here.`,
    `You knew the risks. It didn't go your way.`,
    `Ouch. Walk it off.`,
];

export default {
    data: new SlashCommandBuilder()
        .setName('gamble')
        .setDescription('Gamble your coins (50/50)'),

    category: 'economy',
    guildOnly: true,
    aliases:   ['gamble', 'bet'],
    cooldown:  3,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!gamble <amount|all|half>` to bet.', flags: 64 });
    },

    async prefixExecute(message, args) {
        const config = await getEconomyConfig(message.guild!.id);
        if (!config.enabled) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('warn')}  Economy is disabled in this server.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const cur  = config.currencyEmoji;
        const name = config.currencyName;

        if (!args[0]) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  **Usage:** \`f!gamble <amount|all|half>\``)
                .build();
            await sendMessage(message, [card]); return;
        }

        const { getWallet } = await import('../../db/queries/economy.js');
        const wallet = await getWallet(message.guild!.id, message.author.id);
        const bet    = parseBetAmount(args[0], wallet.balance);

        if (bet === null || bet < 1) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  Provide a valid bet amount. You can also use \`all\` or \`half\`.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const result = await doGamble(message.guild!.id, message.author.id, bet, config);

        if ('cooldown' in result) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`## ⏳ Cooldown`)
                .separator(true)
                .text(`Your gambling privileges are on cooldown for **${formatCooldown(result.msRemaining)}**.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        if ('error' in result) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  ${result.error}`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const { won, amount, wallet: updated } = result;
        const flavour = won
            ? WIN_LINES[Math.floor(Math.random() * WIN_LINES.length)]
            : LOSE_LINES[Math.floor(Math.random() * LOSE_LINES.length)];

        const card = new FadeContainer(won ? Colours.SUCCESS : Colours.DANGER)
            .text(`## ${won ? '🎉' : '💸'} ${won ? 'You Won!' : 'You Lost.'}`)
            .separator(true)
            .text(
                `*${flavour}*\n\n` +
                `${cur}  **Bet** — \`${amount.toLocaleString()}\` ${name}\n` +
                `${won ? '✅' : '❌'}  **Result** — \`${won ? '+' : '-'}${amount.toLocaleString()}\` ${name}\n` +
                `💰  **Wallet** — \`${updated.balance.toLocaleString()}\` ${name}`
            )
            .separator(false)
            .text(`-# 50/50 odds · Next gamble in **30m**`)
            .build();

        await sendMessage(message, [card]);
    },
} satisfies Command;
