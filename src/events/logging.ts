// src/events/logging.ts
// All Discord event listeners for the logging system.
// Each handler calls sendLog() which checks config + channel before sending.
import { AuditLogEvent, ChannelType } from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { sendLog, LogColour } from '../utils/logsender.js';
import { e } from '../components/emojis.js';

const CHANNEL_TYPE_NAMES: Partial<Record<ChannelType, string>> = {
    [ChannelType.GuildText]:         'Text',
    [ChannelType.GuildVoice]:        'Voice',
    [ChannelType.GuildCategory]:     'Category',
    [ChannelType.GuildAnnouncement]: 'Announcement',
    [ChannelType.GuildStageVoice]:   'Stage',
    [ChannelType.GuildForum]:        'Forum',
    [ChannelType.GuildMedia]:        'Media',
};

async function fetchExecutor(guild: any, action: AuditLogEvent, targetId?: string): Promise<string> {
    try {
        await new Promise(res => setTimeout(res, 800));
        const logs  = await guild.fetchAuditLogs({ type: action, limit: 1 });
        const entry = logs.entries.first();
        if (!entry) return '`Unknown`';
        if (targetId && (entry.target as any)?.id !== targetId) return '`Unknown`';
        if (Date.now() - entry.createdTimestamp > 8_000) return '`Unknown`';
        return entry.executor ? `<@${entry.executor.id}>` : '`Unknown`';
    } catch {
        return '`Unknown`';
    }
}

// ── Message Delete ────────────────────────────────────────────────────────────
export const messageDelete: Event<'messageDelete'> = {
    name: 'messageDelete',
    async execute(client, message) {
        if (!message.guild || message.author?.bot) return;
        if (!message.content && !message.attachments.size) return;

        const image = message.attachments.find(a =>
            a.contentType?.startsWith('image/'))?.url;

        await sendLog({
            guild:    message.guild,
            category: 'message',
            event:    'messageDelete',
            color:    LogColour.DELETE,
            title:    `${e('error')} Message Deleted`,
            fields: [
                { name: 'Author',  value: `<@${message.author?.id}> (${message.author?.tag})` },
                { name: 'Channel', value: `<#${message.channelId}>` },
                { name: 'Content', value: message.content?.slice(0, 1000) || '*(empty)*' },
            ],
            footer: `Message ID: ${message.id} · <t:${Math.floor(Date.now() / 1000)}:T>`,
            image,
        });
    },
};

// ── Message Edit ──────────────────────────────────────────────────────────────
export const messageUpdate: Event<'messageUpdate'> = {
    name: 'messageUpdate',
    async execute(client, oldMessage, newMessage) {
        if (!newMessage.guild || newMessage.author?.bot) return;
        if (oldMessage.content === newMessage.content) return;

        await sendLog({
            guild:    newMessage.guild,
            category: 'message',
            event:    'messageEdit',
            color:    LogColour.UPDATE,
            title:    `${e('warn')} Message Edited`,
            fields: [
                { name: 'Author',  value: `<@${newMessage.author?.id}>` },
                { name: 'Channel', value: `<#${newMessage.channelId}>` },
                { name: 'Before',  value: oldMessage.content?.slice(0, 500) || '*(empty)*' },
                { name: 'After',   value: newMessage.content?.slice(0, 500) || '*(empty)*' },
            ],
            footer: `<t:${Math.floor(Date.now() / 1000)}:T> · Jump: ${newMessage.url}`,
        });
    },
};

// ── Bulk Message Delete ───────────────────────────────────────────────────────
export const messageDeleteBulk: Event<'messageDeleteBulk'> = {
    name: 'messageDeleteBulk',
    async execute(client, messages, channel) {
        if (!channel.guild) return;

        await sendLog({
            guild:    channel.guild,
            category: 'message',
            event:    'messageBulkDelete',
            color:    LogColour.DELETE,
            title:    `${e('error')} Bulk Message Delete`,
            fields: [
                { name: 'Channel', value: `<#${channel.id}>` },
                { name: 'Count',   value: `\`${messages.size}\` messages deleted` },
            ],
            footer: `<t:${Math.floor(Date.now() / 1000)}:T>`,
        });
    },
};

