// src/db/queries/autoroles.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { autoroles } from '../schema.js';
import { ensureGuild } from './guilds.js';

export type AutoroleType = 'human' | 'bot' | 'all';

export async function getAutoroles(guildId: string, type?: AutoroleType) {
    await ensureGuild(guildId);
    const rows = await db.query.autoroles.findMany({
        where: eq(autoroles.guildId, guildId),
    });
    if (type) return rows.filter(r => r.type === type || r.type === 'all');
    return rows;
}

export async function addAutorole(guildId: string, roleId: string, type: AutoroleType) {
    await ensureGuild(guildId);
    await db.insert(autoroles)
        .values({ guildId, roleId, type })
        .onConflictDoNothing();
}

export async function removeAutorole(guildId: string, roleId: string) {
    await db.delete(autoroles).where(
        and(eq(autoroles.guildId, guildId), eq(autoroles.roleId, roleId))
    );
}

export async function clearAutoroles(guildId: string, type?: AutoroleType) {
    if (type) {
        await db.delete(autoroles).where(
            and(eq(autoroles.guildId, guildId), eq(autoroles.type, type))
        );
    } else {
        await db.delete(autoroles).where(eq(autoroles.guildId, guildId));
    }
}
