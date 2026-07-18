// src/commands/general/serverstats.ts
import { SlashCommandBuilder, AttachmentBuilder, ChannelType } from 'discord.js';
import type { Command } from '../../types/command.js';
import { buildServerStatsCard, type ServerStatsData } from '../../utils/canvas/serverStatsCard.js';
import { e } from '../../components/emojis.js';
import { db } from '../../db/index.js';
import { guildStats, memberStats, channelStats } from '../../db/schema.js';
import { and, eq, gte, lt, sql } from 'drizzle-orm';

type SSTimeframe = 'weekly' | 'monthly' | 'alltime';

const TIMEFRAME_DAYS: Record<SSTimeframe, number> = {
    weekly:  7,
    monthly: 30,
    alltime: 365 * 5,
};

const TIMEFRAME_LABELS: Record<SSTimeframe, string> = {
    weekly:  '7 DAYS',
    monthly: '30 DAYS',
    alltime: 'ALL TIME',
};

function fmtVoice(sec: number): number {
    return Math.round(sec / 3600);
}

function trendStr(curr: number, prev: number): string {
    if (prev === 0) return curr === 0 ? 'No data yet' : `${curr.toLocaleString()} this period`;
    const pct = Math.round(((curr - prev) / prev) * 100);
    const arrow = pct >= 0 ? '↑' : '↓';
    return `${arrow} ${Math.abs(pct)}% vs last period`;
}

async function fetchStatsData(guild: any, client: any, timeframe: SSTimeframe): Promise<ServerStatsData> {
    const days = TIMEFRAME_DAYS[timeframe];
    const now = new Date();
    const startDate = new Date(now.getTime() - days * 86400_000).toISOString().split('T')[0];
    const prevStartDate = new Date(now.getTime() - days * 2 * 86400_000).toISOString().split('T')[0];

    // ── Presence counts ───────────────────────────────────────────────────────
    const memberCount = guild.memberCount;
    const onlineCount = guild.members.cache.filter((m: any) => m.presence?.status === 'online').size;
    const dndCount    = guild.members.cache.filter((m: any) => m.presence?.status === 'dnd').size;
    const idleCount   = guild.members.cache.filter((m: any) => m.presence?.status === 'idle').size;
    const offlineCount = Math.max(0, memberCount - onlineCount - dndCount - idleCount);

    // ── Guild activity (current period) ───────────────────────────────────────
    const currentActivity = await db.select()
        .from(guildStats)
        .where(and(eq(guildStats.guildId, guild.id), gte(guildStats.date, startDate)))
        .orderBy(guildStats.date);

    // ── Guild activity (previous period for trend) ────────────────────────────
    const prevActivity = await db.select()
        .from(guildStats)
        .where(and(
            eq(guildStats.guildId, guild.id),
            gte(guildStats.date, prevStartDate),
            lt(guildStats.date, startDate),
        ))
        .orderBy(guildStats.date);

    const currentMsgs   = currentActivity.reduce((s, r) => s + (r.messages ?? 0), 0);
    const currentVoice  = currentActivity.reduce((s, r) => s + (r.voiceSeconds ?? 0), 0);
    const currentJoins  = currentActivity.reduce((s, r) => s + (r.joins ?? 0), 0);
    const prevMsgs      = prevActivity.reduce((s, r) => s + (r.messages ?? 0), 0);
    const prevVoice     = prevActivity.reduce((s, r) => s + (r.voiceSeconds ?? 0), 0);
    const prevJoins     = prevActivity.reduce((s, r) => s + (r.joins ?? 0), 0);

    // ── Chart data (7 or 30 bars) ─────────────────────────────────────────────
    const chartDays = timeframe === 'monthly' ? 30 : 7;
    const DAY_ABBR = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const MON_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    const chartData: { label: string; messages: number }[] = [];
    for (let i = chartDays - 1; i >= 0; i--) {
        const d = new Date(now.getTime() - i * 86400_000);
        const dateStr = d.toISOString().split('T')[0];
        const row = currentActivity.find(r => r.date === dateStr);
        let label = '';
        if (timeframe === 'weekly') {
            label = DAY_ABBR[d.getDay()];
        } else if (i % 5 === 0 || i === chartDays - 1) {
            label = `${MON_ABBR[d.getMonth()]} ${d.getDate()}`;
        }
        chartData.push({ label, messages: row?.messages ?? 0 });
    }

    // ── Top members ───────────────────────────────────────────────────────────
    const topMemberRows = await db.select({
        userId:       memberStats.userId,
        messages:     sql<number>`sum(${memberStats.messages})::int`,
        voiceSeconds: sql<number>`sum(${memberStats.voiceSeconds})::int`,
    })
    .from(memberStats)
    .where(and(eq(memberStats.guildId, guild.id), gte(memberStats.date, startDate)))
    .groupBy(memberStats.userId);

    topMemberRows.sort((a, b) => (b.messages ?? 0) - (a.messages ?? 0));

    const topMembers = await Promise.all(
        topMemberRows.slice(0, 5).map(async (r) => {
            const member = guild.members.cache.get(r.userId);
            let avatarURL: string | null = null;
            try {
                const user = member?.user ?? await client.users.fetch(r.userId).catch(() => null);
                avatarURL = user?.displayAvatarURL({ extension: 'png', size: 64 }) ?? null;
            } catch {}
            return {
                avatarURL,
                username:   member?.displayName ?? member?.user?.username ?? 'Unknown',
                messages:   r.messages ?? 0,
                voiceHours: fmtVoice(r.voiceSeconds ?? 0),
            };
        })
    );

    // ── Top channels ──────────────────────────────────────────────────────────
    const topChannelRows = await db.select({
        channelId:    channelStats.channelId,
        messages:     sql<number>`sum(${channelStats.messages})::int`,
        voiceSeconds: sql<number>`sum(${channelStats.voiceSeconds})::int`,
    })
    .from(channelStats)
    .where(and(eq(channelStats.guildId, guild.id), gte(channelStats.date, startDate)))
    .groupBy(channelStats.channelId);

    const isVoiceCh = (id: string) => {
        const t = guild.channels.cache.get(id)?.type;
        return t === ChannelType.GuildVoice || t === ChannelType.GuildStageVoice;
    };

    const topTextChannels = [...topChannelRows]
        .filter(r => !isVoiceCh(r.channelId))
        .sort((a, b) => (b.messages ?? 0) - (a.messages ?? 0))
        .slice(0, 5)
        .map(r => ({
            name:     guild.channels.cache.get(r.channelId)?.name ?? 'deleted-channel',
            messages: r.messages ?? 0,
        }));

    const topVoiceChannels = [...topChannelRows]
        .filter(r => isVoiceCh(r.channelId))
        .sort((a, b) => (b.voiceSeconds ?? 0) - (a.voiceSeconds ?? 0))
        .slice(0, 5)
        .map(r => ({
            name:  guild.channels.cache.get(r.channelId)?.name ?? 'deleted-channel',
            hours: fmtVoice(r.voiceSeconds ?? 0),
        }));

    // ── Labels ────────────────────────────────────────────────────────────────
    const dateLabel = now.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    const guildJoinedLabel = guild.createdAt
        .toLocaleDateString('en-US', { month: 'short', year: 'numeric' }).toUpperCase();

    return {
        guildName:        guild.name,
        guildIcon:        guild.iconURL({ extension: 'png', size: 256 }) ?? null,
        timeframeLabel:   TIMEFRAME_LABELS[timeframe],
        dateLabel,
        memberCount,
        guildJoinedLabel,
        boostTier:        guild.premiumTier ?? 0,
        botName:          client.user?.username ?? 'Fade',
        stats: {
            members:    { value: memberCount,                      trend: trendStr(currentJoins, prevJoins) },
            online:     { value: onlineCount + dndCount + idleCount, pct: `${Math.round(((onlineCount + dndCount + idleCount) / memberCount) * 100)}% of server` },
            messages:   { value: currentMsgs,                     trend: trendStr(currentMsgs, prevMsgs) },
            voiceHours: { value: fmtVoice(currentVoice),          trend: trendStr(currentVoice, prevVoice) },
        },
        presence: { online: onlineCount, dnd: dndCount, idle: idleCount, offline: offlineCount },
        chartData,
        topTextChannels,
        topVoiceChannels,
        topMembers,
    };
}

