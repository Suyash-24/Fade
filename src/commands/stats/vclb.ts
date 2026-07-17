// src/commands/stats/vclb.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage, btn, thumb, ButtonStyle } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getVoiceLeaderboard, type Timeframe } from '../../db/queries/stats.js';

const MEDALS = ['🥇', '🥈', '🥉'];
const PAGE_SIZE = 10;

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

export async function buildVoiceLeaderboard(
    guildId: string,
    guildName: string,
    iconURL: string | null,
    page: number,
    timeframe: Timeframe,
    guild: any,
) {
    const label = TIMEFRAME_LABELS[timeframe];
    const rows = await getVoiceLeaderboard(guildId, timeframe, PAGE_SIZE + 1, page * PAGE_SIZE);
    const hasNext = rows.length > PAGE_SIZE;
    const slice = rows.slice(0, PAGE_SIZE);
    const hasPrev = page > 0;

    if (!slice.length) return null;

    const lines = slice.map((row, i) => {
        const pos = page * PAGE_SIZE + i + 1;
        const medal = MEDALS[pos - 1] ?? `\`#${pos}\``;
        const member = guild?.members?.cache?.get(row.userId);
        const name = member?.displayName ?? `<@${row.userId}>`;
        return `${medal}  ${name} · **${formatDuration(row.total)}**`;
    });

    const card = new FadeContainer(null);

    if (iconURL) {
        card.section(
            [`## ${e('voice')} Voice Leaderboard`, `-# ${guildName} · ${label} · Page ${page + 1}`],
            thumb(iconURL),
        );
    } else {
        card.text(`## ${e('voice')} Voice Leaderboard`);
        card.text(`-# ${guildName} · ${label} · Page ${page + 1}`);
    }

    card.separator(true);
    card.text(lines.join('\n'));

    if (hasPrev || hasNext) {
        card.actionRow(
            btn(`vclb:${guildId}:${page - 1}:${timeframe}`, '◀ Previous', ButtonStyle.Secondary, !hasPrev),
            btn(`vclb:${guildId}:${page + 1}:${timeframe}`, 'Next ▶', ButtonStyle.Secondary, !hasNext),
        );
    }

    return card.build();
}

export default {
    data: new SlashCommandBuilder()
        .setName('vclb')
        .setDescription('View the voice activity leaderboard')
        .addStringOption(o => o
            .setName('timeframe')
            .setDescription('Time period')
            .setRequired(false)
            .addChoices(
                { name: 'Today', value: 'today' },
                { name: 'Weekly (7d)', value: 'weekly' },
                { name: 'Monthly (30d)', value: 'monthly' },
                { name: 'All Time', value: 'alltime' },
            )
        )
        .addIntegerOption(o => o
            .setName('page')
            .setDescription('Page number')
            .setMinValue(1)
            .setRequired(false)
        ),

    category: 'stats',
    guildOnly: true,
    aliases: ['voiceleaderboard', 'topvoice'],
    cooldown: 10,

    async execute(interaction, client) {
        const timeframe = (interaction.options.getString('timeframe') ?? 'alltime') as Timeframe;
        const page = (interaction.options.getInteger('page') ?? 1) - 1;
        const guild = interaction.guild!;
        const iconURL = guild.iconURL({ size: 64 }) ?? null;

        const card = await buildVoiceLeaderboard(guild.id, guild.name, iconURL, page, timeframe, guild);
        if (!card) {
            const empty = new FadeContainer(Colours.FADE).text(`${e('voice')} No voice data recorded yet.`).build();
            await sendResponse(interaction, [empty], true);
            return;
        }

        await sendResponse(interaction, [card], false, { parse: [] });
    },

    async prefixExecute(message, args, client) {
        const guild = message.guild!;
        const iconURL = guild.iconURL({ size: 64 }) ?? null;

        const timeframe: Timeframe = (['today', 'daily', 'weekly', 'monthly', 'alltime'].includes(args[0]?.toLowerCase()) ? args.shift()!.toLowerCase() : 'alltime') as Timeframe;
        const page = Math.max(0, (parseInt(args[0]) || 1) - 1);

        const card = await buildVoiceLeaderboard(guild.id, guild.name, iconURL, page, timeframe, guild);
        if (!card) {
            await message.reply(`${e('voice')} No voice data recorded yet.`);
            return;
        }

        await sendMessage(message, [card]);
    },
} satisfies Command;
