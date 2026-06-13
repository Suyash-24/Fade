// src/commands/moderation/case.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, fadeReply, sendMessage } from '../../components/builders.js';
import { getCase, updateCaseReason } from '../../db/queries/moderation.js';
import { e, Colours } from '../../components/emojis.js';

const MAX_CASE_NUMBER = 2_147_483_647; // PostgreSQL int4 max

function parseCaseNumber(input: string): number | null {
    const cleaned = input.trim().replace(/^#/, '');
    if (!/^\d+$/.test(cleaned)) return null;

    const num = Number(cleaned);
    if (!Number.isSafeInteger(num) || num < 1 || num > MAX_CASE_NUMBER) {
        return null;
    }

    return num;
}

const buildCaseView = (c: any) => {
    const ts = Math.floor(new Date(c.createdAt).getTime() / 1000);
    return new FadeContainer(Colours.FADE)
        .text(`## ${e('id')} Case #${c.caseNumber}`)
        .separator(true)
        .text([
            `**Type** — \`${c.type}\``,
            `${e('members')}  **User** — <@${c.userId}> (${c.userTag})`,
            `${e('shield')}  **Moderator** — <@${c.moderatorId}>`,
            `**Reason** — ${c.reason}`,
            c.duration ? `${e('uptime')}  **Duration** — \`${c.duration}s\`` : '',
            `${e('date')}  **Date** — <t:${ts}:D> (<t:${ts}:R>)`,
            `**Active** — \`${c.active ? 'Yes' : 'No'}\``,
        ].filter(Boolean).join('\n'))
        .build();
};

export default {
    data: new SlashCommandBuilder()
        .setName('case')
        .setDescription('Look up a specific moderation case')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addIntegerOption(o => o.setName('number').setDescription('Case number').setRequired(true)),

    category: 'moderation', guildOnly: true,
    userPermissions: [PermissionFlagsBits.ModerateMembers],
    cooldown: 5,

    async execute(interaction, client) {
        const num  = interaction.options.getInteger('number', true);
        if (!Number.isSafeInteger(num) || num < 1 || num > MAX_CASE_NUMBER) {
            await interaction.reply({
                content: `${e('error')} Please provide a valid case number between 1 and ${MAX_CASE_NUMBER}.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        const c    = await getCase(interaction.guild!.id, num);

        if (!c) {
            await interaction.reply({ content: `${e('error')} Case #${num} not found.`, flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.reply({
            ...(fadeReply([buildCaseView(c)], true) as any),
            allowedMentions: { parse: [] },
        } as any);
    },

    async prefixExecute(message, args, client) {
        const firstArg = args[0] ?? '';
        const num = parseCaseNumber(firstArg);
        if (num === null) {
            await message.reply(`${e('error')} Please provide a valid case number (e.g. \`13\` or \`#13\`).`);
            return;
        }

        const c = await getCase(message.guild!.id, num);
        if (!c) { await message.reply(`${e('error')} Case #${num} not found.`); return; }

        await sendMessage(message, [buildCaseView(c)]);
    },
} satisfies Command;