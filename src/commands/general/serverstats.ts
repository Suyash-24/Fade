// src/commands/general/serverstats.ts
// View server activity statistics: joins, leaves, mod actions, top members.
import { SlashCommandBuilder, MessageFlags, AttachmentBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { db } from '../../db/index.js';
import { cases, levels } from '../../db/schema.js';
import { eq, gte, count, desc, and } from 'drizzle-orm';
import { buildServerStatsCard, type ServerStatsData } from '../../utils/canvas/serverStatsCard.js';

async function fetchStatsData(guild: any, client: any): Promise<ServerStatsData> {
    const guildId = guild.id;
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

    const [modCount] = await db.select({ count: count() }).from(cases).where(eq(cases.guildId, guildId));
    const [recentModCount] = await db.select({ count: count() }).from(cases)
        .where(and(eq(cases.guildId, guildId), gte(cases.createdAt, thirtyDaysAgo)));

    const topMembersDb = await db.select({ userId: levels.userId, xp: levels.xp, level: levels.level })
        .from(levels)
        .where(eq(levels.guildId, guildId))
        .orderBy(desc(levels.xp))
        .limit(5);

    const caseBreakdown = await db.select({ type: cases.type, count: count() })
        .from(cases)
        .where(eq(cases.guildId, guildId))
        .groupBy(cases.type);

    const breakdown: Record<string, number> = {};
    for (const row of caseBreakdown) breakdown[row.type] = row.count;

    const memberCount = guild.memberCount;
    const botCount    = guild.members.cache.filter((m: any) => m.user.bot).size;
    const humanCount  = memberCount - botCount;
    const onlineCount = guild.members.cache.filter((m: any) => m.presence?.status === 'online' || m.presence?.status === 'dnd' || m.presence?.status === 'idle').size;

    const topMembers = await Promise.all(topMembersDb.map(async m => {
        const u = await client.users.fetch(m.userId).catch(() => null);
        return {
            username: u?.username ?? 'Unknown',
            avatar: u?.displayAvatarURL({ extension: 'png', size: 128 }) ?? null,
            xp: m.xp,
            level: m.level
        };
    }));

    return {
        guildName: guild.name,
        guildIcon: guild.iconURL({ extension: 'png', size: 512 }),
        memberCount,
        humanCount,
        botCount,
        onlineCount,
        modStats: {
            allTime: modCount?.count ?? 0,
            last30: recentModCount?.count ?? 0,
            breakdown
        },
        topMembers
    };
}

export default {
    data: new SlashCommandBuilder()
        .setName('serverstats')
        .setDescription('View activity statistics for this server'),

    category: 'general', guildOnly: true,
    cooldown: 15, // Using canvas is slightly more heavy, so longer cooldown is good

    async execute(interaction, client) {
        await interaction.deferReply();
        const data = await fetchStatsData(interaction.guild!, client);
        const buffer = await buildServerStatsCard(data);
        const attachment = new AttachmentBuilder(buffer, { name: 'serverstats.png' });
        await interaction.editReply({ files: [attachment] });
    },

    async prefixExecute(message, args, client) {
        const data = await fetchStatsData(message.guild!, client);
        const buffer = await buildServerStatsCard(data);
        const attachment = new AttachmentBuilder(buffer, { name: 'serverstats.png' });
        await message.reply({ files: [attachment] });
    },
} satisfies Command;
