// src/commands/economy/slots.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import {
    playSlots,
    getEconomyConfig,
    formatCooldown,
    parseBetAmount,
    SLOT_SYMBOLS,
} from '../../db/queries/economy.js';
import { e, Colours } from '../../components/emojis.js';

function buildReelDisplay(reels: [string, string, string]): string {
    return `┌─────────────┐\n│  ${reels[0]}  ${reels[1]}  ${reels[2]}  │\n└─────────────┘`;
}

function payoutDescription(multiplier: number): string {
    if (multiplier === 0)   return '❌ No match — better luck next time';
    if (multiplier === 1.5) return '✨ Two of a kind!';
    if (multiplier === 3)   return '🎉 Three of a kind!';
    if (multiplier === 5)   return '🔔 Triple bells!';
    if (multiplier === 7)   return '💎 Triple diamonds!';
    if (multiplier === 10)  return '7️⃣ JACKPOT! Triple 7s!';
    return '✅ Win!';
}

export default {
    data: new SlashCommandBuilder()
        .setName('slots')
        .setDescription('Spin the slot machine'),

    category: 'economy',
    guildOnly: true,
    aliases:   ['slots', 'slot', 'spin'],
    cooldown:  3,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!slots <amount|all|half>` to spin.', flags: 64 });
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
                .text(
                    `${e('error')}  **Usage:** \`f!slots <amount|all|half>\`\n\n` +
                    `**Payout table:**\n` +
                    `7️⃣ 7️⃣ 7️⃣ → **10×** jackpot\n` +
                    `💎 💎 💎 → **7×**\n` +
                    `🔔 🔔 🔔 → **5×**\n` +
                    `Any 3 matching → **3×**\n` +
                    `Any 2 matching → **1.5×**\n` +
                    `No match → loss`
                )
                .build();
            await sendMessage(message, [card]); return;
        }

        const { getWallet } = await import('../../db/queries/economy.js');
        const wallet = await getWallet(message.guild!.id, message.author.id);
        const bet    = parseBetAmount(args[0], wallet.balance);

        if (bet === null || bet < 1) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  Provide a valid bet. You can use \`all\` or \`half\`.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const result = await playSlots(message.guild!.id, message.author.id, bet, config);

        if ('cooldown' in result) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`## ⏳ Slot Machine Cooling Down`)
                .separator(true)
                .text(`Come back in **${formatCooldown(result.msRemaining)}** for your next spin.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        if ('error' in result) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  ${result.error}`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const { reels, multiplier, payout, wallet: updated } = result;
        const won        = multiplier > 0;
        const net        = payout - bet;
        const reelString = buildReelDisplay(reels);
        const desc       = payoutDescription(multiplier);
        const colour     = multiplier >= 5 ? Colours.INFO : won ? Colours.SUCCESS : Colours.DANGER;

        const card = new FadeContainer(colour)
            .text(`## 🎰 Slot Machine`)
            .separator(true)
            .text(`\`\`\`\n${reelString}\n\`\`\``)
            .text(
                `${desc}\n\n` +
                `${cur}  **Bet** — \`${bet.toLocaleString()}\` ${name}\n` +
                (won
                    ? `✅  **Payout** — \`+${payout.toLocaleString()}\` ${name} (**${multiplier}×**)\n`
                    : `❌  **Lost** — \`-${bet.toLocaleString()}\` ${name}\n`
                ) +
                `💰  **Wallet** — \`${updated.balance.toLocaleString()}\` ${name}`
            )
            .separator(false)
            .text(`-# Next spin in **15m**`)
            .build();

        await sendMessage(message, [card]);
    },
} satisfies Command;
