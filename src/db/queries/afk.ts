// src/db/queries/afk.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { afk } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getAfk(guildId: string, userId: string) {
    return db.query.afk.findFirst({
        where: and(eq(afk.guildId, guildId), eq(afk.userId, userId)),
    });
}

export async function setAfk(guildId: string, userId: string, reason: string) {
    await ensureGuild(guildId);
    await db.insert(afk)
        .values({ guildId, userId, reason })
        .onConflictDoNothing();
}

export async function clearAfk(guildId: string, userId: string) {
    await db.delete(afk).where(
        and(eq(afk.guildId, guildId), eq(afk.userId, userId)),
    );
}
