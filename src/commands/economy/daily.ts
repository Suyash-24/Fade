// src/commands/economy/daily.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { claimDaily, getEconomyConfig, formatCooldown } from '../../db/queries/economy.js';
import { e, Colours } from '../../components/emojis.js';

const STREAK_FLAMES = (streak: number) => {
    if (streak >= 30) return '🔥🔥🔥';
    if (streak >= 14) return '🔥🔥';
    if (streak >= 7)  return '🔥';
    return '✨';
};

export default {
    data: new SlashCommandBuilder()
        .setName('daily')
        .setDescription('Claim your daily coins'),

    category: 'economy',
    guildOnly: true,
    aliases:   ['daily'],
    cooldown:  3,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!daily` to claim your daily reward.', flags: 64 });
    },

    async prefixExecute(message) {
        const config = await getEconomyConfig(message.guild!.id);
        if (!config.enabled) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('warn')}  Economy is disabled in this server.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const result = await claimDaily(message.guild!.id, message.author.id, config);
        const cur    = config.currencyEmoji;
        const name   = config.currencyName;

        if ('cooldown' in result) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`## ⏳ Daily Already Claimed`)
                .separator(true)
                .text(`Come back in **${formatCooldown(result.msRemaining)}** for your next daily!\n-# Your streak is safe — don't miss tomorrow.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const flames = STREAK_FLAMES(result.streak);
        const streakLine = config.streakBonus
            ? `\n${flames}  **Streak** — Day \`${result.streak}\` ${result.streak >= 7 ? `(**bonus multiplier active!**)` : ''}`
            : '';

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## ${cur} Daily Reward Claimed!`)
            .separator(true)
            .text(
                `${cur}  **Earned** — \`+${result.amount.toLocaleString()}\` ${name}` +
                streakLine +
                `\n💰  **New Wallet** — \`${result.wallet.balance.toLocaleString()}\` ${name}`
            )
            .separator(false)
            .text(`-# Next daily in **24h**${result.streak < 30 ? ` · Day ${result.streak + 1} bonus: \`${config.dailyAmount * Math.min(result.streak + 1, 30)} ${name}\`` : ''}`)
            .build();

        await sendMessage(message, [card]);
    },
} satisfies Command;
