// src/db/queries/vanityRoles.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { vanityConfig, vanityRoles } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getVanityConfig(guildId: string) {
    return db.query.vanityConfig.findFirst({
        where: eq(vanityConfig.guildId, guildId),
    });
}

export async function upsertVanityConfig(guildId: string, values: Partial<{
    keyword:   string;
    channelId: string | null;
    message:   string | null;
    enabled:   boolean;
}>) {
    await ensureGuild(guildId);
    await db.insert(vanityConfig)
        .values({ guildId, keyword: '', ...values })
        .onConflictDoUpdate({
            target: vanityConfig.guildId,
            set:    { ...values, updatedAt: new Date() },
        });
}

export async function getVanityRoles(guildId: string) {
    return db.query.vanityRoles.findMany({
        where: eq(vanityRoles.guildId, guildId),
    });
}

export async function addVanityRole(guildId: string, roleId: string) {
    await ensureGuild(guildId);
    await db.insert(vanityRoles).values({ guildId, roleId }).onConflictDoNothing();
}

export async function removeVanityRole(guildId: string, roleId: string) {
    await db.delete(vanityRoles).where(
        and(eq(vanityRoles.guildId, guildId), eq(vanityRoles.roleId, roleId)),
    );
}
