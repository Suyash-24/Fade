// src/events/ready.ts
// Place in: src/events/ready.ts
import { ActivityType } from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { registerCommands } from '../handlers/commandhandler.js';
import { startGiveawayTimer } from '../utils/giveawayTimer.js';
import { logger } from '../utils/logger.js';
import { startBumpTimer } from './bumpReminder.js';
import { startCounterTimer } from '../utils/counterUpdater.js';
import { startReminderTimer } from '../utils/reminderTimer.js';
import { startTimerMessages } from '../utils/timerMessages.js';
import { startBirthdayTimer } from '../utils/birthdayTimer.js';
import { startSocialTimer } from '../utils/socialTimer.js';
import { startFortniteTimer } from '../utils/fortniteTimer.js';
import { startGithubStatsSync } from '../utils/githubStats.js';

const event: Event<'clientReady'> = {
    name:  'clientReady',
    once:  true,

    async execute(client: FadeClient) {
        logger.success(`Fade is online`, {
            tag:    client.user?.tag ?? 'unknown',
            guilds: client.guilds.cache.size,
        });

        // Register slash commands on startup
        await registerCommands(client);

        // Start background giveaway expiry checker
        startGiveawayTimer(client);
        startBumpTimer(client);
        startCounterTimer(client);
        startReminderTimer(client);
        startTimerMessages(client);
        startBirthdayTimer(client);
        startSocialTimer(client);
        startFortniteTimer(client);
        startGithubStatsSync(client);

        // Streaming status
        const updateStatus = () => {
            const userCount = client.guilds.cache.reduce((acc, guild) => acc + guild.memberCount, 0);
            client.user?.setPresence({
                activities: [{
                    name: `${userCount.toLocaleString()} users`,
                    type: ActivityType.Streaming,
                    url: 'https://www.twitch.tv/fade',
                }],
                status: 'online',
            });
        };

        updateStatus();
        setInterval(updateStatus, 15 * 60 * 1000); // Update every 15 minutes
        // Ensure application data (including Developer Portal emojis) is fetched
        try {
            await client.application?.fetch();
            logger.debug('Fetched application data for emoji cache');
        } catch (e) {
            logger.warn('Failed to fetch application data', e as any);
        }
    },
};

export default event;