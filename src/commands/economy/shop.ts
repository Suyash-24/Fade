// src/commands/economy/shop.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { getShopItems, getWallet, getEconomyConfig } from '../../db/queries/economy.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('shop')
        .setDescription('Browse the server shop'),

    category: 'economy',
    guildOnly: true,
    aliases:   ['shop', 'store'],
    cooldown:  5,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!shop` to browse items.', flags: 64 });
    },

    async prefixExecute(message) {
        const config = await getEconomyConfig(message.guild!.id);
        if (!config.enabled) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('warn')}  Economy is disabled in this server.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const cur    = config.currencyEmoji;
        const name   = config.currencyName;
        const items  = await getShopItems(message.guild!.id);
        const wallet = await getWallet(message.guild!.id, message.author.id);

        if (!items.length) {
            const card = new FadeContainer(Colours.FADE)
                .text(`## 🛒 Server Shop`)
                .separator(true)
                .text(`The shop is empty right now.\n-# Admins can add items with \`f!economy additem\``)
                .build();
            await sendMessage(message, [card]); return;
        }

        const lines = items.map((item, i) => {
            const canAfford = wallet.balance >= item.price ? '' : ' *(can\'t afford)*';
            const stock     = item.stock === -1 ? '∞ stock' : `${item.stock} left`;
            const type      = item.type === 'role' ? ` 🎭 Role reward` : '';
            const desc      = item.description ? `\n-# ${item.description}` : '';
            return (
                `**${i + 1}. ${item.name}**${type} — \`${item.price.toLocaleString()} ${cur}\`${canAfford}\n` +
                `-# ${stock}${desc}`
            );
        });

        const card = new FadeContainer(Colours.FADE)
            .text(`## 🛒 Server Shop`)
            .text(`-# Your wallet: \`${wallet.balance.toLocaleString()} ${cur}\` · Use \`f!buy <id>\` to purchase`)
            .separator(true)
            .text(lines.join('\n\n'))
            .build();

        await sendMessage(message, [card]);
    },
} satisfies Command;
