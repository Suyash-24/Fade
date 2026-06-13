// src/events/guildMemberAdd.ts
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { getWelcomeConfig } from '../db/queries/welcome.js';
import { sendWelcome, sendDmWelcome, type WelcomeStyle } from '../utils/welcomecard.js';
import { logger } from '../utils/logger.js';

const event: Event<'guildMemberAdd'> = {
    name: 'guildMemberAdd',

    async execute(client: FadeClient, member) {
        const guildId = member.guild.id;

        try {
            const config = await getWelcomeConfig(guildId);
            if (!config.enabled) return;

            // ── Welcome message ───────────────────────────────────────────────
            if (config.channelId) {
                const channel = member.guild.channels.cache.get(config.channelId);
                if (channel?.isTextBased()) {
                    await sendWelcome(
                        channel,
                        member,
                        (config.style as WelcomeStyle) ?? 'embed',
                        config.message,
                        config.embedScript,
                        config.cardScript,
                        config.deleteAfter,
                    );
                }
            }

            // ── DM welcome ────────────────────────────────────────────────────
            if (config.dmMessage) {
                await sendDmWelcome(
                    member,
                    config.dmMessage,
                    (config.style as WelcomeStyle) ?? 'card',
                );
            }

            // ── Auto-roles ────────────────────────────────────────────────────
            const autoRoles = config.autoRoles as string[] ?? [];
            if (autoRoles.length) {
                const roles = autoRoles
                    .map(id => member.guild.roles.cache.get(id))
                    .filter(Boolean) as any[];

                if (roles.length) {
                    await member.roles.add(roles, 'Fade auto-role on join').catch(err =>
                        logger.warn('Auto-role failed', { guildId, userId: member.id, error: String(err) })
                    );
                }
            }

        } catch (err) {
            logger.error('guildMemberAdd handler failed', err, { guildId, userId: member.id });
        }
    },
};

export default event;