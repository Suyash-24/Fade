// src/db/queries/webhooks.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { webhooks } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getWebhook(guildId: string, name: string) {
    return db.query.webhooks.findFirst({
        where: and(eq(webhooks.guildId, guildId), eq(webhooks.name, name.toLowerCase())),
    });
}

export async function getGuildWebhooks(guildId: string) {
    return db.query.webhooks.findMany({
        where: eq(webhooks.guildId, guildId),
        orderBy: (t, { asc }) => [asc(t.name)],
    });
}

export async function createWebhook(opts: {
    guildId:    string;
    name:       string;
    channelId:  string;
    webhookId:  string;
    webhookUrl: string;
    username?:  string;
    avatarUrl?: string;
    createdBy:  string;
}) {
    await ensureGuild(opts.guildId);
    const [entry] = await db.insert(webhooks)
        .values({ ...opts, name: opts.name.toLowerCase() })
        .returning();
    return entry;
}

export async function deleteWebhook(guildId: string, name: string) {
    await db.delete(webhooks).where(
        and(eq(webhooks.guildId, guildId), eq(webhooks.name, name.toLowerCase())),
    );
}
