// src/db/queries/antiraid.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { antiraidConfig, antiraidWhitelist } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getAntiraidConfig(guildId: string) {
    await ensureGuild(guildId);
    let config = await db.query.antiraidConfig.findFirst({
        where: eq(antiraidConfig.guildId, guildId),
    });
    if (!config) {
        [config] = await db.insert(antiraidConfig)
            .values({ guildId })
            .returning();
    }
    return config;
}

export async function updateAntiraidConfig(
    guildId: string,
    values: Partial<typeof antiraidConfig.$inferInsert>,
) {
    await db.insert(antiraidConfig)
        .values({ guildId, ...values })
        .onConflictDoUpdate({
            target: antiraidConfig.guildId,
            set: { ...values, updatedAt: new Date() },
        });
}

export async function getAntiraidWhitelist(guildId: string) {
    return db.query.antiraidWhitelist.findMany({
        where: eq(antiraidWhitelist.guildId, guildId),
    });
}

export async function isAntiraidWhitelisted(guildId: string, userId: string): Promise<boolean> {
    const entry = await db.query.antiraidWhitelist.findFirst({
        where: and(eq(antiraidWhitelist.guildId, guildId), eq(antiraidWhitelist.userId, userId)),
    });
    return !!entry;
}

export async function addAntiraidWhitelist(guildId: string, userId: string) {
    await ensureGuild(guildId);
    await db.insert(antiraidWhitelist).values({ guildId, userId }).onConflictDoNothing();
}

export async function removeAntiraidWhitelist(guildId: string, userId: string) {
    await db.delete(antiraidWhitelist).where(
        and(eq(antiraidWhitelist.guildId, guildId), eq(antiraidWhitelist.userId, userId)),
    );
}