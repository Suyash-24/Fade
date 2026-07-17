// src/commands/stats/channelstats.ts
import { SlashCommandBuilder, ChannelType } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getChannelActivity, type Timeframe } from '../../db/queries/stats.js';

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
    channel: { id: string, type: any },
    allStats: { messages: number, voiceSeconds: number },
    weeklyStats: { messages: number, voiceSeconds: number },
    todayStats: { messages: number, voiceSeconds: number },
    guildName: string
) {
    const isVoice = channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice;
    const emoji = isVoice ? e('voice') : e('channels');

    const card = new FadeContainer(0x2b2d31)
        .text([
            `## ${emoji} Channel Stats`,
            `-# <#${channel.id}>`,
        ].join('\n'))
        .separator(true)
        .text([
            `**All Time**`,
            `${e('pinkarrow')} **Messages** — \`${allStats.messages.toLocaleString()}\``,
            `${e('pinkarrow')} **Voice Activity** — \`${formatDuration(allStats.voiceSeconds)}\``,
            `\u200b`,
            `**This Week**`,
            `${e('pinkarrow')} **Messages** — \`${weeklyStats.messages.toLocaleString()}\``,
            `${e('pinkarrow')} **Voice Activity** — \`${formatDuration(weeklyStats.voiceSeconds)}\``,
            `\u200b`,
            `**Today**`,
            `${e('pinkarrow')} **Messages** — \`${todayStats.messages.toLocaleString()}\``,
            `${e('pinkarrow')} **Voice Activity** — \`${formatDuration(todayStats.voiceSeconds)}\``,
        ].join('\n'))
        .separator(true)
        .text(`-# ${e('server')} ${guildName}`);

    return card.build();
}

export default {
    data: new SlashCommandBuilder()
        .setName('channelstats')
        .setDescription('Check activity stats for a specific channel')
        .addChannelOption(o => o
            .setName('channel')
            .setDescription('Channel to check (defaults to current)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildForum, ChannelType.GuildStageVoice)
            .setRequired(false)
        ),

    category: 'stats',
    prefixOnly: true,
    guildOnly: true,
    aliases: ['cstats'],
    cooldown: 5,

    async execute(interaction, client) {
        const channel = interaction.options.getChannel('channel') ?? interaction.channel!;
        const guild = interaction.guild!;

        const [allStats, wStats, tStats] = await Promise.all([
            getChannelActivity(guild.id, channel.id, 'alltime'),
            getChannelActivity(guild.id, channel.id, 'weekly'),
            getChannelActivity(guild.id, channel.id, 'today'),
        ]);

        const card = buildCard(channel as any, allStats, wStats, tStats, guild.name);
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const guild = message.guild!;
        const channelId = args[0]?.replace(/[<#>]/g, '');
        const channel = channelId ? guild.channels.cache.get(channelId) : message.channel;
        if (!channel) {
            const err = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} Channel not found.`)
                .build();
            await sendMessage(message, [err]);
            return;
        }

        const [allStats, wStats, tStats] = await Promise.all([
            getChannelActivity(guild.id, channel.id, 'alltime'),
            getChannelActivity(guild.id, channel.id, 'weekly'),
            getChannelActivity(guild.id, channel.id, 'today'),
        ]);

        const card = buildCard(channel as any, allStats, wStats, tStats, guild.name);
        await sendMessage(message, [card]);
    },
} satisfies Command;
