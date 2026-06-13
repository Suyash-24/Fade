// src/commands/tickets/ticket.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import {
    createPanel,
    getPanels,
    getPanel,
    getPanelOptions,
    addOption,
    updatePanelMessage,
    deletePanel,
    getOption,
    updateOptionFormFields,
    type FormField,
} from '../../db/queries/tickets.js';
import { buildPanelMessage } from '../../utils/ticketUtils.js';
import { e, Colours } from '../../components/emojis.js';
import { MessageFlags as MF } from 'discord.js';

export default {
    data: new SlashCommandBuilder()
        .setName('ticket')
        .setDescription('Manage the ticket system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(s => s
            .setName('create')
            .setDescription('Create a new ticket panel')
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel to post the panel in')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
            .addStringOption(o => o.setName('label').setDescription('Panel title').setRequired(true))
            .addStringOption(o => o.setName('description').setDescription('Panel description').setRequired(false))
        )

        .addSubcommand(s => s
            .setName('addtype')
            .setDescription('Add a ticket type (button) to a panel')
            .addIntegerOption(o => o.setName('panel').setDescription('Panel ID (from /ticket list)').setRequired(true))
            .addStringOption(o => o.setName('label').setDescription('Button label').setRequired(true))
            .addChannelOption(o => o
                .setName('category')
                .setDescription('Category to create tickets in')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(true)
            )
            .addRoleOption(o => o.setName('role').setDescription('Support role for this ticket type').setRequired(false))
            .addStringOption(o => o.setName('message').setDescription('Opening message').setRequired(false))
            .addIntegerOption(o => o
                .setName('max_open')
                .setDescription('Max open tickets per user (default 1)')
                .setMinValue(1).setMaxValue(5)
                .setRequired(false)
            )
        )

        .addSubcommand(s => s
            .setName('post')
            .setDescription('Post (or repost) a ticket panel to its channel')
            .addIntegerOption(o => o.setName('panel').setDescription('Panel ID').setRequired(true))
        )

        .addSubcommand(s => s
            .setName('list')
            .setDescription('List all ticket panels in this server')
        )

        .addSubcommand(s => s
            .setName('delete')
            .setDescription('Delete a ticket panel')
            .addIntegerOption(o => o.setName('panel').setDescription('Panel ID').setRequired(true))
        )

        .addSubcommandGroup(g => g
            .setName('form')
            .setDescription('Manage intake form fields for a ticket type')
            .addSubcommand(s => s
                .setName('add')
                .setDescription('Add a form field to a ticket type')
                .addIntegerOption(o => o.setName('option').setDescription('Ticket type ID (from /ticket list)').setRequired(true))
                .addStringOption(o => o.setName('label').setDescription('Field label / question').setRequired(true).setMaxLength(45))
                .addStringOption(o => o
                    .setName('style')
                    .setDescription('Input style')
                    .setRequired(false)
                    .addChoices(
                        { name: 'Short (single line)', value: 'short' },
                        { name: 'Paragraph (multi line)', value: 'paragraph' },
                    )
                )
                .addStringOption(o => o.setName('placeholder').setDescription('Placeholder text').setRequired(false).setMaxLength(100))
                .addBooleanOption(o => o.setName('required').setDescription('Is this field required? (default: true)').setRequired(false))
            )
            .addSubcommand(s => s
                .setName('remove')
                .setDescription('Remove a form field by number')
                .addIntegerOption(o => o.setName('option').setDescription('Ticket type ID').setRequired(true))
                .addIntegerOption(o => o.setName('field').setDescription('Field number (from /ticket form list)').setRequired(true).setMinValue(1))
            )
            .addSubcommand(s => s
                .setName('list')
                .setDescription('View form fields for a ticket type')
                .addIntegerOption(o => o.setName('option').setDescription('Ticket type ID').setRequired(true))
            )
        ),

    category:        'tickets',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        5,

    async execute(interaction, client) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        // ── Create panel ──────────────────────────────────────────────────────
        if (sub === 'create') {
            const channel     = interaction.options.getChannel('channel', true);
            const label       = interaction.options.getString('label', true);
            const description = interaction.options.getString('description')?.replace(/\\n/g, '\n');

            // Enforce 3-panel limit per server
            const existing = await getPanels(guild.id);
            if (existing.length >= 3) {
                const card = new FadeContainer(Colours.WARNING)
                    .text(
                        `## ${e('error')} Panel Limit Reached\n` +
                        `This server already has **${existing.length}/3** ticket panels.\n` +
                        `-# Delete an existing panel with \`/ticket delete\` before creating a new one.\n\n` +
                        existing.map(p => `${e('id')} \`#${p.id}\` — **${p.label}** ${p.messageId ? `· <#${p.channelId}>` : '*(unposted)*'}`).join('\n')
                    )
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }

            const panel = await createPanel(guild.id, channel.id, label, description ?? undefined);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `## ${e('ticket')} Panel Created\n` +
                    `${e('id')}  **Panel ID** — \`${panel.id}\`\n` +
                    `**Channel** — <#${channel.id}>\n` +
                    `-# Use \`/ticket addtype panel:${panel.id}\` to add ticket types, then \`/ticket post panel:${panel.id}\` to publish`
                )
                .build();

            await sendResponse(interaction, [card]);
            return;
        }

        // ── Add ticket type ───────────────────────────────────────────────────
        if (sub === 'addtype') {
            const panelId  = interaction.options.getInteger('panel', true);
            const label    = interaction.options.getString('label', true);
            const role     = interaction.options.getRole('role');
            const category = interaction.options.getChannel('category', true);
            const message  = interaction.options.getString('message');
            const maxOpen  = interaction.options.getInteger('max_open') ?? 1;

            const panel = await getPanel(panelId);
            if (!panel || panel.guildId !== guild.id) {
                await interaction.reply({ content: `${e('error')} Panel #${panelId} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const options = await getPanelOptions(panelId);
            if (options.length >= 5) {
                await interaction.reply({ content: `${e('error')} Maximum 5 ticket types per panel.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const option = await addOption(panelId, guild.id, label, {
                categoryId:   category?.id,
                supportRoles: role ? [role.id] : [],
                openMessage:  message ?? undefined,
                maxOpen,
            });

            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `${e('success')}  **${label}** added to panel #${panelId}\n` +
                    `-# Run \`/ticket post panel:${panelId}\` to update the panel`
                )
                .build();

            await sendResponse(interaction, [card]);
            return;
        }

        // ── Post panel ────────────────────────────────────────────────────────
        if (sub === 'post') {
            const panelId = interaction.options.getInteger('panel', true);
            const panel   = await getPanel(panelId);

            if (!panel || panel.guildId !== guild.id) {
                await interaction.reply({ content: `${e('error')} Panel #${panelId} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const options = await getPanelOptions(panelId);
            if (!options.length) {
                await interaction.reply({
                    content: `${e('error')} Add at least one ticket type first with \`/ticket addtype\`.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const channel = guild.channels.cache.get(panel.channelId) as any;
            if (!channel?.isTextBased()) {
                await interaction.reply({ content: `${e('error')} Panel channel not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            // Delete old panel message if it exists
            if (panel.messageId) {
                await channel.messages.delete(panel.messageId).catch(() => null);
            }

            const card = await buildPanelMessage(
                panel.label,
                panel.description,
                panel.color,
                options.map(o => ({ id: o.id, label: o.label, emoji: o.emoji })),
            );

            const msg = await channel.send({
                components: [card],
                flags:      MessageFlags.IsComponentsV2,
            } as any);

            await updatePanelMessage(panelId, msg.id);

            const confirmCard = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Panel **${panel.label}** posted in <#${channel.id}>`)
                .build();

            await sendResponse(interaction, [confirmCard]);
            return;
        }

        // ── List panels ───────────────────────────────────────────────────────
        if (sub === 'list') {
            const panels = await getPanels(guild.id);

            if (!panels.length) {
                const card = new FadeContainer(Colours.FADE)
                    .text(`${e('ticket')} No ticket panels created yet.\nUse \`/ticket create\` to get started.`)
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }

            const lines = await Promise.all(
                panels.map(async p => {
                    const opts = await getPanelOptions(p.id);
                    return `**#${p.id}** · ${p.label} · <#${p.channelId}> · \`${opts.length}\` type${opts.length === 1 ? '' : 's'}`;
                })
            );

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('ticket')} Ticket Panels`)
                .separator(true)
                .text(lines.join('\n'))
                .build();

            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Form management ───────────────────────────────────────────────────
        const group = interaction.options.getSubcommandGroup(false);
        if (group === 'form') {
            const optionId = interaction.options.getInteger('option', true);
            const option   = await getOption(optionId);

            if (!option || option.guildId !== guild.id) {
                await interaction.reply({ content: `${e('error')} Ticket type #${optionId} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const fields = (option.formFields ?? []) as FormField[];

            if (sub === 'add') {
                if (fields.length >= 5) {
                    await interaction.reply({ content: `${e('error')} Maximum 5 form fields per ticket type.`, flags: MessageFlags.Ephemeral });
                    return;
                }

                const field: FormField = {
                    label:       interaction.options.getString('label', true),
                    placeholder: interaction.options.getString('placeholder') ?? undefined,
                    required:    interaction.options.getBoolean('required') ?? true,
                    paragraph:   interaction.options.getString('style') === 'paragraph',
                };

                fields.push(field);
                await updateOptionFormFields(optionId, fields);

                const card = new FadeContainer(Colours.SUCCESS)
                    .text(
                        `${e('success')}  Form field added to **${option.label}**\n` +
                        `-# Field ${fields.length}/5: "${field.label}" · ${field.paragraph ? 'Paragraph' : 'Short'} · ${field.required ? 'Required' : 'Optional'}`
                    )
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            if (sub === 'remove') {
                const fieldNum = interaction.options.getInteger('field', true);
                if (fieldNum > fields.length) {
                    await interaction.reply({ content: `${e('error')} Field #${fieldNum} doesn't exist. Use \`/ticket form list\` to see fields.`, flags: MessageFlags.Ephemeral });
                    return;
                }

                const removed = fields.splice(fieldNum - 1, 1)[0];
                await updateOptionFormFields(optionId, fields);

                const card = new FadeContainer(Colours.DANGER)
                    .text(`${e('success')}  Removed field "${removed.label}" from **${option.label}**`)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            if (sub === 'list') {
                if (!fields.length) {
                    await interaction.reply({
                        content: `${e('error')} No form fields on **${option.label}**. Use \`/ticket form add\` to add some.`,
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }

                const lines = fields.map((f, i) =>
                    `**${i + 1}.** ${f.label}\n-# ${f.paragraph ? 'Paragraph' : 'Short'} · ${f.required ? 'Required' : 'Optional'}${f.placeholder ? ` · "${f.placeholder}"` : ''}`
                ).join('\n');

                const card = new FadeContainer(Colours.FADE)
                    .text(`## ${e('ticket')} Form — ${option.label}\n${lines}`)
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }
        }

        // ── Delete panel ──────────────────────────────────────────────────────
        if (sub === 'delete') {
            const panelId = interaction.options.getInteger('panel', true);
            const panel   = await getPanel(panelId);

            if (!panel || panel.guildId !== guild.id) {
                await interaction.reply({ content: `${e('error')} Panel #${panelId} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            // Delete the panel message if it exists
            if (panel.messageId) {
                const channel = guild.channels.cache.get(panel.channelId) as any;
                await channel?.messages.delete(panel.messageId).catch(() => null);
            }

            await deletePanel(panelId);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Panel **${panel.label}** deleted`)
                .build();

            await sendResponse(interaction, [card]);
            return;
        }
    },
} satisfies Command;