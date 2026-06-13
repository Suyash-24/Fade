// src/commands/roles/reactionrole.ts
// Reaction roles — button, select menu, and emoji reaction based role assignment.
// Panels are NOT created here; use f!ce to post a rich message first, then attach
// buttons / select menus / reactions with these subcommands.
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    StringSelectMenuBuilder,
    StringSelectMenuOptionBuilder,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import {
    createButtonRole,
    getButtonRolesByMessage,
    getButtonRolesByGuild,
    getButtonRole,
    deleteButtonRolesByMessage,
    deleteButtonRole,
    createReactionRole,
    getReactionRole,
    getReactionRolesByMessage,
    getReactionRolesByGuild,
    deleteReactionRole,
} from '../../db/queries/roles.js';
import { e, Colours } from '../../components/emojis.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Find a bot message by ID across all text channels */
async function findBotMessage(guild: any, messageId: string, client: any) {
    for (const channel of guild.channels.cache.values()) {
        if (!channel.isTextBased()) continue;
        const msg = await (channel as any).messages.fetch(messageId).catch(() => null);
        if (msg) {
            if (msg.author.id !== client.user!.id) return { msg: null, reason: 'not_bot' };
            return { msg, reason: null };
        }
    }
    return { msg: null, reason: 'not_found' };
}

/** Clean/standardize custom emoji string format */
function cleanEmoji(emojiStr: string): string {
    const customMatch = emojiStr.match(/<?(a)?:?([^:]+):(\d+)>?/);
    if (customMatch) {
        const isAnimated = !!customMatch[1];
        const name = customMatch[2];
        const id = customMatch[3];
        return `<${isAnimated ? 'a' : ''}:${name}:${id}>`;
    }
    return emojiStr;
}

/** Rebuild button action rows on a message from DB entries */
async function rebuildButtons(targetMessage: any, entries: any[]) {
    if (!entries.length) {
        // No buttons left — remove all action rows by editing components
        // We need to keep the existing container content but remove button rows.
        // Just remove all action rows from the message.
        const existing = targetMessage.components;
        if (existing?.length && existing[0]?.type === 17) {
            // Components v2 container — rebuild without action rows
            const raw = existing[0].toJSON ? existing[0].toJSON() : existing[0];
            const filtered = (raw.components ?? []).filter((c: any) => c.type !== 1);
            if (filtered.length) {
                raw.components = filtered;
                await targetMessage.edit({ components: [raw], flags: MessageFlags.IsComponentsV2 } as any).catch(() => null);
            }
        } else if (existing?.length) {
            // Legacy embeds — clear components
            await targetMessage.edit({ components: [] }).catch(() => null);
        }
        return;
    }

    const buttons = entries.map(b =>
        new ButtonBuilder()
            .setCustomId(`brole_${b.roleId}`)
            .setLabel(b.label)
            .setStyle(b.style as ButtonStyle)
    );

    // Build action rows (max 5 buttons per row)
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    for (let i = 0; i < buttons.length; i += 5) {
        rows.push(new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons.slice(i, i + 5)));
    }

    const existing = targetMessage.components;

    if (existing?.length && existing[0]?.type === 17) {
        // Components v2 container — replace/add action rows
        const raw = existing[0].toJSON ? existing[0].toJSON() : existing[0];
        // Keep non-action-row components (text, separator, section, etc.)
        const nonActionRow = (raw.components ?? []).filter((c: any) => {
            // type 1 = ActionRow. Skip existing action rows that contain brole_ buttons
            if (c.type !== 1) return true;
            const hasBrole = c.components?.some((btn: any) => btn.custom_id?.startsWith('brole_'));
            return !hasBrole;
        });
        raw.components = [...nonActionRow, ...rows.map(r => r.toJSON())];
        await targetMessage.edit({ components: [raw], flags: MessageFlags.IsComponentsV2 } as any).catch(() => null);
    } else {
        // Legacy embed/content — append action rows as components
        await targetMessage.edit({ components: rows }).catch(() => null);
    }
}

