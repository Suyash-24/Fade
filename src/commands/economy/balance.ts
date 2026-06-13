// src/commands/economy/balance.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { getWallet, getEconomyConfig } from '../../db/queries/economy.js';
import { e, Colours } from '../../components/emojis.js';

async function buildBalanceCard(guildId: string, targetId: string, displayName: string, avatarUrl: string | null, config: Awaited<ReturnType<typeof getEconomyConfig>>) {
    const wallet  = await getWallet(guildId, targetId);
    const net     = wallet.balance + wallet.bank;
    const cur     = config.currencyEmoji;
    const name    = config.currencyName;

    return new FadeContainer(Colours.FADE)
        .text(`## 💰 ${displayName}'s Wallet`)
        .separator(true)
        .text(
            `${cur}  **Wallet** — \`${wallet.balance.toLocaleString()}\` ${name}\n` +
            `🏦  **Bank** — \`${wallet.bank.toLocaleString()}\` ${name}\n` +
            `📈  **Net Worth** — \`${net.toLocaleString()}\` ${name}`
        )
        .separator(false)
        .text(`-# 🏅 Lifetime earned: \`${wallet.totalEarned.toLocaleString()}\` ${name}`)
        .build();
}

export default {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('View your economy wallet'),

    category: 'economy',
    guildOnly: true,
    aliases:   ['bal', 'wallet', 'money'],
    cooldown:  5,

    async execute(interaction) {
        // prefix-only — slash is a no-op stub
        await interaction.reply({ content: 'Use `f!bal` for balance.', flags: 64 });
    },

    async prefixExecute(message, args) {
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const explicitTarget = targetId ? await message.client.users.fetch(targetId).catch(() => null) : null;
        const target = explicitTarget || message.author;
        const member  = message.guild?.members.cache.get(target.id);
        const name    = member?.displayName ?? target.username;
        const avatar  = target.displayAvatarURL();
        const config  = await getEconomyConfig(message.guild!.id);

        if (!config.enabled) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('warn')}  Economy is disabled in this server.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const card = await buildBalanceCard(message.guild!.id, target.id, name, avatar, config);
        await sendMessage(message, [card]);
    },
} satisfies Command;
