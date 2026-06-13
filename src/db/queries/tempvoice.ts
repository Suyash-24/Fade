// src/db/queries/tempvoice.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { voicemasterConfig, tempVoiceChannels } from '../schema.js';
import { ensureGuild } from './guilds.js';

// ── Config ────────────────────────────────────────────────────────────────────

export async function getTempVoiceConfig(guildId: string) {
    await ensureGuild(guildId);
    let config = await db.query.voicemasterConfig.findFirst({
        where: eq(voicemasterConfig.guildId, guildId),
    });
    if (!config) {
        [config] = await db.insert(voicemasterConfig)
            .values({ guildId })
            .returning();
    }
    return config;
}

export async function updateTempVoiceConfig(
    guildId: string,
    values: Partial<typeof voicemasterConfig.$inferInsert>,
) {
    await db.insert(voicemasterConfig)
        .values({ guildId, ...values })
        .onConflictDoUpdate({
            target: voicemasterConfig.guildId,
            set: { ...values, updatedAt: new Date() },
        });
}

// ── Temp channels ─────────────────────────────────────────────────────────────

export async function registerTempChannel(channelId: string, guildId: string, ownerId: string) {
    await db.insert(tempVoiceChannels)
        .values({ channelId, guildId, ownerId })
        .onConflictDoNothing();
}

export async function getTempChannel(channelId: string) {
    return db.query.tempVoiceChannels.findFirst({
        where: eq(tempVoiceChannels.channelId, channelId),
    });
}

export async function getOwnerChannel(guildId: string, ownerId: string) {
    return db.query.tempVoiceChannels.findFirst({
        where: and(
            eq(tempVoiceChannels.guildId, guildId),
            eq(tempVoiceChannels.ownerId, ownerId),
        ),
    });
}

export async function deleteTempChannel(channelId: string) {
    await db.delete(tempVoiceChannels)
        .where(eq(tempVoiceChannels.channelId, channelId));
}

export async function transferOwnership(channelId: string, newOwnerId: string) {
    await db.update(tempVoiceChannels)
        .set({ ownerId: newOwnerId })
        .where(eq(tempVoiceChannels.channelId, channelId));
}