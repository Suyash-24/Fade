// src/db/queries/moderation.ts
import { eq, and, desc, count } from 'drizzle-orm';
import { db } from '../index.js';
import { cases, guilds } from '../schema.js';
import { ensureGuild } from './guilds.js';

export type CaseType = 'ban' | 'kick' | 'warn' | 'mute' | 'unmute' | 'unban' | 'timeout' | 'softban' | 'strip';

export interface CreateCaseOptions {
    guildId:      string;
    type:         CaseType;
    userId:       string;
    userTag:      string;
    moderatorId:  string;
    moderatorTag: string;
    reason?:      string;
    duration?:    number; // seconds
    expiresAt?:   Date;
}

// Get the next case number for a guild
async function nextCaseNumber(guildId: string): Promise<number> {
    const result = await db
        .select({ count: count() })
        .from(cases)
        .where(eq(cases.guildId, guildId));
    return (result[0]?.count ?? 0) + 1;
}

// Create a new moderation case
export async function createCase(opts: CreateCaseOptions) {
    await ensureGuild(opts.guildId);
    const caseNumber = await nextCaseNumber(opts.guildId);

    const [newCase] = await db.insert(cases).values({
        guildId:      opts.guildId,
        caseNumber,
        type:         opts.type,
        userId:       opts.userId,
        userTag:      opts.userTag,
        moderatorId:  opts.moderatorId,
        moderatorTag: opts.moderatorTag,
        reason:       opts.reason ?? 'No reason provided',
        duration:     opts.duration,
        expiresAt:    opts.expiresAt,
        active:       true,
    }).returning();

    return newCase;
}

// Get a specific case by number
export async function getCase(guildId: string, caseNumber: number) {
    return db.query.cases.findFirst({
        where: and(
            eq(cases.guildId, guildId),
            eq(cases.caseNumber, caseNumber),
        ),
    });
}

// Get all cases for a user in a guild
export async function getUserCases(guildId: string, userId: string) {
    return db.query.cases.findMany({
        where: and(
            eq(cases.guildId, guildId),
            eq(cases.userId, userId),
        ),
        orderBy: [desc(cases.createdAt)],
    });
}

// Get recent cases for a guild (for modhistory)
export async function getGuildCases(guildId: string, limit = 10) {
    return db.query.cases.findMany({
        where: eq(cases.guildId, guildId),
        orderBy: [desc(cases.createdAt)],
        limit,
    });
}

// Update a case reason
export async function updateCaseReason(
    guildId: string,
    caseNumber: number,
    reason: string,
) {
    const [updated] = await db.update(cases)
        .set({ reason })
        .where(and(
            eq(cases.guildId, guildId),
            eq(cases.caseNumber, caseNumber),
        ))
        .returning();
    return updated;
}

// Deactivate a case (e.g. unban deactivates ban)
export async function deactivateCase(guildId: string, caseNumber: number) {
    await db.update(cases)
        .set({ active: false })
        .where(and(
            eq(cases.guildId, guildId),
            eq(cases.caseNumber, caseNumber),
        ));
}

// Count warnings for a user
export async function getWarningCount(guildId: string, userId: string) {
    const result = await db
        .select({ count: count() })
        .from(cases)
        .where(and(
            eq(cases.guildId, guildId),
            eq(cases.userId, userId),
            eq(cases.type, 'warn'),
            eq(cases.active, true),
        ));
    return result[0]?.count ?? 0;
}

// Clear all warnings for a user
export async function clearWarnings(guildId: string, userId: string) {
    await db.update(cases)
        .set({ active: false })
        .where(and(
            eq(cases.guildId, guildId),
            eq(cases.userId, userId),
            eq(cases.type, 'warn'),
        ));
}