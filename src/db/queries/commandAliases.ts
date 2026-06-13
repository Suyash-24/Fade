// src/db/queries/commandAliases.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { commandAliases } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getGuildAliases(guildId: string) {
    return db.query.commandAliases.findMany({
        where: eq(commandAliases.guildId, guildId),
        orderBy: (t, { asc }) => [asc(t.alias)],
    });
}

export async function getAlias(guildId: string, alias: string) {
    return db.query.commandAliases.findFirst({
        where: and(
            eq(commandAliases.guildId, guildId),
            eq(commandAliases.alias, alias.toLowerCase()),
        ),
    });
}

export async function createAlias(opts: {
    guildId:   string;
    alias:     string;
    command:   string;
    createdBy: string;
}) {
    await ensureGuild(opts.guildId);
    const [entry] = await db.insert(commandAliases)
        .values({ ...opts, alias: opts.alias.toLowerCase() })
        .returning();
    return entry;
}

export async function deleteAlias(id: number) {
    await db.delete(commandAliases).where(eq(commandAliases.id, id));
}

export async function deleteAliasByName(guildId: string, alias: string) {
    await db.delete(commandAliases).where(
        and(
            eq(commandAliases.guildId, guildId),
            eq(commandAliases.alias, alias.toLowerCase()),
        ),
    );
}
