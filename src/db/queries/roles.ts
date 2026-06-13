// src/db/queries/roles.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { reactionRoles, buttonRoles } from '../schema.js';
import { ensureGuild } from './guilds.js';

// ── Button roles ──────────────────────────────────────────────────────────────

export async function createButtonRole(opts: {
    guildId:   string;
    channelId: string;
    messageId: string;
    label:     string;
    roleId:    string;
    emoji?:    string;
    style?:    number;
    exclusive?: boolean;
}) {
    await ensureGuild(opts.guildId);
    const [entry] = await db.insert(buttonRoles).values({
        ...opts,
        exclusive: opts.exclusive ?? false,
    }).returning();
    return entry;
}

export async function getButtonRolesByMessage(messageId: string) {
    return db.query.buttonRoles.findMany({
        where: eq(buttonRoles.messageId, messageId),
    });
}

export async function getButtonRolesByGuild(guildId: string) {
    return db.query.buttonRoles.findMany({
        where: eq(buttonRoles.guildId, guildId),
    });
}

export async function getButtonRole(messageId: string, roleId: string) {
    return db.query.buttonRoles.findFirst({
        where: and(
            eq(buttonRoles.messageId, messageId),
            eq(buttonRoles.roleId, roleId),
        ),
    });
}

export async function deleteButtonRolesByMessage(messageId: string) {
    await db.delete(buttonRoles).where(eq(buttonRoles.messageId, messageId));
}

export async function deleteButtonRole(messageId: string, roleId: string) {
    await db.delete(buttonRoles).where(
        and(
            eq(buttonRoles.messageId, messageId),
            eq(buttonRoles.roleId, roleId),
        )
    );
}

// ── Reaction roles ────────────────────────────────────────────────────────────

export async function createReactionRole(opts: {
    guildId:   string;
    channelId: string;
    messageId: string;
    emoji:     string;
    roleId:    string;
    exclusive?: boolean;
}) {
    await ensureGuild(opts.guildId);
    const [entry] = await db.insert(reactionRoles).values({
        ...opts,
        exclusive: opts.exclusive ?? false,
    }).returning();
    return entry;
}

export async function getReactionRole(messageId: string, emoji: string) {
    return db.query.reactionRoles.findFirst({
        where: and(
            eq(reactionRoles.messageId, messageId),
            eq(reactionRoles.emoji, emoji),
        ),
    });
}

export async function getReactionRolesByMessage(messageId: string) {
    return db.query.reactionRoles.findMany({
        where: eq(reactionRoles.messageId, messageId),
    });
}

export async function getReactionRolesByGuild(guildId: string) {
    return db.query.reactionRoles.findMany({
        where: eq(reactionRoles.guildId, guildId),
    });
}

export async function deleteReactionRole(messageId: string, emoji: string) {
    await db.delete(reactionRoles).where(
        and(
            eq(reactionRoles.messageId, messageId),
            eq(reactionRoles.emoji, emoji),
        )
    );
}