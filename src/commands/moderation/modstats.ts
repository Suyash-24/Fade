// src/commands/moderation/modstats.ts
// Show how many mod actions a moderator has performed.
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, fadeReply, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { db } from '../../db/index.js';
import { cases } from '../../db/schema.js';
import { and, eq, count, sql } from 'drizzle-orm';
import { hasPermission } from '../../utils/fakePerms.js';

export default {
    data: new SlashCommandBuilder()
        .setName('modstats')
        .setDescription('View moderator action statistics')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(o => o.setName('moderator').setDescription('Moderator to check (defaults to you)').setRequired(false)),

    category: 'moderation', guildOnly: true,
    userPermissions: [PermissionFlagsBits.ModerateMembers],
    cooldown: 5,

    async execute(interaction, client) {
        const target = interaction.options.getUser('moderator') ?? interaction.user;
        const guild  = interaction.guild!;

        const rows = await db.select({
            type:  cases.type,
            count: count(),
        })
        .from(cases)
        .where(and(eq(cases.guildId, guild.id), eq(cases.moderatorId, target.id)))
        .groupBy(cases.type);

        const totals: Record<string, number> = {};
        let total = 0;
        for (const row of rows) {
            totals[row.type] = row.count;
            total += row.count;
        }

        const typeEmojis: Record<string, string> = {
            ban: e('ban'), kick: e('kick'), warn: e('warn'), mute: e('mute'),
            unmute: e('mute'), unban: e('unlock'), timeout: '⏳', softban: e('ban'), strip: e('roles'),
        };

        const lines = Object.entries(totals)
            .sort((a, b) => b[1] - a[1])
            .map(([type, cnt]) => `${typeEmojis[type] ?? '•'} **${type}** — \`${cnt}\``)
            .join('\n');

        const card = new FadeContainer(Colours.NONE)
            .text(`## ${e('stats')} Mod Stats — ${target.tag}`)
            .separator(true)
            .text(
                total === 0
                    ? '*No moderation actions found.*'
                    : lines + `\n\n**Total:** \`${total}\``
            )
            .build();

        await interaction.reply({ ...(fadeReply([card], true) as any), allowedMentions: { parse: [] } });
    },

    async prefixExecute(message, args, client) {
        if (!await hasPermission(message.member!, 'moderate_members')) {
            await message.reply(`${e('error')} You need Moderate Members permission.`); return;
        }

        const targetId  = args[0]?.replace(/[<@!>]/g, '') ?? message.author.id;
        const target    = await client.users.fetch(targetId).catch(() => null) ?? message.author;
        const guild     = message.guild!;

        const rows = await db.select({ type: cases.type, count: count() })
            .from(cases)
            .where(and(eq(cases.guildId, guild.id), eq(cases.moderatorId, target.id)))
            .groupBy(cases.type);

        const totals: Record<string, number> = {};
        let total = 0;
        for (const row of rows) {
            totals[row.type] = row.count;
            total += row.count;
        }

        const typeEmojis: Record<string, string> = {
            ban: e('ban'), kick: e('kick'), warn: e('warn'), mute: e('mute'),
            unmute: e('mute'), unban: e('unlock'), timeout: '⏳', softban: e('ban'), strip: e('roles'),
        };

        const lines = Object.entries(totals)
            .sort((a, b) => b[1] - a[1])
            .map(([type, cnt]) => `${typeEmojis[type] ?? '•'} **${type}** — \`${cnt}\``)
            .join('\n');

        const card = new FadeContainer(Colours.NONE)
            .text(`## ${e('stats')} Mod Stats — ${target.tag}`)
            .separator(true)
            .text(total === 0 ? '*No actions found.*' : lines + `\n\n**Total:** \`${total}\``)
            .build();

        await sendMessage(message, [card]);
    },
} satisfies Command;
