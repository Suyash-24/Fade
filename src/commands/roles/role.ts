// src/commands/roles/role.ts
import { Message, PermissionFlagsBits, Role, GuildMember } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { e } from '../../components/emojis.js';
import type { FadeClient } from '../../client.js';

function isManageable(member: GuildMember, role: Role, botMember: GuildMember): string | null {
    if (role.managed) return `I cannot manage the integration role ${role.toString()}.`;
    if (role.position >= botMember.roles.highest.position) return `My highest role must be higher than ${role.toString()} to manage it.`;
    if (member.id === member.guild.ownerId) return null; // Owner bypasses user hierarchy check
    if (role.position >= member.roles.highest.position) return `Your highest role must be higher than ${role.toString()} to manage it.`;
    return null;
}

async function processMassRole(message: Message, members: GuildMember[], role: Role, action: 'add' | 'remove') {
    // Initial aesthetic message
    const card = new FadeContainer()
        .text(`${e('loading')} **Processing Roles...**`)
        .separator()
        .text(`Assigning ${role.toString()} to **${members.length}** members. This may take some time due to rate limits.`)
        .build();
        
    const statusMsg = await sendMessage(message, [card]);

    let success = 0;
    let failed = 0;

    // Background process to avoid blocking
    (async () => {
        for (const member of members) {
            try {
                if (action === 'add') {
                    if (!member.roles.cache.has(role.id)) {
                        await member.roles.add(role);
                        success++;
                    }
                } else {
                    if (member.roles.cache.has(role.id)) {
                        await member.roles.remove(role);
                        success++;
                    }
                }
            } catch (err) {
                failed++;
            }
            // Add a small delay to avoid rate limits
            await new Promise(r => setTimeout(r, 600));
        }

        // Update the message
        const resultCard = new FadeContainer()
            .text(`${e('success')} **Role Operation Completed**`)
            .separator()
            .text(`Successfully ${action === 'add' ? 'added' : 'removed'} ${role.toString()} for **${success}** members.`);
            
        if (failed > 0) {
            resultCard.text(`\nFailed to process **${failed}** members.`);
        }
        
        await statusMsg.edit({ components: [resultCard.build()], flags: 1 << 13, allowedMentions: { parse: [] } } as any).catch(() => {});
    })();
}