// ── Member Join ───────────────────────────────────────────────────────────────
export const memberJoinLog: Event<'guildMemberAdd'> = {
    name: 'guildMemberAdd',
    async execute(client, member) {
        const createdAt = Math.floor(member.user.createdTimestamp / 1000);
        const accountAge = Math.floor((Date.now() - member.user.createdTimestamp) / 86400000);

        await sendLog({
            guild:    member.guild,
            category: 'member',
            event:    'memberJoin',
            color:    LogColour.CREATE,
            title:    `${e('members')} Member Joined`,
            fields: [
                { name: 'User',        value: `<@${member.id}> (${member.user.tag})` },
                { name: 'Account age', value: `${accountAge} days old · <t:${createdAt}:D>` },
                { name: 'Member #',    value: `\`${member.guild.memberCount}\`` },
            ],
            footer: `ID: ${member.id}`,
        });
    },
};

// ── Member Leave ──────────────────────────────────────────────────────────────
export const memberLeaveLog: Event<'guildMemberRemove'> = {
    name: 'guildMemberRemove',
    async execute(client, member) {
        const joinedAt = member.joinedTimestamp
            ? `<t:${Math.floor(member.joinedTimestamp / 1000)}:D>`
            : 'Unknown';

        const roles = member.roles.cache
            .filter(r => r.id !== member.guild.id)
            .map(r => `<@&${r.id}>`)
            .join(' ') || '`None`';

        await sendLog({
            guild:    member.guild,
            category: 'member',
            event:    'memberLeave',
            color:    LogColour.DELETE,
            title:    `${e('offline')} Member Left`,
            fields: [
                { name: 'User',   value: `<@${member.id}> (${member.user.tag})` },
                { name: 'Joined', value: joinedAt },
                { name: 'Roles',  value: roles.slice(0, 500) },
            ],
            footer: `ID: ${member.id}`,
        });
    },
};

// ── Member Update (role/nick changes) ─────────────────────────────────────────
export const memberUpdate: Event<'guildMemberUpdate'> = {
    name: 'guildMemberUpdate',
    async execute(client, oldMember, newMember) {
        // Nickname change
        if (oldMember.nickname !== newMember.nickname) {
            await sendLog({
                guild:    newMember.guild,
                category: 'member',
                event:    'memberNickname',
                color:    LogColour.UPDATE,
                title:    `${e('warn')} Nickname Changed`,
                fields: [
                    { name: 'User',   value: `<@${newMember.id}>` },
                    { name: 'Before', value: oldMember.nickname ?? '`None`' },
                    { name: 'After',  value: newMember.nickname ?? '`None`' },
                ],
                footer: `ID: ${newMember.id}`,
            });
        }

        // Role added
        const addedRoles = newMember.roles.cache.filter(r => !oldMember.roles.cache.has(r.id));
        if (addedRoles.size) {
            const executor = await fetchExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
            await sendLog({
                guild:    newMember.guild,
                category: 'member',
                event:    'memberRoleAdd',
                color:    LogColour.CREATE,
                title:    `${e('roles')} Role Added`,
                fields: [
                    { name: 'User',     value: `<@${newMember.id}>` },
                    { name: 'Roles',    value: addedRoles.map(r => `<@&${r.id}>`).join(' ') },
                    { name: 'Executor', value: executor },
                ],
                footer: `ID: ${newMember.id}`,
            });
        }

        // Role removed
        const removedRoles = oldMember.roles.cache.filter(r => !newMember.roles.cache.has(r.id));
        if (removedRoles.size) {
            const executor = await fetchExecutor(newMember.guild, AuditLogEvent.MemberRoleUpdate, newMember.id);
            await sendLog({
                guild:    newMember.guild,
                category: 'member',
                event:    'memberRoleRemove',
                color:    LogColour.DELETE,
                title:    `${e('roles')} Role Removed`,
                fields: [
                    { name: 'User',     value: `<@${newMember.id}>` },
                    { name: 'Roles',    value: removedRoles.map(r => `<@&${r.id}>`).join(' ') },
                    { name: 'Executor', value: executor },
                ],
                footer: `ID: ${newMember.id}`,
            });
        }

        // Server avatar change
        if (oldMember.avatar !== newMember.avatar) {
            await sendLog({
                guild:    newMember.guild,
                category: 'member',
                event:    'memberAvatar',
                color:    LogColour.UPDATE,
                title:    `${e('members')} Server Avatar Changed`,
                fields: [
                    { name: 'User', value: `<@${newMember.id}> (${newMember.user.tag})` },
                ],
                footer: `ID: ${newMember.id}`,
                image: newMember.displayAvatarURL({ size: 256 }),
            });
        }

    },
};

