// src/commands/server/bind.ts
import { Message, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { e } from '../../components/emojis.js';
import type { FadeClient } from '../../client.js';
import { addBoundRole, removeBoundRole, getBoundRoles } from '../../db/queries/boundRoles.js';

export default {
    data: { name: 'bind', description: 'Bind specific roles for internal bot permissions.' },
    prefixOnly: true,
    category: 'server',
    syntax: "f!bind <subcommand> [args]",
    example: "f!bind staff @Moderator",
    subcommands: [
        { name: 'staff', description: 'Bind a role as server staff.' },
        { name: 'staff list', description: 'List all bound staff roles.' },
        { name: 'staff remove', description: 'Remove a role from staff binding.' }
    ],
    
    async prefixExecute(message: Message, args: string[], client: FadeClient) {
        if (!message.guild || !message.member) return;

        // Admin only command
        if (!message.member.permissions.has(PermissionFlagsBits.Administrator) && message.guild.ownerId !== message.author.id) {
            const card = new FadeContainer()
                .text(`${e('error')} **Permission Denied**`)
                .separator()
                .text(`You must be an Administrator to use this command.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        const sub = args[0]?.toLowerCase();
        
        if (sub === 'staff') {
            const sub2 = args[1]?.toLowerCase();
            
            if (sub2 === 'list') {
                const staffRoles = await getBoundRoles(message.guild.id, 'staff');
                
                const card = new FadeContainer()
                    .text(`${e('roles')} **Staff Roles**`)
                    .separator();

                if (staffRoles.length === 0) {
                    card.text('*No staff roles are bound.*');
                } else {
                    card.text(staffRoles.map(id => `<@&${id}>`).join('\n'));
                }
                
                await sendMessage(message, [card.build()]);
                return;
            }

            if (sub2 === 'remove') {
                const targetRole = message.mentions.roles.first() || message.guild.roles.cache.get(args[2]);
                if (!targetRole) {
                    const card = new FadeContainer()
                        .text(`${e('error')} **Invalid Syntax**`)
                        .separator()
                        .text(`Please mention or provide the ID of a role to remove.\nUsage: \`f!bind staff remove @role\``)
                        .build();
                    await sendMessage(message, [card]);
                    return;
                }

                await removeBoundRole(message.guild.id, targetRole.id, 'staff');
                const card = new FadeContainer()
                    .text(`${e('success')} Successfully unbound ${targetRole.toString()} from staff roles.`)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            // Bind a role
            const targetRole = message.mentions.roles.first() || message.guild.roles.cache.get(args[1]);
            if (!targetRole) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Invalid Syntax**`)
                    .separator()
                    .text(`Please mention or provide the ID of a role to bind.\nUsage: \`f!bind staff @role\``)
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            await addBoundRole(message.guild.id, targetRole.id, 'staff');
            const card = new FadeContainer()
                .text(`${e('success')} Successfully bound ${targetRole.toString()} as a staff role.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        const card = new FadeContainer()
            .text(`${e('error')} **Invalid Subcommand**`)
            .separator()
            .text(`Valid subcommands are: \`staff\``)
            .build();
        await sendMessage(message, [card]);
    }
} satisfies Command;
