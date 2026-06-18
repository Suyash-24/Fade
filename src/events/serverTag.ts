// src/events/serverTagRoles.ts
import { MessageFlags } from 'discord.js';
import type { Event } from '../types/event.js';
import { getServerTagConfig } from '../db/queries/serverTag.js';
import { Colours } from '../components/emojis.js';
import { FadeContainer, thumb } from '../components/builders.js';
import { logger } from '../utils/logger.js';

const cache = new Map<string, { config: any; expiresAt: number }>();
const TTL   = 2 * 60 * 1_000;

async function getCached(guildId: string) {
    const hit = cache.get(guildId);
    if (hit && hit.expiresAt > Date.now()) return hit.config;
    const config = await getServerTagConfig(guildId);
    cache.set(guildId, { config, expiresAt: Date.now() + TTL });
    return config;
}

export function invalidateServerTagCache(guildId: string) {
    cache.delete(guildId);
}

const event: Event<'userUpdate'> = {
    name: 'userUpdate',
    async execute(client, oldUser, newUser) {
        // Native server tag is tracked in primaryGuild
        const oldPrimary = oldUser.primaryGuild?.identityGuildId;
        const newPrimary = newUser.primaryGuild?.identityGuildId;
        
        if (oldPrimary === newPrimary) return;

        // User removed a server tag
        if (oldPrimary && (!newPrimary || newPrimary !== oldPrimary)) {
            const guild = client.guilds.cache.get(oldPrimary);
            if (guild) {
                try {
                    const config = await getCached(oldPrimary);
                    if (config?.enabled && config.roleId) {
                        const member = guild.members.cache.get(newUser.id) ?? await guild.members.fetch(newUser.id).catch(() => null);
                        if (member) {
                            await member.roles.remove(config.roleId, '[Fade] Server Tag unequipped').catch(() => null);
                        }
                    }
                } catch (err) {
                    logger.error('Failed to handle server tag removal', err);
                }
            }
        }
        
        // User equipped a server tag
        if (newPrimary && (!oldPrimary || newPrimary !== oldPrimary)) {
            const guild = client.guilds.cache.get(newPrimary);
            if (guild) {
                try {
                    const config = await getCached(newPrimary);
                    if (config?.enabled && config.roleId) {
                        const member = guild.members.cache.get(newUser.id) ?? await guild.members.fetch(newUser.id).catch(() => null);
                        if (member) {
                            await member.roles.add(config.roleId, '[Fade] Server Tag equipped').catch(() => null);
                            
                            // Send the thank you card if channel configured
                            if (config.channelId) {
                                const channel = guild.channels.cache.get(config.channelId) as any ?? await guild.channels.fetch(config.channelId).catch(() => null);
                                if (channel?.isTextBased()) {
                                    const tag = newUser.primaryGuild?.tag ?? 'Tag';
                                    
                                    // Get role member count
                                    let roleCount = 0;
                                    const role = guild.roles.cache.get(config.roleId);
                                    if (role) roleCount = role.members.size;

                                    const text = config.message
                                        ? config.message
                                            .replace(/{user}/g,       member.toString())
                                            .replace(/{username}/g,   newUser.username)
                                            .replace(/{server}/g,     guild.name)
                                            .replace(/{tag}/g,        tag)
                                        : `> ${member} just applied our guild tag **${tag}**, you have successfully received <@&${config.roleId}> Role\n\n> We now have **${roleCount}** supporters!`;

                                    const card = new FadeContainer()
                                        .text('**Guild Tag Added**')
                                        .section([text], thumb(newUser.displayAvatarURL({ size: 128 })));
                                        
                                    if (config.image) {
                                        card.gallery([{ url: config.image }]);
                                    }

                                    await channel.send({
                                        components: [card.build()],
                                        flags:      MessageFlags.IsComponentsV2,
                                    } as any).catch((err: any) => logger.error('Failed to send server tag message', err));
                                }
                            }
                        }
                    }
                } catch (err) {
                    logger.error('Failed to handle server tag assignment', err);
                }
            }
        }
    },
};

export default event;
