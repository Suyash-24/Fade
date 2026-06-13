// src/commands/economy/inventory.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { getInventory, getEconomyConfig } from '../../db/queries/economy.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('inventory')
        .setDescription('View your purchased items'),

    category: 'economy',
    guildOnly: true,
    aliases:   ['inv', 'inventory', 'items'],
    cooldown:  5,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!inv` to see your items.', flags: 64 });
    },

    async prefixExecute(message) {
        const config    = await getEconomyConfig(message.guild!.id);
        const cur       = config.currencyEmoji;
        const purchases = await getInventory(message.guild!.id, message.author.id);
        const member    = message.guild?.members.cache.get(message.author.id);
        const dispName  = member?.displayName ?? message.author.username;

        if (!purchases.length) {
            const card = new FadeContainer(Colours.FADE)
                .text(`## 🎒 ${dispName}'s Inventory`)
                .separator(true)
                .text(`Your inventory is empty.\n-# Visit \`f!shop\` to see what's available`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const lines = purchases.map((p) => {
            const typeTag = p.item.type === 'role' && p.item.roleId
                ? ` — <@&${p.item.roleId}>`
                : '';
            const qty = p.quantity > 1 ? ` ×${p.quantity}` : '';
            return `• **${p.item.name}**${qty}${typeTag}\n-# Purchased for \`${p.item.price.toLocaleString()} ${cur}\``;
        });

        const card = new FadeContainer(Colours.FADE)
            .text(`## 🎒 ${dispName}'s Inventory`)
            .separator(true)
            .text(lines.join('\n\n'))
            .separator(false)
            .text(`-# ${purchases.length} item${purchases.length !== 1 ? 's' : ''} owned`)
            .build();

        await sendMessage(message, [card]);
    },
} satisfies Command;
