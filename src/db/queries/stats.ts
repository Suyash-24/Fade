// src/db/queries/stats.ts
import { db } from '../index.js';
import { memberStats, channelStats, guildStats } from '../schema.js';
import { and, eq, gte, sql, desc } from 'drizzle-orm';

// ── Timeframe helpers ────────────────────────────────────────────────────────

export type Timeframe = 'today' | 'daily' | 'weekly' | 'monthly' | 'alltime';

function getDateCutoff(timeframe: Timeframe): string | null {
    const now = new Date();
    switch (timeframe) {
        case 'today':
        case 'daily':
            return now.toISOString().split('T')[0];
        case 'weekly':
            return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        case 'monthly':
            return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        case 'alltime':
            return null;
    }
}

// ── User Stats ───────────────────────────────────────────────────────────────

export async function getUserMessages(guildId: string, userId: string, timeframe: Timeframe): Promise<number> {
    const cutoff = getDateCutoff(timeframe);
    const conditions = [eq(memberStats.guildId, guildId), eq(memberStats.userId, userId)];
    if (cutoff) conditions.push(gte(memberStats.date, cutoff));

    const [result] = await db.select({
        total: sql<number>`coalesce(sum(${memberStats.messages}), 0)::int`,
    }).from(memberStats).where(and(...conditions));

    return result?.total ?? 0;
}

export async function getUserVoiceSeconds(guildId: string, userId: string, timeframe: Timeframe): Promise<number> {
    const cutoff = getDateCutoff(timeframe);
    const conditions = [eq(memberStats.guildId, guildId), eq(memberStats.userId, userId)];
    if (cutoff) conditions.push(gte(memberStats.date, cutoff));

    const [result] = await db.select({
        total: sql<number>`coalesce(sum(${memberStats.voiceSeconds}), 0)::int`,
    }).from(memberStats).where(and(...conditions));

    return result?.total ?? 0;
}

export async function getUserStats(guildId: string, userId: string, timeframe: Timeframe) {
    const cutoff = getDateCutoff(timeframe);
    const conditions = [eq(memberStats.guildId, guildId), eq(memberStats.userId, userId)];
    if (cutoff) conditions.push(gte(memberStats.date, cutoff));

    const [result] = await db.select({
        messages: sql<number>`coalesce(sum(${memberStats.messages}), 0)::int`,
        voiceSeconds: sql<number>`coalesce(sum(${memberStats.voiceSeconds}), 0)::int`,
    }).from(memberStats).where(and(...conditions));

    return { messages: result?.messages ?? 0, voiceSeconds: result?.voiceSeconds ?? 0 };
}

// ── Channel Stats ────────────────────────────────────────────────────────────

export async function getChannelActivity(guildId: string, channelId: string, timeframe: Timeframe) {
    const cutoff = getDateCutoff(timeframe);
    const conditions = [eq(channelStats.guildId, guildId), eq(channelStats.channelId, channelId)];
    if (cutoff) conditions.push(gte(channelStats.date, cutoff));

    const [result] = await db.select({
        messages: sql<number>`coalesce(sum(${channelStats.messages}), 0)::int`,
        voiceSeconds: sql<number>`coalesce(sum(${channelStats.voiceSeconds}), 0)::int`,
    }).from(channelStats).where(and(...conditions));

    return { messages: result?.messages ?? 0, voiceSeconds: result?.voiceSeconds ?? 0 };
}

// ── Leaderboards ─────────────────────────────────────────────────────────────

export async function getMessageLeaderboard(guildId: string, timeframe: Timeframe, limit: number, offset = 0) {
    const cutoff = getDateCutoff(timeframe);
    const conditions = [eq(memberStats.guildId, guildId)];
    if (cutoff) conditions.push(gte(memberStats.date, cutoff));

    return db.select({
        userId: memberStats.userId,
        total: sql<number>`coalesce(sum(${memberStats.messages}), 0)::int`,
    })
    .from(memberStats)
    .where(and(...conditions))
    .groupBy(memberStats.userId)
    .having(sql`sum(${memberStats.messages}) > 0`)
    .orderBy(desc(sql`sum(${memberStats.messages})`))
    .limit(limit)
    .offset(offset);
}

export async function getVoiceLeaderboard(guildId: string, timeframe: Timeframe, limit: number, offset = 0) {
    const cutoff = getDateCutoff(timeframe);
    const conditions = [eq(memberStats.guildId, guildId)];
    if (cutoff) conditions.push(gte(memberStats.date, cutoff));

    return db.select({
        userId: memberStats.userId,
        total: sql<number>`coalesce(sum(${memberStats.voiceSeconds}), 0)::int`,
    })
    .from(memberStats)
    .where(and(...conditions))
    .groupBy(memberStats.userId)
    .having(sql`sum(${memberStats.voiceSeconds}) > 0`)
    .orderBy(desc(sql`sum(${memberStats.voiceSeconds})`))
    .limit(limit)
    .offset(offset);
}

// ── Admin Management ─────────────────────────────────────────────────────────

