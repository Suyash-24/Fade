// src/utils/antinuke.ts
// Antinuke engine with per-module settings and vanity protection.
import { AuditLogEvent, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Guild, User, TextBasedChannel } from 'discord.js';
import { getAntinukeConfig, isWhitelisted } from '../db/queries/antinuke.js';
import { FadeContainer } from '../components/builders.js';
import { e, Colours } from '../components/emojis.js';
import { logger } from './logger.js';

export type AntiNukeAction =
    | 'ban'
    | 'kick'
    | 'channelDelete'
    | 'roleDelete'
    | 'webhookCreate'
    | 'roleUpdate'
    | 'vanity'
    | 'emojiDelete';

export type Punishment = 'ban' | 'kick' | 'strip';

// ── In-memory tracker ─────────────────────────────────────────────────────────

const tracker = new Map<string, Map<string, Map<AntiNukeAction, number[]>>>();

function recordAction(guildId: string, userId: string, action: AntiNukeAction): void {
    if (!tracker.has(guildId)) tracker.set(guildId, new Map());
    const guild = tracker.get(guildId)!;
    if (!guild.has(userId)) guild.set(userId, new Map());
    const user = guild.get(userId)!;
    if (!user.has(action)) user.set(action, []);
    const timestamps = user.get(action)!;
    timestamps.push(Date.now());
    if (timestamps.length > 100) timestamps.shift();
}

function countRecent(guildId: string, userId: string, action: AntiNukeAction, windowMs: number): number {
    const now = Date.now();
    return tracker.get(guildId)?.get(userId)?.get(action)
        ?.filter(t => now - t < windowMs).length ?? 0;
}

function clearActions(guildId: string, userId: string): void {
    tracker.get(guildId)?.delete(userId);
}

// ── Punishment executor ───────────────────────────────────────────────────────

async function punish(
    guild: Guild,
    actorId: string,
    action: AntiNukeAction,
    punishment: Punishment,
    count: number,
): Promise<void> {
    if (actorId === guild.ownerId) return;

    const actor = await guild.members.fetch(actorId).catch(() => null);
    if (!actor) return;

    const botMember = guild.members.me;
    if (botMember && actor.roles.highest.position >= botMember.roles.highest.position) {
        logger.warn('Antinuke: Cannot punish — actor has higher/equal role', { guildId: guild.id, actorId });
        return;
    }

    const reason = `[Fade Antinuke] ${action} threshold exceeded (${count} actions)`;

    try {
        if (punishment === 'ban') {
            await guild.bans.create(actorId, { reason, deleteMessageSeconds: 0 });
        } else if (punishment === 'kick') {
            await actor.kick(reason);
        } else if (punishment === 'strip') {
            const dangerousPerms = [
                PermissionFlagsBits.Administrator,
                PermissionFlagsBits.BanMembers,
                PermissionFlagsBits.KickMembers,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ManageRoles,
                PermissionFlagsBits.ManageGuild,
                PermissionFlagsBits.ManageWebhooks,
            ];
            const toRemove = actor.roles.cache.filter(r =>
                r.id !== guild.id &&
                dangerousPerms.some(p => r.permissions.has(p))
            );
            if (toRemove.size) await actor.roles.remove([...toRemove.keys()], reason);
        }

        clearActions(guild.id, actorId);
        logger.warn('Antinuke triggered', { guildId: guild.id, actorId, action, punishment, count });
        await sendAlert(guild, actor.user, action, punishment, count);

    } catch (err) {
        logger.error('Antinuke punishment failed', err, { guildId: guild.id, actorId });
    }
}

// ── Alert card ────────────────────────────────────────────────────────────────

const ACTION_LABELS: Record<AntiNukeAction, string> = {
    ban:          'Mass Ban',
    kick:         'Mass Kick',
    channelDelete:'Mass Channel Delete',
    roleDelete:   'Mass Role Delete',
    webhookCreate:'Mass Webhook Create',
    roleUpdate:   'Dangerous Role Edit',
    vanity:       'Vanity URL Change',
    emojiDelete:  'Mass Emoji Delete',
};

const PUNISHMENT_LABELS: Record<Punishment, string> = {
    ban:   'Banned',
    kick:  'Kicked',
    strip: 'Roles Stripped',
};

