// src/events/voiceStateUpdate.ts
import type { Event } from '../types/event.js';
import type { FadeClient } from '../client.js';
import { get247 } from '../db/queries/twentyFourSeven.js';
import { logger } from '../utils/logger.js';

const event: Event<'voiceStateUpdate'> = {
    name: 'voiceStateUpdate',
    async execute(client: FadeClient, oldState, newState) {
        // We only care if the bot itself was disconnected
        if (oldState.id !== client.user?.id) return;
        
        // If bot was disconnected (channelId changed to null)
        if (oldState.channelId && !newState.channelId) {
            const guildId = oldState.guild.id;
            
            try {
                const is247 = await get247(guildId);
                if (is247 && is247.voiceId === oldState.channelId) {
                    logger.info(`[24/7] Bot disconnected from ${oldState.channelId} in ${guildId}. Rejoining...`);
                    
                    // Re-create the player to rejoin
                    setTimeout(async () => {
                        if (!client.music) return;
                        try {
                            await client.music.createPlayer({
                                guildId:    guildId,
                                voiceId:    is247.voiceId,
                                textId:     is247.textId,
                                deaf:       true,
                                volume:     80,
                            });
                            logger.info(`[24/7] Successfully rejoined ${is247.voiceId} in ${guildId}`);
                        } catch (e) {
                            logger.error(`[24/7] Failed to rejoin ${is247.voiceId}`, e);
                        }
                    }, 1000); // Small delay to let Discord close the previous connection
                }
            } catch (err) {
                logger.error('[24/7] Error checking 24/7 status on disconnect', err);
            }
        }
    },
};

export default event;
