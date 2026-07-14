// src/commands/roles/autorole.ts
// Manage auto-assigned roles for humans, bots, or all members on join.
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    type Role,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { hasPermission } from '../../utils/fakePerms.js';
import {
    getAutoroles,
    addAutorole,
    removeAutorole,
    clearAutoroles,
    type AutoroleType,
} from '../../db/queries/autoroles.js';

const TYPE_LABELS: Record<string, string> = {
    human: '👤 Humans',
    bot:   '🤖 Bots',
    all:   '🌐 Everyone',
};

export default {
    data: new SlashCommandBuilder()
        .setName('autorole')
        .setDescription('Manage auto-assigned roles for new members')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s
            .setName('add')
            .setDescription('Add a role to be automatically assigned')
            .addRoleOption(o => o.setName('role').setDescription('Role to auto-assign').setRequired(true))
            .addStringOption(o => o
                .setName('type')
                .setDescription('Who should receive this role on join?')
                .setRequired(false)
                .addChoices(
                    { name: '👤 Humans only (default)', value: 'human' },
                    { name: '🤖 Bots only',             value: 'bot'   },
                    { name: '🌐 Everyone',               value: 'all'   },
                )
            )
        )
        .addSubcommand(s => s
            .setName('remove')
            .setDescription('Remove an autorole')
            .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('list')
            .setDescription('Show all configured autoroles')
        )
        .addSubcommand(s => s
            .setName('clear')
            .setDescription('Remove all autoroles')
            .addStringOption(o => o
                .setName('type')
                .setDescription('Clear only a specific type (leave empty for all)')
                .setRequired(false)
                .addChoices(
                    { name: '👤 Humans', value: 'human' },
                    { name: '🤖 Bots',   value: 'bot'   },
                    { name: '🌐 All',    value: 'all'   },
                )
            )
        ),

    category:        'roles',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    botPermissions:  [PermissionFlagsBits.ManageRoles],
    cooldown:        3,

    async execute(interaction) {
        await interaction.deferReply();
        const sub     = interaction.options.getSubcommand();
        const guild   = interaction.guild!;

        if (sub === 'add') {
            const role = interaction.options.getRole('role', true) as Role;
            const type = (interaction.options.getString('type') ?? 'human') as AutoroleType;

            if (role.managed) {
                await interaction.editReply(`${e('error')} That role is managed by an integration and cannot be auto-assigned.`);
                return;
            }
            if (role.position >= guild.members.me!.roles.highest.position) {
                await interaction.editReply(`${e('error')} That role is above my highest role. Move my role higher and try again.`);
                return;
            }

            await addAutorole(guild.id, role.id, type);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} **Autorole added**\n${role} will now be given to **${TYPE_LABELS[type]}** when they join.`)
                .build();
            await interaction.editReply({ components: [card] as any, flags: MessageFlags.IsComponentsV2 } as any);
            return;
        }

        if (sub === 'remove') {
            const role = interaction.options.getRole('role', true) as Role;
            await removeAutorole(guild.id, role.id);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} **Autorole removed**\n${role} will no longer be auto-assigned.`)
                .build();
            await interaction.editReply({ components: [card] as any, flags: MessageFlags.IsComponentsV2 } as any);
            return;
        }

        if (sub === 'list') {
            const rows = await getAutoroles(guild.id);
            if (!rows.length) {
                await interaction.editReply(`${e('error')} No autoroles configured. Use \`/autorole add\` to set one up.`);
                return;
            }

            const grouped: Record<string, string[]> = { human: [], bot: [], all: [] };
            for (const r of rows) {
                grouped[r.type]?.push(`<@&${r.roleId}>`);
            }

            const lines: string[] = [];
            for (const [type, roles] of Object.entries(grouped)) {
                if (roles.length) lines.push(`${TYPE_LABELS[type]}\n${roles.join(', ')}`);
            }

            const card = new FadeContainer()
                .text(`## ${e('roles')} Autoroles\n\n${lines.join('\n\n')}`)
                .build();
            await interaction.editReply({ components: [card] as any, flags: MessageFlags.IsComponentsV2 } as any);
            return;
        }

        if (sub === 'clear') {
            const type = interaction.options.getString('type') as AutoroleType | null;
            await clearAutoroles(guild.id, type ?? undefined);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} **Autoroles cleared**${type ? ` for **${TYPE_LABELS[type]}**` : ' for all types'}.`)
                .build();
            await interaction.editReply({ components: [card] as any, flags: MessageFlags.IsComponentsV2 } as any);
        }
    },

    async prefixExecute(message, args) {
        if (!message.guild || !message.member) return;
        if (!await hasPermission(message.member as any, 'manage_guild')) {
            await message.reply(`${e('error')} You need **Manage Server** permission.`);
            return;
        }

        const sub = args[0]?.toLowerCase();

        if (sub === 'add') {
            const roleArg = args[1];
            const typeArg = args[2]?.toLowerCase() as AutoroleType | undefined;
            const type: AutoroleType = ['human', 'bot', 'all'].includes(typeArg ?? '') ? typeArg! : 'human';

            const roleId = roleArg?.replace(/[<@&>]/g, '');
            const role   = roleId ? message.guild.roles.cache.get(roleId) : null;

            if (!role) {
                await message.reply(`${e('error')} Please mention a valid role.\nUsage: \`f!autorole add @Role [human|bot|all]\``);
                return;
            }
            if (role.managed) {
                await message.reply(`${e('error')} That role is managed by an integration.`);
                return;
            }
            if (role.position >= message.guild.members.me!.roles.highest.position) {
                await message.reply(`${e('error')} That role is above my highest role.`);
                return;
            }

            await addAutorole(message.guild.id, role.id, type);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} **Autorole added**\n${role} will now be given to **${TYPE_LABELS[type]}** when they join.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        if (sub === 'remove') {
            const roleId = args[1]?.replace(/[<@&>]/g, '');
            const role   = roleId ? message.guild.roles.cache.get(roleId) : null;
            if (!role) {
                await message.reply(`${e('error')} Please mention a valid role.`);
                return;
            }
            await removeAutorole(message.guild.id, role.id);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} **Autorole removed**\n${role} will no longer be auto-assigned.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        if (sub === 'list') {
            const rows = await getAutoroles(message.guild.id);
            if (!rows.length) {
                await message.reply(`${e('error')} No autoroles configured.`);
                return;
            }
            const grouped: Record<string, string[]> = { human: [], bot: [], all: [] };
            for (const r of rows) grouped[r.type]?.push(`<@&${r.roleId}>`);
            const lines: string[] = [];
            for (const [type, roles] of Object.entries(grouped)) {
                if (roles.length) lines.push(`${TYPE_LABELS[type]}\n${roles.join(', ')}`);
            }
            const card = new FadeContainer()
                .text(`## ${e('roles')} Autoroles\n\n${lines.join('\n\n')}`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        if (sub === 'clear') {
            await clearAutoroles(message.guild.id);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} All autoroles cleared.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        // Usage
        const card = new FadeContainer()
            .text([
                `## ${e('roles')} Autorole`,
                `\`f!autorole add @Role [human|bot|all]\` — add an autorole`,
                `\`f!autorole remove @Role\` — remove an autorole`,
                `\`f!autorole list\` — show all autoroles`,
                `\`f!autorole clear\` — remove all autoroles`,
            ].join('\n'))
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;
