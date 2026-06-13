// src/db/queries/fortnite.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { fortniteShopConfig, fortniteWatches } from '../schema.js';
import { ensureGuild } from './guilds.js';

// ── Shop config ───────────────────────────────────────────────────────────────

export async function getFortniteShopConfig(guildId: string) {
    return db.query.fortniteShopConfig.findFirst({
        where: eq(fortniteShopConfig.guildId, guildId),
    });
}

export async function upsertFortniteShopConfig(guildId: string, values: Partial<{
    channelId:    string;
    roleId:       string | null;
    voting:       boolean;
    lastShopDate: string | null;
    messageId:    string | null;
}>) {
    await ensureGuild(guildId);
    await db.insert(fortniteShopConfig)
        .values({ guildId, channelId: '', ...values })
        .onConflictDoUpdate({
            target: fortniteShopConfig.guildId,
            set:    { ...values, updatedAt: new Date() },
        });
}

export async function getAllShopConfigs() {
    return db.query.fortniteShopConfig.findMany();
}

// ── Watches ───────────────────────────────────────────────────────────────────

export async function getUserWatches(userId: string) {
    return db.query.fortniteWatches.findMany({
        where: eq(fortniteWatches.userId, userId),
    });
}

export async function toggleWatch(userId: string, cosmetic: string): Promise<'added' | 'removed'> {
    const name = cosmetic.toLowerCase();
    const existing = await db.query.fortniteWatches.findFirst({
        where: and(eq(fortniteWatches.userId, userId), eq(fortniteWatches.cosmetic, name)),
    });
    if (existing) {
        await db.delete(fortniteWatches).where(eq(fortniteWatches.id, existing.id));
        return 'removed';
    }
    await db.insert(fortniteWatches).values({ userId, cosmetic: name });
    return 'added';
}

export async function getWatchersForCosmetics(names: string[]) {
    if (!names.length) return [];
    const lower = names.map(n => n.toLowerCase());
    return db.query.fortniteWatches.findMany({
        where: (t, { inArray }) => inArray(t.cosmetic, lower),
    });
}
