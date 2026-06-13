// src/commands/roles/boosterrole.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import {
    getBoosterConfig, upsertBoosterConfig,
    getBoosterRole, getAllBoosterRoles,
    createBoosterRole, updateBoosterRole, deleteBoosterRole,
} from '../../db/queries/boosterRoles.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function parseColor(input: string): number | null {
    const hex = input.replace('#', '');
    const val = parseInt(hex, 16);
    return isNaN(val) || hex.length !== 6 ? null : val;
}

function isBooster(member: any): boolean {
    return !!member.premiumSince;
}

// ── Command ───────────────────────────────────────────────────────────────────

export default {
    data: new SlashCommandBuilder()
        .setName('boosterrole')
        .setDescription('Manage your custom booster role')

        // ── Admin: base role ──────────────────────────────────────────────────
        .addSubcommandGroup(g => g
            .setName('base')
            .setDescription('Set the base role for booster role placement')
            .addSubcommand(s => s
                .setName('set')
                .setDescription('Set the base role (booster roles are placed below this)')
                .addRoleOption(o => o.setName('role').setDescription('Base role').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('remove')
                .setDescription('Remove the base role setting')
            )
        )

        // ── Admin: award role ─────────────────────────────────────────────────
        .addSubcommandGroup(g => g
            .setName('award')
            .setDescription('Auto-grant a role to all boosters')
            .addSubcommand(s => s
                .setName('set')
                .setDescription('Set the role to award to boosters')
                .addRoleOption(o => o.setName('role').setDescription('Role to award').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('view')
                .setDescription('View the currently awarded role')
            )
            .addSubcommand(s => s
                .setName('remove')
                .setDescription('Stop awarding a role to boosters')
            )
        )

        // ── User: create ──────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('create')
            .setDescription('Create your custom booster role')
            .addStringOption(o => o
                .setName('color')
                .setDescription('Hex color code (e.g. #3498DB)')
                .setRequired(true)
            )
            .addStringOption(o => o
                .setName('name')
                .setDescription('Role name (defaults to your username)')
                .setRequired(false)
                .setMaxLength(100)
            )
        )

        // ── User: rename ──────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('rename')
            .setDescription('Rename your booster role')
            .addStringOption(o => o
                .setName('name')
                .setDescription('New role name')
                .setRequired(true)
                .setMaxLength(100)
            )
        )

        // ── User: color ───────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('color')
            .setDescription('Change the color of your booster role')
            .addStringOption(o => o
                .setName('color')
                .setDescription('New hex color code (e.g. #3498DB)')
                .setRequired(true)
            )
        )

        // ── User: icon ────────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('icon')
            .setDescription('Set the icon of your booster role (emoji or image URL)')
            .addStringOption(o => o
                .setName('icon')
                .setDescription('Emoji (e.g. 🔥) or image URL')
                .setRequired(true)
            )
        )

        // ── User: remove ──────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('remove')
            .setDescription('Delete your custom booster role')
        )

        // ── Admin: list ───────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('list')
            .setDescription('View all booster roles in this server')
        )

        // ── Admin: cleanup ────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('cleanup')
            .setDescription('Remove booster roles from members who are no longer boosting')
        ),

    category:  'roles',
    guildOnly: true,
    cooldown:  5,

    async execute(interaction) {
        const group  = interaction.options.getSubcommandGroup(false);
        const sub    = interaction.options.getSubcommand();
        const guild  = interaction.guild!;
        const member = interaction.member as any;

        // ── base set / remove ─────────────────────────────────────────────────
        if (group === 'base') {
            if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                await interaction.reply({ content: `${e('error')} You need **Manage Server** to configure booster roles.`, flags: MessageFlags.Ephemeral });
                return;
            }

            if (sub === 'set') {
                const role = interaction.options.getRole('role', true);
                await upsertBoosterConfig(guild.id, { baseRoleId: role.id });
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Base role set to <@&${role.id}>\n-# Booster roles will be placed below this role.`)
                    .build();
                await sendResponse(interaction, [card]);
            } else {
                await upsertBoosterConfig(guild.id, { baseRoleId: null });
                const card = new FadeContainer(Colours.DANGER)
                    .text(`${e('success')}  Base role removed.`)
                    .build();
                await sendResponse(interaction, [card]);
            }
            return;
        }

        // ── award set / view / remove ─────────────────────────────────────────
        if (group === 'award') {
            if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                await interaction.reply({ content: `${e('error')} You need **Manage Server** to configure booster roles.`, flags: MessageFlags.Ephemeral });
                return;
            }

            if (sub === 'set') {
                const role = interaction.options.getRole('role', true);
                await upsertBoosterConfig(guild.id, { awardRoleId: role.id });
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Award role set to <@&${role.id}>\n-# Boosters will automatically receive this role.`)
                    .build();
                await sendResponse(interaction, [card]);
            } else if (sub === 'view') {
                const config = await getBoosterConfig(guild.id);
                if (!config?.awardRoleId) {
                    await interaction.reply({ content: `${e('error')} No award role configured.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                const card = new FadeContainer(Colours.FADE)
                    .text(`${e('boost')}  Award role: <@&${config.awardRoleId}>`)
                    .build();
                await sendResponse(interaction, [card], true);
            } else {
                await upsertBoosterConfig(guild.id, { awardRoleId: null });
                const card = new FadeContainer(Colours.DANGER)
                    .text(`${e('success')}  Award role removed.`)
                    .build();
                await sendResponse(interaction, [card]);
            }
            return;
        }

        // ── create ────────────────────────────────────────────────────────────
        if (sub === 'create') {
            if (!isBooster(member)) {
                await interaction.reply({ content: `${e('error')} You must be boosting this server to create a booster role.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const existing = await getBoosterRole(guild.id, interaction.user.id);
            if (existing) {
                await interaction.reply({ content: `${e('error')} You already have a booster role. Use \`/boosterrole rename\` or \`/boosterrole remove\` first.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const colorStr = interaction.options.getString('color', true);
            const color    = parseColor(colorStr);
            if (color === null) {
                await interaction.reply({ content: `${e('error')} Invalid hex color. Use format \`#RRGGBB\` e.g. \`#3498DB\`.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const name   = interaction.options.getString('name') ?? interaction.user.username;
            const config = await getBoosterConfig(guild.id);

            // Create the role, positioned below base role if set
            const roleOptions: any = { name, color, reason: '[Fade] Booster role created' };
            if (config?.baseRoleId) {
                const baseRole = guild.roles.cache.get(config.baseRoleId);
                if (baseRole) roleOptions.position = baseRole.position - 1;
            }

            const role = await guild.roles.create(roleOptions).catch(() => null);
            if (!role) {
                await interaction.reply({ content: `${e('error')} Failed to create role. Check my permissions.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await member.roles.add(role, '[Fade] Booster role assigned').catch(() => null);
            await createBoosterRole(guild.id, interaction.user.id, role.id);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('boost')}  Created your booster role **${name}**\n-# Color: \`#${color.toString(16).padStart(6, '0').toUpperCase()}\``)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── rename ────────────────────────────────────────────────────────────
        if (sub === 'rename') {
            const entry = await getBoosterRole(guild.id, interaction.user.id);
            if (!entry) {
                await interaction.reply({ content: `${e('error')} You don't have a booster role. Use \`/boosterrole create\` first.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const name = interaction.options.getString('name', true);
            const role = guild.roles.cache.get(entry.roleId);
            if (!role) {
                await interaction.reply({ content: `${e('error')} Your booster role no longer exists.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await role.setName(name, '[Fade] Booster role renamed');
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Booster role renamed to **${name}**`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── color ─────────────────────────────────────────────────────────────
        if (sub === 'color') {
            const entry = await getBoosterRole(guild.id, interaction.user.id);
            if (!entry) {
                await interaction.reply({ content: `${e('error')} You don't have a booster role. Use \`/boosterrole create\` first.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const colorStr = interaction.options.getString('color', true);
            const color    = parseColor(colorStr);
            if (color === null) {
                await interaction.reply({ content: `${e('error')} Invalid hex color. Use format \`#RRGGBB\` e.g. \`#3498DB\`.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const role = guild.roles.cache.get(entry.roleId);
            if (!role) {
                await interaction.reply({ content: `${e('error')} Your booster role no longer exists.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await role.setColor(color, '[Fade] Booster role color changed');
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Booster role color updated to **#${color.toString(16).padStart(6, '0').toUpperCase()}**`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── icon ──────────────────────────────────────────────────────────────
        if (sub === 'icon') {
            const entry = await getBoosterRole(guild.id, interaction.user.id);
            if (!entry) {
                await interaction.reply({ content: `${e('error')} You don't have a booster role.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const role = guild.roles.cache.get(entry.roleId);
            if (!role) {
                await interaction.reply({ content: `${e('error')} Your booster role no longer exists.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const icon = interaction.options.getString('icon', true).trim();
            await role.setIcon(icon, '[Fade] Booster role icon updated').catch(async () => {
                await interaction.reply({ content: `${e('error')} Failed to set icon. Server must be level 2+ and the icon must be a valid emoji or image URL.`, flags: MessageFlags.Ephemeral });
            });

            if (interaction.replied) return;
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Booster role icon updated.`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── remove ────────────────────────────────────────────────────────────
        if (sub === 'remove') {
            const entry = await getBoosterRole(guild.id, interaction.user.id);
            if (!entry) {
                await interaction.reply({ content: `${e('error')} You don't have a booster role.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const role = guild.roles.cache.get(entry.roleId);
            if (role) await role.delete('[Fade] Booster role removed by user').catch(() => null);
            await deleteBoosterRole(guild.id, interaction.user.id);

            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('success')}  Your booster role has been removed.`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── list ──────────────────────────────────────────────────────────────
        if (sub === 'list') {
            if (!member.permissions.has(PermissionFlagsBits.ManageGuild) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: `${e('error')} You need **Manage Server** or **Administrator** permission to view booster roles.`, flags: MessageFlags.Ephemeral });
                return;
            }
            const all = await getAllBoosterRoles(guild.id);
            if (!all.length) {
                await interaction.reply({ content: `${e('error')} No booster roles in this server.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const lines = all.map(r => `<@${r.userId}> → <@&${r.roleId}>`).join('\n');
            const card  = new FadeContainer(Colours.FADE)
                .text(`## ${e('boost')} Booster Roles\n${lines}`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── cleanup ───────────────────────────────────────────────────────────
        if (sub === 'cleanup') {
            if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                await interaction.reply({ content: `${e('error')} You need **Manage Server** to run cleanup.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            const all     = await getAllBoosterRoles(guild.id);
            let   removed = 0;

            for (const entry of all) {
                const m = await guild.members.fetch(entry.userId).catch(() => null);
                if (!m || !isBooster(m)) {
                    const role = guild.roles.cache.get(entry.roleId);
                    if (role) await role.delete('[Fade] Booster role cleanup').catch(() => null);
                    await deleteBoosterRole(guild.id, entry.userId);
                    removed++;
                }
            }

            const card = new FadeContainer(removed > 0 ? Colours.SUCCESS : Colours.FADE)
                .text(`${e('success')}  Cleanup complete — removed **${removed}** stale booster role${removed !== 1 ? 's' : ''}.`)
                .build();
            await interaction.editReply({ components: [card] as any, flags: MessageFlags.IsComponentsV2 } as any);
        }
    },
    async prefixExecute(message, args) {
        const guild  = message.guild!;
        const member = message.member as any;
        const sub    = args[0]?.toLowerCase();

        // ── base <@role | role_id> ─────────────────────────────────────────────
        if (sub === 'base') {
            if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                await message.reply(`${e('error')} You need **Manage Server** to configure booster roles.`); return;
            }
            const roleId = args[1]?.replace(/\D/g, '');
            const role = roleId ? guild.roles.cache.get(roleId) : null;
            if (!role) { await message.reply(`${e('error')} Mention a role or provide a valid role ID. Usage: \`f!boosterrole base @role\``); return; }
            await upsertBoosterConfig(guild.id, { baseRoleId: role.id });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Base role set to <@&${role.id}>`)
                .build();
            await sendMessage(message, [card]); return;
        }

        // ── award <@role | role_id | view | remove> ───────────────────────────
        if (sub === 'award') {
            if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                await message.reply(`${e('error')} You need **Manage Server** to configure booster roles.`); return;
            }
            const action = args[1]?.toLowerCase();
            if (action === 'view') {
                const config = await getBoosterConfig(guild.id);
                if (!config?.awardRoleId) { await message.reply(`${e('error')} No award role configured.`); return; }
                const card = new FadeContainer(Colours.FADE).text(`${e('boost')}  Award role: <@&${config.awardRoleId}>`).build();
                await sendMessage(message, [card]); return;
            }
            if (action === 'remove') {
                await upsertBoosterConfig(guild.id, { awardRoleId: null });
                const card = new FadeContainer(Colours.DANGER).text(`${e('success')}  Award role removed.`).build();
                await sendMessage(message, [card]); return;
            }
            const roleId = args[1]?.replace(/\D/g, '');
            const role = roleId ? guild.roles.cache.get(roleId) : null;
            if (!role) { await message.reply(`${e('error')} Usage: \`f!boosterrole award @role\` | \`award view\` | \`award remove\``); return; }
            await upsertBoosterConfig(guild.id, { awardRoleId: role.id });
            const card = new FadeContainer(Colours.SUCCESS).text(`${e('success')}  Award role set to <@&${role.id}>`).build();
            await sendMessage(message, [card]); return;
        }

        // ── rename <name> ─────────────────────────────────────────────────────
        if (sub === 'rename') {
            const entry = await getBoosterRole(guild.id, message.author.id);
            if (!entry) { await message.reply(`${e('error')} You don't have a booster role.`); return; }
            const name = args.slice(1).join(' ');
            if (!name) { await message.reply(`${e('error')} Usage: \`f!boosterrole rename <name>\``); return; }
            const role = guild.roles.cache.get(entry.roleId);
            if (!role) { await message.reply(`${e('error')} Your booster role no longer exists.`); return; }
            await role.setName(name, '[Fade] Booster role renamed');
            const card = new FadeContainer(Colours.SUCCESS).text(`${e('success')}  Booster role renamed to **${name}**`).build();
            await sendMessage(message, [card]); return;
        }

        // ── color <#color> ────────────────────────────────────────────────────
        if (sub === 'color') {
            const entry = await getBoosterRole(guild.id, message.author.id);
            if (!entry) { await message.reply(`${e('error')} You don't have a booster role.`); return; }
            const colorStr = args[1];
            if (!colorStr) { await message.reply(`${e('error')} Usage: \`f!boosterrole color <#color>\``); return; }
            const color = parseColor(colorStr);
            if (color === null) {
                await message.reply(`${e('error')} Invalid hex color. Use format \`#RRGGBB\` e.g. \`#3498DB\`.`); return;
            }
            const role = guild.roles.cache.get(entry.roleId);
            if (!role) { await message.reply(`${e('error')} Your booster role no longer exists.`); return; }
            await role.setColor(color, '[Fade] Booster role color changed');
            const card = new FadeContainer(Colours.SUCCESS).text(`${e('success')}  Booster role color updated to **#${color.toString(16).padStart(6, '0').toUpperCase()}**`).build();
            await sendMessage(message, [card]); return;
        }

        // ── icon <emoji/url> ──────────────────────────────────────────────────
        if (sub === 'icon') {
            const entry = await getBoosterRole(guild.id, message.author.id);
            if (!entry) { await message.reply(`${e('error')} You don't have a booster role.`); return; }
            const icon = args[1];
            if (!icon) { await message.reply(`${e('error')} Usage: \`f!boosterrole icon <emoji or url>\``); return; }
            const role = guild.roles.cache.get(entry.roleId);
            if (!role) { await message.reply(`${e('error')} Your booster role no longer exists.`); return; }
            const ok = await role.setIcon(icon, '[Fade] Booster role icon updated').catch(() => null);
            if (!ok) { await message.reply(`${e('error')} Failed to set icon. Server must be level 2+ and icon must be a valid emoji or image URL.`); return; }
            const card = new FadeContainer(Colours.SUCCESS).text(`${e('success')}  Booster role icon updated.`).build();
            await sendMessage(message, [card]); return;
        }

        // ── remove ────────────────────────────────────────────────────────────
        if (sub === 'remove') {
            const entry = await getBoosterRole(guild.id, message.author.id);
            if (!entry) { await message.reply(`${e('error')} You don't have a booster role.`); return; }
            const role = guild.roles.cache.get(entry.roleId);
            if (role) await role.delete('[Fade] Booster role removed by user').catch(() => null);
            await deleteBoosterRole(guild.id, message.author.id);
            const card = new FadeContainer(Colours.DANGER).text(`${e('success')}  Your booster role has been removed.`).build();
            await sendMessage(message, [card]); return;
        }

        // ── list ──────────────────────────────────────────────────────────────
        if (sub === 'list') {
            if (!member.permissions.has(PermissionFlagsBits.ManageGuild) && !member.permissions.has(PermissionFlagsBits.Administrator)) {
                await message.reply(`${e('error')} You need **Manage Server** or **Administrator** permission to view booster roles.`); return;
            }
            const all = await getAllBoosterRoles(guild.id);
            if (!all.length) { await message.reply(`${e('error')} No booster roles in this server.`); return; }
            const lines = all.map(r => `<@${r.userId}> → <@&${r.roleId}>`).join('\n');
            const card  = new FadeContainer(Colours.FADE).text(`## ${e('boost')} Booster Roles\n${lines}`).build();
            await sendMessage(message, [card]); return;
        }

        // ── cleanup ───────────────────────────────────────────────────────────
        if (sub === 'cleanup') {
            if (!member.permissions.has(PermissionFlagsBits.ManageGuild)) {
                await message.reply(`${e('error')} You need **Manage Server** to run cleanup.`); return;
            }
            const all = await getAllBoosterRoles(guild.id);
            let removed = 0;
            for (const entry of all) {
                const m = await guild.members.fetch(entry.userId).catch(() => null);
                if (!m || !isBooster(m)) {
                    const role = guild.roles.cache.get(entry.roleId);
                    if (role) await role.delete('[Fade] Booster role cleanup').catch(() => null);
                    await deleteBoosterRole(guild.id, entry.userId);
                    removed++;
                }
            }
            const card = new FadeContainer(removed > 0 ? Colours.SUCCESS : Colours.FADE)
                .text(`${e('success')}  Cleanup complete — removed **${removed}** stale booster role${removed !== 1 ? 's' : ''}.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        // ── create: f!boosterrole <#color> [name] ─────────────────────────────
        if (!isBooster(member)) {
            await message.reply(`${e('error')} You must be boosting this server to create a booster role.`); return;
        }
        const existing = await getBoosterRole(guild.id, message.author.id);
        if (existing) {
            await message.reply(`${e('error')} You already have a booster role. Use \`f!boosterrole rename\` or \`f!boosterrole remove\` first.`); return;
        }
        const colorStr = args[0];
        if (!colorStr) {
            await message.reply(`${e('error')} Usage: \`f!boosterrole <#color> [name]\``); return;
        }
        const color = parseColor(colorStr);
        if (color === null) {
            await message.reply(`${e('error')} Invalid hex color. Use format \`#RRGGBB\` e.g. \`#3498DB\`.`); return;
        }
        const name   = args.slice(1).join(' ') || message.author.username;
        const config = await getBoosterConfig(guild.id);
        const roleOptions: any = { name, color, reason: '[Fade] Booster role created' };
        if (config?.baseRoleId) {
            const baseRole = guild.roles.cache.get(config.baseRoleId);
            if (baseRole) roleOptions.position = baseRole.position - 1;
        }
        const role = await guild.roles.create(roleOptions).catch(() => null);
        if (!role) { await message.reply(`${e('error')} Failed to create role. Check my permissions.`); return; }
        await member.roles.add(role, '[Fade] Booster role assigned').catch(() => null);
        await createBoosterRole(guild.id, message.author.id, role.id);
        const card = new FadeContainer(Colours.SUCCESS)
            .text(`${e('boost')}  Created your booster role **${name}**\n-# Color: \`#${color.toString(16).padStart(6, '0').toUpperCase()}\``)
            .build();
        await sendMessage(message, [card]);
    },

    aliases: ['br', 'boosterroles'],
} satisfies Command;
