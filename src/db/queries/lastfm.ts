// src/db/queries/lastfm.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { lastfmUsers, lastfmCrowns } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getLastfmUser(userId: string) {
    return db.query.lastfmUsers.findFirst({
        where: eq(lastfmUsers.userId, userId),
    });
}

export async function setLastfmUser(userId: string, username: string) {
    await db.insert(lastfmUsers)
        .values({ userId, username })
        .onConflictDoUpdate({
            target: lastfmUsers.userId,
            set:    { username },
        });
}

export async function removeLastfmUser(userId: string) {
    await db.delete(lastfmUsers).where(eq(lastfmUsers.userId, userId));
}

export async function updateLastfmCache(userId: string, artists: { name: string; plays: number }[]) {
    await db.update(lastfmUsers)
        .set({ cachedArtists: artists, lastCached: new Date() })
        .where(eq(lastfmUsers.userId, userId));
}

export async function updateNpMode(userId: string, mode: string | null) {
    await db.update(lastfmUsers).set({ npMode: mode }).where(eq(lastfmUsers.userId, userId));
}

export async function updateNpReactions(userId: string, reactions: { upvote: string; downvote: string } | null) {
    await db.update(lastfmUsers).set({ npReactions: reactions }).where(eq(lastfmUsers.userId, userId));
}

export async function getLastfmUsersByIds(userIds: string[]) {
    if (!userIds.length) return [];
    return db.query.lastfmUsers.findMany({
        where: (t, { inArray }) => inArray(t.userId, userIds),
    });
}

// ── Crowns ────────────────────────────────────────────────────────────────────

export async function getCrown(guildId: string, artist: string) {
    return db.query.lastfmCrowns.findFirst({
        where: and(eq(lastfmCrowns.guildId, guildId), eq(lastfmCrowns.artist, artist.toLowerCase())),
    });
}

export async function upsertCrown(guildId: string, userId: string, artist: string, plays: number) {
    await ensureGuild(guildId);
    await db.insert(lastfmCrowns)
        .values({ guildId, userId, artist: artist.toLowerCase(), plays })
        .onConflictDoUpdate({
            target: [lastfmCrowns.guildId, lastfmCrowns.artist],
            set:    { userId, plays, updatedAt: new Date() },
        });
}

export async function getUserCrowns(guildId: string, userId: string) {
    return db.query.lastfmCrowns.findMany({
        where: and(eq(lastfmCrowns.guildId, guildId), eq(lastfmCrowns.userId, userId)),
        orderBy: (t, { desc }) => [desc(t.plays)],
    });
}

export async function getGuildCrowns(guildId: string) {
    return db.query.lastfmCrowns.findMany({
        where: eq(lastfmCrowns.guildId, guildId),
        orderBy: (t, { desc }) => [desc(t.plays)],
    });
}
