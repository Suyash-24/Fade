// src/db/queries/reactionTriggers.ts
import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import { reactionTriggers } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getReactionTriggers(guildId: string) {
    return db.query.reactionTriggers.findMany({
        where: eq(reactionTriggers.guildId, guildId),
    });
}

export async function getReactionTrigger(id: number) {
    return db.query.reactionTriggers.findFirst({
        where: eq(reactionTriggers.id, id),
    });
}

export async function createReactionTrigger(opts: {
    guildId:   string;
    trigger:   string;
    emoji:     string;
    matchType: 'contains' | 'startsWith' | 'exact';
}) {
    await ensureGuild(opts.guildId);
    const [entry] = await db.insert(reactionTriggers)
        .values({ ...opts, enabled: true })
        .returning();
    return entry;
}

export async function deleteReactionTrigger(id: number) {
    await db.delete(reactionTriggers)
        .where(eq(reactionTriggers.id, id));
}

export async function toggleReactionTrigger(id: number, enabled: boolean) {
    await db.update(reactionTriggers)
        .set({ enabled })
        .where(eq(reactionTriggers.id, id));
}