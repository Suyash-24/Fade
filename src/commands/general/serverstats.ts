// src/commands/general/serverstats.ts
// View server activity statistics: joins, leaves, mod actions, top members.
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, fadeReply, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { db } from '../../db/index.js';
import { cases, levels } from '../../db/schema.js';
import { eq, gte, count, desc, and } from 'drizzle-orm';

export default {
    data: new SlashCommandBuilder()
        .setName('serverstats')
        .setDescription('View activity statistics for this server'),

    category: 'general', guildOnly: true,
    cooldown: 30,

    async execute(interaction, client) {
        await interaction.deferReply();

        const guild = interaction.guild!;
        const guildId = guild.id;

        // Last 30 days threshold
        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        // Total mod actions (all time)
        const [modCount] = await db.select({ count: count() }).from(cases).where(eq(cases.guildId, guildId));

        // Recent mod actions (last 30 days)
        const [recentModCount] = await db.select({ count: count() }).from(cases)
            .where(and(eq(cases.guildId, guildId), gte(cases.createdAt, thirtyDaysAgo)));

        // Top 5 members by XP
        const topMembers = await db.select({ userId: levels.userId, xp: levels.xp, level: levels.level })
            .from(levels)
            .where(eq(levels.guildId, guildId))
            .orderBy(desc(levels.xp))
            .limit(5);

        // Case breakdown
        const caseBreakdown = await db.select({ type: cases.type, count: count() })
            .from(cases)
            .where(eq(cases.guildId, guildId))
            .groupBy(cases.type);

        const breakdown: Record<string, number> = {};
        for (const row of caseBreakdown) breakdown[row.type] = row.count;

        const memberCount = guild.memberCount;
        const botCount    = guild.members.cache.filter(m => m.user.bot).size;
        const humanCount  = memberCount - botCount;
        const onlineCount = guild.members.cache.filter(m => m.presence?.status === 'online').size;

        const topMembersText = topMembers.length > 0
            ? topMembers.map((m, i) =>
                `\`${i + 1}.\` <@${m.userId}> — Level \`${m.level}\` (\`${m.xp.toLocaleString()}\` XP)`
              ).join('\n')
            : '*No leveling data available.*';

        const caseText = Object.entries(breakdown)
            .sort((a, b) => b[1] - a[1])
            .map(([type, cnt]) => `\`${type}\`: **${cnt}**`)
            .join(' · ') || '*No cases yet.*';

        const card = new FadeContainer(Colours.FADE)
            .text(`## ${e('stats')} Server Stats — ${guild.name}`)
            .separator(true)
            .text([
                `### ${e('members')} Members`,
                `Total: \`${memberCount}\` · Humans: \`${humanCount}\` · Bots: \`${botCount}\``,
                '',
                `### ${e('shield')} Moderation`,
                `All-time actions: \`${modCount?.count ?? 0}\` · Last 30 days: \`${recentModCount?.count ?? 0}\``,
                caseText,
                '',
                `### ${e('trophy')} Top Members by Level`,
                topMembersText,
            ].join('\n'))
            .build();

        await interaction.editReply({ ...(fadeReply([card], false) as any), allowedMentions: { parse: [] } });
    },

    async prefixExecute(message, args, client) {
        const guild = message.guild!;
        const guildId = guild.id;

        const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

        const [modCount] = await db.select({ count: count() }).from(cases).where(eq(cases.guildId, guildId));
        const [recentModCount] = await db.select({ count: count() }).from(cases)
            .where(and(eq(cases.guildId, guildId), gte(cases.createdAt, thirtyDaysAgo)));

        const topMembers = await db.select({ userId: levels.userId, xp: levels.xp, level: levels.level })
            .from(levels)
            .where(eq(levels.guildId, guildId))
            .orderBy(desc(levels.xp))
            .limit(5);

        const caseBreakdown = await db.select({ type: cases.type, count: count() })
            .from(cases).where(eq(cases.guildId, guildId)).groupBy(cases.type);

        const breakdown: Record<string, number> = {};
        for (const row of caseBreakdown) breakdown[row.type] = row.count;

        const topMembersText = topMembers.length > 0
            ? topMembers.map((m, i) =>
                `\`${i + 1}.\` <@${m.userId}> — Level \`${m.level}\` (\`${m.xp.toLocaleString()}\` XP)`
              ).join('\n')
            : '*No leveling data.*';

        const caseText = Object.entries(breakdown)
            .sort((a, b) => b[1] - a[1])
            .map(([type, cnt]) => `\`${type}\`: **${cnt}**`)
            .join(' · ') || '*None yet.*';

        const card = new FadeContainer(Colours.FADE)
            .text(`## ${e('stats')} Server Stats — ${guild.name}`)
            .separator(true)
            .text([
                `### ${e('members')} Members`,
                `Total: \`${guild.memberCount}\``,
                '',
                `### ${e('shield')} Moderation`,
                `All-time: \`${modCount?.count ?? 0}\` · Last 30 days: \`${recentModCount?.count ?? 0}\``,
                caseText,
                '',
                `### ${e('trophy')} Top Members`,
                topMembersText,
            ].join('\n'))
            .build();

        await sendMessage(message, [card]);
    },
} satisfies Command;
