// src/db/queries/reputation.ts
import { eq, and, sql } from 'drizzle-orm';
import { db } from '../index.js';
import { reputation, repCooldowns } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getReputation(guildId: string, userId: string) {
    const result = await db.query.reputation.findFirst({
        where: and(eq(reputation.guildId, guildId), eq(reputation.userId, userId)),
    });
    
    if (result) return result;
    
    return {
        guildId,
        userId,
        helperRep: 0,
        developerRep: 0,
        artistRep: 0,
        trustedRep: 0,
    };
}

export async function addReputation(guildId: string, userId: string, type: 'helper' | 'developer' | 'artist' | 'trusted', amount: number) {
    await ensureGuild(guildId);
    
    const setQuery: any = { updatedAt: new Date() };
    if (type === 'helper') setQuery.helperRep = sql`${reputation.helperRep} + ${amount}`;
    if (type === 'developer') setQuery.developerRep = sql`${reputation.developerRep} + ${amount}`;
    if (type === 'artist') setQuery.artistRep = sql`${reputation.artistRep} + ${amount}`;
    if (type === 'trusted') setQuery.trustedRep = sql`${reputation.trustedRep} + ${amount}`;

    await db.insert(reputation).values({
        guildId,
        userId,
        helperRep: type === 'helper' ? amount : 0,
        developerRep: type === 'developer' ? amount : 0,
        artistRep: type === 'artist' ? amount : 0,
        trustedRep: type === 'trusted' ? amount : 0,
    }).onConflictDoUpdate({
        target: [reputation.guildId, reputation.userId],
        set: setQuery,
    });
}

export async function getRepCooldown(guildId: string, giverId: string) {
    const result = await db.query.repCooldowns.findFirst({
        where: and(eq(repCooldowns.guildId, guildId), eq(repCooldowns.giverId, giverId)),
    });
    return result?.lastThank ?? null;
}

export async function setRepCooldown(guildId: string, giverId: string) {
    await ensureGuild(guildId);
    await db.insert(repCooldowns).values({
        guildId,
        giverId,
        lastThank: new Date(),
    }).onConflictDoUpdate({
        target: [repCooldowns.guildId, repCooldowns.giverId],
        set: { lastThank: new Date() },
    });
}
