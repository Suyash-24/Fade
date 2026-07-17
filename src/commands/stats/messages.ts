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
    messages: number,
    rank: number,
    serverTotal: number,
    timeframe: Timeframe,
    guildName: string,
) {
    const label = TIMEFRAME_LABELS[timeframe];
    const pct = serverTotal > 0 ? ((messages / serverTotal) * 100).toFixed(1) : '0.0';

    const card = new FadeContainer(Colours.FADE)
        .section(
            [
                `## ${e('stats')} Message Stats`,
                `-# ${user.username} · ${label}`,
            ],
            thumb(user.displayAvatarURL({ size: 128 })),
        )
        .separator(true)
        .text(
            `${e('pinkarrow')} **Messages Sent** — \`${messages.toLocaleString()}\`\n` +
            `${e('pinkarrow')} **Server Rank** — \`#${rank || '—'}\`\n` +
            `${e('pinkarrow')} **Server Share** — \`${pct}%\`\n` +
            `${e('pinkarrow')} **Server Total** — \`${serverTotal.toLocaleString()}\``
        )
        .separator(true)
        .text(`-# ${e('server')} ${guildName} · ${label}`);

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
    aliases: ['msgs', 'msgcount'],
    cooldown: 5,

    async execute(interaction, client) {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const timeframe = (interaction.options.getString('timeframe') ?? 'alltime') as Timeframe;
        const guild = interaction.guild!;

        const [messages, rank, totals] = await Promise.all([
            getUserMessages(guild.id, target.id, timeframe),
            getUserMessageRank(guild.id, target.id, timeframe),
            getServerTotals(guild.id, timeframe),
        ]);

        const card = buildCard(target, messages, rank, totals.messages, timeframe, guild.name);
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const guild = message.guild!;
        const timeframe: Timeframe = (['today', 'daily', 'weekly', 'monthly', 'alltime'].includes(args[0]?.toLowerCase()) ? args.shift()!.toLowerCase() : 'alltime') as Timeframe;

        const targetId = args[0]?.replace(/[<@!>]/g, '');
        let target = targetId ? await client.users.fetch(targetId).catch(() => undefined) : undefined;
        if (!target) target = message.author;

        const [messages, rank, totals] = await Promise.all([
            getUserMessages(guild.id, target.id, timeframe),
            getUserMessageRank(guild.id, target.id, timeframe),
            getServerTotals(guild.id, timeframe),
        ]);

        const card = buildCard(target as any, messages, rank, totals.messages, timeframe, guild.name);
        await sendMessage(message, [card]);
    },
} satisfies Command;
