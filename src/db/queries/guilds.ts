// src/db/queries/guilds.ts
// Guild config queries — used by almost every command.
// Results are cached in memory to avoid hitting Supabase on every message.
import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import { guilds } from '../schema.js';
import { logger } from '../../utils/logger.js';

type Guild = typeof guilds.$inferSelect;

// Simple in-process cache: guildId → { data, expiresAt }
const cache = new Map<string, { data: Guild; expiresAt: number }>();
const TTL = 5 * 60 * 1_000; // 5 minutes

// Get guild config, creating it if it doesn't exist
export async function getGuild(guildId: string): Promise<Guild> {
    // Check cache first
    const cached = cache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    // Try to fetch from DB
    let guild = await db.query.guilds.findFirst({
        where: eq(guilds.guildId, guildId),
    });

    // Auto-create on first encounter
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

    // Store in cache
    cache.set(guildId, { data: guild, expiresAt: Date.now() + TTL });
    return guild;
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