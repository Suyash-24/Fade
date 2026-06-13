// src/events/xpGain.ts
// Fires on every message and awards XP with a per-user cooldown.
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { getLevelConfig, addXp, getEarnedRewards } from '../db/queries/leveling.js';
import { FadeContainer } from '../components/builders.js';
import { e, Colours } from '../components/emojis.js';
import { logger } from '../utils/logger.js';
import { buildScriptedCard, buildScriptedEmbed, detectScriptStyle } from '../utils/welcomecard.js';
import type { GuildMember } from 'discord.js';
import { MessageFlags } from 'discord.js';

// In-memory XP cooldown: "guildId:userId" → expiry timestamp
const xpCooldowns = new Map<string, number>();

// Replace all {level} occurrences in any string — used as post-process after resolveVars
function injectLevel(s: string | null | undefined, level: number): string | null {
    if (!s) return null;
    return s.replace(/{level}/g, level.toString());
}

const event: Event<'messageCreate'> = {
    name: 'messageCreate',

    async execute(client: FadeClient, message) {
        if (message.author.bot || !message.guild || message.system) return;

        const guildId = message.guild.id;
        const userId  = message.author.id;

        const config = await getLevelConfig(guildId).catch(() => null);
        if (!config?.enabled) return;

        if (config.ignoredChannels?.includes(message.channelId)) return;
        const memberRoles = message.member?.roles.cache.map(r => r.id) ?? [];
        if (config.ignoredRoles?.some((r: string) => memberRoles.includes(r))) return;

        const cooldownKey = `${guildId}:${userId}`;
        const now         = Date.now();
        const cooldownMs  = (config.xpCooldown ?? 60) * 1_000;
        const expiry      = xpCooldowns.get(cooldownKey);

        if (cooldownMs > 0 && expiry && now < expiry) return;
        if (cooldownMs > 0) xpCooldowns.set(cooldownKey, now + cooldownMs);

        const xpMin    = config.xpMin ?? 15;
        const xpMax    = config.xpMax ?? 25;
        const xpAmount = Math.floor(Math.random() * (xpMax - xpMin + 1)) + xpMin;

        const result = await addXp(guildId, userId, xpAmount).catch(err => {
            logger.error('XP gain failed', err, { guildId, userId });
            return null;
        });

        if (!result) return;

        if (result.levelled) {
            await handleLevelUp(client, message, result.newLevel, guildId, userId);
        }
    },
};

async function handleLevelUp(
    client: FadeClient,
    message: any,
    newLevel: number,
    guildId: string,
    userId: string,
) {
    try {
        const config = await getLevelConfig(guildId);

        // Assign earned role rewards
        const rewards = await getEarnedRewards(guildId, newLevel);
        if (rewards.length && message.member) {
            for (const reward of rewards) {
                if (reward.remove) {
                    await message.member.roles.remove(reward.roleId).catch(() => null);
                } else {
                    await message.member.roles.add(reward.roleId).catch(() => null);
                }
            }
        }

        // Resolve announcement channel
        const announceChannel = config.announceChannel
            ? message.guild.channels.cache.get(config.announceChannel)
            : message.channel;

        if (!announceChannel?.isTextBased()) return;

        const member: GuildMember | null = message.member ?? null;

        // ── Plain text ────────────────────────────────────────────────────────────
        if (config.announceMessage?.startsWith('__plain__') && member) {
            try {
                const raw  = config.announceMessage.slice('__plain__'.length);
                const avatarUrl = member.user.displayAvatarURL({ size: 256 });
                const text = raw
                    .replace(/{user}/g,             member.toString())
                    .replace(/\{user\.mention\}/g,  member.toString())
                    .replace(/{username}/g,         member.user.username)
                    .replace(/\{user\.username\}/g, member.user.username)
                    .replace(/\{user\.name\}/g,     member.user.username)
                    .replace(/{server}/g,           member.guild.name)
                    .replace(/{level}/g,            newLevel.toString())
                    .replace(/{id}/g,               member.id)
                    .replace(/{avatar}/g,           avatarUrl)
                    .replace(/\{user\.avatar\}/g,   avatarUrl)
                    .replace(/\{user\.icon\}/g,     avatarUrl)
                    .replace(/{usericon}/g,         avatarUrl)
                    .replace(/{servericon}/g,       member.guild.iconURL({ size: 256 }) ?? '');
                if (text.trim()) {
                    await announceChannel.send({ content: text }).catch(() => null);
                }
            } catch (err) {
                logger.warn('Level-up plain message failed, using default', { guildId, userId });
                await sendDefaultCard(announceChannel, userId, newLevel);
            }
            return;
        }

        // ── Script-based message ──────────────────────────────────────────────────
        if (config.announceMessage && member) {
            // Pre-resolve {level} in the raw script before all other parsing
            // so it works in every field (author, footer, title, etc.)
            const script = config.announceMessage.replace(/{level}/g, newLevel.toString());
            const style  = detectScriptStyle(script);

            try {
                if (style === 'embed') {
                    const { embed, content, buttons } = buildScriptedEmbed(script, member);

                    // Validate: embed needs at least a description or title to be accepted
                    const raw = embed.toJSON();
                    if (!raw.title && !raw.description && !raw.fields?.length) {
                        // Embed is empty — fall through to default
                        throw new Error('Embed has no visible content');
                    }

                    const payload: any = { embeds: [embed] };
                    if (content) payload.content = content;
                    if (buttons) payload.components = [buttons];
                    await announceChannel.send(payload).catch(() => null);
                    return;
                }

                // Card style — or ambiguous (null) → always try card
                const { container } = buildScriptedCard(script, member);
                // buildScriptedCard always produces a valid container (FadeContainer.build())
                await announceChannel.send({
                    components: [container],
                    flags: MessageFlags.IsComponentsV2,
                } as any).catch(() => null);
                return;

            } catch (scriptErr) {
                // Script rendering failed (bad values, empty embed, etc.)
                // Log and fall through to the default card — bot never crashes
                logger.error('Level-up script render failed, using default card', scriptErr, { guildId, userId });
            }
        }

        // ── Default card (fallback) ───────────────────────────────────────────────
        await sendDefaultCard(announceChannel, userId, newLevel);

    } catch (err) {
        logger.error('Level-up handler failed', err, { guildId, userId });
    }
}

// Default level-up card — always safe, used when no script or script fails
async function sendDefaultCard(channel: any, userId: string, newLevel: number): Promise<void> {
    try {
        const card = new FadeContainer(Colours.FADE)
            .text(`## ${e('level')} Level Up!\n<@${userId}> reached **Level ${newLevel}** ${newLevel >= 10 ? '🎉' : '⬆️'}`)
            .build();
        await channel.send({
            components: [card],
            flags: MessageFlags.IsComponentsV2,
        } as any);
    } catch {
        // If even the default card fails (e.g. no send perms), silently ignore
    }
}

export default event;