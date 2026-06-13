// src/db/queries/welcome.ts
import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import { welcomeConfig, goodbyeConfig } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getWelcomeConfig(guildId: string) {
    await ensureGuild(guildId);
    let config = await db.query.welcomeConfig.findFirst({
        where: eq(welcomeConfig.guildId, guildId),
    });
    if (!config) {
        [config] = await db.insert(welcomeConfig)
            .values({ guildId })
            .returning();
    }
    return config;
}

export async function updateWelcomeConfig(
    guildId: string,
    values: Partial<typeof welcomeConfig.$inferInsert>,
) {
    await db.insert(welcomeConfig)
        .values({ guildId, ...values })
        .onConflictDoUpdate({
            target: welcomeConfig.guildId,
            set: { ...values, updatedAt: new Date() },
        });
}

export async function getGoodbyeConfig(guildId: string) {
    await ensureGuild(guildId);
    let config = await db.query.goodbyeConfig.findFirst({
        where: eq(goodbyeConfig.guildId, guildId),
    });
    if (!config) {
        [config] = await db.insert(goodbyeConfig)
            .values({ guildId })
            .returning();
    }
    return config;
}

export async function updateGoodbyeConfig(
    guildId: string,
    values: Partial<typeof goodbyeConfig.$inferInsert>,
) {
    await db.insert(goodbyeConfig)
        .values({ guildId, ...values })
        .onConflictDoUpdate({
            target: goodbyeConfig.guildId,
            set: { ...values, updatedAt: new Date() },
        });
}