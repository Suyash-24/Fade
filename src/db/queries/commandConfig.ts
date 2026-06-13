import { db } from '../index.js';
import { disabledCommands, restrictedCommands } from '../schema.js';
import { eq, and, isNull } from 'drizzle-orm';

// ── Disabled Commands ──────────────────────────────────────────────────────────

export async function getDisabledCommands(guildId: string) {
    return await db.select().from(disabledCommands).where(eq(disabledCommands.guildId, guildId));
}

export async function addDisabledCommand(guildId: string, target: string, channelId: string | null) {
    try {
        await db.insert(disabledCommands).values({
            guildId,
            target,
            channelId,
        });
    } catch (e: any) {
        if (e.code !== '23505') throw e; // ignore unique constraint violation
    }
}

export async function removeDisabledCommand(guildId: string, target: string, channelId: string | null) {
    if (channelId) {
        await db.delete(disabledCommands).where(
            and(
                eq(disabledCommands.guildId, guildId),
                eq(disabledCommands.target, target),
                eq(disabledCommands.channelId, channelId)
            )
        );
    } else {
        // channelId is null (global)
        await db.delete(disabledCommands).where(
            and(
                eq(disabledCommands.guildId, guildId),
                eq(disabledCommands.target, target),
                isNull(disabledCommands.channelId)
            )
        );
    }
}

// ── Restricted Commands ────────────────────────────────────────────────────────

export async function getRestrictedCommands(guildId: string) {
    return await db.select().from(restrictedCommands).where(eq(restrictedCommands.guildId, guildId));
}

export async function addRestrictedCommand(guildId: string, target: string, type: 'role' | 'channel', entityId: string) {
    try {
        await db.insert(restrictedCommands).values({
            guildId,
            target,
            type,
            entityId,
        });
    } catch (e: any) {
        if (e.code !== '23505') throw e; // ignore unique constraint violation
    }
}

export async function removeRestrictedCommand(guildId: string, target: string, type: 'role' | 'channel', entityId: string) {
    await db.delete(restrictedCommands).where(
        and(
            eq(restrictedCommands.guildId, guildId),
            eq(restrictedCommands.target, target),
            eq(restrictedCommands.type, type),
            eq(restrictedCommands.entityId, entityId)
        )
    );
}
