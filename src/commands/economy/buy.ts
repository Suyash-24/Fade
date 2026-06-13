// src/commands/economy/buy.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { purchaseItem, getShopItems, getEconomyConfig } from '../../db/queries/economy.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('buy')
        .setDescription('Buy an item from the shop'),

    category: 'economy',
    guildOnly: true,
    aliases:   ['buy', 'purchase'],
    cooldown:  5,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!buy <id>` to purchase an item.', flags: 64 });
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
                .text(`${e('error')}  **Usage:** \`f!buy <item id>\`\n-# Use \`f!shop\` to see available items`)
                .build();
            await sendMessage(message, [card]); return;
        }

        // Support buying by numeric ID (position in f!shop list) or by item DB id
        const input = args[0];
        let itemId: number | null = null;

        // If numeric, first try as position in shop list
        const n = parseInt(input, 10);
        if (!isNaN(n) && n > 0) {
            const items = await getShopItems(message.guild!.id);
            const byPos = items[n - 1]; // 1-indexed from f!shop display
            if (byPos) itemId = byPos.id;
        }

        // If not found by position, fallback to raw ID
        if (itemId === null && !isNaN(n)) {
            itemId = n;
        }

        if (itemId === null) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  Provide the item number from \`f!shop\`.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const result = await purchaseItem(message.guild!.id, message.author.id, itemId, config);

        if ('error' in result) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  ${result.error}`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const { item, wallet } = result;

        // Auto-assign role if type = role
        let roleNote = '';
        if (item.type === 'role' && item.roleId) {
            try {
                const member = await message.guild!.members.fetch(message.author.id);
                await member.roles.add(item.roleId, `Economy shop purchase: ${item.name}`);
                roleNote = `\n🎭  **Role assigned:** <@&${item.roleId}>`;
            } catch {
                roleNote = `\n${e('warn')}  Couldn't assign role — make sure I have Manage Roles permission.`;
            }
        }

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## 🛒 Purchase Successful!`)
            .separator(true)
            .text(
                `✅  **Item** — ${item.name}\n` +
                `${cur}  **Paid** — \`${item.price.toLocaleString()}\` ${name}` +
                roleNote +
                `\n💰  **Remaining** — \`${wallet.balance.toLocaleString()}\` ${name}`
            )
            .separator(false)
            .text(`-# View your collection with \`f!inv\``)
            .build();

        await sendMessage(message, [card]);
    },
} satisfies Command;
