// src/utils/timerMessages.ts
// Checks for due auto messages every minute and sends them.
import type { FadeClient } from '../client.js';
import { getDueTimers, updateLastSent } from '../db/queries/timerMessages.js';
import { logger } from './logger.js';

export function startTimerMessages(client: FadeClient): void {
    setInterval(async () => {
        try {
            const due = await getDueTimers();
            for (const timer of due) {
                // Mark sent first to prevent double-fire
                await updateLastSent(timer.id);

                const channel = await client.channels.fetch(timer.channelId).catch(() => null) as any;
                if (!channel?.isTextBased()) continue;

                await channel.send({ content: timer.message }).catch(() => null);
            }
        } catch (err) {
            logger.error('Timer messages tick failed', err);
        }
    }, 60_000);

    logger.info('Timer messages started');
}
