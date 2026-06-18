// src/db/queries/serverTag.ts
import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import { serverTagConfig } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getServerTagConfig(guildId: string) {
    return db.query.serverTagConfig.findFirst({
        where: eq(serverTagConfig.guildId, guildId),
    });
}

export async function upsertServerTagConfig(guildId: string, values: Partial<{
    roleId:    string | null;
    channelId: string | null;
    message:   string | null;
    image:     string | null;
    enabled:   boolean;
}>) {
    await ensureGuild(guildId);
    await db.insert(serverTagConfig)
        .values({ guildId, ...values })
        .onConflictDoUpdate({
            target: serverTagConfig.guildId,
            set:    { ...values, updatedAt: new Date() },
        });
}

export async function deleteServerTagConfig(guildId: string) {
    await db.delete(serverTagConfig).where(eq(serverTagConfig.guildId, guildId));
}
