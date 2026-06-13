// src/db/queries/timerMessages.ts
import { eq, and, lte, sql } from 'drizzle-orm';
import { db } from '../index.js';
import { timerMessages } from '../schema.js';
import { ensureGuild } from './guilds.js';

let timerMessagesSchemaReady: Promise<void> | null = null;

async function ensureTimerMessageSchema(): Promise<void> {
    if (!timerMessagesSchemaReady) {
        timerMessagesSchemaReady = (async () => {
            const result = await db.execute(sql`
                select column_name
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'timer_messages'
                  and column_name in ('last_sent', 'enabled', 'created_at')
            `) as any;

            const rows = Array.isArray(result) ? result : (result?.rows ?? []);
            const existing = new Set<string>(rows.map((row: any) => row.column_name));

            if (!existing.has('last_sent')) {
                await db.execute(sql`ALTER TABLE "timer_messages" ADD COLUMN "last_sent" timestamp with time zone`);
            }
            if (!existing.has('enabled')) {
                await db.execute(sql`ALTER TABLE "timer_messages" ADD COLUMN "enabled" boolean DEFAULT true NOT NULL`);
            }
            if (!existing.has('created_at')) {
                await db.execute(sql`ALTER TABLE "timer_messages" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL`);
            }
        })();
    }

    return timerMessagesSchemaReady;
}

export async function getTimerMessages(guildId: string) {
    await ensureTimerMessageSchema();
    return db.query.timerMessages.findMany({
        where: eq(timerMessages.guildId, guildId),
        orderBy: (t, { asc }) => [asc(t.createdAt)],
    });
}

export async function getTimerByChannel(guildId: string, channelId: string) {
    await ensureTimerMessageSchema();
    return db.query.timerMessages.findFirst({
        where: and(
            eq(timerMessages.guildId, guildId),
            eq(timerMessages.channelId, channelId),
        ),
    });
}

export async function createTimerMessage(opts: {
    guildId:   string;
    channelId: string;
    message:   string;
    interval:  number; // seconds
}) {
    await ensureTimerMessageSchema();
    await ensureGuild(opts.guildId);
    const [entry] = await db.insert(timerMessages)
        .values({ ...opts, enabled: true })
        .returning();
    return entry;
}

export async function deleteTimerMessage(guildId: string, channelId: string) {
    await ensureTimerMessageSchema();
    await db.delete(timerMessages).where(
        and(
            eq(timerMessages.guildId, guildId),
            eq(timerMessages.channelId, channelId),
        ),
    );
}

export async function getDueTimers() {
    await ensureTimerMessageSchema();
    const now = new Date();
    try {
        return await db.query.timerMessages.findMany({
            where: (t, { and, or, isNull, lte, sql }) => and(
                eq(t.enabled, true),
                or(
                    isNull(t.lastSent),
                    lte(
                        sql`${t.lastSent} + (${t.interval} * interval '1 second')`,
                        now,
                    ),
                ),
            ),
        });
    } catch {
        const all = await db.query.timerMessages.findMany({
            where: eq(timerMessages.enabled, true),
        });

        const nowMs = now.getTime();
        return all.filter((t) => {
            if (!t.lastSent) return true;
            const intervalSec = Number(t.interval);
            if (!Number.isFinite(intervalSec)) return false;
            const lastMs = t.lastSent instanceof Date
                ? t.lastSent.getTime()
                : new Date(t.lastSent as any).getTime();
            return lastMs + (intervalSec * 1000) <= nowMs;
        });
    }
}

export async function updateLastSent(id: number) {
    await ensureTimerMessageSchema();
    await db.update(timerMessages)
        .set({ lastSent: new Date() })
        .where(eq(timerMessages.id, id));
}
