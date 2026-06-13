// src/db/queries/leveling.ts
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../index.js';
import { levels, levelConfig, levelRewards } from '../schema.js';
import { ensureGuild } from './guilds.js';

// ── XP Math ───────────────────────────────────────────────────────────────────

// XP required to reach a given level
export function xpForLevel(level: number): number {
    return Math.floor(100 * Math.pow(level, 1.5));
}

// Total XP required to reach a given level from 0
export function totalXpForLevel(level: number): number {
    let total = 0;
    for (let i = 1; i <= level; i++) {
        total += xpForLevel(i);
    }
    return total;
}

// Calculate level from total XP
export function levelFromXp(xp: number): number {
    let level = 0;
    while (xp >= xpForLevel(level + 1)) {
        xp -= xpForLevel(level + 1);
        level++;
    }
    return level;
}

// XP progress within current level
export function xpProgress(totalXp: number): { current: number; needed: number; level: number } {
    let xp    = totalXp;
    let level = 0;
    while (xp >= xpForLevel(level + 1)) {
        xp -= xpForLevel(level + 1);
        level++;
    }
    return { current: xp, needed: xpForLevel(level + 1), level };
}

// ── Config ────────────────────────────────────────────────────────────────────

export async function getLevelConfig(guildId: string) {
    await ensureGuild(guildId);
    let config = await db.query.levelConfig.findFirst({
        where: eq(levelConfig.guildId, guildId),
    });

    if (!config) {
        [config] = await db.insert(levelConfig)
            .values({ guildId })
            .returning();
    }
    return config;
}

export async function updateLevelConfig(
    guildId: string,
    values: Partial<typeof levelConfig.$inferInsert>,
) {
    await db.insert(levelConfig)
        .values({ guildId, ...values })
        .onConflictDoUpdate({
            target: levelConfig.guildId,
            set: { ...values, updatedAt: new Date() },
        });
}

// ── User level data ───────────────────────────────────────────────────────────

export async function getUserLevel(guildId: string, userId: string) {
    await ensureGuild(guildId);
    let row = await db.query.levels.findFirst({
        where: and(eq(levels.guildId, guildId), eq(levels.userId, userId)),
    });

    if (!row) {
        [row] = await db.insert(levels)
            .values({ guildId, userId })
            .returning();
    }
    return row;
}

// Add XP — returns { oldLevel, newLevel, levelled } 
export async function addXp(
    guildId: string,
    userId: string,
    amount: number,
): Promise<{ oldLevel: number; newLevel: number; levelled: boolean; totalXp: number }> {
    const row      = await getUserLevel(guildId, userId);
    const oldLevel = row.level;
    const newXp    = row.xp + amount;
    const newLevel = levelFromXp(newXp);

    await db.update(levels)
        .set({
            xp:        newXp,
            level:     newLevel,
            messages:  row.messages + 1,
            updatedAt: new Date(),
        })
        .where(and(eq(levels.guildId, guildId), eq(levels.userId, userId)));

    return {
        oldLevel,
        newLevel,
        levelled: newLevel > oldLevel,
        totalXp:  newXp,
    };
}

export async function setXp(guildId: string, userId: string, amount: number) {
    await ensureGuild(guildId);
    const newLevel = levelFromXp(amount);
    await db.insert(levels)
        .values({ guildId, userId, xp: amount, level: newLevel })
        .onConflictDoUpdate({
            target: [levels.guildId, levels.userId],
            set: { xp: amount, level: newLevel, updatedAt: new Date() },
        });
}

export async function setLevel(guildId: string, userId: string, level: number) {
    const xp = totalXpForLevel(level);
    await setXp(guildId, userId, xp);
}

// ── Leaderboard ───────────────────────────────────────────────────────────────

export async function getLeaderboard(guildId: string, limit = 10) {
    return db.query.levels.findMany({
        where: eq(levels.guildId, guildId),
        orderBy: [desc(levels.xp)],
        limit,
    });
}

// Get a user's rank (position) on the leaderboard
// Pass memberIds (Set of current guild member IDs) to exclude users who left
export async function getUserRank(
    guildId: string,
    userId: string,
    memberIds?: Set<string>,
): Promise<number> {
    // Get all rows with more XP than this user in this guild
    const myRow = await db.query.levels.findFirst({
        where: and(eq(levels.guildId, guildId), eq(levels.userId, userId)),
    });
    if (!myRow) return 1;

    const rows = await db.select({ userId: levels.userId })
        .from(levels)
        .where(and(
            eq(levels.guildId, guildId),
            sql`${levels.xp} > ${myRow.xp}`,
        ));

    // If memberIds provided, only count users still in the guild
    const ahead = memberIds
        ? rows.filter(r => memberIds.has(r.userId))
        : rows;

    return ahead.length + 1;
}

// ── Level rewards ─────────────────────────────────────────────────────────────

export async function getLevelRewards(guildId: string) {
    return db.query.levelRewards.findMany({
        where: eq(levelRewards.guildId, guildId),
        orderBy: [desc(levelRewards.level)],
    });
}

export async function addLevelReward(guildId: string, level: number, roleId: string, remove = false) {
    await ensureGuild(guildId);
    await db.insert(levelRewards).values({ guildId, level, roleId, remove });
}

export async function removeLevelReward(guildId: string, level: number) {
    const { levelRewards: lr } = await import('../schema.js');
    await db.delete(lr).where(
        and(eq(lr.guildId, guildId), eq(lr.level, level))
    );
}

// Get rewards the user should have at their current level
export async function getEarnedRewards(guildId: string, level: number) {
    const { levelRewards: lr } = await import('../schema.js');
    const { lte } = await import('drizzle-orm');
    return db.query.levelRewards.findMany({
        where: and(
            eq(lr.guildId, guildId),
            lte(lr.level, level),
        ),
    });
}