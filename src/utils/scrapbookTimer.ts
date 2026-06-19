import type { FadeClient } from '../client.js';
import { getScrapbookWinners, wipeAllWeeklyScrapbookData, saveScrapbookArchive } from '../db/queries/scrapbook.js';
import { ScrapbookData } from './canvas/scrapbookCard.js';
import { logger } from './logger.js';
import { flushVoiceSessions } from '../events/voiceScrapbook.js';

let lastRunDate = new Date().toDateString();

export async function processWeeklyScrapbooks(client: FadeClient) {
    logger.info('Taking weekly Scrapbook snapshots for all guilds...');
    
    // Ensure all ongoing voice sessions are synced to the database before compiling winners
    await flushVoiceSessions();

    // Loop through all guilds Fade is in
    for (const guild of client.guilds.cache.values()) {
        try {
            const winners = await getScrapbookWinners(guild.id);
            
            // Map DB winners to Canvas ScrapbookData format
            const data: ScrapbookData = {};

            if (winners.topChatter) {
                const member = await guild.members.fetch(winners.topChatter.userId).catch(() => null);
                if (member) {
                    data.topChatter = {
                        username: member.user.username,
                        avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
                        messages: winners.topChatter.messageCount
                    };
                }
            }

            if (winners.topVoiceDuo && winners.topVoiceDuo.length > 0) {
                data.topVoiceDuo = [];
                for (const u of winners.topVoiceDuo) {
                    const member = await guild.members.fetch(u.userId).catch(() => null);
                    if (member) {
                        data.topVoiceDuo.push({
                            username: member.user.username,
                            avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
                            voiceSeconds: u.voiceSeconds
                        });
                    }
                }
            }

            if (winners.topMessage) {
                const member = await guild.members.fetch(winners.topMessage.authorId).catch(() => null);
                if (member) {
                    data.topMessage = {
                        username: member.user.username,
                        avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
                        content: winners.topMessage.content,
                        reactions: winners.topMessage.reactionCount
                    };
                }
            }

            if (winners.topNightOwl && winners.topNightOwl.nightOwlCount > 0) {
                const member = await guild.members.fetch(winners.topNightOwl.userId).catch(() => null);
                if (member) {
                    data.topNightOwl = {
                        username: member.user.username,
                        avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
                        messages: winners.topNightOwl.nightOwlCount
                    };
                }
            }

            // Save the snapshot for this guild
            if (Object.keys(data).length > 0) {
                await saveScrapbookArchive(guild.id, data);
            }

        } catch (err) {
            logger.error(`Failed to process scrapbook snapshot for guild ${guild.id}`, err);
        }
    }

    // Wipe data for all guilds globally to start the next week fresh
    await wipeAllWeeklyScrapbookData();
    logger.info('Weekly Scrapbook snapshots complete. Data wiped.');
}

export function startScrapbookTimer(client: FadeClient) {
    setInterval(() => {
        const now = new Date();
        const isSunday = now.getUTCDay() === 0;
        const is12PM = now.getUTCHours() === 12;
        const is0Minute = now.getUTCMinutes() === 0;

        // Note: For testing, you could bypass this if statement manually
        if (isSunday && is12PM && is0Minute) {
            const todayStr = now.toDateString();
            if (lastRunDate !== todayStr) {
                lastRunDate = todayStr;
                processWeeklyScrapbooks(client);
            }
        }
    }, 60 * 1000); // Check every minute
    
    logger.info('Scrapbook snapshot timer started');
}
