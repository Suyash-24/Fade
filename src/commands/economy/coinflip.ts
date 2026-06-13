// src/commands/economy/coinflip.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { coinflipEconomy, getEconomyConfig, parseBetAmount } from '../../db/queries/economy.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('coinflip')
        .setDescription('Bet on a coin flip'),

    category: 'economy',
    guildOnly: true,
    // NOTE: 'cf' and 'flip' are used by the existing fun/coinflip.ts.
    // Economy coinflip uses 'ecf' and 'eflip' to avoid conflict.
    aliases:   ['ecf', 'eflip', 'ecoinflip'],
    cooldown:  3,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!ecf <heads|tails> <amount>` to bet on a flip.', flags: 64 });
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

        // Usage: f!ecf heads 500   OR   f!ecf tails all
        const guessArg  = args[0]?.toLowerCase();
        const amountArg = args[1];

        if (!guessArg || (guessArg !== 'heads' && guessArg !== 'tails') || !amountArg) {
            const card = new FadeContainer(Colours.DANGER)
                .text(
                    `${e('error')}  **Usage:** \`f!ecf <heads|tails> <amount|all|half>\`\n` +
                    `-# Example: \`f!ecf heads 500\``
                )
                .build();
            await sendMessage(message, [card]); return;
        }

        const { getWallet } = await import('../../db/queries/economy.js');
        const wallet = await getWallet(message.guild!.id, message.author.id);
        const bet    = parseBetAmount(amountArg, wallet.balance);

        if (bet === null || bet < 1) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  Provide a valid bet. You can use \`all\` or \`half\`.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const result = await coinflipEconomy(
            message.guild!.id,
            message.author.id,
            bet,
            guessArg as 'heads' | 'tails',
            config,
        );

        if ('error' in result) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  ${result.error}`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const { won, result: flip, payout, wallet: updated } = result;
        const coinDisplay = flip === 'heads' ? '🪙 **Heads**' : '🌑 **Tails**';

        const card = new FadeContainer(won ? Colours.SUCCESS : Colours.DANGER)
            .text(`## 🪙 Coin Flip`)
            .separator(true)
            .text(
                `${coinDisplay}\n\n` +
                `You guessed **${guessArg}** — ${won ? `${e('success')} **Correct!**` : `${e('error')} **Wrong!**`}\n\n` +
                `${cur}  **Bet** — \`${payout.toLocaleString()}\` ${name}\n` +
                `${won ? '✅' : '❌'}  **Result** — \`${won ? '+' : '-'}${payout.toLocaleString()}\` ${name}\n` +
                `💰  **Wallet** — \`${updated.balance.toLocaleString()}\` ${name}`
            )
            .build();

        await sendMessage(message, [card]);
    },
} satisfies Command;
