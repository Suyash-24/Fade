// src/commands/leveling/leaderboard.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage, btn, thumb, ButtonStyle } from '../../components/builders.js';
import { getLeaderboard } from '../../db/queries/leveling.js';
import { e, Colours } from '../../components/emojis.js';

const MEDALS = ['🥇', '🥈', '🥉'];
export const LEADERBOARD_LIMIT = 10;

// ── Shared builder used by both slash and button handler ──────────────────────

export async function buildLeaderboardCard(
    guildId: string,
    guildName: string,
    iconURL: string | null,
    page: number, // 0-indexed
    guild: any,   // Guild object for member cache
) {
    const limit   = LEADERBOARD_LIMIT;
    const entries = await getLeaderboard(guildId, limit * (page + 1));
    const slice   = entries.slice(page * limit, (page + 1) * limit);
    const total   = entries.length; // total fetched — if we got exactly limit*(page+1) there may be more
    const hasNext = total === limit * (page + 1); // if exactly filled, assume next page may exist
    const hasPrev = page > 0;

    if (!slice.length) return null;

    const lines = slice.map((row, i) => {
        const pos   = page * limit + i + 1;
        const medal = MEDALS[pos - 1] ?? `\`#${pos}\``;
        const member = guild?.members?.cache?.get(row.userId);
        const name  = member?.displayName ?? `<@${row.userId}>`;
        return `${medal}  ${name} · **Lv.${row.level}** · \`${row.xp.toLocaleString()} XP\``;
    });

    const card = new FadeContainer(null) // no accent stripe
        // 1. Title — plain text (Section requires an accessory, so no section here)
        .text(`## ${e('trophy')} XP Leaderboard`)
        .text(`-# ${guildName} · Page ${page + 1}`)
        // 2. Separator
        .separator(true);

    // 3. Users — section with thumbnail if icon available, plain text otherwise
    if (iconURL) {
        card.section([lines.join('\n')], thumb(iconURL));
    } else {
        card.text(lines.join('\n'));
    }

    // Pagination buttons
    if (hasPrev || hasNext) {
        card.actionRow(
            btn(`lb_page:${guildId}:${page - 1}`, '◀ Previous', ButtonStyle.Secondary, !hasPrev),
            btn(`lb_page:${guildId}:${page + 1}`, 'Next ▶',     ButtonStyle.Secondary, !hasNext),
        );
    }

    return card.build();
}

export default {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('View the XP leaderboard for this server')
        .addIntegerOption(o => o
            .setName('page')
            .setDescription('Page number')
            .setMinValue(1)
            .setRequired(false)
        ),

    category: 'leveling',
    guildOnly: true,
    aliases:   ['lb'],
    cooldown:  10,

    async execute(interaction, client) {
        const page    = (interaction.options.getInteger('page') ?? 1) - 1;
        const guild   = interaction.guild!;
        const iconURL = guild.iconURL({ size: 64 }) ?? null;

        const card = await buildLeaderboardCard(guild.id, guild.name, iconURL, page, guild);

        if (!card) {
            const empty = new FadeContainer(Colours.FADE)
                .text(`${e('stats')} No leveling data yet for this server.`)
                .build();
            await sendResponse(interaction, [empty], true);
            return;
        }

        await sendResponse(interaction, [card], false, { parse: [] });
    },

    async prefixExecute(message, args, client) {
        const guild   = message.guild!;
        const iconURL = guild.iconURL({ size: 64 }) ?? null;
        const page    = Math.max(0, (parseInt(args[0]) || 1) - 1);

        const card = await buildLeaderboardCard(guild.id, guild.name, iconURL, page, guild);

        if (!card) {
            await message.reply(`${e('stats')} No leveling data yet.`);
            return;
        }

        await sendMessage(message, [card]);
    },
} satisfies Command;