/** Rebuild select menu on a message from DB entries */
async function rebuildSelectMenu(targetMessage: any, entries: any[], guild: any) {
    if (!entries.length) {
        // Remove select menu action rows
        const existing = targetMessage.components;
        if (existing?.length && existing[0]?.type === 17) {
            const raw = existing[0].toJSON ? existing[0].toJSON() : existing[0];
            const filtered = (raw.components ?? []).filter((c: any) => {
                if (c.type !== 1) return true;
                const hasSelect = c.components?.some((comp: any) => comp.custom_id?.startsWith('srole_'));
                return !hasSelect;
            });
            if (filtered.length) {
                raw.components = filtered;
                await targetMessage.edit({ components: [raw], flags: MessageFlags.IsComponentsV2 } as any).catch(() => null);
            }
        } else if (existing?.length) {
            await targetMessage.edit({ components: [] }).catch(() => null);
        }
        return;
    }

    const isExclusive = entries[0].exclusive;
    const messageId = entries[0].messageId;

    const selectMenu = new StringSelectMenuBuilder()
        .setCustomId(`srole_${messageId}`)
        .setPlaceholder('Select a role...')
        .setMinValues(0)
        .setMaxValues(isExclusive ? 1 : entries.length)
        .addOptions(
            entries.map(o =>
                new StringSelectMenuOptionBuilder()
                    .setValue(o.roleId)
                    .setLabel(o.label)
                    .setDescription(`Click to get/remove @${guild.roles.cache.get(o.roleId)?.name ?? o.roleId}`)
            )
        );

    const selectRow = new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(selectMenu);
    const existing = targetMessage.components;

    if (existing?.length && existing[0]?.type === 17) {
        const raw = existing[0].toJSON ? existing[0].toJSON() : existing[0];
        // Remove existing select menu rows
        const nonSelect = (raw.components ?? []).filter((c: any) => {
            if (c.type !== 1) return true;
            const hasSelect = c.components?.some((comp: any) => comp.custom_id?.startsWith('srole_'));
            return !hasSelect;
        });
        raw.components = [...nonSelect, selectRow.toJSON()];
        await targetMessage.edit({ components: [raw], flags: MessageFlags.IsComponentsV2 } as any).catch(() => null);
    } else {
        await targetMessage.edit({ components: [selectRow] }).catch(() => null);
    }
}

// ── Command ───────────────────────────────────────────────────────────────────

