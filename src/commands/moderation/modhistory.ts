// src/commands/moderation/modhistory.ts
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, btn, sendResponse, sendMessage } from '../../components/builders.js';
import { getUserCases } from '../../db/queries/moderation.js';
import { e, Colours } from '../../components/emojis.js';

const TYPE_EMOJI: Record<string, string> = {
    ban:     '🔨', kick: '👢', warn: '⚠️',
    mute:    '🔇', unmute: '🔊', unban: '🔓',
    timeout: '⏳', softban: '🪃',
};

const PAGE_SIZE = 10;
export const MODHISTORY_PAGE_PREFIX = 'modhistory_page';

function buildHistoryLines(allCases: any[], page: number) {
    const totalPages = Math.max(1, Math.ceil(allCases.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    const pageCases = allCases.slice(start, start + PAGE_SIZE);

    const lines = pageCases.map(c => {
        const emoji = TYPE_EMOJI[c.type] ?? '•';
        const ts    = Math.floor(new Date(c.createdAt).getTime() / 1000);
        return `${emoji} \`#${c.caseNumber}\` **${c.type}** · <t:${ts}:R>\n-# ${c.reason}`;
    });

    return {
        lines,
        shown: lines.length,
        total: allCases.length,
        page: safePage,
        totalPages,
    };
}

function buildHistoryContainer(targetId: string, targetTag: string, allCases: any[], page = 1) {
    if (!allCases.length) {
        return new FadeContainer(Colours.FADE)
            .text(`${e('success')}  **${targetTag}** has a clean record.`)
            .build();
    }

    const history = buildHistoryLines(allCases, page);
    const hasPages = history.totalPages > 1;

    const card = new FadeContainer(Colours.FADE)
        .text(`## ${e('shield')} Mod History — ${targetTag}`)
        .text(`-# ${history.total} total case${history.total === 1 ? '' : 's'}`)
        .separator(true)
        .text(history.lines.join('\n\n'))
        .text(`-# Page ${history.page}/${history.totalPages}`);

    if (hasPages) {
        card.actionRow(
            btn(`${MODHISTORY_PAGE_PREFIX}:${targetId}:${history.page - 1}`, 'Prev', undefined, history.page <= 1),
            btn(`${MODHISTORY_PAGE_PREFIX}:${targetId}:${history.page + 1}`, 'Next', undefined, history.page >= history.totalPages),
        );
    }

    return card.build();
}

export async function buildModHistoryPage(guildId: string, targetUser: { id: string; tag: string }, page = 1) {
    const allCases = await getUserCases(guildId, targetUser.id);
    return buildHistoryContainer(targetUser.id, targetUser.tag, allCases, page);
}

export default {
    data: new SlashCommandBuilder()
        .setName('modhistory')
        .setDescription('View moderation history for a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(o => o.setName('user').setDescription('The user to check').setRequired(true)),

    category: 'moderation', guildOnly: true,
    userPermissions: [PermissionFlagsBits.ModerateMembers],
    aliases: ['history', 'mh'],
    cooldown: 5,

    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user', true);
        const card = await buildModHistoryPage(interaction.guild!.id, targetUser, 1);
        await sendResponse(interaction, [card], true);
    },

    async prefixExecute(message, args, client) {
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const target = targetId ? await client.users.fetch(targetId).catch(() => null) : null;
        if (!target) { await message.reply(`${e('error')} Please mention a user.`); return; }

        const card = await buildModHistoryPage(message.guild!.id, target, 1);

        await sendMessage(message, [card]);
    },
} satisfies Command;