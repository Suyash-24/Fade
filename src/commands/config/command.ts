import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
    ChatInputCommandInteraction,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { e, Colours } from '../../components/emojis.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import {
    addDisabledCommand,
    removeDisabledCommand,
    addRestrictedCommand,
    removeRestrictedCommand,
    getDisabledCommands,
    getRestrictedCommands,
} from '../../db/queries/commandConfig.js';
import { db } from '../../db/index.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('command')
        .setDescription('Manage command restrictions and access control')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        // ── Disable ───────────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('disable')
            .setDescription('Disable a command or category globally or in a specific channel')
            .addStringOption(o => o
                .setName('type')
                .setDescription('Are you disabling a specific command or an entire category?')
                .setRequired(true)
                .addChoices(
                    { name: 'Command', value: 'command' },
                    { name: 'Category', value: 'category' }
                )
            )
            .addStringOption(o => o
                .setName('name')
                .setDescription('Name of the command (e.g. play) or category (e.g. economy)')
                .setRequired(true)
            )
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Optional: Only disable in this channel. Leave blank to disable globally.')
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        // ── Enable ────────────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('enable')
            .setDescription('Re-enable a command or category')
            .addStringOption(o => o
                .setName('type')
                .setDescription('Command or Category?')
                .setRequired(true)
                .addChoices(
                    { name: 'Command', value: 'command' },
                    { name: 'Category', value: 'category' }
                )
            )
            .addStringOption(o => o
                .setName('name')
                .setDescription('Name of the command or category')
                .setRequired(true)
            )
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Optional: The specific channel to re-enable it in.')
                .addChannelTypes(ChannelType.GuildText)
            )
        )
        // ── Restrict Role ─────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('restrictrole')
            .setDescription('Restrict a command or category to a specific role')
            .addStringOption(o => o
                .setName('type')
                .setDescription('Command or Category?')
                .setRequired(true)
                .addChoices(
                    { name: 'Command', value: 'command' },
                    { name: 'Category', value: 'category' }
                )
            )
            .addStringOption(o => o
                .setName('name')
                .setDescription('Name of the command or category')
                .setRequired(true)
            )
            .addRoleOption(o => o
                .setName('role')
                .setDescription('The role to restrict this to')
                .setRequired(true)
            )
        )
        // ── Restrict Channel ──────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('restrictchannel')
            .setDescription('Restrict a command or category to a specific channel')
            .addStringOption(o => o
                .setName('type')
                .setDescription('Command or Category?')
                .setRequired(true)
                .addChoices(
                    { name: 'Command', value: 'command' },
                    { name: 'Category', value: 'category' }
                )
            )
            .addStringOption(o => o
                .setName('name')
                .setDescription('Name of the command or category')
                .setRequired(true)
            )
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('The channel to restrict this to')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
        )
        // ── Unrestrict ────────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('unrestrict')
            .setDescription('Remove a role or channel restriction')
            .addStringOption(o => o
                .setName('type')
                .setDescription('Command or Category?')
                .setRequired(true)
                .addChoices(
                    { name: 'Command', value: 'command' },
                    { name: 'Category', value: 'category' }
                )
            )
            .addStringOption(o => o
                .setName('name')
                .setDescription('Name of the command or category')
                .setRequired(true)
            )
            .addStringOption(o => o
                .setName('restrictiontype')
                .setDescription('Is it a role or channel restriction?')
                .setRequired(true)
                .addChoices(
                    { name: 'Role', value: 'role' },
                    { name: 'Channel', value: 'channel' }
                )
            )
            .addStringOption(o => o
                .setName('entityid')
                .setDescription('The ID of the role or channel to remove (you must paste the ID)')
                .setRequired(true)
            )
        )
        // ── View ──────────────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('view')
            .setDescription('View all command restrictions and disabled commands')
        ),

    category:  'config',
    guildOnly: true,

    async execute(interaction: ChatInputCommandInteraction) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        // Shared option parsing
        const type    = interaction.options.getString('type')?.toLowerCase(); // 'command' or 'category'
        let   name    = interaction.options.getString('name')?.toLowerCase().trim();

        if (name && name.startsWith('/')) {
            name = name.slice(1);
        }

        const target = type && name ? `${type}:${name}` : null;

        // Ensure critical commands are never disabled
        if (target && ['command:command', 'command:help'].includes(target)) {
            await interaction.reply({
                content: `${e('error')} Critical configuration commands cannot be disabled or restricted.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // ── Disable / Enable ──────────────────────────────────────────────────
        if (sub === 'disable' || sub === 'enable') {
            const channel = interaction.options.getChannel('channel');
            const channelId = channel?.id || null;

            if (sub === 'disable') {
                await addDisabledCommand(guild.id, target!, channelId);
                const scopeStr = channelId ? `in <#${channelId}>` : 'server-wide';
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')} Disabled **${name}** (${type}) ${scopeStr}.`)
                    .build();
                await sendResponse(interaction, [card]);
            } else {
                await removeDisabledCommand(guild.id, target!, channelId);
                const scopeStr = channelId ? `in <#${channelId}>` : 'server-wide';
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')} Enabled **${name}** (${type}) ${scopeStr}.`)
                    .build();
                await sendResponse(interaction, [card]);
            }
            return;
        }

        // ── Restrict Role / Channel ───────────────────────────────────────────
        if (sub === 'restrictrole' || sub === 'restrictchannel') {
            const isRole = sub === 'restrictrole';
            const rType = isRole ? 'role' : 'channel';
            const entityId = isRole 
                ? interaction.options.getRole('role', true).id
                : interaction.options.getChannel('channel', true).id;

            await addRestrictedCommand(guild.id, target!, rType, entityId);

            const entityStr = isRole ? `<@&${entityId}>` : `<#${entityId}>`;
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} Restricted **${name}** (${type}) to ${entityStr}.`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Unrestrict ────────────────────────────────────────────────────────
        if (sub === 'unrestrict') {
            const rType    = interaction.options.getString('restrictiontype', true) as 'role' | 'channel';
            const entityId = interaction.options.getString('entityid', true);

            await removeRestrictedCommand(guild.id, target!, rType, entityId);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} Removed ${rType} restriction \`${entityId}\` from **${name}** (${type}).`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── View ──────────────────────────────────────────────────────────────
        if (sub === 'view') {
            const disabled = await getDisabledCommands(guild.id);
            const restricted = await getRestrictedCommands(guild.id);

            if (disabled.length === 0 && restricted.length === 0) {
                await interaction.reply({
                    content: `ℹ️ No commands or categories are currently disabled or restricted.`,
                });
                return;
            }

            const formatTarget = (t: string) => {
                const [type, name] = t.split(':');
                return type === 'category' ? `[Category] **${name}**` : `[Command] **/${name}**`;
            };

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('settings')} Command Management`);

            // Disabled
            if (disabled.length > 0) {
                const disabledLines = disabled.map(d => {
                    const scope = d.channelId ? `<#${d.channelId}>` : '`Global`';
                    return `• ${formatTarget(d.target)} — Disabled ${scope}`;
                });
                card.text(`**Disabled**\n${disabledLines.join('\n')}`);
            }

            // Restricted
            if (restricted.length > 0) {
                if (disabled.length > 0) card.separator(true);
                
                // Group by target
                const map = new Map<string, string[]>();
                for (const r of restricted) {
                    const tag = r.type === 'role' ? `<@&${r.entityId}>` : `<#${r.entityId}>`;
                    const current = map.get(r.target) || [];
                    current.push(tag);
                    map.set(r.target, current);
                }

                const restrictedLines = Array.from(map.entries()).map(([t, tags]) => {
                    return `• ${formatTarget(t)} — Restricted to ${tags.join(', ')}`;
                });
                card.text(`**Restricted Access**\n${restrictedLines.join('\n')}`);
            }

            await sendResponse(interaction, [card.build()]);
            return;
        }
    },
};

export default command;
