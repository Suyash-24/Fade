// src/commands/moderation/fakeperms.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getGuildFakePerms, addFakePerm, removeFakePerm, clearRoleFakePerms, type FakePerm } from '../../db/queries/fakePerms.js';
import { ensureGuild } from '../../db/queries/guilds.js';

const PERMS: FakePerm[] = [
    'administrator', 'ban_members', 'kick_members', 'moderate_members',
    'manage_messages', 'manage_nicknames', 'manage_roles',
    'manage_guild_expressions', 'manage_guild', 'manage_channels'
];

export default {
    data: new SlashCommandBuilder()
        .setName('fakeperms')
        .setDescription('Grant roles mod permissions through Fade only (not native Discord)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => s
            .setName('grant')
            .setDescription('Grant a fake permission to a role')
            .addRoleOption(o => o.setName('role').setDescription('Role to grant permission to').setRequired(true))
            .addStringOption(o => o
                .setName('permission')
                .setDescription('Permission to grant')
                .setRequired(true)
                .addChoices(...PERMS.map(p => ({ name: p.replace(/_/g, ' '), value: p })))
            )
        )
        .addSubcommand(s => s
            .setName('revoke')
            .setDescription('Revoke a fake permission from a role')
            .addRoleOption(o => o.setName('role').setDescription('Role to revoke permission from').setRequired(true))
            .addStringOption(o => o
                .setName('permission')
                .setDescription('Permission to revoke')
                .setRequired(true)
                .addChoices(...PERMS.map(p => ({ name: p.replace(/_/g, ' '), value: p })))
            )
        )
        .addSubcommand(s => s
            .setName('clear')
            .setDescription('Remove all fake permissions from a role')
            .addRoleOption(o => o.setName('role').setDescription('Role to clear').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('list')
            .setDescription('View all fake permissions in this server')
        ),

    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.Administrator],
    cooldown:        3,

    async execute(interaction) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;
        await ensureGuild(guild.id);

        if (sub === 'grant') {
            const role       = interaction.options.getRole('role', true);
            const permission = interaction.options.getString('permission', true) as FakePerm;

            await addFakePerm(guild.id, role.id, permission);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Granted \`${permission}\` to <@&${role.id}>\n-# Members with this role can now use Fade's ${permission.replace(/_/g, ' ')} commands.`)
                .build();
            await interaction.reply({ flags: MessageFlags.Ephemeral, components: [card] as any });
        }

        else if (sub === 'revoke') {
            const role       = interaction.options.getRole('role', true);
            const permission = interaction.options.getString('permission', true) as FakePerm;

            await removeFakePerm(guild.id, role.id, permission);

            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('success')}  Revoked \`${permission}\` from <@&${role.id}>`)
                .build();
            await interaction.reply({ flags: MessageFlags.Ephemeral, components: [card] as any });
        }

        else if (sub === 'clear') {
            const role = interaction.options.getRole('role', true);
            await clearRoleFakePerms(guild.id, role.id);

            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('success')}  Cleared all fake permissions from <@&${role.id}>`)
                .build();
            await interaction.reply({ flags: MessageFlags.Ephemeral, components: [card] as any });
        }

        else if (sub === 'list') {
            const rows = await getGuildFakePerms(guild.id);

            if (!rows.length) {
                await interaction.reply({ content: `${e('error')} No fake permissions configured.`, flags: MessageFlags.Ephemeral });
                return;
            }

            // Group by role
            const grouped = new Map<string, string[]>();
            for (const row of rows) {
                if (!grouped.has(row.roleId)) grouped.set(row.roleId, []);
                grouped.get(row.roleId)!.push(`\`${row.permission}\``);
            }

            const lines = [...grouped.entries()]
                .map(([roleId, perms]) => `<@&${roleId}> — ${perms.join(', ')}`)
                .join('\n');

            const card = new FadeContainer(Colours.FADE)
                .text(`## 🔐 Fake Permissions\n${lines}`)
                .build();
            await interaction.reply({ flags: MessageFlags.Ephemeral, components: [card] as any });
        }
    },
} satisfies Command;
