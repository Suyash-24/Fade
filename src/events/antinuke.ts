// src/events/antinuke.ts
import { AuditLogEvent, Routes } from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { checkAction, getAuditActor } from '../utils/antinuke.js';
import { getAntinukeConfig, isWhitelisted } from '../db/queries/antinuke.js';
import { logger } from '../utils/logger.js';

// ── Ban ───────────────────────────────────────────────────────────────────────
export const guildBanAdd: Event<'guildBanAdd'> = {
    name: 'guildBanAdd',
    async execute(client, ban) {
        const actorId = await getAuditActor(ban.guild, AuditLogEvent.MemberBanAdd, ban.user.id);
        if (actorId) await checkAction(ban.guild, actorId, 'ban');
    },
};

// ── Kick ──────────────────────────────────────────────────────────────────────
export const guildMemberRemoveAntinuke: Event<'guildMemberRemove'> = {
    name: 'guildMemberRemove',
    async execute(client, member) {
        const actorId = await getAuditActor(member.guild, AuditLogEvent.MemberKick, member.id);
        if (actorId) await checkAction(member.guild, actorId, 'kick');
    },
};

// ── Channel delete ────────────────────────────────────────────────────────────
export const channelDelete: Event<'channelDelete'> = {
    name: 'channelDelete',
    async execute(client, channel) {
        if (!('guild' in channel) || !channel.guild) return;
        const actorId = await getAuditActor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
        if (actorId) await checkAction(channel.guild, actorId, 'channelDelete');
    },
};

// ── Role delete ───────────────────────────────────────────────────────────────
export const roleDelete: Event<'roleDelete'> = {
    name: 'roleDelete',
    async execute(client, role) {
        const actorId = await getAuditActor(role.guild, AuditLogEvent.RoleDelete, role.id);
        if (actorId) await checkAction(role.guild, actorId, 'roleDelete');
    },
};

// ── Role update (dangerous perms added) ───────────────────────────────────────
export const roleUpdate: Event<'roleUpdate'> = {
    name: 'roleUpdate',
    async execute(client, oldRole, newRole) {
        const { PermissionFlagsBits } = await import('discord.js');
        const dangerousPerms = [
            PermissionFlagsBits.Administrator,
            PermissionFlagsBits.BanMembers,
            PermissionFlagsBits.ManageGuild,
            PermissionFlagsBits.ManageRoles,
            PermissionFlagsBits.ManageChannels,
            PermissionFlagsBits.ManageWebhooks,
        ];
        const newDangerous = dangerousPerms.some(
            p => !oldRole.permissions.has(p) && newRole.permissions.has(p)
        );
        if (!newDangerous) return;
        const actorId = await getAuditActor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
        if (actorId) await checkAction(newRole.guild, actorId, 'roleUpdate');
    },
};

// ── Webhook create ────────────────────────────────────────────────────────────
export const webhookCreate: Event<'webhookUpdate'> = {
    name: 'webhookUpdate',
    async execute(client, channel) {
        if (!('guild' in channel) || !channel.guild) return;
        const actorId = await getAuditActor(channel.guild, AuditLogEvent.WebhookCreate);
        if (actorId) await checkAction(channel.guild, actorId, 'webhookCreate');
    },
};

// ── Vanity URL protection ─────────────────────────────────────────────────────
export const guildUpdate: Event<'guildUpdate'> = {
    name: 'guildUpdate',
    async execute(client, oldGuild, newGuild) {
        // Detect vanity URL change
        if (oldGuild.vanityURLCode === newGuild.vanityURLCode) return;

        const config = await getAntinukeConfig(newGuild.id).catch(() => null);
        if (!config?.enabled) return;
        const vanityEnabled = (config as any).vanityEnabled ?? false;
        if (!vanityEnabled) return;

        const actorId = await getAuditActor(newGuild, AuditLogEvent.GuildUpdate);
        if (!actorId) return;
        if (actorId === newGuild.ownerId) return;
        if (await isWhitelisted(newGuild.id, actorId)) return;

        // Revert the vanity URL if possible
        if (oldGuild.vanityURLCode) {
            await client.rest.patch(Routes.guildVanityUrl(newGuild.id), {
                body:   { code: oldGuild.vanityURLCode },
                reason: '[Fade Antinuke] Vanity URL change blocked',
            }).catch(() => null);
        }

        await checkAction(newGuild, actorId, 'vanity');
    },
};

// ── Bot join protection ───────────────────────────────────────────────────────
export const botJoinProtection: Event<'guildMemberAdd'> = {
    name: 'guildMemberAdd',
    async execute(client, member) {
        if (!member.user.bot) return;

        try {
            const config = await getAntinukeConfig(member.guild.id);
            if (!config.enabled || !config.botAdd) return;

            const actorId = await getAuditActor(member.guild, AuditLogEvent.BotAdd, member.id);
            if (!actorId) return;
            if (actorId === member.guild.ownerId) return;
            if (await isWhitelisted(member.guild.id, actorId)) return;

            // Kick the unauthorized bot first
            await member.kick('[Fade Antinuke] Unauthorized bot addition').catch(() => null);

            // Then punish who added it
            await checkAction(member.guild, actorId, 'ban');

            logger.warn('Antinuke: Unauthorized bot blocked', {
                guildId: member.guild.id,
                botId:   member.id,
                actorId,
            });
        } catch (err) {
            logger.error('Bot join protection failed', err, { guildId: member.guild.id });
        }
    },
};

// ── Emoji delete ──────────────────────────────────────────────────────────────
export const emojiDelete: Event<'emojiDelete'> = {
    name: 'emojiDelete',
    async execute(client, emoji) {
        if (!emoji.guild) return;
        const actorId = await getAuditActor(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);
        if (actorId) await checkAction(emoji.guild, actorId, 'emojiDelete');
    },
};

export default [
    guildBanAdd,
    guildMemberRemoveAntinuke,
    channelDelete,
    roleDelete,
    roleUpdate,
    webhookCreate,
    guildUpdate,
    botJoinProtection,
    emojiDelete,
];