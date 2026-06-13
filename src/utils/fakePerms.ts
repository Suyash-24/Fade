// src/utils/fakePerms.ts
import { PermissionFlagsBits, type GuildMember } from 'discord.js';
import { getGuildFakePerms, type FakePerm } from '../db/queries/fakePerms.js';

const PERM_MAP: Record<FakePerm, bigint> = {
    administrator:              PermissionFlagsBits.Administrator,
    ban_members:                PermissionFlagsBits.BanMembers,
    kick_members:               PermissionFlagsBits.KickMembers,
    moderate_members:           PermissionFlagsBits.ModerateMembers,
    manage_messages:            PermissionFlagsBits.ManageMessages,
    manage_nicknames:           PermissionFlagsBits.ManageNicknames,
    manage_roles:               PermissionFlagsBits.ManageRoles,
    manage_guild_expressions:   PermissionFlagsBits.ManageGuildExpressions,
    manage_guild:               PermissionFlagsBits.ManageGuild,
    manage_channels:            PermissionFlagsBits.ManageChannels,
};

/**
 * Checks if a member has a permission either natively (Discord) or via FakePerms.
 * administrator FakePerm grants all mod permissions.
 */
export async function hasPermission(member: GuildMember, permission: FakePerm): Promise<boolean> {
    // Native Discord permission always wins
    const nativePerm = PERM_MAP[permission];
    if (member.permissions.has(nativePerm) || member.permissions.has(PermissionFlagsBits.Administrator)) {
        return true;
    }

    // Check FakePerms from DB
    const rows = await getGuildFakePerms(member.guild.id);
    const memberRoleIds = [...member.roles.cache.keys()];

    for (const row of rows) {
        if (!memberRoleIds.includes(row.roleId)) continue;
        if (row.permission === permission || row.permission === 'administrator') return true;
    }

    return false;
}
