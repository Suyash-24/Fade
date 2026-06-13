// src/commands/server/rolealias.ts
import { Message, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { e } from '../../components/emojis.js';
import type { FadeClient } from '../../client.js';
import { addRoleAlias, removeRoleAlias, getGuildRoleAliases, setReqRole, getReqRole } from '../../db/queries/roleAliases.js';

export default {
    data: { name: 'rolealias', description: 'Manage custom role aliases.' },
    prefixOnly: true,
    category: 'server',
    
    async prefixExecute(message: Message, args: string[], client: FadeClient) {
        if (!message.guild || !message.member) return;

        const sub = args[0]?.toLowerCase();
        
        // 1. list
        if (!sub || sub === 'list') {
            const reqroleId = await getReqRole(message.guild.id);
            const aliases = await getGuildRoleAliases(message.guild.id);
            
            // Check list permission (Manage Guild OR ReqRole OR Manage Roles)
            let hasPerm = message.member.permissions.has(PermissionFlagsBits.ManageRoles) ||
                          message.member.permissions.has(PermissionFlagsBits.ManageGuild) || 
                          message.member.permissions.has(PermissionFlagsBits.Administrator);
            if (!hasPerm && reqroleId) {
                hasPerm = message.member.roles.cache.has(reqroleId);
            }

            if (!hasPerm) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Permission Denied**`)
                    .separator()
                    .text(`You need \`Manage Guild\`, \`Manage Roles\`, or the custom \`ReqRole\` to view role aliases.`)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            const card = new FadeContainer()
                .text(`${e('roles')} **Role Aliases**`)
                .separator()
                .text(`**Required Role:** ${reqroleId ? `<@&${reqroleId}>` : '`None`'}\n`);

            card.separator();
                
            if (aliases.size === 0) {
                card.text('*No role aliases configured yet.*');
            } else {
                let listStr = '';
                for (const [alias, roleId] of aliases.entries()) {
                    listStr += `\`${alias}\` → <@&${roleId}>\n`;
                }
                card.text(listStr);
            }

            await sendMessage(message, [card.build()]);
            return;
        }

        // Must be Manage Guild for add/remove/reqrole
        if (!message.member.permissions.has(PermissionFlagsBits.ManageGuild) && !message.member.permissions.has(PermissionFlagsBits.Administrator)) {
            const card = new FadeContainer()
                .text(`${e('error')} **Permission Denied**`)
                .separator()
                .text(`You need \`Manage Guild\` permission to configure aliases or the reqrole.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        // 2. reqrole
        if (sub === 'reqrole') {
            const target = args[1]?.toLowerCase();
            if (!target) {
                const reqroleId = await getReqRole(message.guild.id);
                const card = new FadeContainer()
                    .text(`${e('roles')} **ReqRole Configuration**`)
                    .separator()
                    .text(`**Current ReqRole:** ${reqroleId ? `<@&${reqroleId}>` : '`None`'}\n\nUse \`rolealias reqrole @role\` to set or \`rolealias reqrole off\` to remove.`)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            if (target === 'off' || target === 'none' || target === 'clear') {
                await setReqRole(message.guild.id, null);
                const card = new FadeContainer()
                    .text(`${e('success')} **ReqRole Disabled**`)
                    .separator()
                    .text(`Users will now need the default \`Manage Roles\` permission to use aliases.`)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            const targetId = target?.replace(/\D/g, '');
            const role = targetId ? message.guild.roles.cache.get(targetId) : null;
            if (!role) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Invalid Role**`)
                    .separator()
                    .text(`Please mention a valid role or provide a role ID.`)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            await setReqRole(message.guild.id, role.id);
            const card = new FadeContainer()
                .text(`${e('success')} **ReqRole Set**`)
                .separator()
                .text(`Users must have the <@&${role.id}> role (or Manage Server) to use custom role commands.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        // 3. remove
        if (sub === 'remove') {
            const alias = args[1]?.toLowerCase();
            if (!alias) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Missing Argument**`)
                    .separator()
                    .text(`Usage: \`rolealias remove <alias>\``)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            const existing = await getGuildRoleAliases(message.guild.id);
            if (!existing.has(alias)) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Not Found**`)
                    .separator()
                    .text(`The alias \`${alias}\` does not exist.`)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            await removeRoleAlias(message.guild.id, alias);
            const card = new FadeContainer()
                .text(`${e('success')} **Alias Removed**`)
                .separator()
                .text(`Removed the role alias \`${alias}\`.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        // 4. add
        if (sub === 'add') {
            const alias = args[1]?.toLowerCase();
            const roleInput = args[2];

            if (!alias || !roleInput) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Missing Arguments**`)
                    .separator()
                    .text(`Usage: \`rolealias add <alias> @role\``)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            if (['add', 'remove', 'list', 'reqrole'].includes(alias)) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Invalid Alias**`)
                    .separator()
                    .text(`\`${alias}\` is a reserved word and cannot be used as an alias.`)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            const existing = await getGuildRoleAliases(message.guild.id);
            if (existing.has(alias)) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Alias Exists**`)
                    .separator()
                    .text(`The alias \`${alias}\` is already in use.`)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            const targetId = roleInput?.replace(/\D/g, '');
            const role = targetId ? message.guild.roles.cache.get(targetId) : null;
            if (!role) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Invalid Role**`)
                    .separator()
                    .text(`Please mention a valid role or provide a role ID.`)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            // Check if role is dangerous
            const dangerousPerms = [
                PermissionFlagsBits.Administrator,
                PermissionFlagsBits.ManageGuild,
                PermissionFlagsBits.ManageRoles,
                PermissionFlagsBits.KickMembers,
                PermissionFlagsBits.BanMembers,
                PermissionFlagsBits.ManageChannels,
            ];
            if (dangerousPerms.some(p => role.permissions.has(p))) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Unsafe Role**`)
                    .separator()
                    .text(`You cannot create aliases for roles with dangerous moderation permissions.`)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            if (role.position >= message.guild.members.me!.roles.highest.position) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Hierarchy Error**`)
                    .separator()
                    .text(`I cannot manage that role because it is higher than or equal to my highest role.`)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            // Ensure role isn't already aliased under a different name
            let existingAliasForRole = null;
            for (const [k, v] of existing.entries()) {
                if (v === role.id) existingAliasForRole = k;
            }
            if (existingAliasForRole) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Role Aliased**`)
                    .separator()
                    .text(`That role already has an alias: \`${existingAliasForRole}\`. Only one alias per role is allowed.`)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            await addRoleAlias(message.guild.id, alias, role.id);
            const card = new FadeContainer()
                .text(`${e('success')} **Alias Added**`)
                .separator()
                .text(`Added alias \`${alias}\` for the role <@&${role.id}>.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }
        
        // Invalid subcommand
        const card = new FadeContainer()
            .text(`${e('error')} **Unknown Subcommand**`)
            .separator()
            .text(`Valid subcommands: \`add\`, \`remove\`, \`list\`, \`reqrole\`.`)
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;
