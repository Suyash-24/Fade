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

        // Rotating presence
        const activities = [
            { name: 'Everything. Free.', type: ActivityType.Custom },
            { name: `${client.guilds.cache.size} servers`, type: ActivityType.Watching },
            { name: '/help', type: ActivityType.Listening },
        ];

        let i = 0;
        const rotate = () => {
            client.user?.setActivity(activities[i % activities.length]);
            i++;
        };

        rotate();
        setInterval(rotate, 15_000);
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