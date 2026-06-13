// src/db/queries/bumpReminder.ts
import { eq } from 'drizzle-orm';
import { db } from '../index.js';
import { bumpReminder } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getBumpReminder(guildId: string) {
    await ensureGuild(guildId);
    let config = await db.query.bumpReminder.findFirst({
        where: eq(bumpReminder.guildId, guildId),
    });
    return config ?? null;
}

export async function updateBumpReminder(
    guildId: string,
    values: Partial<typeof bumpReminder.$inferInsert>,
) {
    await db.insert(bumpReminder)
        .values({ guildId, channelId: '', ...values })
        .onConflictDoUpdate({
            target: bumpReminder.guildId,
            set: values,
        });
}

export async function recordBump(guildId: string) {
    await db.update(bumpReminder)
        .set({ lastBump: new Date() })
        .where(eq(bumpReminder.guildId, guildId));
}

// Get all guilds due for a bump reminder (lastBump was 2h ago)
export async function getDueBumps() {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const all = await db.query.bumpReminder.findMany({
        where: eq(bumpReminder.enabled, true),
    });
    return all.filter(r =>
        r.lastBump && new Date(r.lastBump) <= twoHoursAgo && r.channelId
    );
}