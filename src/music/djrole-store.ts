// src/music/djrole-store.ts
// Isolated DJ role lookup — avoids circular imports between utils.ts and djrole.ts.
import { db } from '../db/index.js';
import { musicConfig } from '../db/schema.js';
import { eq } from 'drizzle-orm';

// Simple in-memory cache: guildId → roleId | null
// Populated by djrole.ts set/clear, read by utils.ts requireDj.
export const djRoleCache = new Map<string, string | null>();

export async function getDjRole(guildId: string): Promise<string | null> {
    if (djRoleCache.has(guildId)) {
        return djRoleCache.get(guildId) ?? null;
    }
    try {
        const row = await db.query.musicConfig.findFirst({
            where: eq(musicConfig.guildId, guildId),
            columns: { djRoleId: true },
        });
        const roleId = row?.djRoleId ?? null;
        djRoleCache.set(guildId, roleId);
        return roleId;
    } catch {
        return null;
    }
}