export default {
    data: { name: 'role', description: 'Advanced basic and mass role management.' },
    prefixOnly: true,
    category: 'roles',
    syntax: "f!role <subcommand> [args]",
    example: "f!role add @member @role",
    subcommands: [
        { name: 'add', description: 'Add a role to a user.' },
        { name: 'remove', description: 'Remove a role from a user.' },
        { name: 'multiple', description: 'Add/remove multiple roles for a user.' },
        { name: 'all', description: 'Add a role to all members.' },
        { name: 'humans', description: 'Add a role to all human members.' },
        { name: 'bots', description: 'Add a role to all bots.' },
        { name: 'removeall', description: 'Remove a role from all members.' },
        { name: 'in', description: 'Give a role to everyone who has a specific role.' }
    ],
    
    async prefixExecute(message: Message, args: string[], client: FadeClient) {
        if (!message.guild || !message.member) return;

        if (!message.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
            const card = new FadeContainer()
                .text(`${e('error')} **Permission Denied**`)
                .separator()
                .text(`I need the \`Manage Roles\` permission to do this.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        if (!message.member.permissions.has(PermissionFlagsBits.ManageRoles) && message.guild.ownerId !== message.author.id) {
            const card = new FadeContainer()
                .text(`${e('error')} **Permission Denied**`)
                .separator()
                .text(`You must have \`Manage Roles\` to use this command.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        const sub = args[0]?.toLowerCase();
        
        if (!sub) {
            const card = new FadeContainer()
                .text(`${e('error')} **Invalid Syntax**`)
                .separator()
                .text(`Please provide a subcommand. Use \`f!help role\` for a list of subcommands.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        if (sub === 'add' || sub === 'remove') {
            const member = message.mentions.members?.first() || message.guild.members.cache.get(args[1]);
            const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);

            if (!member || !role) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Invalid Syntax**`)
                    .separator()
                    .text(`Usage: \`f!role ${sub} <@user> <@role>\``)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            const error = isManageable(message.member, role, message.guild.members.me);
            if (error) {
                const card = new FadeContainer().text(`${e('error')} **Hierarchy Error**\n${error}`).build();
                await sendMessage(message, [card]);
                return;
            }

            if (sub === 'add') {
                if (member.roles.cache.has(role.id)) {
                    const card = new FadeContainer()
                        .text(`${e('error')} ${member.toString()} already has the role ${role.toString()}.`)
                        .build();
                    await sendMessage(message, [card]);
                    return;
                }
                await member.roles.add(role);
                const card = new FadeContainer()
                    .text(`${e('success')} Successfully added ${role.toString()} to ${member.toString()}.`)
                    .build();
                await sendMessage(message, [card]);
            } else {
                if (!member.roles.cache.has(role.id)) {
                    const card = new FadeContainer()
                        .text(`${e('error')} ${member.toString()} does not have the role ${role.toString()}.`)
                        .build();
                    await sendMessage(message, [card]);
                    return;
                }
                await member.roles.remove(role);
                const card = new FadeContainer()
                    .text(`${e('success')} Successfully removed ${role.toString()} from ${member.toString()}.`)
                    .build();
                await sendMessage(message, [card]);
            }
            return;
        }

        if (sub === 'multiple') {
            const member = message.mentions.members?.first() || message.guild.members.cache.get(args[1]);
            if (!member) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Invalid Syntax**`)
                    .separator()
                    .text(`Usage: \`f!role multiple <@user> <@role1> <@role2> ...\``)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            const roles = message.mentions.roles.map(r => r);
            if (roles.length === 0) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Invalid Syntax**`)
                    .separator()
                    .text(`You must mention at least one role.`)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            let added = [];
            let removed = [];
            let errors = [];

            for (const role of roles) {
                const error = isManageable(message.member, role, message.guild.members.me);
                if (error) {
                    errors.push(`${role.toString()}: ${error}`);
                    continue;
                }
                if (member.roles.cache.has(role.id)) {
                    await member.roles.remove(role).catch(() => {});
                    removed.push(role.toString());
                } else {
                    await member.roles.add(role).catch(() => {});
                    added.push(role.toString());
                }
            }

            const card = new FadeContainer().text(`${e('success')} **Role Operation Completed**`).separator();
            if (added.length > 0) card.text(`**Added:** ${added.join(', ')}`);
            if (removed.length > 0) card.text(`**Removed:** ${removed.join(', ')}`);
            if (errors.length > 0) card.text(`**Errors:**\n${errors.join('\n')}`);

            await sendMessage(message, [card.build()]);
            return;
        }

        if (sub === 'all' || sub === 'humans' || sub === 'bots' || sub === 'removeall') {
            const role = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
            if (!role) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Invalid Syntax**`)
                    .separator()
                    .text(`Usage: \`f!role ${sub} <@role>\``)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            const error = isManageable(message.member, role, message.guild.members.me);
            if (error) {
                const card = new FadeContainer().text(`${e('error')} **Hierarchy Error**\n${error}`).build();
                await sendMessage(message, [card]);
                return;
            }

            await message.guild.members.fetch();
            let targets = Array.from(message.guild.members.cache.values());

            if (sub === 'humans') targets = targets.filter(m => !m.user.bot && !m.roles.cache.has(role.id));
            else if (sub === 'bots') targets = targets.filter(m => m.user.bot && !m.roles.cache.has(role.id));
            else if (sub === 'all') targets = targets.filter(m => !m.roles.cache.has(role.id));
            else if (sub === 'removeall') targets = targets.filter(m => m.roles.cache.has(role.id));

            if (targets.length === 0) {
                const card = new FadeContainer()
                    .text(`${e('error')} No applicable members found for this operation.`)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            await processMassRole(message, targets, role, sub === 'removeall' ? 'remove' : 'add');
            return;
        }

        if (sub === 'in') {
            const baseRole = message.mentions.roles.first();
            const assignRole = message.mentions.roles.last();

            if (!baseRole || !assignRole || baseRole.id === assignRole.id) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Invalid Syntax**`)
                    .separator()
                    .text(`Usage: \`f!role in <@baseRole> <@assignRole>\``)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            const error = isManageable(message.member, assignRole, message.guild.members.me);
            if (error) {
                const card = new FadeContainer().text(`${e('error')} **Hierarchy Error**\n${error}`).build();
                await sendMessage(message, [card]);
                return;
            }

            await message.guild.members.fetch();
            const targets = Array.from(message.guild.members.cache.values())
                .filter(m => m.roles.cache.has(baseRole.id) && !m.roles.cache.has(assignRole.id));

            if (targets.length === 0) {
                const card = new FadeContainer()
                    .text(`${e('error')} No members found in ${baseRole.toString()} who don't already have ${assignRole.toString()}.`)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            await processMassRole(message, targets, assignRole, 'add');
            return;
        }

        const card = new FadeContainer()
            .text(`${e('error')} **Invalid Subcommand**`)
            .separator()
            .text(`Use \`f!help role\` for a list of subcommands.`)
            .build();
        await sendMessage(message, [card]);
    }
} satisfies Command;
