// src/commands/economy/transfer.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { transfer, getWallet, getEconomyConfig } from '../../db/queries/economy.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('transfer')
        .setDescription('Send coins to another user'),

    category: 'economy',
    guildOnly: true,
    aliases:   ['pay', 'transfer'],
    cooldown:  5,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!pay @user <amount>` to send coins.', flags: 64 });
    },

    async prefixExecute(message, args) {
        const config = await getEconomyConfig(message.guild!.id);
        if (!config.enabled) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('warn')}  Economy is disabled in this server.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const cur    = config.currencyEmoji;
        const name   = config.currencyName;
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const target = targetId ? await message.client.users.fetch(targetId).catch(() => null) : null;

        if (!target) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  **Usage:** \`f!pay @user <amount>\``)
                .build();
            await sendMessage(message, [card]); return;
        }

        if (target.id === message.author.id) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  You can't send coins to yourself.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        if (target.bot) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  You can't send coins to bots.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        // Amount is the second arg (after mention), or could be args[1]
        const amountStr = args.find(a => !a.startsWith('<@'));
        const amount    = parseInt((amountStr ?? '').replace(/,/g, ''), 10);

        if (isNaN(amount) || amount < 1) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  Provide a valid amount (minimum 1).`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const wallet = await getWallet(message.guild!.id, message.author.id);
        if (wallet.balance < amount) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  Insufficient balance. You have \`${wallet.balance.toLocaleString()}\` in your wallet.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        try {
            const { from, to } = await transfer(message.guild!.id, message.author.id, target.id, amount);
            const targetMember = message.guild?.members.cache.get(target.id);
            const targetName   = targetMember?.displayName ?? target.username;

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`## 💸 Transfer Complete`)
                .separator(true)
                .text(
                    `${cur}  **Sent** — \`${amount.toLocaleString()}\` ${name} → **${targetName}**\n` +
                    `💰  **Your Wallet** — \`${from.balance.toLocaleString()}\` ${name}`
                )
                .build();

            await sendMessage(message, [card]);
        } catch {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  Transfer failed — insufficient balance.`)
                .build();
            await sendMessage(message, [card]);
        }
    },
} satisfies Command;