// ── External mod actions (other bots / Discord UI) ──────────────────────────
// Pattern from YAGPDB: skip if executor is our own bot, otherwise log.
export const externalModLog: Event<'guildAuditLogEntryCreate'> = {
    name: 'guildAuditLogEntryCreate',
    async execute(client, entry, guild) {
        if (entry.executor?.id === client.user?.id) return;

        const target   = entry.target as any;
        const executor = entry.executor ? `<@${entry.executor.id}>` : '`Unknown`';
        const userId   = target?.id ?? 'Unknown';
        const userTag  = target?.tag ?? target?.username ?? 'Unknown';

        switch (entry.action) {
            case AuditLogEvent.MemberBanAdd:
                await sendLog({
                    guild, category: 'mod', event: 'memberBan',
                    color: LogColour.MOD, title: `${e('ban')} Member Banned`,
                    fields: [
                        { name: 'User',     value: `<@${userId}> (${userTag})` },
                        { name: 'Executor', value: executor },
                        { name: 'Reason',   value: entry.reason ?? 'No reason provided' },
                    ],
                    footer: `ID: ${userId}`,
                });
                break;

            case AuditLogEvent.MemberBanRemove:
                await sendLog({
                    guild, category: 'mod', event: 'memberUnban',
                    color: LogColour.CREATE, title: `${e('unlock')} Member Unbanned`,
                    fields: [
                        { name: 'User',     value: `<@${userId}> (${userTag})` },
                        { name: 'Executor', value: executor },
                        { name: 'Reason',   value: entry.reason ?? 'No reason provided' },
                    ],
                    footer: `ID: ${userId}`,
                });
                break;

            case AuditLogEvent.MemberKick:
                await sendLog({
                    guild, category: 'mod', event: 'memberKick',
                    color: LogColour.MOD, title: `${e('kick')} Member Kicked`,
                    fields: [
                        { name: 'User',     value: `<@${userId}> (${userTag})` },
                        { name: 'Executor', value: executor },
                        { name: 'Reason',   value: entry.reason ?? 'No reason provided' },
                    ],
                    footer: `ID: ${userId}`,
                });
                break;

            case AuditLogEvent.MemberUpdate: {
                const timeoutChange = (entry.changes as any[]).find(
                    c => c.key === 'communication_disabled_until'
                );
                if (!timeoutChange) break;

                if (timeoutChange.new != null) {
                    const until = Math.floor(new Date(timeoutChange.new).getTime() / 1000);
                    await sendLog({
                        guild, category: 'mod', event: 'memberTimeout',
                        color: LogColour.MOD, title: `${e('mute')} Member Timed Out`,
                        fields: [
                            { name: 'User',     value: `<@${userId}>` },
                            { name: 'Until',    value: `<t:${until}:F>` },
                            { name: 'Executor', value: executor },
                        ],
                        footer: `ID: ${userId}`,
                    });
                }
                break;
            }
        }
    },
};

// ── Channel events ────────────────────────────────────────────────────────────
export const channelCreate: Event<'channelCreate'> = {
    name: 'channelCreate',
    async execute(client, channel) {
        if (!channel.guild) return;
        const executor = await fetchExecutor(channel.guild, AuditLogEvent.ChannelCreate, channel.id);
        await sendLog({
            guild:    channel.guild,
            category: 'channel',
            event:    'channelCreate',
            color:    LogColour.CREATE,
            title:    `${e('channels')} Channel Created`,
            fields: [
                { name: 'Name',     value: `<#${channel.id}>` },
                { name: 'Type',     value: `\`${CHANNEL_TYPE_NAMES[channel.type] ?? channel.type}\`` },
                { name: 'Category', value: channel.parent?.name ?? '`None`' },
                { name: 'Executor', value: executor },
            ],
            footer: `ID: ${channel.id}`,
        });
    },
};

