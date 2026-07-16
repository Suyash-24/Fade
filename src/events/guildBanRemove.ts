// src/events/guildBanRemove.ts
import { Events, GuildBan } from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { isHardbanned } from '../db/queries/hardbans.js';
import { logger } from '../utils/logger.js';

const event: Event<Events.GuildBanRemove> = {
    name: Events.GuildBanRemove,
    async execute(client: FadeClient, ban: GuildBan) {
        if (ban.partial) {
            try {
                await ban.fetch();
            } catch {
                return; // Can't fetch ban
            }
        }

        const { guild, user } = ban;

        try {
            // Check if the user is in the hardbans database for this guild
            const hardbanned = await isHardbanned(guild.id, user.id);
            if (hardbanned) {
                logger.warn(`[Hardban] Rogue unban detected for user ${user.id} in guild ${guild.id}. Re-banning.`);
                
                // Re-ban the user instantly
                await guild.bans.create(user.id, {
                    reason: '[Fade Hardban System] Rogue unban attempt blocked. User is hardbanned.',
                });
            }
        } catch (error) {
            logger.error(`Error processing guildBanRemove event for hardban check`, error);
        }
    },
};

export default event;
