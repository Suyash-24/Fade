// src/events/antiraid.ts
// Detects and responds to join raids.
// Tracks join timestamps in memory per guild.
// When joins exceed threshold within the window → raid mode activates.
import {
    PermissionFlagsBits,
    MessageFlags,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
} from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { getAntiraidConfig, isAntiraidWhitelisted } from '../db/queries/antiraid.js';
import { createCase } from '../db/queries/moderation.js';
import { Colours, e } from '../components/emojis.js';
import { logger } from '../utils/logger.js';

// ── In-memory join tracker ────────────────────────────────────────────────────
// Key: guildId → array of join timestamps

const joinTracker   = new Map<string, number[]>();
const raidCooldown  = new Map<string, number>(); // guildId → raid end timestamp

function trackJoin(guildId: string, windowMs: number): number {
    const now  = Date.now();
    const list = joinTracker.get(guildId) ?? [];
    const recent = list.filter(t => now - t < windowMs);
    recent.push(now);
    joinTracker.set(guildId, recent);
    return recent.length;
}

function isInRaidCooldown(guildId: string): boolean {
    const end = raidCooldown.get(guildId);
    if (!end) return false;
    if (Date.now() > end) {
        raidCooldown.delete(guildId);
        return false;
    }
    return true;
}

function setRaidCooldown(guildId: string, durationMs: number) {
    raidCooldown.set(guildId, Date.now() + durationMs);
}

// ── Channel lock/unlock ───────────────────────────────────────────────────────

async function lockAllChannels(guild: any, lock: boolean) {
    const textChannels = guild.channels.cache.filter((c: any) =>
        c.isTextBased() && c.permissionsFor(guild.id)?.has(PermissionFlagsBits.SendMessages)
    );
    for (const [, channel] of textChannels) {
        await (channel as any).permissionOverwrites.edit(guild.id, {
            SendMessages: lock ? false : null,
        }, { reason: lock ? '[Fade Antiraid] Raid lockdown' : '[Fade Antiraid] Raid ended' }).catch(() => null);
    }
}

// ── Manual raid state toggle ──────────────────────────────────────────────────

export async function setRaidState(guild: any, active: boolean) {
    if (active) {
        setRaidCooldown(guild.id, 30 * 60 * 1_000);
        const config = await getAntiraidConfig(guild.id).catch(() => null);
        if ((config as any)?.lockOnRaid) await lockAllChannels(guild, true);
    } else {
        raidCooldown.delete(guild.id);
        await lockAllChannels(guild, false);
    }
}

// ── Alert sender ──────────────────────────────────────────────────────────────

async function sendRaidAlert(
    guild: any,
    joinCount: number,
    action: string,
    affectedCount: number,
) {
    const channel = guild.systemChannel
        ?? guild.channels.cache
            .filter((c: any) => c.isTextBased() && c.permissionsFor(guild.members.me)?.has(PermissionFlagsBits.SendMessages))
            .first();

    if (!channel?.isTextBased()) return;

    const card = new ContainerBuilder()
        .setAccentColor(Colours.DANGER)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${e('protect')} Antiraid Triggered\n` +
                `${e('warn')}  **${joinCount} members** joined within the time window\n` +
                `${e('ban')}  **Action** — \`${action}\` applied to \`${affectedCount}\` accounts\n` +
                `-# <t:${Math.floor(Date.now() / 1000)}:T>`
            )
        );

    await channel.send({
        components: [card],
        flags: MessageFlags.IsComponentsV2,
    } as any).catch(() => null);
}

// ── Main event ────────────────────────────────────────────────────────────────

const event: Event<'guildMemberAdd'> = {
    name: 'guildMemberAdd',
    async execute(client: FadeClient, member) {
        const guild   = member.guild;
        const guildId = guild.id;

        try {
            const config = await getAntiraidConfig(guildId);
            if (!config.enabled) return;

            const user = member.user;

            // ── Per-member filters (apply regardless of raid mode) ─────────────

            // Whitelist check
            if (await isAntiraidWhitelisted(guildId, member.id)) return;

            // Account age filter
            if (config.minAccountAge > 0) {
                const ageDays = (Date.now() - user.createdTimestamp) / 86_400_000;
                if (ageDays < config.minAccountAge / 86_400) {
                    // Account too new — kick immediately
                    await member.kick(
                        `[Fade Antiraid] Account too new (${Math.floor(ageDays)} days old, minimum ${Math.floor(config.minAccountAge / 86_400)} days)`
                    ).catch(() => null);
                    return;
                }
            }

            // No avatar filter
            if (config.requireAvatar && !user.avatar) {
                await member.kick('[Fade Antiraid] No profile picture').catch(() => null);
                return;
            }

            // ── Mass join detection ───────────────────────────────────────────

            const windowMs  = config.joinWindow * 1_000;
            const joinCount = trackJoin(guildId, windowMs);

            if (joinCount < config.joinThreshold) return;

            // Already in raid cooldown — still apply action to new joiners
            if (isInRaidCooldown(guildId)) {
                if (config.action !== 'none') {
                    await applyAction(member, config.action as any, '[Fade Antiraid] Raid in progress');
                }
                return;
            }

            // Raid threshold hit — activate raid mode
            setRaidCooldown(guildId, 5 * 60 * 1_000); // 5 min cooldown

            logger.warn('Antiraid triggered', { guildId, joinCount });

            // Lock channels if configured
            if ((config as any).lockOnRaid) {
                await lockAllChannels(guild, true);
            }

            // Get all recent joiners from cache and punish them
            const cutoff = Date.now() - windowMs;
            const recentMembers = guild.members.cache.filter((m: any) =>
                m.joinedTimestamp && m.joinedTimestamp > cutoff && !m.user.bot
            );

            let affected = 0;
            if (config.action !== 'none') {
                for (const [, raider] of recentMembers) {
                    const success = await applyAction(raider, config.action as any, '[Fade Antiraid] Mass join raid detected');
                    if (success) affected++;
                }
            }

            await sendRaidAlert(guild, joinCount, config.action, affected);

        } catch (err) {
            logger.error('Antiraid event failed', err, { guildId });
        }
    },
};

// ── Apply action to a member ──────────────────────────────────────────────────

async function applyAction(
    member: any,
    action: 'ban' | 'kick' | 'timeout',
    reason: string,
): Promise<boolean> {
    try {
        // Never touch bots or guild owner
        if (member.user.bot || member.id === member.guild.ownerId) return false;

        const botMember = member.guild.members.me;
        if (botMember && member.roles.highest.position >= botMember.roles.highest.position) return false;

        if (action === 'ban') {
            await member.guild.bans.create(member.id, { reason, deleteMessageSeconds: 0 });
        } else if (action === 'kick') {
            await member.kick(reason);
        } else if (action === 'timeout') {
            // 1 hour timeout
            await member.timeout(60 * 60 * 1_000, reason);
        }

        // Log the case
        const bot = member.guild.client;
        await createCase({
            guildId:      member.guild.id,
            type:         action === 'timeout' ? 'mute' : action,
            userId:       member.id,
            userTag:      member.user.tag,
            moderatorId:  bot.user.id,
            moderatorTag: bot.user.tag,
            reason,
        }).catch(() => null);

        return true;
    } catch {
        return false;
    }
}

export default event;