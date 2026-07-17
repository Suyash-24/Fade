// src/db/queries/warnThresholds.ts
import { and, eq, lte } from 'drizzle-orm';
import { db } from '../index.js';
import { warnThresholds } from '../schema.js';

export interface WarnThreshold {
    id: number;
    guildId: string;
    count: number;
    action: string;
    duration: number | null;
    reason: string | null;
}

// Get all thresholds for a guild, ordered by count
export async function getWarnThresholds(guildId: string): Promise<WarnThreshold[]> {
    return db.select()
        .from(warnThresholds)
        .where(eq(warnThresholds.guildId, guildId))
        .orderBy(warnThresholds.count) as any;
}

// Get the threshold triggered by a specific warn count (exact match)
export async function getTriggeredThreshold(guildId: string, warnCount: number): Promise<WarnThreshold | null> {
    const result = await db.select()
        .from(warnThresholds)
        .where(and(
            eq(warnThresholds.guildId, guildId),
            eq(warnThresholds.count, warnCount),
        ))
        .limit(1);
    return (result[0] as WarnThreshold | undefined) ?? null;
}

// Set a threshold (upsert by count)
export async function setWarnThreshold(
    guildId: string,
    count: number,
    action: string,
    duration?: number | null,
    reason?: string | null,
) {
    await db.insert(warnThresholds)
        .values({ guildId, count, action, duration: duration ?? null, reason: reason ?? null })
        .onConflictDoUpdate({
            target: [warnThresholds.guildId, warnThresholds.count],
            set: { action, duration: duration ?? null, reason: reason ?? null },
        });
}

// Remove a specific threshold
export async function removeWarnThreshold(guildId: string, count: number) {
    await db.delete(warnThresholds)
        .where(and(
            eq(warnThresholds.guildId, guildId),
            eq(warnThresholds.count, count),
        ));
}

// Clear all thresholds for a guild
export async function clearWarnThresholds(guildId: string) {
    await db.delete(warnThresholds).where(eq(warnThresholds.guildId, guildId));
}
