import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../index.js';
import { scrapbookConfig, scrapbookUsers, scrapbookMessages } from '../schema.js';

export async function isScrapbookEnabled(guildId: string): Promise<boolean> {
    const config = await db.select().from(scrapbookConfig).where(eq(scrapbookConfig.guildId, guildId)).limit(1);
    return config[0]?.enabled ?? false;
}

export async function setScrapbookChannel(guildId: string, channelId: string): Promise<void> {
    await db.insert(scrapbookConfig)
        .values({ guildId, channelId, enabled: true })
        .onConflictDoUpdate({
            target: scrapbookConfig.guildId,
            set: { channelId, enabled: true }
        });
}

export async function disableScrapbook(guildId: string): Promise<void> {
    await db.update(scrapbookConfig).set({ enabled: false }).where(eq(scrapbookConfig.guildId, guildId));
}

export async function getEnabledScrapbookGuilds() {
    return await db.select().from(scrapbookConfig).where(eq(scrapbookConfig.enabled, true));
}

// Stats tracking
export async function incrementScrapbookMessageCount(guildId: string, userId: string): Promise<void> {
    const isEnabled = await isScrapbookEnabled(guildId);
    if (!isEnabled) return;

    await db.insert(scrapbookUsers)
        .values({ guildId, userId, messageCount: 1, voiceSeconds: 0 })
        .onConflictDoUpdate({
            target: [scrapbookUsers.guildId, scrapbookUsers.userId],
            set: { messageCount: sql`scrapbook_users.message_count + 1` }
        });
}

export async function addScrapbookVoiceSeconds(guildId: string, userId: string, seconds: number): Promise<void> {
    const isEnabled = await isScrapbookEnabled(guildId);
    if (!isEnabled) return;

    await db.insert(scrapbookUsers)
        .values({ guildId, userId, messageCount: 0, voiceSeconds: seconds })
        .onConflictDoUpdate({
            target: [scrapbookUsers.guildId, scrapbookUsers.userId],
            set: { voiceSeconds: sql`scrapbook_users.voice_seconds + ${seconds}` }
        });
}

export async function upsertScrapbookMessage(
    guildId: string, 
    messageId: string, 
    authorId: string, 
    content: string, 
    reactionCount: number, 
    comedyCount: number
): Promise<void> {
    const isEnabled = await isScrapbookEnabled(guildId);
    if (!isEnabled) return;

    await db.insert(scrapbookMessages)
        .values({ guildId, messageId, authorId, content, reactionCount, comedyCount })
        .onConflictDoUpdate({
            target: [scrapbookMessages.guildId, scrapbookMessages.messageId],
            set: { reactionCount, comedyCount }
        });
}

// Fetching weekly winners
export async function getScrapbookWinners(guildId: string) {
    const topChatter = await db.select()
        .from(scrapbookUsers)
        .where(eq(scrapbookUsers.guildId, guildId))
        .orderBy(desc(scrapbookUsers.messageCount))
        .limit(1);

    const topVoiceDuo = await db.select()
        .from(scrapbookUsers)
        .where(eq(scrapbookUsers.guildId, guildId))
        .orderBy(desc(scrapbookUsers.voiceSeconds))
        .limit(2);

    const topMessage = await db.select()
        .from(scrapbookMessages)
        .where(and(
            eq(scrapbookMessages.guildId, guildId),
            // ensure it's not totally blank
            sql`length(content) > 1`
        ))
        .orderBy(desc(scrapbookMessages.reactionCount))
        .limit(1);

    const funniestMessage = await db.select()
        .from(scrapbookMessages)
        .where(and(
            eq(scrapbookMessages.guildId, guildId),
            sql`length(content) > 1`
        ))
        .orderBy(desc(scrapbookMessages.comedyCount))
        .limit(1);

    return {
        topChatter: topChatter[0] ?? null,
        topVoiceDuo: topVoiceDuo.length > 0 ? topVoiceDuo : null,
        topMessage: topMessage[0] ?? null,
        funniestMessage: funniestMessage[0] ?? null,
    };
}

export async function wipeWeeklyScrapbookData(guildId: string): Promise<void> {
    await db.delete(scrapbookUsers).where(eq(scrapbookUsers.guildId, guildId));
    await db.delete(scrapbookMessages).where(eq(scrapbookMessages.guildId, guildId));
}
