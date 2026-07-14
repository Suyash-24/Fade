// src/events/guildMemberAdd.ts
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { getWelcomeConfig } from '../db/queries/welcome.js';
import { getAutoroles } from '../db/queries/autoroles.js';
import { sendWelcome, sendDmWelcome, type WelcomeStyle } from '../utils/welcomecard.js';
import { logger } from '../utils/logger.js';

const event: Event<'guildMemberAdd'> = {
    name: 'guildMemberAdd',

    async execute(client: FadeClient, member) {
        const guildId = member.guild.id;

        try {
            // ── Autoroles (standalone system, supports human/bot/all) ─────────────
            const autoroles = await getAutoroles(guildId);
            if (autoroles.length) {
                const targetType = member.user.bot ? 'bot' : 'human';
                const roleIds = autoroles
                    .filter(r => r.type === targetType || r.type === 'all')
                    .map(r => r.roleId)
                    .filter(id => member.guild.roles.cache.has(id));

                if (roleIds.length) {
                    await member.roles.add(roleIds, 'Fade autorole on join').catch(err =>
                        logger.warn('Autorole assignment failed', { guildId, userId: member.id, error: String(err) })
                    );
                }
            }

            // Don't send welcome messages for bots
            if (member.user.bot) return;

            // ── Welcome config ────────────────────────────────────────────────────
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

        } catch (err) {
            logger.error('guildMemberAdd handler failed', err, { guildId, userId: member.id });
        }
    },
};

export default event;