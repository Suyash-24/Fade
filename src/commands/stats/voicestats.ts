// src/commands/stats/voicestats.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage, thumb } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getUserVoiceSeconds, getUserVoiceRank, getServerTotals, type Timeframe } from '../../db/queries/stats.js';

const TIMEFRAME_LABELS: Record<Timeframe, string> = {
    today: 'Today',
    daily: 'Today',
    weekly: 'Last 7 Days',
    monthly: 'Last 30 Days',
    alltime: 'All Time',
};

function formatDuration(seconds: number): string {
    if (seconds === 0) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

function buildCard(
    user: { username: string; displayAvatarURL: (opts?: any) => string; id: string },
    allStats: { seconds: number, rank: number, total: number },
    weeklyStats: { seconds: number, rank: number, total: number },
    todayStats: { seconds: number, rank: number, total: number },
    guildName: string,
) {
    const calcPct = (m: number, t: number) => t > 0 ? ((m / t) * 100).toFixed(1) : '0.0';

    const card = new FadeContainer(0x2b2d31)
        .section([
            `## ${e('stats')} Voice Stats`,
            `-# ${user.username}`,
        ])
        .separator(true)
        .section([
            `**All Time**`,
            `${e('pinkarrow')} **Voice Time** — \`${formatDuration(allStats.seconds)}\``,
            `${e('pinkarrow')} **Server Rank** — \`#${allStats.rank || '—'}\``,
            `${e('pinkarrow')} **Server Share** — \`${calcPct(allStats.seconds, allStats.total)}%\``,
        ], thumb(user.displayAvatarURL({ size: 128 })))
        .text([
            `\u200b`,
            `**This Week**`,
            `${e('pinkarrow')} **Voice Time** — \`${formatDuration(weeklyStats.seconds)}\``,
            `${e('pinkarrow')} **Server Rank** — \`#${weeklyStats.rank || '—'}\``,
            `${e('pinkarrow')} **Server Share** — \`${calcPct(weeklyStats.seconds, weeklyStats.total)}%\``,
            `\u200b`,
            `**Today**`,
            `${e('pinkarrow')} **Voice Time** — \`${formatDuration(todayStats.seconds)}\``,
            `${e('pinkarrow')} **Server Rank** — \`#${todayStats.rank || '—'}\``,
            `${e('pinkarrow')} **Server Share** — \`${calcPct(todayStats.seconds, todayStats.total)}%\``,
        ].join('\n'))
        .separator(true)
        .text(`-# ${e('server')} ${guildName}`);

    return card.build();
}

export default {
    data: new SlashCommandBuilder()
        .setName('voicestats')
        .setDescription('Check voice activity for yourself or another user')
        .addUserOption(o => o
            .setName('user')
            .setDescription('User to check (defaults to you)')
            .setRequired(false)
        ),

    category: 'stats',
    prefixOnly: true,
    guildOnly: true,
    aliases: ['vcstats', 'vctime'],
    cooldown: 5,

    async execute(interaction, client) {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const guild = interaction.guild!;

        const [allSec, allRank, allTot, wSec, wRank, wTot, tSec, tRank, tTot] = await Promise.all([
            getUserVoiceSeconds(guild.id, target.id, 'alltime'),
            getUserVoiceRank(guild.id, target.id, 'alltime'),
            getServerTotals(guild.id, 'alltime'),
            getUserVoiceSeconds(guild.id, target.id, 'weekly'),
            getUserVoiceRank(guild.id, target.id, 'weekly'),
            getServerTotals(guild.id, 'weekly'),
            getUserVoiceSeconds(guild.id, target.id, 'today'),
            getUserVoiceRank(guild.id, target.id, 'today'),
            getServerTotals(guild.id, 'today'),
        ]);

        const card = buildCard(
            target,
            { seconds: allSec, rank: allRank, total: allTot.voiceSeconds },
            { seconds: wSec, rank: wRank, total: wTot.voiceSeconds },
            { seconds: tSec, rank: tRank, total: tTot.voiceSeconds },
            guild.name
        );
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const guild = message.guild!;
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        let target = targetId ? await client.users.fetch(targetId).catch(() => undefined) : undefined;
        if (!target) target = message.author;

        const [allSec, allRank, allTot, wSec, wRank, wTot, tSec, tRank, tTot] = await Promise.all([
            getUserVoiceSeconds(guild.id, target.id, 'alltime'),
            getUserVoiceRank(guild.id, target.id, 'alltime'),
            getServerTotals(guild.id, 'alltime'),
            getUserVoiceSeconds(guild.id, target.id, 'weekly'),
            getUserVoiceRank(guild.id, target.id, 'weekly'),
            getServerTotals(guild.id, 'weekly'),
            getUserVoiceSeconds(guild.id, target.id, 'today'),
            getUserVoiceRank(guild.id, target.id, 'today'),
            getServerTotals(guild.id, 'today'),
        ]);

        const card = buildCard(
            target as any,
            { seconds: allSec, rank: allRank, total: allTot.voiceSeconds },
            { seconds: wSec, rank: wRank, total: wTot.voiceSeconds },
            { seconds: tSec, rank: tRank, total: tTot.voiceSeconds },
            guild.name
        );
        await sendMessage(message, [card]);
    },
} satisfies Command;
