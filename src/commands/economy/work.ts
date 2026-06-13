// src/commands/economy/work.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { claimWork, getEconomyConfig, formatCooldown } from '../../db/queries/economy.js';
import { e, Colours } from '../../components/emojis.js';

// Pool of work flavour messages — {amount} and {cur} are replaced at runtime
const WORK_MESSAGES = [
    `You ground through a mountain of tickets as a **Customer Support Agent**`,
    `You shipped a flawless feature as a **Senior Software Engineer**`,
    `You cooked an insane service as a **Head Chef**`,
    `You drove the overnight shift as a **Delivery Driver**`,
    `You closed a massive deal as a **Sales Executive**`,
    `You fixed a production outage as a **DevOps Engineer**`,
    `You designed a viral campaign as a **Creative Director**`,
    `You diagnosed a tricky bug as a **QA Engineer**`,
    `You hauled cargo across the city as a **Truck Driver**`,
    `You pulled an all-nighter as a **Freelance Developer**`,
    `You arbitraged the markets as a **Day Trader**`,
    `You treated patients all day as a **Nurse Practitioner**`,
    `You tutored five students as a **Private Tutor**`,
    `You live-streamed your gameplay as a **Content Creator**`,
    `You edited a banger clip as a **Video Editor**`,
    `You surveyed the lands as a **Real Estate Agent**`,
    `You secured the perimeter as a **Security Guard**`,
    `You mixed a fire track as a **Music Producer**`,
    `You managed the warehouse as a **Logistics Coordinator**`,
    `You completed a bounty hunt as a **Freelance Mercenary**`,
];

export default {
    data: new SlashCommandBuilder()
        .setName('work')
        .setDescription('Work for coins'),

    category: 'economy',
    guildOnly: true,
    aliases:   ['work'],
    cooldown:  3,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!work` to earn coins.', flags: 64 });
    },

    async prefixExecute(message) {
        const config = await getEconomyConfig(message.guild!.id);
        if (!config.enabled) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('warn')}  Economy is disabled in this server.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const result = await claimWork(message.guild!.id, message.author.id, config);
        const cur    = config.currencyEmoji;
        const name   = config.currencyName;

        if ('cooldown' in result) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`## ⏳ Still On Shift`)
                .separator(true)
                .text(`You're still recovering. Come back in **${formatCooldown(result.msRemaining)}**.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const job = WORK_MESSAGES[Math.floor(Math.random() * WORK_MESSAGES.length)];

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## 💼 Work Complete`)
            .separator(true)
            .text(
                `${job}.\n\n` +
                `${cur}  **Earned** — \`+${result.amount.toLocaleString()}\` ${name}\n` +
                `💰  **Wallet** — \`${result.wallet.balance.toLocaleString()}\` ${name}`
            )
            .separator(false)
            .text(`-# Next shift available in **1h**`)
            .build();

        await sendMessage(message, [card]);
    },
} satisfies Command;