export const channelDeleteLog: Event<'channelDelete'> = {
    name: 'channelDelete',
    async execute(client, channel) {
        if (!('guild' in channel) || !channel.guild) return;
        const executor = await fetchExecutor(channel.guild, AuditLogEvent.ChannelDelete, channel.id);
        await sendLog({
            guild:    channel.guild,
            category: 'channel',
            event:    'channelDelete',
            color:    LogColour.DELETE,
            title:    `${e('channels')} Channel Deleted`,
            fields: [
                { name: 'Name',     value: `\`#${channel.name}\`` },
                { name: 'Type',     value: `\`${CHANNEL_TYPE_NAMES[channel.type] ?? channel.type}\`` },
                { name: 'Category', value: (channel as any).parent?.name ?? '`None`' },
                { name: 'Executor', value: executor },
            ],
            footer: `ID: ${channel.id}`,
        });
    },
};

export const channelUpdate: Event<'channelUpdate'> = {
    name: 'channelUpdate',
    async execute(client, oldChannel, newChannel) {
        if (!('guild' in newChannel) || !newChannel.guild) return;

        const o = oldChannel as any;
        const n = newChannel as any;

        const nameChanged  = o.name  !== n.name;
        const topicChanged = o.topic !== n.topic;
        const slowChanged  = o.rateLimitPerUser !== n.rateLimitPerUser;
        const nsfwChanged  = o.nsfw  !== n.nsfw;
        const bitrateChanged = o.bitrate !== n.bitrate;

        // Detect permission overwrite changes by comparing serialised maps
        const oldPerms = JSON.stringify(
            [...(o.permissionOverwrites?.cache?.values() ?? [])].map((ow: any) => ({
                id: ow.id, allow: ow.allow?.bitfield?.toString(), deny: ow.deny?.bitfield?.toString(),
            })).sort((a: any, b: any) => a.id.localeCompare(b.id))
        );
        const newPerms = JSON.stringify(
            [...(n.permissionOverwrites?.cache?.values() ?? [])].map((ow: any) => ({
                id: ow.id, allow: ow.allow?.bitfield?.toString(), deny: ow.deny?.bitfield?.toString(),
            })).sort((a: any, b: any) => a.id.localeCompare(b.id))
        );
        const permsChanged = oldPerms !== newPerms;

        if (!nameChanged && !topicChanged && !slowChanged && !nsfwChanged && !bitrateChanged && !permsChanged) return;

        // Overwrite changes use a different audit log event than regular channel edits
        const hasNonPermChanges = nameChanged || topicChanged || slowChanged || nsfwChanged || bitrateChanged;
        const auditEvent = permsChanged && !hasNonPermChanges
            ? AuditLogEvent.ChannelOverwriteUpdate
            : AuditLogEvent.ChannelUpdate;
        // For overwrite events entry.target is the role/user, not the channel — skip targetId check
        const auditTargetId = auditEvent === AuditLogEvent.ChannelOverwriteUpdate ? undefined : newChannel.id;
        const executor = await fetchExecutor(newChannel.guild, auditEvent, auditTargetId);
        await sendLog({
            guild:    newChannel.guild,
            category: 'channel',
            event:    'channelUpdate',
            color:    LogColour.UPDATE,
            title:    `${e('channels')} Channel Updated`,
            fields: [
                { name: 'Channel',  value: `<#${newChannel.id}>` },
                { name: 'Executor', value: executor },
                ...(nameChanged    ? [{ name: 'Name',        value: `\`${o.name}\` → \`${n.name}\`` }] : []),
                ...(topicChanged   ? [{ name: 'Topic',       value: `${o.topic ?? '`None`'} → ${n.topic ?? '`None`'}` }] : []),
                ...(slowChanged    ? [{ name: 'Slowmode',    value: `\`${o.rateLimitPerUser}s\` → \`${n.rateLimitPerUser}s\`` }] : []),
                ...(nsfwChanged    ? [{ name: 'NSFW',        value: `\`${o.nsfw}\` → \`${n.nsfw}\`` }] : []),
                ...(bitrateChanged ? [{ name: 'Bitrate',     value: `\`${o.bitrate}\` → \`${n.bitrate}\`` }] : []),
                ...(permsChanged   ? [{ name: 'Permissions', value: 'Overwrites updated' }] : []),
            ],
            footer: `ID: ${newChannel.id}`,
        });
    },
};

// ── Role events ───────────────────────────────────────────────────────────────
export const roleCreate: Event<'roleCreate'> = {
    name: 'roleCreate',
    async execute(client, role) {
        const executor = await fetchExecutor(role.guild, AuditLogEvent.RoleCreate, role.id);
        await sendLog({
            guild:    role.guild,
            category: 'role',
            event:    'roleCreate',
            color:    LogColour.CREATE,
            title:    `${e('roles')} Role Created`,
            fields: [
                { name: 'Name',     value: `<@&${role.id}>` },
                { name: 'Color',    value: `\`${role.hexColor}\`` },
                { name: 'Executor', value: executor },
            ],
            footer: `ID: ${role.id}`,
        });
    },
};

