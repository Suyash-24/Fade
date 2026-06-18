import type { FadeClient } from '../client.js';
import { getEnabledScrapbookGuilds, getScrapbookWinners, wipeWeeklyScrapbookData } from '../db/queries/scrapbook.js';
import { generateScrapbookCard, ScrapbookData } from './canvas/scrapbookCard.js';
import { logger } from './logger.js';
import { AttachmentBuilder, TextChannel } from 'discord.js';

let lastRunDate = new Date().toDateString();

export async function processWeeklyScrapbooks(client: FadeClient) {
    const guilds = await getEnabledScrapbookGuilds();
    for (const conf of guilds) {
        try {
            const guild = client.guilds.cache.get(conf.guildId);
            if (!guild) continue;

            const channel = guild.channels.cache.get(conf.channelId) as TextChannel;
            if (!channel) continue;

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

            if (winners.funniestMessage) {
                const member = await guild.members.fetch(winners.funniestMessage.authorId).catch(() => null);
                if (member) {
                    data.funniestMessage = {
                        username: member.user.username,
                        avatarUrl: member.user.displayAvatarURL({ extension: 'png', size: 256 }),
                        content: winners.funniestMessage.content,
                        reactions: winners.funniestMessage.comedyCount
                    };
                }
            }

            const buffer = await generateScrapbookCard(data);
            const attachment = new AttachmentBuilder(buffer, { name: 'scrapbook.png' });

            await channel.send({
                content: '📸 **Your Weekly Server Scrapbook is here!**\nHere are the top moments, most active members, and funniest quotes from this week:',
                files: [attachment]
            });

            // Wipe data for next week
            await wipeWeeklyScrapbookData(guild.id);

        } catch (err) {
            logger.error(`Failed to process scrapbook for guild ${conf.guildId}`, err);
        }
    }
}

export function startScrapbookTimer(client: FadeClient) {
    setInterval(() => {
        const now = new Date();
        const isSunday = now.getUTCDay() === 0;
        const is12PM = now.getUTCHours() === 12;
        const is0Minute = now.getUTCMinutes() === 0;

        if (isSunday && is12PM && is0Minute) {
            const todayStr = now.toDateString();
            if (lastRunDate !== todayStr) {
                lastRunDate = todayStr;
                processWeeklyScrapbooks(client);
            }
        }
    }, 60 * 1000); // Check every minute
    
    logger.info('Scrapbook timer started');
}
