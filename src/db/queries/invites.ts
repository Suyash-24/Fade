// src/db/queries/invites.ts
import { db } from '../index.js';
import { inviteStats, inviteRecords } from '../schema.js';
import { and, eq, sql, desc } from 'drizzle-orm';

// ── Get invite stats for a user ──────────────────────────────────────────────

export async function getInviteStats(guildId: string, userId: string) {
    const [result] = await db.select().from(inviteStats)
        .where(and(eq(inviteStats.guildId, guildId), eq(inviteStats.userId, userId)));

    return result ?? { regular: 0, left: 0, fake: 0, bonus: 0 };
}

export function getTotalInvites(stats: { regular: number; left: number; fake: number; bonus: number }) {
    return stats.regular - stats.left - stats.fake + stats.bonus;
}

// ── Invite leaderboard ───────────────────────────────────────────────────────

export async function getInviteLeaderboard(guildId: string, limit: number, offset = 0) {
    return db.select({
        userId: inviteStats.userId,
        regular: inviteStats.regular,
        left: inviteStats.left,
        fake: inviteStats.fake,
        bonus: inviteStats.bonus,
        total: sql<number>`(${inviteStats.regular} - ${inviteStats.left} - ${inviteStats.fake} + ${inviteStats.bonus})`.as('total'),
    })
    .from(inviteStats)
    .where(eq(inviteStats.guildId, guildId))
    .orderBy(desc(sql`(${inviteStats.regular} - ${inviteStats.left} - ${inviteStats.fake} + ${inviteStats.bonus})`))
    .limit(limit)
    .offset(offset);
}

// ── Record a new invite ──────────────────────────────────────────────────────

export async function recordInvite(
    guildId: string,
    inviterId: string,
    invitedId: string,
    code: string | null,
    isFake: boolean,
) {
    // Insert or update the invite record
    await db.insert(inviteRecords)
        .values({ guildId, inviterId, invitedId, code, fake: isFake, left: false })
        .onConflictDoUpdate({
            target: [inviteRecords.guildId, inviteRecords.invitedId],
            set: { inviterId, code, fake: isFake, left: false },
        });

    // Update aggregated stats
    const field = isFake ? 'fake' : 'regular';
    await db.insert(inviteStats)
        .values({ guildId, userId: inviterId, regular: isFake ? 0 : 1, fake: isFake ? 1 : 0, left: 0, bonus: 0 })
        .onConflictDoUpdate({
            target: [inviteStats.guildId, inviteStats.userId],
            set: { [field]: sql`${inviteStats[field]} + 1` },
        });
}

// ── Mark invite as left ──────────────────────────────────────────────────────

export async function markInviteLeft(guildId: string, invitedId: string) {
    // Find who invited this user
    const [record] = await db.select().from(inviteRecords)
        .where(and(eq(inviteRecords.guildId, guildId), eq(inviteRecords.invitedId, invitedId)));

    if (!record || record.left) return; // Already marked or no record

    // Mark record as left
    await db.update(inviteRecords)
        .set({ left: true })
        .where(eq(inviteRecords.id, record.id));

    // Increment the inviter's left count
    await db.update(inviteStats)
        .set({ left: sql`${inviteStats.left} + 1` })
        .where(and(eq(inviteStats.guildId, guildId), eq(inviteStats.userId, record.inviterId)));
}

// ── Who invited a user ───────────────────────────────────────────────────────

export async function getInviter(guildId: string, invitedId: string) {
    const [record] = await db.select().from(inviteRecords)
        .where(and(eq(inviteRecords.guildId, guildId), eq(inviteRecords.invitedId, invitedId)));

    return record ?? null;
}

// ── Who a user has invited ───────────────────────────────────────────────────

export async function getInvited(guildId: string, inviterId: string, limit = 20) {
    return db.select().from(inviteRecords)
        .where(and(eq(inviteRecords.guildId, guildId), eq(inviteRecords.inviterId, inviterId)))
        .orderBy(desc(inviteRecords.createdAt))
        .limit(limit);
}

// ── Admin: add/remove bonus invites ──────────────────────────────────────────

export async function addBonusInvites(guildId: string, userId: string, amount: number) {
    await db.insert(inviteStats)
        .values({ guildId, userId, regular: 0, left: 0, fake: 0, bonus: amount })
        .onConflictDoUpdate({
            target: [inviteStats.guildId, inviteStats.userId],
            set: { bonus: sql`${inviteStats.bonus} + ${amount}` },
        });
}

export async function removeBonusInvites(guildId: string, userId: string, amount: number) {
    await db.update(inviteStats)
        .set({ bonus: sql`GREATEST(${inviteStats.bonus} - ${amount}, 0)` })
        .where(and(eq(inviteStats.guildId, guildId), eq(inviteStats.userId, userId)));
}

// ── Admin: reset invites ─────────────────────────────────────────────────────

export async function resetInvites(guildId: string, userId?: string) {
    if (userId) {
        await db.update(inviteStats)
            .set({ regular: 0, left: 0, fake: 0, bonus: 0 })
            .where(and(eq(inviteStats.guildId, guildId), eq(inviteStats.userId, userId)));
    } else {
        await db.delete(inviteStats).where(eq(inviteStats.guildId, guildId));
        await db.delete(inviteRecords).where(eq(inviteRecords.guildId, guildId));
    }
}
