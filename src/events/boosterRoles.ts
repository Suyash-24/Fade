// src/events/boosterRoles.ts
// Fires on guildMemberUpdate to handle boost start/end:
//   - Boost start: grant award role if configured
//   - Boost end:   remove award role + delete custom booster role
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { getBoosterConfig, getBoosterRole, deleteBoosterRole } from '../db/queries/boosterRoles.js';
import { FadeContainer, thumb } from '../components/builders.js';
import { e, Colours } from '../components/emojis.js';
import { detectScriptStyle, buildScriptedCard, buildScriptedEmbed, resolveVars } from '../utils/welcomecard.js';
import { logger } from '../utils/logger.js';

const event: Event<'guildMemberUpdate'> = {
    name: 'guildMemberUpdate',

    async execute(_client: FadeClient, oldMember, newMember) {
        const wasBooster = !!oldMember.premiumSince;
        const isBooster  = !!newMember.premiumSince;

        // No boost change — nothing to do
        if (wasBooster === isBooster) return;

        const guildId = newMember.guild.id;

        try {
            const config = await getBoosterConfig(guildId);

            if (!wasBooster && isBooster) {
                // ── Boost started ─────────────────────────────────────────────
                if (config?.awardRoleId) {
                    await newMember.roles.add(config.awardRoleId, '[Fade] Booster award role').catch(() => null);
                }

                if (config?.announceChannelId) {
                    const channel = newMember.guild.channels.cache.get(config.announceChannelId);
                    if (channel && channel.isTextBased()) {
                        const script = config.announceMessage;
                        try {
                            if (!script) {
                                // Default boost card
                                const avatarUrl = newMember.user.displayAvatarURL({ size: 256 });
                                const defaultCard = new FadeContainer(Colours.FADE)
                                    .section([`## ${e('boost')} Server Boosted!`, `Thank you ${newMember.toString()} for boosting **${newMember.guild.name}**!`], thumb(avatarUrl))
                                    .build();
                                await channel.send({ embeds: [defaultCard as any] }).catch(() => null);
                            } else if (script.startsWith('__plain__')) {
                                const text = resolveVars(script.replace('__plain__', ''), newMember as any);
                                await channel.send({ content: text }).catch(() => null);
                            } else {
                                const style = detectScriptStyle(script) || 'card';
                                if (style === 'embed') {
                                    const { content, embed, buttons } = buildScriptedEmbed(script, newMember as any);
                                    const isEmpty = !embed.data.title && !embed.data.description && !embed.data.fields?.length && !embed.data.author && !embed.data.footer && !embed.data.image && !embed.data.thumbnail;
                                    if (content || !isEmpty) {
                                        await channel.send({ content: content || undefined, embeds: isEmpty ? [] : [embed], components: buttons ? [buttons] : undefined }).catch(() => null);
                                    }
                                } else {
                                    const { container, buttons } = buildScriptedCard(script, newMember as any);
                                    await channel.send({ embeds: [container as any], components: buttons ? [buttons] : undefined }).catch(() => null);
                                }
                            }
                        } catch (err) {
                            logger.warn('Failed to send boost announcement', err as any);
                        }
                    }
                }

            } else if (wasBooster && !isBooster) {
                // ── Boost ended ───────────────────────────────────────────────

                // Remove award role
                if (config?.awardRoleId) {
                    await newMember.roles.remove(config.awardRoleId, '[Fade] Boost ended').catch(() => null);
                }

                // Delete custom booster role
                const entry = await getBoosterRole(guildId, newMember.id);
                if (entry) {
                    const role = newMember.guild.roles.cache.get(entry.roleId);
                    if (role) await role.delete('[Fade] Boost ended').catch(() => null);
                    await deleteBoosterRole(guildId, newMember.id);
                }
            }

        } catch (err) {
            logger.error('boosterRoles guildMemberUpdate failed', err, { guildId, userId: newMember.id });
        }
    },
};

export default event;
