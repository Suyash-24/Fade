// src/db/queries/statsBlacklist.ts
import { db } from '../index.js';
import { statsBlacklist } from '../schema.js';
import { and, eq } from 'drizzle-orm';

export async function getBlacklist(guildId: string) {
    const records = await db.select().from(statsBlacklist).where(eq(statsBlacklist.guildId, guildId));
    return records.map(r => r.targetId);
}

export async function addToBlacklist(guildId: string, targetId: string, targetType: 'channel' | 'category') {
    await db.insert(statsBlacklist)
        .values({ guildId, targetId, targetType })
        .onConflictDoNothing();
}

export async function removeFromBlacklist(guildId: string, targetId: string) {
    await db.delete(statsBlacklist)
        .where(and(eq(statsBlacklist.guildId, guildId), eq(statsBlacklist.targetId, targetId)));
}
