import type { Event } from '../types/event.js';
import type { FadeClient } from '../client.js';
import { addScrapbookVoiceSeconds } from '../db/queries/scrapbook.js';

// Tracks when a user joined a VC: "guildId:userId" -> timestamp
const voiceSessions = new Map<string, number>();

export const scrapbookVoiceTracking: Event<'voiceStateUpdate'> = {
    name: 'voiceStateUpdate',
    async execute(client: FadeClient, oldState, newState) {
        if (oldState.member?.user.bot) return;

        const guildId = oldState.guild.id;
        const userId = oldState.member!.id;
        const sessionKey = `${guildId}:${userId}`;

        // Joined a VC
        if (!oldState.channelId && newState.channelId) {
            voiceSessions.set(sessionKey, Date.now());
            return;
        }

        // Left a VC
        if (oldState.channelId && !newState.channelId) {
            const joinTime = voiceSessions.get(sessionKey);
            if (joinTime) {
                const seconds = Math.floor((Date.now() - joinTime) / 1000);
                voiceSessions.delete(sessionKey);
                if (seconds > 0) {
                    await addScrapbookVoiceSeconds(guildId, userId, seconds).catch(() => null);
                }
            }
            return;
        }

        // Switched VC - treat as continuous, but we could also split sessions
        // If they switch, we can just leave the timer running since it's the same guild.
    },
};

// Initialize sessions for users already in VC when bot boots up
export function initializeVoiceSessions(client: FadeClient) {
    const now = Date.now();
    for (const guild of client.guilds.cache.values()) {
        for (const [userId, voiceState] of guild.voiceStates.cache) {
            if (voiceState.channelId && !voiceState.member?.user.bot) {
                voiceSessions.set(`${guild.id}:${userId}`, now);
            }
        }
    }
}

// Flushes the ongoing voice sessions to the database (called before snapshots)
export async function flushVoiceSessions() {
    const now = Date.now();
    for (const [sessionKey, joinTime] of voiceSessions.entries()) {
        const seconds = Math.floor((now - joinTime) / 1000);
        if (seconds > 0) {
            const [guildId, userId] = sessionKey.split(':');
            await addScrapbookVoiceSeconds(guildId, userId, seconds).catch(() => null);
            voiceSessions.set(sessionKey, now); // Reset timer
        }
    }
}

export default scrapbookVoiceTracking;
