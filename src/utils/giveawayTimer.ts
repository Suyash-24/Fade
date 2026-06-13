// src/utils/giveawayTimer.ts
// Background timer that checks for expired giveaways every 15 seconds
// and concludes them automatically.
import type { FadeClient } from '../client.js';
import { getExpiredGiveaways, cleanupOldGiveaways } from '../db/queries/giveaways.js';
import { concludeGiveaway } from './giveawayUtils.js';
import { logger } from './logger.js';

export function startGiveawayTimer(client: FadeClient): void {
    // Every 15 seconds, check for expired giveaways
    setInterval(async () => {
        try {
            const expired = await getExpiredGiveaways();
            for (const giveaway of expired) {
                const guild = client.guilds.cache.get(giveaway.guildId);
                if (!guild) continue;
                await concludeGiveaway(guild, giveaway);
            }
        } catch (err) {
            logger.error('Giveaway timer failed', err);
        }
    }, 15_000); 

    // Every 1 hour, clean up giveaways older than 30 days
    setInterval(async () => {
        try {
            const deleted = await cleanupOldGiveaways();
            if (deleted > 0) {
                logger.info(`Cleaned up ${deleted} giveaways older than 30 days.`);
            }
        } catch (err) {
            logger.error('Giveaway cleanup failed', err);
        }
    }, 60 * 60 * 1000);

    logger.info('Giveaway timer started');
}