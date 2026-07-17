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

export default {
    data: new SlashCommandBuilder()
        .setName('channelstats')
        .setDescription('Check activity stats for a specific channel')
        .addChannelOption(o => o
            .setName('channel')
            .setDescription('Channel to check (defaults to current)')
            .addChannelTypes(ChannelType.GuildText, ChannelType.GuildVoice, ChannelType.GuildForum, ChannelType.GuildStageVoice)
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
    aliases: ['cstats'],
    cooldown: 5,

    async execute(interaction, client) {
        const channel = interaction.options.getChannel('channel') ?? interaction.channel!;
        const timeframe = (interaction.options.getString('timeframe') ?? 'alltime') as Timeframe;
        const guild = interaction.guild!;

        const stats = await getChannelActivity(guild.id, channel.id, timeframe);
        const label = TIMEFRAME_LABELS[timeframe];

        const isVoice = (channel as any).type === ChannelType.GuildVoice || (channel as any).type === ChannelType.GuildStageVoice;
        const emoji = isVoice ? e('voice') : e('channels');

        const card = new FadeContainer(Colours.FADE)
            .text(`## ${emoji} Channel Stats`)
            .text(`-# <#${channel.id}> · ${label}`)
            .separator(true)
            .text(
                `${e('pinkarrow')} **Messages** — \`${stats.messages.toLocaleString()}\`\n` +
                `${e('pinkarrow')} **Voice Activity** — \`${formatDuration(stats.voiceSeconds)}\``
            )
            .separator(true)
            .text(`-# ${e('server')} ${guild.name} · ${label}`)
            .build();

        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const guild = message.guild!;
        const timeframe: Timeframe = (['today', 'daily', 'weekly', 'monthly', 'alltime'].includes(args[0]?.toLowerCase()) ? args.shift()!.toLowerCase() : 'alltime') as Timeframe;

        const channelId = args[0]?.replace(/[<#>]/g, '');
        const channel = channelId ? guild.channels.cache.get(channelId) : message.channel;
        if (!channel) {
            const err = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} Channel not found.`)
                .build();
            await sendMessage(message, [err]);
            return;
        }

        const stats = await getChannelActivity(guild.id, channel.id, timeframe);
        const label = TIMEFRAME_LABELS[timeframe];

        const isVoice = channel.type === ChannelType.GuildVoice || channel.type === ChannelType.GuildStageVoice;
        const emoji = isVoice ? e('voice') : e('channels');

        const card = new FadeContainer(Colours.FADE)
            .text(`## ${emoji} Channel Stats`)
            .text(`-# <#${channel.id}> · ${label}`)
            .separator(true)
            .text(
                `${e('pinkarrow')} **Messages** — \`${stats.messages.toLocaleString()}\`\n` +
                `${e('pinkarrow')} **Voice Activity** — \`${formatDuration(stats.voiceSeconds)}\``
            )
            .separator(true)
            .text(`-# ${e('server')} ${guild.name} · ${label}`)
            .build();

        await sendMessage(message, [card]);
    },
} satisfies Command;
