// src/commands/moderation/warnings.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, btn, sendResponse, sendMessage } from '../../components/builders.js';
import { getUserCases, clearWarnings } from '../../db/queries/moderation.js';
import { e, Colours } from '../../components/emojis.js';

const PAGE_SIZE = 10;
export const WARNINGS_PAGE_PREFIX = 'warnings_page';

function buildWarningsLines(warnings: any[], page: number) {
    const totalPages = Math.max(1, Math.ceil(warnings.length / PAGE_SIZE));
    const safePage = Math.min(Math.max(page, 1), totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    const pageWarnings = warnings.slice(start, start + PAGE_SIZE);

    return {
        lines: pageWarnings.map(w => `\`#${w.caseNumber}\` · <t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:R> · ${w.reason}`),
        total: warnings.length,
        page: safePage,
        totalPages,
    };
}

function buildWarningsContainer(targetId: string, targetTag: string, warnings: any[], page = 1) {
    if (!warnings.length) {
        return new FadeContainer(Colours.FADE)
            .text(`${e('success')}  **${targetTag}** has no active warnings.`)
            .build();
    }

    const view = buildWarningsLines(warnings, page);
    const card = new FadeContainer(Colours.WARNING)
        .text(`## ${e('warn')} Warnings — ${targetTag}`)
        .text(`-# ${view.total} active warning${view.total === 1 ? '' : 's'}`)
        .separator(true)
        .text(view.lines.join('\n'))
        .text(`-# Page ${view.page}/${view.totalPages}`);

    if (view.totalPages > 1) {
        card.actionRow(
            btn(`${WARNINGS_PAGE_PREFIX}:${targetId}:${view.page - 1}`, 'Prev', undefined, view.page <= 1),
            btn(`${WARNINGS_PAGE_PREFIX}:${targetId}:${view.page + 1}`, 'Next', undefined, view.page >= view.totalPages),
        );
    }

    return card.build();
}

export async function buildWarningsPage(guildId: string, targetUser: { id: string; tag: string }, page = 1) {
    const allCases = await getUserCases(guildId, targetUser.id);
    const warnings = allCases.filter(c => c.type === 'warn' && c.active);
    return buildWarningsContainer(targetUser.id, targetUser.tag, warnings, page);
}

export default {
    data: new SlashCommandBuilder()
        .setName('warnings')
        .setDescription('View or clear warnings for a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(o => o.setName('user').setDescription('The user to check').setRequired(true))
        .addBooleanOption(o => o.setName('clear').setDescription('Clear all warnings for this user').setRequired(false)),

    category: 'moderation', guildOnly: true,
    userPermissions: [PermissionFlagsBits.ModerateMembers],
    cooldown: 5,

    async execute(interaction, client) {
        const targetUser = interaction.options.getUser('user', true);
        const doClear    = interaction.options.getBoolean('clear') ?? false;
        const guild      = interaction.guild!;

        if (doClear) {
            await clearWarnings(guild.id, targetUser.id);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  **Warnings cleared** for ${targetUser.tag}`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        const card = await buildWarningsPage(guild.id, targetUser, 1);
        await sendResponse(interaction, [card], true);
    },

    async prefixExecute(message, args, client) {
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const target = targetId ? await client.users.fetch(targetId).catch(() => null) : null;
        if (!target) { await message.reply(`${e('error')} Please mention a user.`); return; }

        const card = await buildWarningsPage(message.guild!.id, target, 1);

        await sendMessage(message, [card]);
    },
} satisfies Command;