export async function addUserMessages(guildId: string, userId: string, amount: number) {
    const date = new Date().toISOString().split('T')[0];
    await db.insert(memberStats)
        .values({ guildId, userId, date, messages: amount, voiceSeconds: 0 })
        .onConflictDoUpdate({
            target: [memberStats.guildId, memberStats.userId, memberStats.date],
            set: { messages: sql`${memberStats.messages} + ${amount}` },
        });
}

export async function removeUserMessages(guildId: string, userId: string, amount: number) {
    const date = new Date().toISOString().split('T')[0];
    // We subtract from today's entry; if not enough, it'll go to 0 via GREATEST
    await db.insert(memberStats)
        .values({ guildId, userId, date, messages: 0, voiceSeconds: 0 })
        .onConflictDoUpdate({
            target: [memberStats.guildId, memberStats.userId, memberStats.date],
            set: { messages: sql`GREATEST(${memberStats.messages} - ${amount}, 0)` },
        });
}

export async function addUserVoiceSeconds(guildId: string, userId: string, seconds: number) {
    const date = new Date().toISOString().split('T')[0];
    await db.insert(memberStats)
        .values({ guildId, userId, date, messages: 0, voiceSeconds: seconds })
        .onConflictDoUpdate({
            target: [memberStats.guildId, memberStats.userId, memberStats.date],
            set: { voiceSeconds: sql`${memberStats.voiceSeconds} + ${seconds}` },
        });
}

export async function removeUserVoiceSeconds(guildId: string, userId: string, seconds: number) {
    const date = new Date().toISOString().split('T')[0];
    await db.insert(memberStats)
        .values({ guildId, userId, date, messages: 0, voiceSeconds: 0 })
        .onConflictDoUpdate({
            target: [memberStats.guildId, memberStats.userId, memberStats.date],
            set: { voiceSeconds: sql`GREATEST(${memberStats.voiceSeconds} - ${seconds}, 0)` },
        });
}

export async function resetUserMessages(guildId: string, userId?: string) {
    if (userId) {
        await db.update(memberStats)
            .set({ messages: 0 })
            .where(and(eq(memberStats.guildId, guildId), eq(memberStats.userId, userId)));
    } else {
        await db.update(memberStats)
            .set({ messages: 0 })
            .where(eq(memberStats.guildId, guildId));
    }
}

export async function resetUserVoice(guildId: string, userId?: string) {
    if (userId) {
        await db.update(memberStats)
            .set({ voiceSeconds: 0 })
            .where(and(eq(memberStats.guildId, guildId), eq(memberStats.userId, userId)));
    } else {
        await db.update(memberStats)
            .set({ voiceSeconds: 0 })
            .where(eq(memberStats.guildId, guildId));
    }
}

// ── Server-wide totals ──────────────────────────────────────────────────────

export async function getServerTotals(guildId: string, timeframe: Timeframe) {
    const cutoff = getDateCutoff(timeframe);
    const conditions = [eq(guildStats.guildId, guildId)];
    if (cutoff) conditions.push(gte(guildStats.date, cutoff));

    const [result] = await db.select({
        messages: sql<number>`coalesce(sum(${guildStats.messages}), 0)::int`,
        voiceSeconds: sql<number>`coalesce(sum(${guildStats.voiceSeconds}), 0)::int`,
        joins: sql<number>`coalesce(sum(${guildStats.joins}), 0)::int`,
        leaves: sql<number>`coalesce(sum(${guildStats.leaves}), 0)::int`,
    }).from(guildStats).where(and(...conditions));

    return {
        messages: result?.messages ?? 0,
        voiceSeconds: result?.voiceSeconds ?? 0,
        joins: result?.joins ?? 0,
        leaves: result?.leaves ?? 0,
    };
}

// ── User rank ────────────────────────────────────────────────────────────────

export async function getUserMessageRank(guildId: string, userId: string, timeframe: Timeframe): Promise<number> {
    const cutoff = getDateCutoff(timeframe);
    const conditions = cutoff
        ? sql`guild_id = ${guildId} AND date >= ${cutoff}`
        : sql`guild_id = ${guildId}`;

    const [result] = await db.execute(sql`
        SELECT rank FROM (
            SELECT user_id, RANK() OVER (ORDER BY sum(messages) DESC) as rank
            FROM member_stats WHERE ${conditions}
            GROUP BY user_id
            HAVING sum(messages) > 0
        ) ranked WHERE user_id = ${userId}
    `);

    return (result as any)?.rank ?? 0;
}

export async function getUserVoiceRank(guildId: string, userId: string, timeframe: Timeframe): Promise<number> {
    const cutoff = getDateCutoff(timeframe);
    const conditions = cutoff
        ? sql`guild_id = ${guildId} AND date >= ${cutoff}`
        : sql`guild_id = ${guildId}`;

    const [result] = await db.execute(sql`
        SELECT rank FROM (
            SELECT user_id, RANK() OVER (ORDER BY sum(voice_seconds) DESC) as rank
            FROM member_stats WHERE ${conditions}
            GROUP BY user_id
            HAVING sum(voice_seconds) > 0
        ) ranked WHERE user_id = ${userId}
    `);

    return (result as any)?.rank ?? 0;
}