export default {
    data: new SlashCommandBuilder()
        .setName('serverstats')
        .setDescription('View a detailed analytics dashboard for this server')
        .addStringOption(o => o
            .setName('timeframe')
            .setDescription('Time period to show stats for (default: 7 days)')
            .setRequired(false)
            .addChoices(
                { name: '7 Days (default)', value: 'weekly' },
                { name: '30 Days',          value: 'monthly' },
                { name: 'All Time',         value: 'alltime' },
            )
        ),

    category: 'general',
    guildOnly: true,
    cooldown: 15,

    async execute(interaction, client) {
        const timeframe = (interaction.options.getString('timeframe') ?? 'weekly') as SSTimeframe;
        await interaction.deferReply();
        await interaction.editReply({ embeds: [{ description: `${e('loading')} Building server analytics...`, color: 0x13141f }] });
        const data = await fetchStatsData(interaction.guild!, client, timeframe);
        const buffer = await buildServerStatsCard(data);
        const attachment = new AttachmentBuilder(buffer, { name: 'serverstats.png' });
        await interaction.editReply({ content: null, embeds: [], files: [attachment] });
    },

    async prefixExecute(message, args, client) {
        const tfMap: Record<string, SSTimeframe> = {
            '7d': 'weekly', 'weekly': 'weekly', 'week': 'weekly',
            '30d': 'monthly', 'monthly': 'monthly', 'month': 'monthly',
            'alltime': 'alltime', 'all': 'alltime',
        };
        const timeframe: SSTimeframe = tfMap[args[0]?.toLowerCase() ?? ''] ?? 'weekly';
        const msg = await message.reply({ embeds: [{ description: `${e('loading')} Building server analytics...`, color: 0x13141f }] });
        const data = await fetchStatsData(message.guild!, client, timeframe);
        const buffer = await buildServerStatsCard(data);
        const attachment = new AttachmentBuilder(buffer, { name: 'serverstats.png' });
        await msg.edit({ content: null, embeds: [], files: [attachment] });
    },
} satisfies Command;
