// src/db/queries/automod.ts
import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import { automodConfig } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getAutomodConfig(guildId: string) {
    await ensureGuild(guildId);
    let config = await db.query.automodConfig.findFirst({
        where: eq(automodConfig.guildId, guildId),
    });
    if (!config) {
        [config] = await db.insert(automodConfig)
            .values({ guildId })
            .returning();
    }
    return config;
}

export async function updateAutomodConfig(
    guildId: string,
    values: Partial<typeof automodConfig.$inferInsert>,
) {
    await db.insert(automodConfig)
        .values({ guildId, ...values })
        .onConflictDoUpdate({
            target: automodConfig.guildId,
            set: { ...values, updatedAt: new Date() },
        });
}