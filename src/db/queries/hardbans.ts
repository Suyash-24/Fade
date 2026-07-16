// src/db/queries/hardbans.ts
import { and, eq } from 'drizzle-orm';
import { db } from '../index.js';
import { hardbans } from '../schema.js';

export async function addHardban(guildId: string, userId: string, moderatorId: string, reason: string | null = null) {
    await db.insert(hardbans)
        .values({
            guildId,
            userId,
            moderatorId,
            reason,
        })
        .onConflictDoUpdate({
            target: [hardbans.guildId, hardbans.userId],
            set: { moderatorId, reason, createdAt: new Date() },
        });
}

export async function removeHardban(guildId: string, userId: string) {
    await db.delete(hardbans)
        .where(and(eq(hardbans.guildId, guildId), eq(hardbans.userId, userId)));
}

export async function isHardbanned(guildId: string, userId: string): Promise<boolean> {
    const res = await db.select()
        .from(hardbans)
        .where(and(eq(hardbans.guildId, guildId), eq(hardbans.userId, userId)))
        .limit(1);
    
    return res.length > 0;
}
