// src/commands/utility/bumpreminder.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import { getBumpReminder, updateBumpReminder } from '../../db/queries/bumpReminder.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('bumpreminder')
        .setDescription('Configure the Disboard bump reminder')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(s => s
            .setName('view')
            .setDescription('View current bump reminder settings')
        )
        .addSubcommand(s => s
            .setName('setup')
            .setDescription('Set up the bump reminder')
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel to send reminders in')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
            .addRoleOption(o => o
                .setName('role')
                .setDescription('Role to ping when it\'s time to bump')
                .setRequired(false)
            )
        )
        .addSubcommand(s => s
            .setName('toggle')
            .setDescription('Enable or disable bump reminders')
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('message')
            .setDescription('Set a custom reminder message')
            .addStringOption(o => o
                .setName('message')
                .setDescription('Custom message (leave empty to reset to default)')
                .setRequired(false)
            )
        ),

    category: 'utility',
    guildOnly: true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown: 5,

    async execute(interaction, client) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        if (sub === 'view') {
            const config = await getBumpReminder(guild.id);
            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('boost')} Bump Reminder Config`)
                .separator(true)
                .text([
                    `**Enabled** — \`${config?.enabled ? 'Yes' : 'No'}\``,
                    `**Channel** — ${config?.channelId ? `<#${config.channelId}>` : '`Not set`'}`,
                    `**Ping role** — ${config?.roleId ? `<@&${config.roleId}>` : '`None`'}`,
                    `**Message** — ${config?.message ?? '`Default`'}`,
                    config?.lastBump
                        ? `**Last bump** — <t:${Math.floor(new Date(config.lastBump).getTime() / 1000)}:R>`
                        : `**Last bump** — \`Never recorded\``,
                ].join('\n'))
                .separator(false)
                .text(`-# Fade detects \`/bump\` on Disboard automatically`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        if (sub === 'setup') {
            const channel = interaction.options.getChannel('channel', true);
            const role    = interaction.options.getRole('role');
            await updateBumpReminder(guild.id, {
                channelId: channel.id,
                roleId:    role?.id ?? null,
                enabled:   true,
            });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `## ${e('boost')} Bump Reminder Enabled\n` +
                    `Reminders → <#${channel.id}>\n` +
                    (role ? `Ping → <@&${role.id}>\n` : '') +
                    `-# Bump your server with \`/bump\` on Disboard to start`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateBumpReminder(guild.id, { enabled });
            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(`${e('success')}  Bump reminders **${enabled ? 'enabled' : 'disabled'}**`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'message') {
            const message = interaction.options.getString('message');
            await updateBumpReminder(guild.id, { message: message ?? null });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(message
                    ? `${e('success')}  Custom bump reminder message set`
                    : `${e('success')}  Bump reminder message reset to default`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }
    },
} satisfies Command;