export default {
    data: new SlashCommandBuilder()
        .setName('reactionrole')
        .setDescription('Set up button, select menu, or reaction roles')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)

        // ── Button roles ──────────────────────────────────────────────────────
        .addSubcommandGroup(g => g
            .setName('button')
            .setDescription('Button-based role assignment')
            .addSubcommand(s => s
                .setName('add')
                .setDescription('Add a role button to an existing bot message')
                .addStringOption(o => o
                    .setName('message_id')
                    .setDescription('Message ID of the bot message')
                    .setRequired(true)
                )
                .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true))
                .addStringOption(o => o.setName('label').setDescription('Button label').setRequired(true))
                .addBooleanOption(o => o
                    .setName('exclusive')
                    .setDescription('Only allow one role from this panel at a time (default: false)')
                    .setRequired(false)
                )
                .addStringOption(o => o
                    .setName('style')
                    .setDescription('Button colour')
                    .setRequired(false)
                    .addChoices(
                        { name: 'Blue (Primary)',   value: '1' },
                        { name: 'Grey (Secondary)', value: '2' },
                        { name: 'Green (Success)',  value: '3' },
                        { name: 'Red (Danger)',     value: '4' },
                    )
                )
            )
            .addSubcommand(s => s
                .setName('removebutton')
                .setDescription('Remove a specific role button from a message')
                .addStringOption(o => o.setName('message_id').setDescription('Panel message ID').setRequired(true))
                .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('clear')
                .setDescription('Remove all buttons from a panel message')
                .addStringOption(o => o.setName('message_id').setDescription('Panel message ID').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('list')
                .setDescription('List all button role panels in this server')
            )
        )

        // ── Select menu roles ─────────────────────────────────────────────────
        .addSubcommandGroup(g => g
            .setName('select')
            .setDescription('Dropdown select menu role assignment')
            .addSubcommand(s => s
                .setName('add')
                .setDescription('Add a role option to a select menu on an existing bot message')
                .addStringOption(o => o
                    .setName('message_id')
                    .setDescription('Message ID of the bot message')
                    .setRequired(true)
                )
                .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true))
                .addStringOption(o => o.setName('label').setDescription('Dropdown option label').setRequired(true))
                .addBooleanOption(o => o
                    .setName('exclusive')
                    .setDescription('Only allow one role from this menu at a time (default: false)')
                    .setRequired(false)
                )
            )
            .addSubcommand(s => s
                .setName('remove')
                .setDescription('Remove a specific role from the dropdown')
                .addStringOption(o => o.setName('message_id').setDescription('Panel message ID').setRequired(true))
                .addRoleOption(o => o.setName('role').setDescription('Role to remove').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('clear')
                .setDescription('Remove the entire select menu from a message')
                .addStringOption(o => o.setName('message_id').setDescription('Panel message ID').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('list')
                .setDescription('List all select menu role panels in this server')
            )
        )

        // ── Reaction roles ────────────────────────────────────────────────────
        .addSubcommandGroup(g => g
            .setName('reaction')
            .setDescription('Reaction-based role assignment')
            .addSubcommand(s => s
                .setName('add')
                .setDescription('Add a reaction role to a message')
                .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
                .addStringOption(o => o.setName('emoji').setDescription('Reaction emoji').setRequired(true))
                .addRoleOption(o => o.setName('role').setDescription('Role to assign').setRequired(true))
                .addBooleanOption(o => o
                    .setName('exclusive')
                    .setDescription('Only allow one role from this message at a time (default: false)')
                    .setRequired(false)
                )
                .addChannelOption(o => o
                    .setName('channel')
                    .setDescription('Channel the message is in (default: current)')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(false)
                )
            )
            .addSubcommand(s => s
                .setName('remove')
                .setDescription('Remove a reaction role from a message')
                .addStringOption(o => o.setName('message_id').setDescription('Message ID').setRequired(true))
                .addStringOption(o => o.setName('emoji').setDescription('Emoji to remove').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('list')
                .setDescription('List all reaction roles in this server')
            )
        ),

    category:        'roles',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageRoles],
    botPermissions:  [PermissionFlagsBits.ManageRoles],
    cooldown:        5,

    async execute(interaction, client) {
        const group = interaction.options.getSubcommandGroup();
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;
        await interaction.deferReply({ ephemeral: true });

        // ════════════════════════════════════════════════════════════════════
        // BUTTON ROLES
        // ════════════════════════════════════════════════════════════════════

        if (group === 'button') {

            // ── Add button ────────────────────────────────────────────────────
            if (sub === 'add') {
                const messageId = interaction.options.getString('message_id', true);
                const role      = interaction.options.getRole('role', true);
                const label     = interaction.options.getString('label', true);
                const styleStr  = interaction.options.getString('style') ?? '1';
                const style     = parseInt(styleStr) as ButtonStyle;
                const exclusive = interaction.options.getBoolean('exclusive') ?? false;

                // Find the bot message
                const { msg: targetMessage, reason } = await findBotMessage(guild, messageId, client);
                if (!targetMessage) {
                    const errMsg = reason === 'not_bot'
                        ? `${e('error')} That message wasn't sent by me. Use \`f!ce\` to create a message first.`
                        : `${e('error')} Message not found. Make sure the ID is correct.`;
                    await interaction.editReply({ content: errMsg });
                    return;
                }

                // Check for duplicates
                const dup = await getButtonRole(messageId, role.id);
                if (dup) {
                    await interaction.editReply({ content: `${e('error')} That role is already on this panel.` });
                    return;
                }

                // Get existing buttons for this message
                const existing = await getButtonRolesByMessage(messageId);
                if (existing.length >= 25) {
                    await interaction.editReply({ content: `${e('error')} Maximum 25 buttons per panel.` });
                    return;
                }

                // Save to DB
                await createButtonRole({
                    guildId:   guild.id,
                    channelId: targetMessage.channelId,
                    messageId,
                    label,
                    roleId:    role.id,
                    style,
                    exclusive,
                });

                // Rebuild buttons on the message
                const allEntries = await getButtonRolesByMessage(messageId);
                await rebuildButtons(targetMessage, allEntries);

                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Button added — **${label}** → <@&${role.id}>${exclusive ? '\n-# Exclusive mode: enabled' : ''}`)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            // ── Remove specific button ───────────────────────────────────────
            if (sub === 'removebutton') {
                const messageId = interaction.options.getString('message_id', true);
                const role      = interaction.options.getRole('role', true);

                const entry = await getButtonRole(messageId, role.id);
                if (!entry) {
                    await interaction.editReply({ content: `${e('error')} That role is not on this panel.` });
                    return;
                }

                await deleteButtonRole(messageId, role.id);

                // Try to rebuild buttons on the message
                const { msg: targetMessage } = await findBotMessage(guild, messageId, client);
                if (targetMessage) {
                    const remaining = await getButtonRolesByMessage(messageId);
                    await rebuildButtons(targetMessage, remaining);
                }

                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Button removed — <@&${role.id}>`)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            // ── Clear all buttons ────────────────────────────────────────────
            if (sub === 'clear') {
                const messageId = interaction.options.getString('message_id', true);
                await deleteButtonRolesByMessage(messageId);

                // Try to clear buttons from the message
                const { msg: targetMessage } = await findBotMessage(guild, messageId, client);
                if (targetMessage) {
                    await rebuildButtons(targetMessage, []);
                }

                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  All button roles removed from message \`${messageId}\``)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            // ── List ──────────────────────────────────────────────────────────
            if (sub === 'list') {
                const all = await getButtonRolesByGuild(guild.id);
                if (!all.length) {
                    const card = new FadeContainer(Colours.NONE)
                        .text(`${e('roles')} No button role panels set up.\nUse \`f!ce\` to create a message, then \`/reactionrole button add\` to attach buttons.`)
                        .build();
                    await sendResponse(interaction, [card], true);
                    return;
                }

                // Group by message
                const grouped = new Map<string, typeof all>();
                for (const entry of all) {
                    if (!grouped.has(entry.messageId)) grouped.set(entry.messageId, []);
                    grouped.get(entry.messageId)!.push(entry);
                }

                const lines = [...grouped.entries()].map(([msgId, entries]) => {
                    const excLabel = entries[0].exclusive ? ' · `exclusive`' : '';
                    return `\`${msgId}\` in <#${entries[0].channelId}>${excLabel} · ${entries.map(e => `<@&${e.roleId}>`).join(', ')}`;
                });

                const card = new FadeContainer(Colours.FADE)
                    .text(`## ${e('roles')} Button Role Panels`)
                    .separator(true)
                    .text(lines.join('\n'))
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // SELECT MENU ROLES
        // ════════════════════════════════════════════════════════════════════

        if (group === 'select') {

            // ── Add option ───────────────────────────────────────────────────
            if (sub === 'add') {
                const messageId = interaction.options.getString('message_id', true);
                const role      = interaction.options.getRole('role', true);
                const label     = interaction.options.getString('label', true);
                const exclusive = interaction.options.getBoolean('exclusive') ?? false;

                // Find bot message
                const { msg: targetMessage, reason } = await findBotMessage(guild, messageId, client);
                if (!targetMessage) {
                    const errMsg = reason === 'not_bot'
                        ? `${e('error')} That message wasn't sent by me. Use \`f!ce\` to create a message first.`
                        : `${e('error')} Message not found. Make sure the ID is correct.`;
                    await interaction.editReply({ content: errMsg });
                    return;
                }

                // Check for duplicates
                const existing = await getButtonRolesByMessage(messageId);
                // We reuse buttonRoles table for select menu entries too? No — we need a separate approach.
                // Actually, select menus are stored in buttonRoles table with a different style marker.
                // Let's use the button_roles table but with style = 0 to indicate select menu entries.
                const existingSelect = (await getButtonRolesByMessage(messageId)).filter(e => e.style === 0);
                const dup = existingSelect.find(e => e.roleId === role.id);
                if (dup) {
                    await interaction.editReply({ content: `${e('error')} That role is already in this dropdown.` });
                    return;
                }

                if (existingSelect.length >= 25) {
                    await interaction.editReply({ content: `${e('error')} Maximum 25 options per dropdown.` });
                    return;
                }

                // Save to DB (style = 0 marks select menu entries)
                await createButtonRole({
                    guildId:   guild.id,
                    channelId: targetMessage.channelId,
                    messageId,
                    label,
                    roleId:    role.id,
                    style:     0,
                    exclusive,
                });

                // Rebuild select menu
                const allEntries = (await getButtonRolesByMessage(messageId)).filter(e => e.style === 0);
                await rebuildSelectMenu(targetMessage, allEntries, guild);

                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Dropdown option added — **${label}** → <@&${role.id}>${exclusive ? '\n-# Exclusive mode: enabled' : ''}`)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            // ── Remove option ────────────────────────────────────────────────
            if (sub === 'remove') {
                const messageId = interaction.options.getString('message_id', true);
                const role      = interaction.options.getRole('role', true);

                const entry = await getButtonRole(messageId, role.id);
                if (!entry || entry.style !== 0) {
                    await interaction.editReply({ content: `${e('error')} That role is not in this dropdown.` });
                    return;
                }

                await deleteButtonRole(messageId, role.id);

                // Try to rebuild select menu
                const { msg: targetMessage } = await findBotMessage(guild, messageId, client);
                if (targetMessage) {
                    const remaining = (await getButtonRolesByMessage(messageId)).filter(e => e.style === 0);
                    await rebuildSelectMenu(targetMessage, remaining, guild);
                }

                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Dropdown option removed — <@&${role.id}>`)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            // ── Clear all ────────────────────────────────────────────────────
            if (sub === 'clear') {
                const messageId = interaction.options.getString('message_id', true);

                // Only delete select entries (style === 0)
                const selectEntries = (await getButtonRolesByMessage(messageId)).filter(e => e.style === 0);
                for (const entry of selectEntries) {
                    await deleteButtonRole(messageId, entry.roleId);
                }

                const { msg: targetMessage } = await findBotMessage(guild, messageId, client);
                if (targetMessage) {
                    await rebuildSelectMenu(targetMessage, [], guild);
                }

                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Select menu removed from message \`${messageId}\``)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            // ── List ──────────────────────────────────────────────────────────
            if (sub === 'list') {
                const all = (await getButtonRolesByGuild(guild.id)).filter(e => e.style === 0);
                if (!all.length) {
                    const card = new FadeContainer(Colours.NONE)
                        .text(`${e('roles')} No select menu role panels set up.\nUse \`f!ce\` to create a message, then \`/reactionrole select add\` to attach a dropdown.`)
                        .build();
                    await sendResponse(interaction, [card], true);
                    return;
                }

                const grouped = new Map<string, typeof all>();
                for (const entry of all) {
                    if (!grouped.has(entry.messageId)) grouped.set(entry.messageId, []);
                    grouped.get(entry.messageId)!.push(entry);
                }

                const lines = [...grouped.entries()].map(([msgId, entries]) => {
                    const excLabel = entries[0].exclusive ? ' · `exclusive`' : '';
                    return `\`${msgId}\` in <#${entries[0].channelId}>${excLabel} · ${entries.map(e => `<@&${e.roleId}>`).join(', ')}`;
                });

                const card = new FadeContainer(Colours.FADE)
                    .text(`## ${e('roles')} Select Menu Panels`)
                    .separator(true)
                    .text(lines.join('\n'))
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }
        }

        // ════════════════════════════════════════════════════════════════════
        // REACTION ROLES
        // ════════════════════════════════════════════════════════════════════

        if (group === 'reaction') {

            if (sub === 'add') {
                const messageId = interaction.options.getString('message_id', true);
                const emojiInput = interaction.options.getString('emoji', true).trim();
                const emoji     = cleanEmoji(emojiInput);
                const role      = interaction.options.getRole('role', true);
                const exclusive = interaction.options.getBoolean('exclusive') ?? false;
                const channel   = (interaction.options.getChannel('channel') ?? interaction.channel) as any;

                // Verify message exists
                const targetMessage = await channel.messages.fetch(messageId).catch(() => null);
                if (!targetMessage) {
                    await interaction.editReply({ content: `${e('error')} Message not found in this channel.` });
                    return;
                }

                // Check for duplicate emoji or role on this message
                const existing = await getReactionRolesByMessage(messageId);
                const dupEmoji = existing.find(r => r.emoji === emoji);
                if (dupEmoji) {
                    await interaction.editReply({ content: `${e('error')} That emoji is already mapped to <@&${dupEmoji.roleId}> on this message.` });
                    return;
                }
                const dupRole = existing.find(r => r.roleId === role.id);
                if (dupRole) {
                    await interaction.editReply({ content: `${e('error')} That role is already mapped to ${dupRole.emoji} on this message.` });
                    return;
                }

                await createReactionRole({
                    guildId:   guild.id,
                    channelId: channel.id,
                    messageId,
                    emoji,
                    roleId:    role.id,
                    exclusive,
                });

                // Add the reaction to the message
                await targetMessage.react(emoji).catch(() => null);

                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Reaction role added\n${emoji} → <@&${role.id}>${exclusive ? '\n-# Exclusive mode: enabled' : ''}`)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            if (sub === 'remove') {
                const messageId = interaction.options.getString('message_id', true);
                const emojiInput = interaction.options.getString('emoji', true).trim();
                const emoji     = cleanEmoji(emojiInput);

                const entry = await getReactionRole(messageId, emoji);
                if (!entry) {
                    await interaction.editReply({ content: `${e('error')} That reaction role is not configured for this message.` });
                    return;
                }

                await deleteReactionRole(messageId, emoji);

                // Fetch channel and message to remove the bot's reaction
                const channel = await guild.channels.fetch(entry.channelId).catch(() => null);
                if (channel && channel.isTextBased()) {
                    const msg = await (channel as any).messages.fetch(messageId).catch(() => null);
                    if (msg) {
                        const rx = msg.reactions.cache.find((r: any) => {
                            const rEmoji = r.emoji.id
                                ? `<${r.emoji.animated ? 'a' : ''}:${r.emoji.name}:${r.emoji.id}>`
                                : r.emoji.name;
                            return rEmoji === emoji;
                        });
                        if (rx) {
                            await rx.users.remove(client.user!.id).catch(() => null);
                        }
                    }
                }

                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Reaction role removed (${emoji})`)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            if (sub === 'list') {
                const all = await getReactionRolesByGuild(guild.id);
                if (!all.length) {
                    const card = new FadeContainer(Colours.NONE)
                        .text(`${e('roles')} No reaction roles set up.\nUse \`/reactionrole reaction add\` to get started.`)
                        .build();
                    await sendResponse(interaction, [card], true);
                    return;
                }

                const lines = all.map(r =>
                    `${r.emoji} → <@&${r.roleId}> · <#${r.channelId}> · \`${r.messageId}\`${r.exclusive ? ' · `exclusive`' : ''}`
                );

                const card = new FadeContainer(Colours.FADE)
                    .text(`## ${e('roles')} Reaction Roles`)
                    .separator(true)
                    .text(lines.join('\n'))
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }
        }
    },
} satisfies Command;