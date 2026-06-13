// src/commands/economy/withdraw.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { withdraw, getWallet, getEconomyConfig } from '../../db/queries/economy.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('withdraw')
        .setDescription('Withdraw coins from your bank'),

    category: 'economy',
    guildOnly: true,
    aliases:   ['with', 'withdraw', 'wd'],
    cooldown:  5,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!with <amount|all>` to withdraw.', flags: 64 });
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
                .text(`${e('error')}  **Usage:** \`f!with <amount|all>\``)
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

        if (wallet.bank === 0) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('warn')}  Your bank is empty — nothing to withdraw.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const { withdrawn, wallet: updated } = await withdraw(message.guild!.id, message.author.id, amount);

        if (withdrawn === 0) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('warn')}  Nothing was withdrawn.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## 💸 Withdrawn`)
            .separator(true)
            .text(
                `${cur}  **Withdrawn** — \`${withdrawn.toLocaleString()}\` ${name}\n` +
                `💰  **Wallet** — \`${updated.balance.toLocaleString()}\` ${name}\n` +
                `🏦  **Bank** — \`${updated.bank.toLocaleString()}\` ${name}`
            )
            .separator(false)
            .text(`-# Wallet coins can be robbed — deposit to stay safe`)
            .build();

        await sendMessage(message, [card]);
    },
} satisfies Command;
