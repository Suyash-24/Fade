// src/commands/economy/deposit.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { deposit, getWallet, getEconomyConfig } from '../../db/queries/economy.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('deposit')
        .setDescription('Deposit coins into your bank'),

    category: 'economy',
    guildOnly: true,
    aliases:   ['dep', 'deposit'],
    cooldown:  5,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!dep <amount|all>` to deposit.', flags: 64 });
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
                .text(`${e('error')}  **Usage:** \`f!dep <amount|all>\``)
                .build();
            await sendMessage(message, [card]); return;
        }

        const wallet = await getWallet(message.guild!.id, message.author.id);
        const isAll  = args[0].toLowerCase() === 'all';
        const amount = isAll ? Infinity : parseInt(args[0].replace(/,/g, ''), 10);

        if (!isAll && (isNaN(amount) || amount <= 0)) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  Provide a valid amount or \`all\`.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        if (wallet.balance === 0) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('warn')}  Your wallet is empty — nothing to deposit.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const { deposited, wallet: updated } = await deposit(message.guild!.id, message.author.id, amount);

        if (deposited === 0) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('warn')}  Nothing was deposited.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## 🏦 Deposited`)
            .separator(true)
            .text(
                `${cur}  **Deposited** — \`${deposited.toLocaleString()}\` ${name}\n` +
                `💰  **Wallet** — \`${updated.balance.toLocaleString()}\` ${name}\n` +
                `🏦  **Bank** — \`${updated.bank.toLocaleString()}\` ${name}`
            )
            .separator(false)
            .text(`-# Bank balance is safe from robbery`)
            .build();

        await sendMessage(message, [card]);
    },
} satisfies Command;
