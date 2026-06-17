// src/db/queries/twentyFourSeven.ts
import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import { twentyFourSeven } from '../schema.js';

export async function get247(guildId: string) {
    const result = await db.select().from(twentyFourSeven).where(eq(twentyFourSeven.guildId, guildId)).limit(1);
    return result[0] || null;
}

export async function getAll247() {
    return await db.select().from(twentyFourSeven);
}

export async function set247(guildId: string, voiceId: string, textId: string) {
    await db.insert(twentyFourSeven).values({
        guildId,
        voiceId,
        textId,
    }).onConflictDoUpdate({
        target: twentyFourSeven.guildId,
        set: { voiceId, textId },
    });
}

export async function delete247(guildId: string) {
    await db.delete(twentyFourSeven).where(eq(twentyFourSeven.guildId, guildId));
}
