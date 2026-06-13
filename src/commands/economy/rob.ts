// src/commands/economy/rob.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { attemptRob, getEconomyConfig, formatCooldown } from '../../db/queries/economy.js';
import { e, Colours } from '../../components/emojis.js';

const ROB_SUCCESS_LINES = [
    `You slipped into the shadows and took what wasn't yours.`,
    `While they weren't looking, your hand was quicker than their eyes.`,
    `The streets talk — tonight, they'll talk about you.`,
    `Clean getaway. No witnesses. Smooth.`,
    `Your lock-picking skills paid off handsomely.`,
];

const ROB_FAIL_LINES = [
    `You got caught red-handed and fined on the spot.`,
    `Their security system was better than you expected.`,
    `You tripped the alarm — bad night to be greedy.`,
    `Not your finest work. The target fought back.`,
    `Caught. Fined. Walk of shame.`,
];

export default {
    data: new SlashCommandBuilder()
        .setName('rob')
        .setDescription('Attempt to rob another user'),

    category: 'economy',
    guildOnly: true,
    aliases:   ['rob', 'steal'],
    cooldown:  3,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!rob @user` to attempt a robbery.', flags: 64 });
    },

    async prefixExecute(message, args) {
        const config = await getEconomyConfig(message.guild!.id);
        if (!config.enabled) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('warn')}  Economy is disabled in this server.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        if (!config.robEnabled) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('warn')}  Rob is disabled in this server.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const cur    = config.currencyEmoji;
        const name   = config.currencyName;
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const target = targetId ? await message.client.users.fetch(targetId).catch(() => null) : null;

        if (!target) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  **Usage:** \`f!rob @user\``)
                .build();
            await sendMessage(message, [card]); return;
        }

        if (target.id === message.author.id) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  You can't rob yourself.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        if (target.bot) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  Bots don't carry cash.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const result = await attemptRob(
            message.guild!.id,
            message.author.id,
            target.id,
            config,
        );

        if ('cooldown' in result) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`## ⏳ Laying Low`)
                .separator(true)
                .text(`You need to stay off the radar for **${formatCooldown(result.msRemaining)}** before your next job.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        if ('error' in result) {
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('warn')}  ${result.error}`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const targetMember = message.guild?.members.cache.get(target.id);
        const targetName   = targetMember?.displayName ?? target.username;

        if (result.success) {
            const flavour = ROB_SUCCESS_LINES[Math.floor(Math.random() * ROB_SUCCESS_LINES.length)];
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`## 🦹 Successful Robbery`)
                .separator(true)
                .text(
                    `*${flavour}*\n\n` +
                    `${cur}  **Stolen from ${targetName}** — \`+${result.stolen!.toLocaleString()}\` ${name}\n` +
                    `💰  **Your Wallet** — \`${result.robberWallet.balance.toLocaleString()}\` ${name}`
                )
                .separator(false)
                .text(`-# Next rob available in **4h**`)
                .build();
            await sendMessage(message, [card]); return;
        } else {
            const flavour = ROB_FAIL_LINES[Math.floor(Math.random() * ROB_FAIL_LINES.length)];
            const card = new FadeContainer(Colours.DANGER)
                .text(`## 🚔 Caught!`)
                .separator(true)
                .text(
                    `*${flavour}*\n\n` +
                    `${cur}  **Fine paid** — \`-${result.penalty!.toLocaleString()}\` ${name}\n` +
                    `💰  **Your Wallet** — \`${result.robberWallet.balance.toLocaleString()}\` ${name}`
                )
                .separator(false)
                .text(`-# Next attempt in **4h** — maybe prep better next time`)
                .build();
            await sendMessage(message, [card]); return;
        }
    },
} satisfies Command;
