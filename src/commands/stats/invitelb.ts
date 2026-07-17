// src/commands/stats/invitelb.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage, btn, thumb, ButtonStyle } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getInviteLeaderboard } from '../../db/queries/invites.js';

const MEDALS = ['🥇', '🥈', '🥉'];
const PAGE_SIZE = 10;

export async function buildInviteLeaderboard(
    guildId: string,
    guildName: string,
    iconURL: string | null,
    page: number,
    guild: any,
) {
    const rows = await getInviteLeaderboard(guildId, PAGE_SIZE + 1, page * PAGE_SIZE);
    const hasNext = rows.length > PAGE_SIZE;
    const slice = rows.slice(0, PAGE_SIZE);
    const hasPrev = page > 0;

    if (!slice.length) return null;

    const lines = slice.map((row, i) => {
        const pos = page * PAGE_SIZE + i + 1;
        const medal = MEDALS[pos - 1] ?? `\`#${pos}\``;
        const member = guild?.members?.cache?.get(row.userId);
        const name = member?.displayName ?? `<@${row.userId}>`;
        
        // Detailed hover breakdown could be cool, but for text:
        return `${medal}  ${name} · **${row.total}** invites`;
    });

    const card = new FadeContainer(null);

    if (iconURL) {
        card.section(
            [`## ${e('invite')} Invite Leaderboard`, `-# ${guildName} · Page ${page + 1}`],
            thumb(iconURL),
        );
    } else {
        card.text(`## ${e('invite')} Invite Leaderboard`);
        card.text(`-# ${guildName} · Page ${page + 1}`);
    }

    card.separator(true);
    card.text(lines.join('\n'));

    if (hasPrev || hasNext) {
        card.actionRow(
            btn(`invitelb:${guildId}:${page - 1}`, '◀ Previous', ButtonStyle.Secondary, !hasPrev),
            btn(`invitelb:${guildId}:${page + 1}`, 'Next ▶', ButtonStyle.Secondary, !hasNext),
        );
    }

    return card.build();
}

export default {
    data: new SlashCommandBuilder()
        .setName('invitelb')
        .setDescription('View the invite leaderboard')
        .addIntegerOption(o => o
            .setName('page')
            .setDescription('Page number')
            .setMinValue(1)
            .setRequired(false)
        ),

    category: 'stats',
    prefixOnly: true,
    guildOnly: true,
    aliases: ['inviteleaderboard', 'topinvites'],
    cooldown: 10,

    async execute(interaction, client) {
        const page = (interaction.options.getInteger('page') ?? 1) - 1;
        const guild = interaction.guild!;
        const iconURL = guild.iconURL({ size: 64 }) ?? null;

        const card = await buildInviteLeaderboard(guild.id, guild.name, iconURL, page, guild);
        if (!card) {
            const empty = new FadeContainer(Colours.FADE).text(`${e('invite')} No invite data recorded yet.`).build();
            await sendResponse(interaction, [empty], true);
            return;
        }

        await sendResponse(interaction, [card], false, { parse: [] });
    },

    async prefixExecute(message, args, client) {
        const guild = message.guild!;
        const iconURL = guild.iconURL({ size: 64 }) ?? null;
        const page = Math.max(0, (parseInt(args[0]) || 1) - 1);

        const card = await buildInviteLeaderboard(guild.id, guild.name, iconURL, page, guild);
        if (!card) {
            await message.reply(`${e('invite')} No invite data recorded yet.`);
            return;
        }

        await sendMessage(message, [card]);
    },
} satisfies Command;
