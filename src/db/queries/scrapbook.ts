import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../index.js';
import { scrapbookUsers, scrapbookMessages, scrapbookArchives } from '../schema.js';

export async function saveScrapbookArchive(guildId: string, data: any): Promise<void> {
    await db.insert(scrapbookArchives)
        .values({ guildId, snapshotData: data })
        .onConflictDoUpdate({
            target: scrapbookArchives.guildId,
            set: { snapshotData: data, createdAt: new Date() }
        });
}

export async function getLatestScrapbookArchive(guildId: string) {
    const archive = await db.select().from(scrapbookArchives).where(eq(scrapbookArchives.guildId, guildId)).limit(1);
    return archive[0]?.snapshotData ?? null;
}

export async function hasScrapbookRunToday(): Promise<boolean> {
    const latest = await db.select({ createdAt: scrapbookArchives.createdAt })
        .from(scrapbookArchives)
        .orderBy(desc(scrapbookArchives.createdAt))
        .limit(1);
    
    if (latest.length === 0) return false;
    return latest[0].createdAt.toDateString() === new Date().toDateString();
}

// Stats tracking (always on, no enable/disable checks)
export async function incrementScrapbookMessageCount(guildId: string, userId: string): Promise<void> {
    const isNightOwl = new Date().getUTCHours() >= 0 && new Date().getUTCHours() < 6;
    const nightOwlIncr = isNightOwl ? 1 : 0;

    await db.insert(scrapbookUsers)
        .values({ guildId, userId, messageCount: 1, nightOwlCount: nightOwlIncr, voiceSeconds: 0 })
        .onConflictDoUpdate({
            target: [scrapbookUsers.guildId, scrapbookUsers.userId],
            set: { 
                messageCount: sql`scrapbook_users.message_count + 1`,
                nightOwlCount: sql`scrapbook_users.night_owl_count + ${nightOwlIncr}`
            }
        });
}

export async function addScrapbookVoiceSeconds(guildId: string, userId: string, seconds: number): Promise<void> {
    await db.insert(scrapbookUsers)
        .values({ guildId, userId, messageCount: 0, nightOwlCount: 0, voiceSeconds: seconds })
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
            sql`length(content) > 1`
        ))
        .orderBy(desc(scrapbookMessages.reactionCount))
        .limit(1);

    const topNightOwl = await db.select()
        .from(scrapbookUsers)
        .where(eq(scrapbookUsers.guildId, guildId))
        .orderBy(desc(scrapbookUsers.nightOwlCount))
        .limit(1);

    return {
        topChatter: topChatter[0] ?? null,
        topVoiceDuo: topVoiceDuo.length > 0 ? topVoiceDuo : null,
        topMessage: topMessage[0] ?? null,
        topNightOwl: topNightOwl[0] ?? null,
    };
}

// Global Wiping
export async function wipeAllWeeklyScrapbookData(): Promise<void> {
    await db.delete(scrapbookUsers);
    await db.delete(scrapbookMessages);
}
