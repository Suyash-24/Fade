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
import { startScrapbookTimer } from '../utils/scrapbookTimer.js';
import { initializeVoiceSessions } from './voiceScrapbook.js';
import { getAll247 } from '../db/queries/twentyFourSeven.js';

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
        startScrapbookTimer(client);
        initializeVoiceSessions(client);

        // Resume 24/7 Voice connections
        // Status Rotation
        let toggle = false;
        
        const updateStatus = async () => {
            let version = 'v2.0.0';
            try {
                // Safely read version from package.json using fs
                const fs = await import('node:fs');
                const path = await import('node:path');
                const url = await import('node:url');
                const __dirname = url.fileURLToPath(new URL('.', import.meta.url));
                const pkgPath = path.resolve(__dirname, '../../package.json');
                const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'));
                version = `v${pkg.version}`;
            } catch {
                // Fallback
            }

            const statusText = toggle ? version : 'fadebot.me';
            toggle = !toggle;

            client.user?.setPresence({
                activities: [{
                    name: statusText,
                    type: ActivityType.Streaming,
                    url: 'https://www.twitch.tv/fade',
                }],
                status: 'online',
            });
        };

        updateStatus();
        setInterval(updateStatus, 15 * 1000); // Rotate every 15 seconds
        // Ensure application data (including Developer Portal emojis) is fetched
        try {
            await client.application?.fetch();
            logger.debug('Fetched application data for emoji cache');
        } catch (e) {
            logger.warn('Failed to fetch application data', e as any);
        }

        // ── 24/7 Voice Rejoin ──────────────────────────────────────────────────
        setTimeout(async () => {
            if (!client.music) return;
            try {
                const channels = await getAll247();
                if (channels.length === 0) return;
                
                logger.info(`[24/7] Found ${channels.length} 24/7 configurations. Rejoining...`);
                let successCount = 0;

                for (const conf of channels) {
                    try {
                        await client.music.createPlayer({
                            guildId:    conf.guildId,
                            voiceId:    conf.voiceId,
                            textId:     conf.textId,
                            deaf:       true,
                            volume:     80,
                        });
                        successCount++;
                    } catch (e) {
                        logger.error(`[24/7] Failed to rejoin ${conf.voiceId} in ${conf.guildId}`, e);
                    }
                }
                
                if (successCount > 0) {
                    logger.success(`[24/7] Successfully rejoined ${successCount}/${channels.length} channels.`);
                }
            } catch (err) {
                logger.error('[24/7] Failed to fetch 24/7 configurations on startup', err);
            }
        }, 5000); // Wait 5 seconds for Lavalink nodes to be fully connected
    },
};

export default event;