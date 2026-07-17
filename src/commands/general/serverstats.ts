// src/commands/general/serverstats.ts
import { SlashCommandBuilder, MessageFlags, AttachmentBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { buildServerStatsCard, type ServerStatsData } from '../../utils/canvas/serverStatsCard.js';
import { db } from '../../db/index.js';
import { guildStats, memberStats, channelStats } from '../../db/schema.js';
import { and, eq, gte, sql } from 'drizzle-orm';

async function fetchStatsData(guild: any, client: any): Promise<ServerStatsData> {
    const owner = await client.users.fetch(guild.ownerId).catch(() => null);

    const memberCount = guild.memberCount;
    const botCount    = guild.members.cache.filter((m: any) => m.user.bot).size;
    const humanCount  = memberCount - botCount;
    const onlineCount = guild.members.cache.filter((m: any) => m.presence?.status === 'online' || m.presence?.status === 'dnd' || m.presence?.status === 'idle').size;

    const voiceActive = guild.voiceStates.cache.size;

    // --- Analytics Engine Data ---
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    
    const guildActivity = await db.select()
        .from(guildStats)
        .where(and(eq(guildStats.guildId, guild.id), gte(guildStats.date, fourteenDaysAgo)))
        .orderBy(guildStats.date);

    // Default 14 day array
    const chartData: { date: string; messages: number; voiceSeconds: number; joins: number }[] = [];
    let today = new Date();
    for (let i = 13; i >= 0; i--) {
        const d = new Date(today.getTime() - i * 24 * 60 * 60 * 1000);
        const dateStr = d.toISOString().split('T')[0];
        const row = guildActivity.find(r => r.date === dateStr);
        chartData.push({
            date: dateStr,
            messages: row?.messages ?? 0,
            voiceSeconds: row?.voiceSeconds ?? 0,
            joins: row?.joins ?? 0
        });
    }

    // Top Members (aggregate last 14 days)
    const topMembersRows = await db.select({
        userId: memberStats.userId,
        messages: sql<number>`sum(${memberStats.messages})::int`,
        voiceSeconds: sql<number>`sum(${memberStats.voiceSeconds})::int`
    })
    .from(memberStats)
    .where(and(eq(memberStats.guildId, guild.id), gte(memberStats.date, fourteenDaysAgo)))
    .groupBy(memberStats.userId);

    const formatVoice = (sec: number) => {
        if (sec === 0) return '0 hrs';
        if (sec < 60) return '<1 min';
        if (sec < 3600) return `${Math.floor(sec / 60)} min`;
        return `${+(sec / 3600).toFixed(1)} hrs`;
    };

    const topChatters = topMembersRows.sort((a, b) => b.messages - a.messages).slice(0, 3).map(r => {
        const m = guild.members.cache.get(r.userId);
        return { name: m?.user.username ?? 'Unknown', value: `${r.messages.toLocaleString()} msg` };
    });

    const topTalkers = topMembersRows.sort((a, b) => b.voiceSeconds - a.voiceSeconds).slice(0, 3).map(r => {
        const m = guild.members.cache.get(r.userId);
        return { name: m?.user.username ?? 'Unknown', value: formatVoice(r.voiceSeconds) };
    });

    // Top Channels
    const topChannelsRows = await db.select({
        channelId: channelStats.channelId,
        messages: sql<number>`sum(${channelStats.messages})::int`,
        voiceSeconds: sql<number>`sum(${channelStats.voiceSeconds})::int`
    })
    .from(channelStats)
    .where(and(eq(channelStats.guildId, guild.id), gte(channelStats.date, fourteenDaysAgo)))
    .groupBy(channelStats.channelId);

    const topText = topChannelsRows.sort((a, b) => b.messages - a.messages).slice(0, 3).map(r => {
        const c = guild.channels.cache.get(r.channelId);
        return { name: c?.name ?? 'deleted-channel', value: `${r.messages.toLocaleString()} msg` };
    });

    const topVoice = topChannelsRows.sort((a, b) => b.voiceSeconds - a.voiceSeconds).slice(0, 3).map(r => {
        const c = guild.channels.cache.get(r.channelId);
        return { name: c?.name ?? 'deleted-channel', value: formatVoice(r.voiceSeconds) };
    });

    // Sum last 7d joins
    const joined7d = chartData.slice(-7).reduce((a, b) => a + (guildActivity.find(r => r.date === b.date)?.joins ?? 0), 0);
    const joined24h = guildActivity.find(r => r.date === chartData[13].date)?.joins ?? 0;

    return {
        guildName: guild.name,
        guildIcon: guild.iconURL({ extension: 'png', size: 512 }),
        memberCount,
        humanCount,
        botCount,
        onlineCount,
        joined24h,
        joined7d,
        overview: {
            owner: owner?.username ?? 'Unknown',
            createdFormatted: new Date(guild.createdTimestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
            botJoinedFormatted: guild.members.me?.joinedAt 
                ? new Date(guild.members.me.joinedAt).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' })
                : 'Unknown',
            roles: guild.roles.cache.size
        },
        engagement: {
            voiceActive,
            boosts: guild.premiumSubscriptionCount ?? 0,
            boostTier: guild.premiumTier ?? 0
        },
        analytics: {
            chartData,
            topChatters,
            topTalkers,
            topText,
            topVoice
        }
    };
}

export default {
    data: new SlashCommandBuilder()
        .setName('serverstats')
        .setDescription('View detailed analytics and historical statistics for this server'),

    category: 'general', guildOnly: true,
    cooldown: 15,

    async execute(interaction, client) {
        await interaction.deferReply();
        const msg = await interaction.editReply({ embeds: [{ description: 'Loading server analytics...', color: 0x2b2d31 }] });
        const data = await fetchStatsData(interaction.guild!, client);
        const buffer = await buildServerStatsCard(data);
        const attachment = new AttachmentBuilder(buffer, { name: 'serverstats.png' });
        await interaction.editReply({ content: null, embeds: [], files: [attachment] });
    },

    async prefixExecute(message, args, client) {
        const msg = await message.reply({ embeds: [{ description: 'Loading server analytics...', color: 0x2b2d31 }] });
        const data = await fetchStatsData(message.guild!, client);
        const buffer = await buildServerStatsCard(data);
        const attachment = new AttachmentBuilder(buffer, { name: 'serverstats.png' });
        await msg.edit({ content: null, embeds: [], files: [attachment] });
    },
} satisfies Command;
