// src/events/inviteTracking.ts
// Caches guild invites and resolves which invite was used when a member joins.
import type { Client, Guild, GuildMember, Invite } from 'discord.js';
import { recordInvite, markInviteLeft } from '../db/queries/invites.js';
import { logger } from '../utils/logger.js';

// In-memory cache: guildId -> Map<inviteCode, uses>
const inviteCache = new Map<string, Map<string, number>>();

// ── Cache management ─────────────────────────────────────────────────────────

export async function cacheGuildInvites(guild: Guild) {
    try {
        const invites = await guild.invites.fetch();
        const map = new Map<string, number>();
        invites.forEach(inv => map.set(inv.code, inv.uses ?? 0));
        inviteCache.set(guild.id, map);
    } catch {
        // Bot may not have MANAGE_GUILD permission
    }
}

export async function cacheAllInvites(client: Client) {
    for (const [, guild] of client.guilds.cache) {
        await cacheGuildInvites(guild);
    }
    logger.info(`[Invites] Cached invites for ${inviteCache.size} guilds`);
}

// ── Event handlers ───────────────────────────────────────────────────────────

export async function handleInviteCreate(invite: Invite) {
    if (!invite.guild) return;
    const guildCache = inviteCache.get(invite.guild.id) ?? new Map();
    guildCache.set(invite.code, invite.uses ?? 0);
    inviteCache.set(invite.guild.id, guildCache);
}

export async function handleInviteDelete(invite: Invite) {
    if (!invite.guild) return;
    const guildCache = inviteCache.get(invite.guild.id);
    if (guildCache) guildCache.delete(invite.code);
}

export async function handleMemberJoin(member: GuildMember) {
    if (member.user.bot) return;

    const guild = member.guild;
    const oldCache = inviteCache.get(guild.id);
    if (!oldCache) return;

    try {
        const newInvites = await guild.invites.fetch();
        const newMap = new Map<string, number>();
        newInvites.forEach(inv => newMap.set(inv.code, inv.uses ?? 0));

        // Find the invite whose uses increased by 1
        let usedCode: string | null = null;
        let inviterId: string | null = null;

        for (const [code, uses] of newMap) {
            const oldUses = oldCache.get(code) ?? 0;
            if (uses > oldUses) {
                usedCode = code;
                const inv = newInvites.find(i => i.code === code);
                inviterId = inv?.inviter?.id ?? null;
                break;
            }
        }

        // Update cache with new invite counts
        inviteCache.set(guild.id, newMap);

        if (!inviterId || !usedCode) return;
        if (inviterId === member.id) return; // Self-invite

        // Detect fake: account created less than 7 days ago
        const accountAge = Date.now() - member.user.createdTimestamp;
        const isFake = accountAge < 7 * 24 * 60 * 60 * 1000;

        await recordInvite(guild.id, inviterId, member.id, usedCode, isFake);
    } catch (err) {
        // Silently fail — bot may not have ManageGuild
    }
}

export async function handleMemberLeave(member: GuildMember) {
    if (member.user.bot) return;
    await markInviteLeft(member.guild.id, member.id).catch(() => null);
}

// ── Auto-registered events ───────────────────────────────────────────────────

import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';

const inviteCreateEvent: Event<'inviteCreate'> = {
    name: 'inviteCreate',
    async execute(_client: FadeClient, invite) {
        await handleInviteCreate(invite);
    },
};

const inviteDeleteEvent: Event<'inviteDelete'> = {
    name: 'inviteDelete',
    async execute(_client: FadeClient, invite) {
        await handleInviteDelete(invite);
    },
};

const guildCreateEvent: Event<'guildCreate'> = {
    name: 'guildCreate',
    async execute(_client: FadeClient, guild) {
        await cacheGuildInvites(guild);
    },
};

export default [inviteCreateEvent, inviteDeleteEvent, guildCreateEvent];
