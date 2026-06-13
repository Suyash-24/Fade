// src/db/queries/guildBotSettings.ts
import { db } from '../index.js';
import { guildBotSettings } from '../schema.js';
import { eq } from 'drizzle-orm';

export async function getGuildBotSettings(guildId: string) {
    const [row] = await db
        .select()
        .from(guildBotSettings)
        .where(eq(guildBotSettings.guildId, guildId));
    return row ?? null;
}

export async function upsertGuildBotBio(guildId: string, bio: string | null) {
    await db
        .insert(guildBotSettings)
        .values({ guildId, bio, updatedAt: new Date() })
        .onConflictDoUpdate({
            target: guildBotSettings.guildId,
            set: { bio, updatedAt: new Date() },
        });
}
