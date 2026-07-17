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
    voiceSeconds: number,
    rank: number,
    serverTotal: number,
    timeframe: Timeframe,
    guildName: string,
) {
    const label = TIMEFRAME_LABELS[timeframe];
    const pct = serverTotal > 0 ? ((voiceSeconds / serverTotal) * 100).toFixed(1) : '0.0';

    const card = new FadeContainer(Colours.FADE)
        .section(
            [
                `## ${e('voice')} Voice Stats`,
                `-# ${user.username} · ${label}`,
            ],
            thumb(user.displayAvatarURL({ size: 128 })),
        )
        .separator(true)
        .text(
            `${e('pinkarrow')} **Time in Voice** — \`${formatDuration(voiceSeconds)}\`\n` +
            `${e('pinkarrow')} **Server Rank** — \`#${rank || '—'}\`\n` +
            `${e('pinkarrow')} **Server Share** — \`${pct}%\`\n` +
            `${e('pinkarrow')} **Server Total** — \`${formatDuration(serverTotal)}\``
        )
        .separator(true)
        .text(`-# ${e('server')} ${guildName} · ${label}`);

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
        )
        .addStringOption(o => o
            .setName('timeframe')
            .setDescription('Time period to check')
            .setRequired(false)
            .addChoices(
                { name: 'Today', value: 'today' },
                { name: 'Weekly (7d)', value: 'weekly' },
                { name: 'Monthly (30d)', value: 'monthly' },
                { name: 'All Time', value: 'alltime' },
            )
        ),

    category: 'stats',
    prefixOnly: true,
    guildOnly: true,
    aliases: ['vcstats', 'vc', 'vctime'],
    cooldown: 5,

    async execute(interaction, client) {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const timeframe = (interaction.options.getString('timeframe') ?? 'alltime') as Timeframe;
        const guild = interaction.guild!;

        const [voiceSeconds, rank, totals] = await Promise.all([
            getUserVoiceSeconds(guild.id, target.id, timeframe),
            getUserVoiceRank(guild.id, target.id, timeframe),
            getServerTotals(guild.id, timeframe),
        ]);

        const card = buildCard(target, voiceSeconds, rank, totals.voiceSeconds, timeframe, guild.name);
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const guild = message.guild!;
        const timeframe: Timeframe = (['today', 'daily', 'weekly', 'monthly', 'alltime'].includes(args[0]?.toLowerCase()) ? args.shift()!.toLowerCase() : 'alltime') as Timeframe;

        const targetId = args[0]?.replace(/[<@!>]/g, '');
        let target = targetId ? await client.users.fetch(targetId).catch(() => undefined) : undefined;
        if (!target) target = message.author;

        const [voiceSeconds, rank, totals] = await Promise.all([
            getUserVoiceSeconds(guild.id, target.id, timeframe),
            getUserVoiceRank(guild.id, target.id, timeframe),
            getServerTotals(guild.id, timeframe),
        ]);

        const card = buildCard(target as any, voiceSeconds, rank, totals.voiceSeconds, timeframe, guild.name);
        await sendMessage(message, [card]);
    },
} satisfies Command;
