// src/commands/economy/leaderboard.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { getEconomyLeaderboard, getEconomyConfig } from '../../db/queries/economy.js';
import { e, Colours } from '../../components/emojis.js';

const MEDALS = ['🥇', '🥈', '🥉'];

export default {
    data: new SlashCommandBuilder()
        .setName('economyleaderboard')
        .setDescription('View the richest users in the server'),

    category: 'economy',
    guildOnly: true,
    aliases:   ['elb', 'richlist', 'rich'],
    cooldown:  10,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!lb` to see the economy leaderboard.', flags: 64 });
    },

    async prefixExecute(message) {
        const config  = await getEconomyConfig(message.guild!.id);
        const cur     = config.currencyEmoji;
        const name    = config.currencyName;
        const entries = await getEconomyLeaderboard(message.guild!.id, 10);

        if (!entries.length) {
            const card = new FadeContainer(Colours.FADE)
                .text(`${e('stats')}  No economy data yet — use \`f!daily\` to get started!`)
                .build();
            await sendMessage(message, [card]); return;
        }

        // Resolve member names in one pass from cache
        const guild = message.guild!;
        const lines: string[] = [];
        let userRank: number | null = null;

        for (let i = 0; i < entries.length; i++) {
            const row    = entries[i];
            const net    = row.balance + row.bank;
            const pos    = i + 1;
            const medal  = MEDALS[i] ?? `\`#${pos}\``;
            const member = guild.members.cache.get(row.userId);
            const name2  = member?.displayName ?? `<@${row.userId}>`;
            const you    = row.userId === message.author.id ? ' **← you**' : '';
            if (row.userId === message.author.id) userRank = pos;
            lines.push(`${medal}  ${name2} — \`${net.toLocaleString()}\` ${cur}${you}`);
        }

        // If the user is not in top 10, fetch their rank
        let footerNote = `${guild.name} · Top ${entries.length}`;
        if (userRank !== null) {
            footerNote += ` · You're #${userRank}`;
        }

        const card = new FadeContainer(Colours.FADE)
            .text(`## ${e('trophy')} ${name.charAt(0).toUpperCase() + name.slice(1)} Leaderboard`)
            .separator(true)
            .text(lines.join('\n'))
            .separator(false)
            .text(`-# ${footerNote}`)
            .build();

        await sendMessage(message, [card]);
    },
} satisfies Command;
