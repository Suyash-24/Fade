// src/db/queries/counters.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { counters } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getCounters(guildId: string) {
    return db.query.counters.findMany({
        where: eq(counters.guildId, guildId),
    });
}

export async function getCounter(id: number) {
    return db.query.counters.findFirst({
        where: eq(counters.id, id),
    });
}

export async function createCounter(opts: {
    guildId:   string;
    channelId: string;
    type:      string;
    template:  string;
}) {
    await ensureGuild(opts.guildId);
    const [entry] = await db.insert(counters)
        .values({ ...opts, enabled: true })
        .returning();
    return entry;
}

export async function deleteCounter(id: number) {
    await db.delete(counters).where(eq(counters.id, id));
}

export async function toggleCounter(id: number, enabled: boolean) {
    await db.update(counters)
        .set({ enabled })
        .where(eq(counters.id, id));
}