export const roleDeleteLog: Event<'roleDelete'> = {
    name: 'roleDelete',
    async execute(client, role) {
        const executor = await fetchExecutor(role.guild, AuditLogEvent.RoleDelete, role.id);
        await sendLog({
            guild:    role.guild,
            category: 'role',
            event:    'roleDelete',
            color:    LogColour.DELETE,
            title:    `${e('roles')} Role Deleted`,
            fields: [
                { name: 'Name',     value: `\`@${role.name}\`` },
                { name: 'Executor', value: executor },
            ],
            footer: `ID: ${role.id}`,
        });
    },
};

export const roleUpdateLog: Event<'roleUpdate'> = {
    name: 'roleUpdate',
    async execute(client, oldRole, newRole) {
        const nameChanged   = oldRole.name        !== newRole.name;
        const colorChanged  = oldRole.hexColor    !== newRole.hexColor;
        const permsChanged  = oldRole.permissions.bitfield !== newRole.permissions.bitfield;
        const hoistChanged  = oldRole.hoist       !== newRole.hoist;
        const mentChanged   = oldRole.mentionable !== newRole.mentionable;
        const iconChanged   = oldRole.icon        !== newRole.icon;

        if (!nameChanged && !colorChanged && !permsChanged && !hoistChanged && !mentChanged && !iconChanged) return;

        // Build permission diff using explicit flag sets only
        // (avoids .has() which resolves implied permissions through Administrator)
        let permDiff = '';
        if (permsChanged) {
            const oldFlags = new Set(oldRole.permissions.toArray());
            const newFlags = new Set(newRole.permissions.toArray());
            const added    = [...newFlags].filter(p => !oldFlags.has(p));
            const removed  = [...oldFlags].filter(p => !newFlags.has(p));
            const lines    = [
                ...added.map(p   => `\`+ ${p}\``),
                ...removed.map(p => `\`- ${p}\``),
            ];
            permDiff = lines.join('\n') || 'Updated';
        }

        const executor = await fetchExecutor(newRole.guild, AuditLogEvent.RoleUpdate, newRole.id);
        await sendLog({
            guild:    newRole.guild,
            category: 'role',
            event:    'roleUpdate',
            color:    LogColour.UPDATE,
            title:    `${e('roles')} Role Updated`,
            fields: [
                { name: 'Role',     value: `<@&${newRole.id}>` },
                { name: 'Executor', value: executor },
                ...(nameChanged  ? [{ name: 'Name',        value: `\`${oldRole.name}\` → \`${newRole.name}\`` }] : []),
                ...(colorChanged ? [{ name: 'Color',       value: `\`${oldRole.hexColor}\` → \`${newRole.hexColor}\`` }] : []),
                ...(permsChanged ? [{ name: 'Permissions', value: permDiff }] : []),
                ...(hoistChanged ? [{ name: 'Hoisted',     value: `\`${oldRole.hoist}\` → \`${newRole.hoist}\`` }] : []),
                ...(mentChanged  ? [{ name: 'Mentionable', value: `\`${oldRole.mentionable}\` → \`${newRole.mentionable}\`` }] : []),
                ...(iconChanged  ? [{ name: 'Icon',        value: newRole.icon ? 'Updated' : 'Removed' }] : []),
            ],
            footer: `ID: ${newRole.id}`,
        });
    },
};

