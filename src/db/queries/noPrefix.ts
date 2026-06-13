// src/db/queries/noPrefix.ts
import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import { noPrefixUsers } from '../schema.js';

type NoPrefixUser = typeof noPrefixUsers.$inferSelect;

const cache = new Map<string, { data: NoPrefixUser | null; expiresAt: number }>();
const TTL = 5 * 60 * 1_000; // 5 minutes

export async function getNoPrefixUser(userId: string): Promise<NoPrefixUser | null> {
    const cached = cache.get(userId);
    if (cached && cached.expiresAt > Date.now()) {
        return cached.data;
    }

    const row = await db.query.noPrefixUsers.findFirst({
        where: eq(noPrefixUsers.userId, userId),
    });

    // Check expiration
    if (row && row.expiresAt && row.expiresAt.getTime() < Date.now()) {
        await removeNoPrefixUser(userId);
        return null;
    }

    cache.set(userId, { data: row || null, expiresAt: Date.now() + TTL });
    return row || null;
}

export async function setNoPrefixUser(userId: string, expiresAt: Date | null): Promise<void> {
    const [updated] = await db.insert(noPrefixUsers)
        .values({ userId, expiresAt })
        .onConflictDoUpdate({
            target: noPrefixUsers.userId,
            set: { expiresAt },
        })
        .returning();

    cache.set(userId, { data: updated, expiresAt: Date.now() + TTL });
}

export async function removeNoPrefixUser(userId: string): Promise<void> {
    await db.delete(noPrefixUsers).where(eq(noPrefixUsers.userId, userId));
    cache.set(userId, { data: null, expiresAt: Date.now() + TTL });
}
