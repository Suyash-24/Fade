// src/db/queries/giveaways.ts
import { eq, and, lte, sql } from 'drizzle-orm';
import { db } from '../index.js';
import { giveaways, giveawayEntries } from '../schema.js';
import { ensureGuild } from './guilds.js';

// ── Giveaways ─────────────────────────────────────────────────────────────────

let giveawaySchemaReady: Promise<void> | null = null;

async function ensureGiveawaySchema(): Promise<void> {
    if (!giveawaySchemaReady) {
        giveawaySchemaReady = (async () => {
            const result = await db.execute(sql`
                select column_name
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'giveaways'
                  and column_name in ('required_roles', 'description', 'thumbnail', 'image')
            `) as any;

            const rows = Array.isArray(result) ? result : (result?.rows ?? []);
            const existing = new Set<string>(rows.map((row: any) => row.column_name));

            if (!existing.has('required_roles')) {
                await db.execute(sql`ALTER TABLE "giveaways" ADD COLUMN "required_roles" jsonb DEFAULT '[]'::jsonb NOT NULL`);
            }

            if (!existing.has('description')) {
                await db.execute(sql`ALTER TABLE "giveaways" ADD COLUMN "description" text`);
            }
            if (!existing.has('thumbnail')) {
                await db.execute(sql`ALTER TABLE "giveaways" ADD COLUMN "thumbnail" text`);
            }
            if (!existing.has('image')) {
                await db.execute(sql`ALTER TABLE "giveaways" ADD COLUMN "image" text`);
            }
        })();
    }

    return giveawaySchemaReady;
}

export async function createGiveaway(opts: {
    guildId:      string;
    channelId:    string;
    hostId:       string;
    prize:        string;
    winnerCount:  number;
    endsAt:       Date;
    requiredRole?: string;
    minLevel?:    number;
    description?: string | null;
    image?:       string | null;
}) {
    await ensureGiveawaySchema();
    await ensureGuild(opts.guildId);
    const [giveaway] = await db.insert(giveaways).values({
        guildId:      opts.guildId,
        channelId:    opts.channelId,
        hostId:       opts.hostId,
        prize:        opts.prize,
        winnerCount:  opts.winnerCount,
        endsAt:       opts.endsAt,
        requiredRole: opts.requiredRole,
        minLevel:     opts.minLevel ?? 0,
        description:  opts.description,
        image:        opts.image,
        status:       'active',
    }).returning();
    return giveaway;
}

export async function updateGiveawayMessage(id: number, messageId: string) {
    await ensureGiveawaySchema();
    await db.update(giveaways).set({ messageId }).where(eq(giveaways.id, id));
}

export async function updateGiveaway(id: number, values: Partial<typeof giveaways.$inferInsert>) {
    await ensureGiveawaySchema();
    await db.update(giveaways).set(values).where(eq(giveaways.id, id));
}

export async function getAllGiveaways(guildId: string) {
    await ensureGiveawaySchema();
    return db.query.giveaways.findMany({
        where: eq(giveaways.guildId, guildId),
        orderBy: (t, { desc }) => [desc(t.createdAt)],
        limit: 20,
    });
}

export async function getGiveaway(id: number) {
    await ensureGiveawaySchema();
    return db.query.giveaways.findFirst({ where: eq(giveaways.id, id) });
}

export async function getGiveawayByMessage(messageId: string) {
    await ensureGiveawaySchema();
    return db.query.giveaways.findFirst({ where: eq(giveaways.messageId, messageId) });
}

export async function getActiveGiveaways(guildId: string) {
    await ensureGiveawaySchema();
    return db.query.giveaways.findMany({
        where: and(eq(giveaways.guildId, guildId), eq(giveaways.status, 'active')),
    });
}

export async function getExpiredGiveaways() {
    await ensureGiveawaySchema();
    return db.query.giveaways.findMany({
        where: and(
            eq(giveaways.status, 'active'),
            lte(giveaways.endsAt, new Date()),
        ),
    });
}

export async function endGiveaway(id: number) {
    await ensureGiveawaySchema();
    await db.update(giveaways).set({ status: 'ended' }).where(eq(giveaways.id, id));
}

export async function cancelGiveaway(id: number) {
    await ensureGiveawaySchema();
    await db.update(giveaways).set({ status: 'cancelled' }).where(eq(giveaways.id, id));
}

// ── Entries ───────────────────────────────────────────────────────────────────

export async function enterGiveaway(giveawayId: number, userId: string) {
    await ensureGiveawaySchema();
    // Returns false if already entered
    const existing = await db.query.giveawayEntries.findFirst({
        where: and(
            eq(giveawayEntries.giveawayId, giveawayId),
            eq(giveawayEntries.userId, userId),
        ),
    });
    if (existing) return false;

    await db.insert(giveawayEntries).values({ giveawayId, userId });
    return true;
}

export async function leaveGiveaway(giveawayId: number, userId: string) {
    await ensureGiveawaySchema();
    await db.delete(giveawayEntries).where(
        and(
            eq(giveawayEntries.giveawayId, giveawayId),
            eq(giveawayEntries.userId, userId),
        )
    );
}

export async function getEntries(giveawayId: number) {
    await ensureGiveawaySchema();
    return db.query.giveawayEntries.findMany({
        where: eq(giveawayEntries.giveawayId, giveawayId),
    });
}

export async function getEntryCount(giveawayId: number): Promise<number> {
    await ensureGiveawaySchema();
    const entries = await getEntries(giveawayId);
    return entries.length;
}

export async function isEntered(giveawayId: number, userId: string): Promise<boolean> {
    await ensureGiveawaySchema();
    const entry = await db.query.giveawayEntries.findFirst({
        where: and(
            eq(giveawayEntries.giveawayId, giveawayId),
            eq(giveawayEntries.userId, userId),
        ),
    });
    return !!entry;
}

// Pick random winners from entries
export async function pickWinners(giveawayId: number, count: number): Promise<string[]> {
    await ensureGiveawaySchema();
    const entries = await getEntries(giveawayId);
    if (!entries.length) return [];

    // Fisher-Yates shuffle
    const shuffled = [...entries].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(count, shuffled.length)).map(e => e.userId);
}

export async function cleanupOldGiveaways(): Promise<number> {
    await ensureGiveawaySchema();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const deleted = await db.delete(giveaways).where(
        and(
            eq(giveaways.status, 'ended'),
            lte(giveaways.endsAt, thirtyDaysAgo)
        )
    ).returning();
    return deleted.length;
}