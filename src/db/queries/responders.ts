// src/db/queries/responders.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { responders } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getResponders(guildId: string) {
    return db.query.responders.findMany({
        where: eq(responders.guildId, guildId),
        orderBy: (r, { asc }) => [asc(r.createdAt)],
    });
}

export async function getResponder(id: number) {
    return db.query.responders.findFirst({
        where: eq(responders.id, id),
    });
}

export async function createResponder(opts: {
    guildId:   string;
    trigger:   string;
    response:  string;
    matchType: 'contains' | 'startsWith' | 'exact';
}) {
    await ensureGuild(opts.guildId);
    const [entry] = await db.insert(responders).values({
        ...opts,
        enabled: true,
    }).returning();
    return entry;
}

export async function updateResponder(
    id: number,
    values: Partial<typeof responders.$inferInsert>,
) {
    const [updated] = await db.update(responders)
        .set(values)
        .where(eq(responders.id, id))
        .returning();
    return updated;
}

export async function deleteResponder(id: number) {
    await db.delete(responders).where(eq(responders.id, id));
}

export async function toggleResponder(id: number, enabled: boolean) {
    await db.update(responders)
        .set({ enabled })
        .where(eq(responders.id, id));
}