// ── Voice events ──────────────────────────────────────────────────────────────
export const voiceStateUpdate: Event<'voiceStateUpdate'> = {
    name: 'voiceStateUpdate',
    async execute(client, oldState, newState) {
        if (!newState.guild) return;
        const userId = newState.member?.id ?? oldState.member?.id;
        if (!userId) return;

        // Joined voice
        if (!oldState.channelId && newState.channelId) {
            await sendLog({
                guild:    newState.guild,
                category: 'voice',
                event:    'voiceJoin',
                color:    LogColour.CREATE,
                title:    `${e('voice')} Joined Voice`,
                fields: [
                    { name: 'User',    value: `<@${userId}>` },
                    { name: 'Channel', value: `<#${newState.channelId}>` },
                ],
                footer: `<t:${Math.floor(Date.now() / 1000)}:T>`,
            });
        }

        // Left voice
        else if (oldState.channelId && !newState.channelId) {
            await sendLog({
                guild:    newState.guild,
                category: 'voice',
                event:    'voiceLeave',
                color:    LogColour.DELETE,
                title:    `${e('voice')} Left Voice`,
                fields: [
                    { name: 'User',    value: `<@${userId}>` },
                    { name: 'Channel', value: `<#${oldState.channelId}>` },
                ],
                footer: `<t:${Math.floor(Date.now() / 1000)}:T>`,
            });
        }

        // Moved between channels
        else if (oldState.channelId && newState.channelId && oldState.channelId !== newState.channelId) {
            await sendLog({
                guild:    newState.guild,
                category: 'voice',
                event:    'voiceMove',
                color:    LogColour.UPDATE,
                title:    `${e('voice')} Moved Voice Channel`,
                fields: [
                    { name: 'User', value: `<@${userId}>` },
                    { name: 'From', value: `<#${oldState.channelId}>` },
                    { name: 'To',   value: `<#${newState.channelId}>` },
                ],
                footer: `<t:${Math.floor(Date.now() / 1000)}:T>`,
            });
        }
    },
};

// ── User update (global avatar) ───────────────────────────────────────────────
export const userUpdateLog: Event<'userUpdate'> = {
    name: 'userUpdate',
    async execute(client, oldUser, newUser) {
        if (oldUser.avatar === newUser.avatar) return;

        for (const guild of client.guilds.cache.values()) {
            const member = guild.members.cache.get(newUser.id);
            if (!member) continue;

            await sendLog({
                guild,
                category: 'member',
                event:    'memberAvatar',
                color:    LogColour.UPDATE,
                title:    `${e('members')} Avatar Changed`,
                fields: [
                    { name: 'User', value: `<@${newUser.id}> (${newUser.tag})` },
                ],
                footer: `ID: ${newUser.id}`,
                image: newUser.displayAvatarURL({ size: 256 }),
            });
        }
    },
};

// ── Emoji events ──────────────────────────────────────────────────────────────
export const emojiCreate: Event<'emojiCreate'> = {
    name: 'emojiCreate',
    async execute(client, emoji) {
        const executor = await fetchExecutor(emoji.guild, AuditLogEvent.EmojiCreate, emoji.id);
        await sendLog({
            guild:    emoji.guild,
            category: 'emoji',
            event:    'emojiCreate',
            color:    LogColour.CREATE,
            title:    `${e('star')} Emoji Added`,
            fields: [
                { name: 'Name',     value: `\`:${emoji.name}:\`` },
                { name: 'Emoji',    value: `<${emoji.animated ? 'a' : ''}:${emoji.name}:${emoji.id}>` },
                { name: 'Executor', value: executor },
            ],
            footer: `ID: ${emoji.id}`,
        });
    },
};

export const emojiDelete: Event<'emojiDelete'> = {
    name: 'emojiDelete',
    async execute(client, emoji) {
        const executor = await fetchExecutor(emoji.guild, AuditLogEvent.EmojiDelete, emoji.id);
        await sendLog({
            guild:    emoji.guild,
            category: 'emoji',
            event:    'emojiDelete',
            color:    LogColour.DELETE,
            title:    `${e('error')} Emoji Removed`,
            fields: [
                { name: 'Name',     value: `\`:${emoji.name}:\`` },
                { name: 'Executor', value: executor },
            ],
            footer: `ID: ${emoji.id}`,
        });
    },
};

export const emojiUpdate: Event<'emojiUpdate'> = {
    name: 'emojiUpdate',
    async execute(client, oldEmoji, newEmoji) {
        if (oldEmoji.name === newEmoji.name) return;
        const executor = await fetchExecutor(newEmoji.guild, AuditLogEvent.EmojiUpdate, newEmoji.id);
        await sendLog({
            guild:    newEmoji.guild,
            category: 'emoji',
            event:    'emojiUpdate',
            color:    LogColour.UPDATE,
            title:    `${e('star')} Emoji Renamed`,
            fields: [
                { name: 'Before',   value: `\`:${oldEmoji.name}:\`` },
                { name: 'After',    value: `\`:${newEmoji.name}:\`` },
                { name: 'Emoji',    value: `<${newEmoji.animated ? 'a' : ''}:${newEmoji.name}:${newEmoji.id}>` },
                { name: 'Executor', value: executor },
            ],
            footer: `ID: ${newEmoji.id}`,
        });
    },
};

