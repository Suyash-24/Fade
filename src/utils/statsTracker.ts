// src/utils/statsTracker.ts
import { db } from '../db/index.js';
import { guildStats, memberStats, channelStats } from '../db/schema.js';
import { sql } from 'drizzle-orm';

interface GuildDelta { messages: number; voiceSeconds: number; joins: number; leaves: number; }
interface MemberDelta { messages: number; voiceSeconds: number; }
interface ChannelDelta { messages: number; voiceSeconds: number; }

class StatsTrackerImpl {
    // Keys: `${guildId}:${date}`
    private guildQueue = new Map<string, GuildDelta>();
    
    // Keys: `${guildId}:${userId}:${date}`
    private memberQueue = new Map<string, MemberDelta>();
    
    // Keys: `${guildId}:${channelId}:${date}`
    private channelQueue = new Map<string, ChannelDelta>();
    
    // Tracking active voice sessions: userId -> { guildId, channelId, joinTime }
    private activeVoiceSessions = new Map<string, { guildId: string, channelId: string, joinTime: number }>();

    constructor() {
        // Flush to database every 60 seconds
        setInterval(() => this.flush(), 60_000);
    }

    private getDateStr(): string {
        return new Date().toISOString().split('T')[0];
    }

    public trackMessage(guildId: string, userId: string, channelId: string) {
        const date = this.getDateStr();
        
        // Guild
        const gKey = `${guildId}:${date}`;
        const gDelta = this.guildQueue.get(gKey) ?? { messages: 0, voiceSeconds: 0, joins: 0, leaves: 0 };
        gDelta.messages++;
        this.guildQueue.set(gKey, gDelta);

        // Member
        const mKey = `${guildId}:${userId}:${date}`;
        const mDelta = this.memberQueue.get(mKey) ?? { messages: 0, voiceSeconds: 0 };
        mDelta.messages++;
        this.memberQueue.set(mKey, mDelta);

        // Channel
        const cKey = `${guildId}:${channelId}:${date}`;
        const cDelta = this.channelQueue.get(cKey) ?? { messages: 0, voiceSeconds: 0 };
        cDelta.messages++;
        this.channelQueue.set(cKey, cDelta);
    }

    public trackJoinLeave(guildId: string, isJoin: boolean) {
        const date = this.getDateStr();
        const gKey = `${guildId}:${date}`;
        const gDelta = this.guildQueue.get(gKey) ?? { messages: 0, voiceSeconds: 0, joins: 0, leaves: 0 };
        if (isJoin) gDelta.joins++;
        else gDelta.leaves++;
        this.guildQueue.set(gKey, gDelta);
    }

    public voiceJoin(guildId: string, userId: string, channelId: string) {
        // If they were already in a session, finalize it first
        if (this.activeVoiceSessions.has(userId)) {
            this.voiceLeave(userId);
        }
        this.activeVoiceSessions.set(userId, { guildId, channelId, joinTime: Date.now() });
    }

    public voiceLeave(userId: string) {
        const session = this.activeVoiceSessions.get(userId);
        if (!session) return;
        this.activeVoiceSessions.delete(userId);

        const durationSeconds = Math.floor((Date.now() - session.joinTime) / 1000);
        if (durationSeconds < 1) return; // Too short to care

        const date = this.getDateStr(); // Note: if they joined yesterday, it credits today. Good enough.
        
        // Guild
        const gKey = `${session.guildId}:${date}`;
        const gDelta = this.guildQueue.get(gKey) ?? { messages: 0, voiceSeconds: 0, joins: 0, leaves: 0 };
        gDelta.voiceSeconds += durationSeconds;
        this.guildQueue.set(gKey, gDelta);

        // Member
        const mKey = `${session.guildId}:${userId}:${date}`;
        const mDelta = this.memberQueue.get(mKey) ?? { messages: 0, voiceSeconds: 0 };
        mDelta.voiceSeconds += durationSeconds;
        this.memberQueue.set(mKey, mDelta);

        // Channel
        const cKey = `${session.guildId}:${session.channelId}:${date}`;
        const cDelta = this.channelQueue.get(cKey) ?? { messages: 0, voiceSeconds: 0 };
        cDelta.voiceSeconds += durationSeconds;
        this.channelQueue.set(cKey, cDelta);
    }

    // Call this if user switches VC
    public voiceSwitch(guildId: string, userId: string, newChannelId: string) {
        this.voiceLeave(userId);
        this.voiceJoin(guildId, userId, newChannelId);
    }

    private async flush() {
        const gKeys = Array.from(this.guildQueue.keys());
        const mKeys = Array.from(this.memberQueue.keys());
        const cKeys = Array.from(this.channelQueue.keys());

        if (gKeys.length === 0 && mKeys.length === 0 && cKeys.length === 0) return;

        // Take snapshots and clear queues
        const guildSnap = new Map(this.guildQueue);
        const memberSnap = new Map(this.memberQueue);
        const channelSnap = new Map(this.channelQueue);

        this.guildQueue.clear();
        this.memberQueue.clear();
        this.channelQueue.clear();

        try {
            if (guildSnap.size > 0) {
                const values = Array.from(guildSnap.entries()).map(([k, v]) => {
                    const [guildId, date] = k.split(':');
                    return { guildId, date, messages: v.messages, voiceSeconds: v.voiceSeconds, joins: v.joins, leaves: v.leaves };
                });
                await db.insert(guildStats)
                    .values(values)
                    .onConflictDoUpdate({
                        target: [guildStats.guildId, guildStats.date],
                        set: {
                            messages: sql`${guildStats.messages} + EXCLUDED.messages`,
                            voiceSeconds: sql`${guildStats.voiceSeconds} + EXCLUDED.voice_seconds`,
                            joins: sql`${guildStats.joins} + EXCLUDED.joins`,
                            leaves: sql`${guildStats.leaves} + EXCLUDED.leaves`,
                        }
                    });
            }

            if (memberSnap.size > 0) {
                const values = Array.from(memberSnap.entries()).map(([k, v]) => {
                    const [guildId, userId, date] = k.split(':');
                    return { guildId, userId, date, messages: v.messages, voiceSeconds: v.voiceSeconds };
                });
                await db.insert(memberStats)
                    .values(values)
                    .onConflictDoUpdate({
                        target: [memberStats.guildId, memberStats.userId, memberStats.date],
                        set: {
                            messages: sql`${memberStats.messages} + EXCLUDED.messages`,
                            voiceSeconds: sql`${memberStats.voiceSeconds} + EXCLUDED.voice_seconds`,
                        }
                    });
            }

            if (channelSnap.size > 0) {
                const values = Array.from(channelSnap.entries()).map(([k, v]) => {
                    const [guildId, channelId, date] = k.split(':');
                    return { guildId, channelId, date, messages: v.messages, voiceSeconds: v.voiceSeconds };
                });
                await db.insert(channelStats)
                    .values(values)
                    .onConflictDoUpdate({
                        target: [channelStats.guildId, channelStats.channelId, channelStats.date],
                        set: {
                            messages: sql`${channelStats.messages} + EXCLUDED.messages`,
                            voiceSeconds: sql`${channelStats.voiceSeconds} + EXCLUDED.voice_seconds`,
                        }
                    });
            }
        } catch (e) {
            console.error('Failed to flush analytics stats to database:', e);
            // On failure, we could re-queue, but it's okay to drop a minute of stats in extreme cases
            // rather than risking memory leaks.
        }
    }
}

export const StatsTracker = new StatsTrackerImpl();
