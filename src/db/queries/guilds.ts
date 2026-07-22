// src/db/queries/guilds.ts
// Guild config queries — used by almost every command.
// Results are cached in memory to avoid hitting Supabase on every message.
import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import { guilds } from '../schema.js';
import { logger } from '../../utils/logger.js';

type Guild = typeof guilds.$inferSelect;

// Simple in-process cache: guildId → Promise<{ data, expiresAt }>
const cache = new Map<string, Promise<{ data: Guild; expiresAt: number }>>();
const TTL = 5 * 60 * 1_000; // 5 minutes

// Get guild config, creating it if it doesn't exist
export function getGuild(guildId: string): Promise<Guild> {
    const hit = cache.get(guildId);
    if (hit) {
        return hit.then(entry => {
            if (entry.expiresAt > Date.now()) return entry.data;
            return fetchAndCacheGuild(guildId);
        });
    }
    return fetchAndCacheGuild(guildId);
}

async function fetchAndCacheGuild(guildId: string): Promise<Guild> {
    const promise = (async () => {
        let guild = await db.query.guilds.findFirst({
            where: eq(guilds.guildId, guildId),
        });

        if (!guild) {
            [guild] = await db.insert(guilds)
                .values({ guildId })
                .onConflictDoNothing()
                .returning();

            if (!guild) {
                guild = (await db.query.guilds.findFirst({
                    where: eq(guilds.guildId, guildId),
                }))!;
            }
            logger.debug('Created guild config', { guildId });
        }
        return { data: guild, expiresAt: Date.now() + TTL };
    })();

    promise.catch(err => cache.delete(guildId));
    cache.set(guildId, promise);
    return (await promise).data;
}

// Update guild config and invalidate cache
export async function updateGuild(
    guildId: string,
    values: Partial<Omit<Guild, 'guildId' | 'createdAt'>>,
): Promise<Guild> {
    const [updated] = await db.update(guilds)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(guilds.guildId, guildId))
        .returning();

    // Invalidate cache
    cache.delete(guildId);
    return updated;
}

// Get just the prefix (hot path — called on every message)
export async function getPrefix(guildId: string): Promise<string> {
    const guild = await getGuild(guildId);
    return guild.prefix;
}

// Called when bot joins a guild
export async function ensureGuild(guildId: string): Promise<void> {
    await getGuild(guildId);
}

// Called when bot leaves a guild — keeps data but marks as inactive
export async function invalidateGuildCache(guildId: string): Promise<void> {
    cache.delete(guildId);
}