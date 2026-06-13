// src/db/queries/antinuke.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { antinukeConfig, antinukeWhitelist } from '../schema.js';
import { ensureGuild } from './guilds.js';

// ── Config ────────────────────────────────────────────────────────────────────

export async function getAntinukeConfig(guildId: string) {
    await ensureGuild(guildId);
    let config = await db.query.antinukeConfig.findFirst({
        where: eq(antinukeConfig.guildId, guildId),
    });
    if (!config) {
        [config] = await db.insert(antinukeConfig)
            .values({ guildId })
            .returning();
    }
    return config;
}

export async function updateAntinukeConfig(
    guildId: string,
    values: Partial<typeof antinukeConfig.$inferInsert>,
) {
    await db.insert(antinukeConfig)
        .values({ guildId, ...values })
        .onConflictDoUpdate({
            target: antinukeConfig.guildId,
            set: { ...values, updatedAt: new Date() },
        });
}

// ── Whitelist ─────────────────────────────────────────────────────────────────

export async function getWhitelist(guildId: string) {
    return db.query.antinukeWhitelist.findMany({
        where: eq(antinukeWhitelist.guildId, guildId),
    });
}

export async function isWhitelisted(guildId: string, userId: string): Promise<boolean> {
    const entry = await db.query.antinukeWhitelist.findFirst({
        where: and(
            eq(antinukeWhitelist.guildId, guildId),
            eq(antinukeWhitelist.userId, userId),
        ),
    });
    return !!entry;
}

export async function addWhitelist(guildId: string, userId: string, addedBy: string) {
    await ensureGuild(guildId);
    await db.insert(antinukeWhitelist)
        .values({ guildId, userId, addedBy })
        .onConflictDoNothing();
}

export async function removeWhitelist(guildId: string, userId: string) {
    await db.delete(antinukeWhitelist).where(
        and(
            eq(antinukeWhitelist.guildId, guildId),
            eq(antinukeWhitelist.userId, userId),
        )
    );
}

// ── Admins ────────────────────────────────────────────────────────────────────
// Users who can configure antinuke (but are NOT whitelisted from detection)

export async function getAntinukeAdmins(guildId: string) {
    const { antinukeAdmins } = await import('../schema.js');
    return db.query.antinukeAdmins.findMany({
        where: eq(antinukeAdmins.guildId, guildId),
    });
}

export async function isAntinukeAdmin(guildId: string, userId: string): Promise<boolean> {
    const { antinukeAdmins } = await import('../schema.js');
    const entry = await db.query.antinukeAdmins.findFirst({
        where: and(
            eq(antinukeAdmins.guildId, guildId),
            eq(antinukeAdmins.userId, userId),
        ),
    });
    return !!entry;
}

export async function addAntinukeAdmin(guildId: string, userId: string, addedBy: string) {
    await ensureGuild(guildId);
    const { antinukeAdmins } = await import('../schema.js');
    await db.insert(antinukeAdmins)
        .values({ guildId, userId, addedBy })
        .onConflictDoNothing();
}

export async function removeAntinukeAdmin(guildId: string, userId: string) {
    const { antinukeAdmins } = await import('../schema.js');
    await db.delete(antinukeAdmins).where(
        and(
            eq(antinukeAdmins.guildId, guildId),
            eq(antinukeAdmins.userId, userId),
        )
    );
}