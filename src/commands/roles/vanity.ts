// src/commands/roles/vanity.ts
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import {
    getVanityConfig, upsertVanityConfig,
    getVanityRoles, addVanityRole, removeVanityRole,
} from '../../db/queries/vanityRoles.js';
import { invalidateVanityCache } from '../../events/vanityRoles.js';

export default {
    data: new SlashCommandBuilder()
        .setName('vanity')
        .setDescription('Reward members who advertise your server in their status')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(s => s
            .setName('set')
            .setDescription('Set the vanity keyword to monitor in member statuses')
            .addStringOption(o => o
                .setName('keyword')
                .setDescription('Text to look for in status (e.g. /fade)')
                .setRequired(true)
            )
        )
        .addSubcommandGroup(g => g
            .setName('role')
            .setDescription('Manage roles awarded for vanity')
            .addSubcommand(s => s
                .setName('add')
                .setDescription('Add a role to award for vanity')
                .addRoleOption(o => o.setName('role').setDescription('Role to award').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('remove')
                .setDescription('Remove a vanity award role')
                .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('list')
                .setDescription('View all vanity award roles')
            )
        )
        .addSubcommand(s => s
            .setName('message')
            .setDescription('Set the message sent when a member gets the vanity role')
            .addStringOption(o => o
                .setName('message')
                .setDescription('Message content. Variables: {user}, {username}, {server}')
                .setRequired(true)
                .setMaxLength(500)
            )
        )
        .addSubcommandGroup(g => g
            .setName('award')
            .setDescription('Configure where the award message is sent')
            .addSubcommand(s => s
                .setName('channel')
                .setDescription('Set the channel for award messages')
                .addChannelOption(o => o
                    .setName('channel')
                    .setDescription('Channel to send award messages in')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
                )
            )
        )
        .addSubcommand(s => s
            .setName('config')
            .setDescription('View current vanity configuration')
        )
        .addSubcommand(s => s
            .setName('disable')
            .setDescription('Disable the vanity role system')
        ),

    category:        'roles',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        3,

    async execute(interaction) {
        const group   = interaction.options.getSubcommandGroup(false);
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild!.id;

        if (sub === 'set') {
            const keyword = interaction.options.getString('keyword', true).trim();
            await upsertVanityConfig(guildId, { keyword, enabled: true });
                        invalidateVanityCache(guildId);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Vanity keyword set to \`${keyword}\`\n-# Members with this text in their status will receive the vanity role(s).`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (group === 'role') {
            if (sub === 'add') {
                const role  = interaction.options.getRole('role', true);
                const roles = await getVanityRoles(guildId);
                if (roles.some(r => r.roleId === role.id)) {
                    await interaction.reply({ content: `${e('error')} <@&${role.id}> is already a vanity award role.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                await addVanityRole(guildId, role.id);
                            invalidateVanityCache(guildId);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  <@&${role.id}> added as a vanity award role.`)
                    .build();
                await sendResponse(interaction, [card]);
            } else if (sub === 'remove') {
                const role = interaction.options.getRole('role', true);
                await removeVanityRole(guildId, role.id);
                            invalidateVanityCache(guildId);
                const card = new FadeContainer(Colours.DANGER)
                    .text(`${e('success')}  <@&${role.id}> removed from vanity award roles.`)
                    .build();
                await sendResponse(interaction, [card]);
            } else if (sub === 'list') {
                const roles = await getVanityRoles(guildId);
                if (!roles.length) {
                    await interaction.reply({ content: `${e('error')} No vanity roles configured. Use \`/vanity role add\`.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                const card = new FadeContainer(Colours.FADE)
                    .text(`## ${e('roles')} Vanity Award Roles\n${roles.map(r => `<@&${r.roleId}>`).join('\n')}`)
                    .build();
                await sendResponse(interaction, [card], true);
            }
            return;
        }

        if (sub === 'message') {
            const message = interaction.options.getString('message', true);
            await upsertVanityConfig(guildId, { message });
                        invalidateVanityCache(guildId);
            const preview = message
                .replace(/{user}/g,       interaction.user.toString())
                .replace(/{username}/g,   interaction.user.username)
                .replace(/{server}/g,     interaction.guild!.name);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Award message set.\n-# Preview: ${preview}`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (group === 'award' && sub === 'channel') {
            const channel = interaction.options.getChannel('channel', true);
            await upsertVanityConfig(guildId, { channelId: channel.id });
                        invalidateVanityCache(guildId);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Award messages will be sent in <#${channel.id}>`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'config') {
            const config = await getVanityConfig(guildId);
            const roles  = await getVanityRoles(guildId);
            if (!config) {
                await interaction.reply({ content: `${e('error')} Vanity roles not configured. Use \`/vanity set\` to start.`, flags: MessageFlags.Ephemeral });
                return;
            }
            const card = new FadeContainer(Colours.FADE)
                .text(
                    `## ${e('settings')} Vanity Config\n` +
                    `**Keyword:** \`${config.keyword}\`\n` +
                    `**Status:** ${config.enabled ? `${e('online')} Enabled` : `${e('offline')} Disabled`}\n` +
                    `**Roles:** ${roles.length ? roles.map(r => `<@&${r.roleId}>`).join(', ') : 'None'}\n` +
                    `**Channel:** ${config.channelId ? `<#${config.channelId}>` : 'Not set'}\n` +
                    `**Message:** ${config.message ?? 'Default'}`
                )
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        if (sub === 'disable') {
            await upsertVanityConfig(guildId, { enabled: false });
                        invalidateVanityCache(guildId);
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('success')}  Vanity role system disabled.`)
                .build();
            await sendResponse(interaction, [card]);
        }
    },
} satisfies Command;