// ── Server (guild) events ────────────────────────────────────────────────────
export const guildUpdateLog: Event<'guildUpdate'> = {
    name: 'guildUpdate',
    async execute(client, oldGuild, newGuild) {
        const executor = await fetchExecutor(newGuild, AuditLogEvent.GuildUpdate);

        // Name
        if (oldGuild.name !== newGuild.name) {
            await sendLog({
                guild: newGuild, category: 'server', event: 'serverNameUpdate',
                color: LogColour.UPDATE, title: `${e('settings')} Server Name Changed`,
                fields: [
                    { name: 'Before',   value: `\`${oldGuild.name}\`` },
                    { name: 'After',    value: `\`${newGuild.name}\`` },
                    { name: 'Executor', value: executor },
                ],
                footer: `ID: ${newGuild.id}`,
            });
        }

        // Icon
        if (oldGuild.icon !== newGuild.icon) {
            await sendLog({
                guild: newGuild, category: 'server', event: 'serverIconUpdate',
                color: LogColour.UPDATE, title: `${e('settings')} Server Icon Changed`,
                fields: [
                    { name: 'Executor', value: executor },
                ],
                footer: `ID: ${newGuild.id}`,
                image: newGuild.iconURL({ size: 256 }) ?? undefined,
            });
        }

        // Banner
        if (oldGuild.banner !== newGuild.banner) {
            await sendLog({
                guild: newGuild, category: 'server', event: 'serverBannerUpdate',
                color: LogColour.UPDATE, title: `${e('settings')} Server Banner Changed`,
                fields: [
                    { name: 'Executor', value: executor },
                ],
                footer: `ID: ${newGuild.id}`,
                image: newGuild.bannerURL({ size: 1024 }) ?? undefined,
            });
        }

        // Description
        if (oldGuild.description !== newGuild.description) {
            await sendLog({
                guild: newGuild, category: 'server', event: 'serverDescriptionUpdate',
                color: LogColour.UPDATE, title: `${e('settings')} Server Description Changed`,
                fields: [
                    { name: 'Before',   value: oldGuild.description ?? '`None`' },
                    { name: 'After',    value: newGuild.description ?? '`None`' },
                    { name: 'Executor', value: executor },
                ],
                footer: `ID: ${newGuild.id}`,
            });
        }

        // Vanity URL
        if (oldGuild.vanityURLCode !== newGuild.vanityURLCode) {
            await sendLog({
                guild: newGuild, category: 'server', event: 'serverVanityUpdate',
                color: LogColour.UPDATE, title: `${e('settings')} Vanity URL Changed`,
                fields: [
                    { name: 'Before',   value: oldGuild.vanityURLCode ? `\`discord.gg/${oldGuild.vanityURLCode}\`` : '`None`' },
                    { name: 'After',    value: newGuild.vanityURLCode ? `\`discord.gg/${newGuild.vanityURLCode}\`` : '`None`' },
                    { name: 'Executor', value: executor },
                ],
                footer: `ID: ${newGuild.id}`,
            });
        }

        // Verification level
        if (oldGuild.verificationLevel !== newGuild.verificationLevel) {
            await sendLog({
                guild: newGuild, category: 'server', event: 'serverVerificationUpdate',
                color: LogColour.UPDATE, title: `${e('settings')} Verification Level Changed`,
                fields: [
                    { name: 'Before',   value: `\`${oldGuild.verificationLevel}\`` },
                    { name: 'After',    value: `\`${newGuild.verificationLevel}\`` },
                    { name: 'Executor', value: executor },
                ],
                footer: `ID: ${newGuild.id}`,
            });
        }
    },
};

export default [
    messageDelete,
    messageUpdate,
    messageDeleteBulk,
    memberJoinLog,
    memberLeaveLog,
    memberUpdate,
    userUpdateLog,
    externalModLog,
    channelCreate,
    channelDeleteLog,
    channelUpdate,
    roleCreate,
    roleDeleteLog,
    roleUpdateLog,
    voiceStateUpdate,
    emojiCreate,
    emojiDelete,
    emojiUpdate,
    guildUpdateLog,
];