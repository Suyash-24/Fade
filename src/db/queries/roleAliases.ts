// src/db/queries/roleAliases.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { guilds, roleAliases } from '../schema.js';

type RoleAlias = typeof roleAliases.$inferSelect;

// Cache: guildId -> { aliases: Map<alias, roleId>, expiresAt }
const aliasCache = new Map<string, { aliases: Map<string, string>; expiresAt: number }>();
// Cache: guildId -> { reqrole: string | null, expiresAt }
const reqroleCache = new Map<string, { reqrole: string | null; expiresAt: number }>();
const TTL = 5 * 60 * 1_000; // 5 mins

export async function getGuildRoleAliases(guildId: string): Promise<Map<string, string>> {
    const cached = aliasCache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) return cached.aliases;

    const rows = await db.query.roleAliases.findMany({
        where: eq(roleAliases.guildId, guildId),
    });

    const map = new Map<string, string>();
    for (const row of rows) {
        map.set(row.alias, row.roleId);
    }

    aliasCache.set(guildId, { aliases: map, expiresAt: Date.now() + TTL });
    return map;
}

export async function addRoleAlias(guildId: string, alias: string, roleId: string): Promise<void> {
    await db.insert(roleAliases)
        .values({ guildId, alias, roleId })
        .onConflictDoUpdate({
            target: [roleAliases.guildId, roleAliases.alias],
            set: { roleId }
        });
    
    // Invalidate cache
    aliasCache.delete(guildId);
}

export async function removeRoleAlias(guildId: string, alias: string): Promise<void> {
    await db.delete(roleAliases).where(
        and(eq(roleAliases.guildId, guildId), eq(roleAliases.alias, alias))
    );
    
    // Invalidate cache
    aliasCache.delete(guildId);
}

export async function getReqRole(guildId: string): Promise<string | null> {
    const cached = reqroleCache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) return cached.reqrole;

    const row = await db.query.guilds.findFirst({
        where: eq(guilds.guildId, guildId),
        columns: { reqrole: true },
    });

    const reqrole = row?.reqrole || null;
    reqroleCache.set(guildId, { reqrole, expiresAt: Date.now() + TTL });
    return reqrole;
}

export async function setReqRole(guildId: string, roleId: string | null): Promise<void> {
    await db.update(guilds)
        .set({ reqrole: roleId })
        .where(eq(guilds.guildId, guildId));
    
    // Invalidate cache
    reqroleCache.delete(guildId);
}
