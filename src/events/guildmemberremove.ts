// src/events/guildMemberRemove.ts
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { getGoodbyeConfig } from '../db/queries/welcome.js';
import { sendGoodbye, type WelcomeStyle } from '../utils/welcomecard.js';
import { logger } from '../utils/logger.js';

const event: Event<'guildMemberRemove'> = {
    name: 'guildMemberRemove',

    async execute(client: FadeClient, member) {
        const guildId = member.guild.id;

        try {
            const config = await getGoodbyeConfig(guildId);
            if (!config.enabled || !config.channelId) return;

            const channel = member.guild.channels.cache.get(config.channelId);
            if (!channel?.isTextBased()) return;

            await sendGoodbye(
                channel,
                member as any,
                (config.style as WelcomeStyle) ?? 'embed',
                config.message,
                config.embedScript,
                config.cardScript,
                config.deleteAfter,
            );

        } catch (err) {
            logger.error('guildMemberRemove handler failed', err, { guildId, userId: member.id });
        }
    },
};

export default event;