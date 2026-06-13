// src/db/queries/starboard.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { starboardConfig, starboardEntries } from '../schema.js';
import { ensureGuild } from './guilds.js';

// ── Config ────────────────────────────────────────────────────────────────────

export async function getStarboardConfig(guildId: string) {
    await ensureGuild(guildId);
    let config = await db.query.starboardConfig.findFirst({
        where: eq(starboardConfig.guildId, guildId),
    });
    if (!config) {
        [config] = await db.insert(starboardConfig)
            .values({ guildId })
            .returning();
    }
    return config;
}

export async function updateStarboardConfig(
    guildId: string,
    values: Partial<typeof starboardConfig.$inferInsert>,
) {
    await db.insert(starboardConfig)
        .values({ guildId, ...values })
        .onConflictDoUpdate({
            target: starboardConfig.guildId,
            set: { ...values, updatedAt: new Date() },
        });
}

// ── Entries ───────────────────────────────────────────────────────────────────

export async function getStarboardEntry(originalId: string) {
    return db.query.starboardEntries.findFirst({
        where: eq(starboardEntries.originalId, originalId),
    });
}

export async function createStarboardEntry(opts: {
    guildId:     string;
    originalId:  string;
    starboardId: string;
    authorId:    string;
    channelId:   string;
    starCount:   number;
}) {
    const [entry] = await db.insert(starboardEntries)
        .values(opts)
        .returning();
    return entry;
}

export async function updateStarCount(originalId: string, starCount: number) {
    await db.update(starboardEntries)
        .set({ starCount })
        .where(eq(starboardEntries.originalId, originalId));
}

export async function deleteStarboardEntry(originalId: string) {
    await db.delete(starboardEntries)
        .where(eq(starboardEntries.originalId, originalId));
}