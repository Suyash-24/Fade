// src/events/vanityRoles.ts
// Fires on presenceUpdate — grants/removes vanity roles based on status content.
import { MessageFlags, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { getVanityConfig, getVanityRoles } from '../db/queries/vanityRoles.js';
import { Colours, e } from '../components/emojis.js';
import { logger } from '../utils/logger.js';

// Cache per guild to avoid DB hit on every presence update
const cache = new Map<string, { config: any; roles: any[]; expiresAt: number }>();
const TTL   = 2 * 60 * 1_000;

async function getCached(guildId: string) {
    const hit = cache.get(guildId);
    if (hit && hit.expiresAt > Date.now()) return hit;
    const [config, roles] = await Promise.all([getVanityConfig(guildId), getVanityRoles(guildId)]);
    const entry = { config, roles, expiresAt: Date.now() + TTL };
    cache.set(guildId, entry);
    return entry;
}

export function invalidateVanityCache(guildId: string) {
    cache.delete(guildId);
}

function getStatusText(presence: any): string {
    if (!presence?.activities) return '';
    return presence.activities
        .map((a: any) => [a.name, a.state, a.details].filter(Boolean).join(' '))
        .join(' ')
        .toLowerCase();
}

const event: Event<'presenceUpdate'> = {
    name: 'presenceUpdate',

    async execute(_client, oldPresence, newPresence) {
        if (!newPresence?.guild || !newPresence.member) return;

        const guild  = newPresence.guild;
        const member = newPresence.member;

        try {
            const { config, roles } = await getCached(guild.id);
            if (!config?.enabled || !config.keyword || !roles.length) return;

            const keyword    = config.keyword.toLowerCase();
            const hadVanity  = getStatusText(oldPresence).includes(keyword);
            const hasVanity  = getStatusText(newPresence).includes(keyword);

            if (hadVanity === hasVanity) return; // no change

            const roleIds = roles.map((r: any) => r.roleId);

            if (hasVanity && !hadVanity) {
                // Grant roles
                for (const roleId of roleIds) {
                    await member.roles.add(roleId, '[Fade] Vanity role granted').catch(() => null);
                }

                // Send award message if configured
                if (config.channelId) {
                    const channel = guild.channels.cache.get(config.channelId) as any
                        ?? await guild.channels.fetch(config.channelId).catch(() => null);
                    if (channel?.isTextBased()) {
                        const text = config.message
                            ? config.message
                                .replace(/{user}/g,       member.toString())
                                .replace(/{username}/g,   member.user.username)
                                .replace(/{server}/g,     guild.name)
                            : `${e('boost')} ${member} is advertising the server!`;

                        const card = new ContainerBuilder()
                            .setAccentColor(Colours.SUCCESS)
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(text)
                            );

                        await channel.send({
                            components: [card],
                            flags:      MessageFlags.IsComponentsV2,
                        } as any).catch((err: any) => logger.error('Failed to send vanity award message', err));
                    }
                }

            } else if (!hasVanity && hadVanity) {
                // Remove roles
                for (const roleId of roleIds) {
                    await member.roles.remove(roleId, '[Fade] Vanity role removed').catch(() => null);
                }
            }

        } catch (err) {
            logger.error('vanityRoles presenceUpdate failed', err, { guildId: guild.id });
        }
    },
};

export default event;
