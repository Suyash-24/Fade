import { GuildMember, PermissionFlagsBits } from 'discord.js';
import { getDisabledCommands, getRestrictedCommands } from '../db/queries/commandConfig.js';

/**
 * Evaluates command restrictions.
 * Returns a string (error message) if blocked, or null if allowed.
 */
export async function checkCommandRestrictions(
    guildId: string,
    channelId: string,
    member: GuildMember,
    commandName: string,
    category?: string
): Promise<string | null> {
    // 1. Critical Commands Check
    const bypassCommands = ['command', 'help'];
    if (bypassCommands.includes(commandName)) return null;

    // Server Administrators bypass all restrictions by default
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return null;
    if (member.id === member.guild.ownerId) return null;

    const disabled = await getDisabledCommands(guildId);
    const restricted = await getRestrictedCommands(guildId);

    const targets = [`command:${commandName}`];
    if (category) targets.push(`category:${category}`);

    // 2. Global Disable Check & 3. Channel-Specific Disable Check
    for (const target of targets) {
        const rules = disabled.filter(d => d.target === target);
        
        // Global disable
        if (rules.some(r => r.channelId === null)) {
            return `This ${target.split(':')[0]} is currently disabled server-wide.`;
        }

        // Channel disable
        if (rules.some(r => r.channelId === channelId)) {
            return `This ${target.split(':')[0]} is disabled in <#${channelId}>.`;
        }
    }

    // 4. Role Restriction Check & 5. Channel Restriction Check
    for (const target of targets) {
        const rules = restricted.filter(r => r.target === target);
        if (rules.length === 0) continue;

        const roleRules = rules.filter(r => r.type === 'role');
        const channelRules = rules.filter(r => r.type === 'channel');

        // Role Restrictions
        if (roleRules.length > 0) {
            const hasRole = roleRules.some(r => member.roles.cache.has(r.entityId));
            if (!hasRole) {
                const allowedRoles = roleRules.map(r => `<@&${r.entityId}>`).join(', ');
                return `This ${target.split(':')[0]} is restricted to the following roles: ${allowedRoles}`;
            }
        }

        // Channel Restrictions
        if (channelRules.length > 0) {
            const inChannel = channelRules.some(r => r.entityId === channelId);
            if (!inChannel) {
                const allowedChannels = channelRules.map(r => `<#${r.entityId}>`).join(', ');
                return `This ${target.split(':')[0]} can only be used in: ${allowedChannels}`;
            }
        }
    }

    return null; // Allowed
}
