// src/db/queries/stickyMessages.ts
import { and, eq, sql } from 'drizzle-orm';
import { db } from '../index.js';
import { stickyMessages } from '../schema.js';
import { ensureGuild } from './guilds.js';

let stickySchemaReady: Promise<void> | null = null;

async function ensureStickySchema(): Promise<void> {
    if (!stickySchemaReady) {
        stickySchemaReady = (async () => {
            const tableResult = await db.execute(sql`select to_regclass('public.sticky_messages') as name`) as any;
            const tableRows = Array.isArray(tableResult) ? tableResult : (tableResult?.rows ?? []);
            const tableExists = Boolean(tableRows[0]?.name);

            if (!tableExists) {
                await db.execute(sql`
                    create table "sticky_messages" (
                        "id" serial primary key not null,
                        "guild_id" text not null,
                        "channel_id" text not null,
                        "message" text not null,
                        "enabled" boolean default true not null,
                        "cooldown" integer default 30 not null,
                        "last_message_id" text,
                        "last_sent" timestamp with time zone,
                        "created_at" timestamp with time zone default now() not null,
                        "updated_at" timestamp with time zone default now() not null
                    )
                `);
                await db.execute(sql`
                    alter table "sticky_messages"
                    add constraint "sticky_messages_guild_id_guilds_guild_id_fk"
                    foreign key ("guild_id")
                    references "public"."guilds" ("guild_id")
                    on delete cascade
                `);
                return;
            }

            const colResult = await db.execute(sql`
                select column_name
                from information_schema.columns
                where table_schema = 'public'
                  and table_name = 'sticky_messages'
                  and column_name in ('enabled', 'cooldown', 'last_message_id', 'last_sent', 'created_at', 'updated_at')
            `) as any;
            const colRows = Array.isArray(colResult) ? colResult : (colResult?.rows ?? []);
            const existing = new Set<string>(colRows.map((row: any) => row.column_name));

            if (!existing.has('enabled')) {
                await db.execute(sql`alter table "sticky_messages" add column "enabled" boolean default true not null`);
            }
            if (!existing.has('cooldown')) {
                await db.execute(sql`alter table "sticky_messages" add column "cooldown" integer default 30 not null`);
            }
            if (!existing.has('last_message_id')) {
                await db.execute(sql`alter table "sticky_messages" add column "last_message_id" text`);
            }
            if (!existing.has('last_sent')) {
                await db.execute(sql`alter table "sticky_messages" add column "last_sent" timestamp with time zone`);
            }
            if (!existing.has('created_at')) {
                await db.execute(sql`alter table "sticky_messages" add column "created_at" timestamp with time zone default now() not null`);
            }
            if (!existing.has('updated_at')) {
                await db.execute(sql`alter table "sticky_messages" add column "updated_at" timestamp with time zone default now() not null`);
            }
        })();
    }

    return stickySchemaReady;
}

export async function getStickyMessages(guildId: string) {
    await ensureStickySchema();
    return db.query.stickyMessages.findMany({
        where: eq(stickyMessages.guildId, guildId),
        orderBy: (t, { asc }) => [asc(t.createdAt)],
    });
}

export async function getStickyByChannel(guildId: string, channelId: string) {
    await ensureStickySchema();
    return db.query.stickyMessages.findFirst({
        where: and(
            eq(stickyMessages.guildId, guildId),
            eq(stickyMessages.channelId, channelId),
        ),
    });
}

export async function setStickyMessage(opts: {
    guildId: string;
    channelId: string;
    message: string;
    cooldown?: number;
}) {
    await ensureStickySchema();
    await ensureGuild(opts.guildId);

    const existing = await getStickyByChannel(opts.guildId, opts.channelId);
    const values = {
        message: opts.message,
        cooldown: Math.max(5, opts.cooldown ?? 30),
        enabled: true,
        lastMessageId: null,
        lastSent: null,
        updatedAt: new Date(),
    } as const;

    if (existing) {
        const [updated] = await db.update(stickyMessages)
            .set(values)
            .where(eq(stickyMessages.id, existing.id))
            .returning();
        return updated;
    }

    const [created] = await db.insert(stickyMessages)
        .values({
            guildId: opts.guildId,
            channelId: opts.channelId,
            message: opts.message,
            cooldown: Math.max(5, opts.cooldown ?? 30),
            enabled: true,
            lastMessageId: null,
            lastSent: null,
            createdAt: new Date(),
            updatedAt: new Date(),
        })
        .returning();
    return created;
}

export async function deleteStickyMessage(guildId: string, channelId: string) {
    await ensureStickySchema();
    await db.delete(stickyMessages).where(
        and(
            eq(stickyMessages.guildId, guildId),
            eq(stickyMessages.channelId, channelId),
        ),
    );
}

export async function toggleStickyMessage(id: number, enabled: boolean) {
    await ensureStickySchema();
    await db.update(stickyMessages)
        .set({ enabled, updatedAt: new Date() })
        .where(eq(stickyMessages.id, id));
}

export async function updateStickyState(id: number, values: {
    lastMessageId?: string | null;
    lastSent?: Date | null;
}) {
    await ensureStickySchema();
    await db.update(stickyMessages)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(stickyMessages.id, id));
}
