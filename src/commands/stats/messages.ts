// src/commands/stats/messages.ts
import { SlashCommandBuilder, ChannelType } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage, thumb } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getUserMessages, getUserMessageRank, getServerTotals, type Timeframe } from '../../db/queries/stats.js';

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
    today: 'Today',
    daily: 'Today',
    weekly: 'Last 7 Days',
    monthly: 'Last 30 Days',
    alltime: 'All Time',
};

function buildCard(
    user: { username: string; displayAvatarURL: (opts?: any) => string; id: string },
    allStats: { msgs: number, rank: number, total: number },
    weeklyStats: { msgs: number, rank: number, total: number },
    todayStats: { msgs: number, rank: number, total: number },
    guildName: string,
) {
    const calcPct = (m: number, t: number) => t > 0 ? ((m / t) * 100).toFixed(1) : '0.0';

    const card = new FadeContainer(0x2b2d31)
        .text([
            `## ${e('stats')} Message Stats`,
            `-# ${user.username}`,
        ].join('\n'))
        .separator(true)
        .section([[
            `**All Time**`,
            `${e('pinkarrow')} **Messages Sent** — \`${allStats.msgs.toLocaleString()}\``,
            `${e('pinkarrow')} **Server Rank** — \`#${allStats.rank || '—'}\``,
            `${e('pinkarrow')} **Server Share** — \`${calcPct(allStats.msgs, allStats.total)}%\``,
        ].join('\n')], thumb(user.displayAvatarURL({ size: 128 })))
        .text([
            `\u200b`,
            `**This Week**`,
            `${e('pinkarrow')} **Messages Sent** — \`${weeklyStats.msgs.toLocaleString()}\``,
            `${e('pinkarrow')} **Server Rank** — \`#${weeklyStats.rank || '—'}\``,
            `${e('pinkarrow')} **Server Share** — \`${calcPct(weeklyStats.msgs, weeklyStats.total)}%\``,
            `\u200b`,
            `**Today**`,
            `${e('pinkarrow')} **Messages Sent** — \`${todayStats.msgs.toLocaleString()}\``,
            `${e('pinkarrow')} **Server Rank** — \`#${todayStats.rank || '—'}\``,
            `${e('pinkarrow')} **Server Share** — \`${calcPct(todayStats.msgs, todayStats.total)}%\``,
        ].join('\n'))
        .separator(true)
        .text(`-# ${e('server')} ${guildName}`);

    return card.build();
}

export default {
    data: new SlashCommandBuilder()
        .setName('messages')
        .setDescription('Check message count for yourself or another user')
        .addUserOption(o => o
            .setName('user')
            .setDescription('User to check (defaults to you)')
            .setRequired(false)
        ),

    category: 'stats',
    prefixOnly: true,
    guildOnly: true,
    aliases: ['msgs', 'msgcount'],
    cooldown: 5,

    async execute(interaction, client) {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const guild = interaction.guild!;

        const [allMsg, allRank, allTot, wMsg, wRank, wTot, tMsg, tRank, tTot] = await Promise.all([
            getUserMessages(guild.id, target.id, 'alltime'),
            getUserMessageRank(guild.id, target.id, 'alltime'),
            getServerTotals(guild.id, 'alltime'),
            getUserMessages(guild.id, target.id, 'weekly'),
            getUserMessageRank(guild.id, target.id, 'weekly'),
            getServerTotals(guild.id, 'weekly'),
            getUserMessages(guild.id, target.id, 'today'),
            getUserMessageRank(guild.id, target.id, 'today'),
            getServerTotals(guild.id, 'today'),
        ]);

        const card = buildCard(
            target,
            { msgs: allMsg, rank: allRank, total: allTot.messages },
            { msgs: wMsg, rank: wRank, total: wTot.messages },
            { msgs: tMsg, rank: tRank, total: tTot.messages },
            guild.name
        );
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const guild = message.guild!;
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        let target = targetId ? await client.users.fetch(targetId).catch(() => undefined) : undefined;
        if (!target) target = message.author;

        const [allMsg, allRank, allTot, wMsg, wRank, wTot, tMsg, tRank, tTot] = await Promise.all([
            getUserMessages(guild.id, target.id, 'alltime'),
            getUserMessageRank(guild.id, target.id, 'alltime'),
            getServerTotals(guild.id, 'alltime'),
            getUserMessages(guild.id, target.id, 'weekly'),
            getUserMessageRank(guild.id, target.id, 'weekly'),
            getServerTotals(guild.id, 'weekly'),
            getUserMessages(guild.id, target.id, 'today'),
            getUserMessageRank(guild.id, target.id, 'today'),
            getServerTotals(guild.id, 'today'),
        ]);

        const card = buildCard(
            target as any,
            { msgs: allMsg, rank: allRank, total: allTot.messages },
            { msgs: wMsg, rank: wRank, total: wTot.messages },
            { msgs: tMsg, rank: tRank, total: tTot.messages },
            guild.name
        );
        await sendMessage(message, [card]);
    },
} satisfies Command;
