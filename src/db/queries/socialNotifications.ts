// src/db/queries/socialNotifications.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { socialNotifications } from '../schema.js';
import { ensureGuild } from './guilds.js';

export type Platform = 'youtube' | 'twitch' | 'reddit';

export async function getSocialNotifications(guildId: string, platform?: Platform) {
    return db.query.socialNotifications.findMany({
        where: platform
            ? and(eq(socialNotifications.guildId, guildId), eq(socialNotifications.platform, platform))
            : eq(socialNotifications.guildId, guildId),
        orderBy: (t, { asc }) => [asc(t.platform), asc(t.accountName)],
    });
}

export async function getAllByPlatform(platform: Platform) {
    return db.query.socialNotifications.findMany({
        where: and(eq(socialNotifications.platform, platform), eq(socialNotifications.enabled, true)),
    });
}

export async function addSocialNotification(opts: {
    guildId:     string;
    channelId:   string;
    platform:    Platform;
    accountId:   string;
    accountName: string;
    roleId?:     string;
    message?:    string;
}) {
    await ensureGuild(opts.guildId);
    const [entry] = await db.insert(socialNotifications)
        .values({ ...opts, enabled: true })
        .returning();
    return entry;
}

export async function removeSocialNotification(id: number) {
    await db.delete(socialNotifications).where(eq(socialNotifications.id, id));
}

export async function updateLastPostId(id: number, lastPostId: string) {
    await db.update(socialNotifications)
        .set({ lastPostId })
        .where(eq(socialNotifications.id, id));
}

export async function updateSocialMessage(id: number, message: string | null) {
    await db.update(socialNotifications)
        .set({ message })
        .where(eq(socialNotifications.id, id));
}