async function sendAlert(guild: Guild, actor: User, action: AntiNukeAction, punishment: Punishment, count: number) {
    const config = await getAntinukeConfig(guild.id).catch(() => null);
    
    let channel: TextBasedChannel | null = null;
    
    if (config?.logChannelId) {
        channel = guild.channels.cache.get(config.logChannelId) as TextBasedChannel 
            ?? await guild.channels.fetch(config.logChannelId).catch(() => null) as TextBasedChannel | null;
    }

    if (!channel?.isTextBased()) {
        channel = guild.systemChannel as TextBasedChannel | null
            ?? guild.channels.cache
                .filter(c => c.isTextBased() && c.permissionsFor(guild.members.me!)?.has(PermissionFlagsBits.SendMessages))
                .first() as TextBasedChannel | null;
    }

    if (!channel?.isTextBased()) return;

    const card = new FadeContainer(Colours.DANGER)
        .text(`## ${e('protect')} Antinuke Triggered`)
        .separator(true)
        .text([
            `${e('warn')}  **Action** — \`${ACTION_LABELS[action]}\``,
            `${e('members')}  **Actor** — <@${actor.id}> (${actor.tag})`,
            `${e('ban')}  **Punishment** — \`${PUNISHMENT_LABELS[punishment]}\``,
            `**Count** — \`${count} actions\``,
            `-# <t:${Math.floor(Date.now() / 1000)}:T>`,
        ].join('\n'))
        .build();

    await (channel as any).send({
        components: [card],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: [] },
    } as any).catch(() => null);
}

// ── Main check ────────────────────────────────────────────────────────────────

// Maps action type to the config field names for enabled/punishment
const MODULE_MAP: Record<AntiNukeAction, { enabled: string; punishment: string; threshold: string } | null> = {
    ban:          { enabled: 'banEnabled',     punishment: 'banPunishment',     threshold: 'banThreshold'     },
    kick:         { enabled: 'kickEnabled',    punishment: 'kickPunishment',    threshold: 'kickThreshold'    },
    channelDelete:{ enabled: 'channelEnabled', punishment: 'channelPunishment', threshold: 'channelThreshold' },
    roleDelete:   { enabled: 'roleEnabled',    punishment: 'rolePunishment',    threshold: 'roleThreshold'    },
    webhookCreate:{ enabled: 'webhookEnabled', punishment: 'webhookPunishment', threshold: 'webhookThreshold' },
    roleUpdate:   { enabled: 'roleEnabled',    punishment: 'rolePunishment',    threshold: 'roleThreshold'    },
    vanity:       null,
    emojiDelete:  { enabled: 'emojiEnabled',   punishment: 'emojiPunishment',   threshold: 'emojiThreshold'   },
};

export async function checkAction(guild: Guild, actorId: string, action: AntiNukeAction): Promise<void> {
    try {
        const config = await getAntinukeConfig(guild.id);
        if (!config.enabled) return;
        if (actorId === guild.ownerId) return;
        if (actorId === guild.client.user?.id) return;
        if (await isWhitelisted(guild.id, actorId)) return;

        // Vanity change — instant punishment, no threshold needed
        if (action === 'vanity') {
            const vanityEnabled = (config as any).vanityEnabled ?? false;
            if (!vanityEnabled) return;
            await punish(guild, actorId, action, config.punishment as Punishment, 1);
            return;
        }

        const module = MODULE_MAP[action];
        if (!module) return;

        const isEnabled  = (config as any)[module.enabled] ?? true;
        if (!isEnabled) return;

        const threshold  = (config as any)[module.threshold] as number;
        const punishment = (config as any)[module.punishment] as Punishment ?? config.punishment as Punishment;
        const windowMs   = config.timeWindow * 1_000;

        recordAction(guild.id, actorId, action);
        const count = countRecent(guild.id, actorId, action, windowMs);

        if (count >= threshold) {
            await punish(guild, actorId, action, punishment, count);
        }

    } catch (err) {
        logger.error('Antinuke check failed', err, { guildId: guild.id, actorId, action });
    }
}

// ── Audit log helper ──────────────────────────────────────────────────────────

export async function getAuditActor(
    guild: Guild,
    auditEvent: AuditLogEvent,
    targetId?: string,
): Promise<string | null> {
    try {
        const logs  = await guild.fetchAuditLogs({ type: auditEvent, limit: 1 });
        const entry = logs.entries.first();
        if (!entry) return null;
        if (Date.now() - entry.createdTimestamp > 5_000) return null;
        if (targetId && (entry.target as any)?.id !== targetId) return null;
        return entry.executor?.id ?? null;
    } catch {
        return null;
    }
}