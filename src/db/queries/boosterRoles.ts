// src/db/queries/boosterRoles.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { boosterRoles, boosterRoleConfig } from '../schema.js';
import { ensureGuild } from './guilds.js';

// ── Config ────────────────────────────────────────────────────────────────────

export async function getBoosterConfig(guildId: string) {
    return db.query.boosterRoleConfig.findFirst({
        where: eq(boosterRoleConfig.guildId, guildId),
    });
}

export async function upsertBoosterConfig(guildId: string, values: {
    baseRoleId?:  string | null;
    awardRoleId?: string | null;
}) {
    await ensureGuild(guildId);
    await db.insert(boosterRoleConfig)
        .values({ guildId, ...values })
        .onConflictDoUpdate({
            target: boosterRoleConfig.guildId,
            set:    { ...values, updatedAt: new Date() },
        });
}

// ── Per-user roles ────────────────────────────────────────────────────────────

export async function getBoosterRole(guildId: string, userId: string) {
    return db.query.boosterRoles.findFirst({
        where: and(eq(boosterRoles.guildId, guildId), eq(boosterRoles.userId, userId)),
    });
}

export async function getAllBoosterRoles(guildId: string) {
    return db.query.boosterRoles.findMany({
        where: eq(boosterRoles.guildId, guildId),
    });
}

export async function createBoosterRole(guildId: string, userId: string, roleId: string) {
    await ensureGuild(guildId);
    const [entry] = await db.insert(boosterRoles)
        .values({ guildId, userId, roleId })
        .returning();
    return entry;
}

export async function updateBoosterRole(guildId: string, userId: string, roleId: string) {
    await db.update(boosterRoles)
        .set({ roleId })
        .where(and(eq(boosterRoles.guildId, guildId), eq(boosterRoles.userId, userId)));
}

export async function deleteBoosterRole(guildId: string, userId: string) {
    await db.delete(boosterRoles).where(
        and(eq(boosterRoles.guildId, guildId), eq(boosterRoles.userId, userId)),
    );
}
