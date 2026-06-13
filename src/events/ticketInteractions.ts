// src/events/ticketInteractions.ts
// Handles all ticket button interactions:
//   ticket_open_{optionId} — opens a new ticket
//   ticket_claim           — staff claims the ticket
//   ticket_close           — closes the ticket
//   ticket_reopen          — reopens a closed ticket
//   ticket_delete          — deletes the ticket channel
import {
    PermissionFlagsBits,
    MessageFlags,
    AttachmentBuilder,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import {
    getOption,
    createTicket,
    getTicket,
    getUserOpenTickets,
    updateTicketStatus,
    claimTicket,
    unclaimTicket,
    type FormField,
} from '../db/queries/tickets.js';
import {
    createTicketChannel,
    sendTicketOpening,
    generateTranscript,
} from '../utils/ticketUtils.js';
import { FadeContainer, btn } from '../components/builders.js';
import { e, Colours } from '../components/emojis.js';
import { logger } from '../utils/logger.js';
import { ButtonStyle } from 'discord.js';

// ── Helper: swap a button in a CV2 pinned message via raw REST ───────────────────
// discord.js doesn't parse CV2 Container components into message.components,
// so we must use the REST API directly to read & write the raw component tree.

function swapInComponents(components: any[], fromId: string, toId: string, label: string, style: number): any[] {
    return components.map((c: any) => {
        if (c.type === 1) { // ActionRow
            return {
                ...c,
                components: (c.components ?? []).map((b: any) =>
                    b.custom_id === fromId
                        ? { ...b, custom_id: toId, label, style }
                        : b
                ),
            };
        }
        if (c.type === 17 && Array.isArray(c.components)) { // Container
            return { ...c, components: swapInComponents(c.components, fromId, toId, label, style) };
        }
        return c;
    });
}

async function swapPinnedButton(
    client: any,
    channelId: string,
    messageId: string,
    fromId: string,
    toId: string,
    label: string,
    style: number,
): Promise<void> {
    const raw: any = await client.rest.get(`/channels/${channelId}/messages/${messageId}`);
    const updated  = swapInComponents(raw.components ?? [], fromId, toId, label, style);
    await client.rest.patch(`/channels/${channelId}/messages/${messageId}`, {
        body: { components: updated, flags: raw.flags },
    });
}

// ── Helper: open ticket without form ─────────────────────────────────────────

async function openTicket(interaction: any, option: any, optionId: number) {
    await interaction.deferReply({ ephemeral: true });
    try {
        const member  = interaction.member as any;
        const channel = await createTicketChannel(
            interaction.guild,
            member,
            option.label,
            option.categoryId,
            option.supportRoles as string[],
        );
        await createTicket(interaction.guild.id, channel.id, interaction.user.id, optionId);
        await sendTicketOpening(channel, member, option.label, option.openMessage, option.supportRoles as string[]);
        const card = new FadeContainer(Colours.SUCCESS)
            .text(`${e('success')}  Your ticket has been opened — <#${channel.id}>`)
            .build();
        await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);
    } catch (err) {
        logger.error('Failed to open ticket', err, { guildId: interaction.guild.id });
        await interaction.editReply({ content: `${e('error')} Failed to create ticket. Please try again.` });
    }
}

const event: Event<'interactionCreate'> = {
    name: 'interactionCreate',

    async execute(client: FadeClient, interaction) {
        if (!interaction.guild) return;

        // ── Modal submit: ticket form ─────────────────────────────────────────
        if (interaction.isModalSubmit() && interaction.customId.startsWith('ticket_form_')) {
            const optionId = parseInt(interaction.customId.replace('ticket_form_', ''));
            const option   = await getOption(optionId);
            if (!option) return;

            // Check limit again (race condition guard)
            let openTickets = await getUserOpenTickets(interaction.guild.id, interaction.user.id, optionId);
            const actualOpenTickets = [];
            for (const t of openTickets) {
                const c = await interaction.guild.channels.fetch(t.channelId).catch(() => null);
                if (!c) {
                    await updateTicketStatus(t.channelId, 'deleted');
                } else {
                    actualOpenTickets.push(t);
                }
            }

            if (actualOpenTickets.length >= option.maxOpen) {
                await interaction.reply({ content: `${e('error')} You already have an open ticket.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                const member  = interaction.member as any;
                const channel = await createTicketChannel(
                    interaction.guild,
                    member,
                    option.label,
                    option.categoryId,
                    option.supportRoles as string[],
                );

                await createTicket(interaction.guild.id, channel.id, interaction.user.id, optionId);

                // Collect form answers
                const fields  = (option.formFields ?? []) as FormField[];
                const answers = fields.map(f => ({
                    label:  f.label,
                    value:  interaction.fields.getTextInputValue(f.label.slice(0, 100)) || '—',
                }));

                await sendTicketOpening(
                    channel,
                    member,
                    option.label,
                    option.openMessage,
                    option.supportRoles as string[],
                    answers,
                );

                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Your ticket has been opened — <#${channel.id}>`)
                    .build();
                await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);

            } catch (err) {
                logger.error('Failed to open ticket (form)', err, { guildId: interaction.guild.id });
                await interaction.editReply({ content: `${e('error')} Failed to create ticket. Please try again.` });
            }
            return;
        }

        if (!interaction.isMessageComponent()) return;

        const id = interaction.customId;

        // ── Open ticket ───────────────────────────────────────────────────────
        if (id.startsWith('ticket_open_')) {
            const optionId = parseInt(id.replace('ticket_open_', ''));
            const option   = await getOption(optionId);

            if (!option) {
                await interaction.reply({ content: `${e('error')} Ticket option not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            // Check open ticket limit
            let openTickets = await getUserOpenTickets(interaction.guild.id, interaction.user.id, optionId);
            const actualOpenTickets = [];
            for (const t of openTickets) {
                const c = await interaction.guild.channels.fetch(t.channelId).catch(() => null);
                if (!c) {
                    await updateTicketStatus(t.channelId, 'deleted');
                } else {
                    actualOpenTickets.push(t);
                }
            }

            if (actualOpenTickets.length >= option.maxOpen) {
                const card = new FadeContainer(Colours.WARNING)
                    .text(
                        `${e('error')} You already have an open ticket for **${option.label}**.\n` +
                        `-# ${actualOpenTickets.map(t => `<#${t.channelId}>`).join(', ')}`
                    )
                    .build();
                await interaction.reply({ components: [card], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral } as any);
                return;
            }

            const fields = (option.formFields ?? []) as FormField[];

            // If form fields exist — show modal first
            if (fields.length > 0) {
                const modal = new ModalBuilder()
                    .setCustomId(`ticket_form_${optionId}`)
                    .setTitle(option.label.slice(0, 45));

                for (const field of fields.slice(0, 5)) {
                    const input = new TextInputBuilder()
                        .setCustomId(field.label.slice(0, 100))
                        .setLabel(field.label.slice(0, 45))
                        .setStyle(field.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
                        .setRequired(field.required);
                    if (field.placeholder) input.setPlaceholder(field.placeholder.slice(0, 100));
                    modal.addComponents(new ActionRowBuilder<TextInputBuilder>().addComponents(input));
                }

                await interaction.showModal(modal);
                return;
            }

            // No form — open ticket immediately
            await openTicket(interaction, option, optionId);
            return;
        }

        // ── Claim ticket ──────────────────────────────────────────────────────
        if (id === 'ticket_claim') {
            const ticket = await getTicket(interaction.channelId!);
            if (!ticket) {
                await interaction.reply({ content: `${e('error')} Could not find this ticket.`, flags: MessageFlags.Ephemeral });
                return;
            }

            // Must have ManageChannels to claim
            const member = interaction.member as any;
            if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                await interaction.reply({ content: `${e('error')} Only staff can claim tickets.`, flags: MessageFlags.Ephemeral });
                return;
            }

            if (ticket.claimedBy) {
                await interaction.reply({
                    content: `${e('error')} This ticket is already claimed by <@${ticket.claimedBy}>.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await claimTicket(interaction.channelId!, interaction.user.id);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Ticket claimed by <@${interaction.user.id}>`)
                .build();

            await interaction.reply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);

            // Update channel topic
            await (interaction.channel as any)?.setTopic(
                `${(interaction.channel as any)?.topic} · Claimed by ${interaction.user.tag}`
            ).catch(() => null);

            // Swap Claim → Unclaim in the pinned opening message via raw REST
            try {
                const pins   = await (interaction.channel as any)?.messages.fetchPinned();
                const pinned = pins?.first();
                if (pinned && pinned.author.id === interaction.client.user?.id) {
                    await swapPinnedButton(
                        interaction.client, interaction.channelId!, pinned.id,
                        'ticket_claim', 'ticket_unclaim', 'Unclaim', 2,
                    );
                }
            } catch (err) { logger.warn('Failed to swap claim button', err as any); }
            return;
        }

        // ── Close ticket ──────────────────────────────────────────────────────
        if (id === 'ticket_close') {
            const ticket = await getTicket(interaction.channelId!);
            if (!ticket || ticket.status === 'closed') {
                await interaction.reply({ content: `${e('error')} This ticket is already closed.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.deferReply();

            await updateTicketStatus(interaction.channelId!, 'closed');

            // Lock channel for user — they can still view to click Reopen, but can't send messages
            await (interaction.channel as any)?.permissionOverwrites.edit(ticket.userId, {
                ViewChannel:  true,
                SendMessages: false,
            }).catch(() => null);

            const card = new FadeContainer(Colours.WARNING)
                .text(`## ${e('lock')} Ticket Closed`)
                .separator(true)
                .text(
                    `Closed by <@${interaction.user.id}>\n` +
                    `-# <t:${Math.floor(Date.now() / 1000)}:T>`
                )
                .separator(true)
                .actionRow(
                    btn('ticket_reopen',     'Reopen',     ButtonStyle.Success),
                    btn('ticket_transcript', 'Transcript', ButtonStyle.Secondary),
                    btn('ticket_delete',     'Delete',     ButtonStyle.Danger),
                )
                .build();

            await interaction.editReply({
                components: [card],
                flags:      MessageFlags.IsComponentsV2,
            } as any);
            return;
        }

        // ── Reopen ticket ─────────────────────────────────────────────────────
        if (id === 'ticket_reopen') {
            const ticket = await getTicket(interaction.channelId!);
            if (!ticket || ticket.status === 'open') {
                await interaction.reply({ content: `${e('error')} This ticket is already open.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const member       = interaction.member as any;
            const isStaff      = member.permissions.has(PermissionFlagsBits.ManageChannels);
            const isOwner      = interaction.user.id === ticket.userId;

            if (!isStaff && !isOwner) {
                await interaction.reply({ content: `${e('error')} Only staff or the ticket owner can reopen this ticket.`, flags: MessageFlags.Ephemeral });
                return;
            }

            // Restore user's access
            await (interaction.channel as any)?.permissionOverwrites.edit(ticket.userId, {
                ViewChannel:        true,
                SendMessages:       true,
                ReadMessageHistory: true,
            }).catch(() => null);

            await updateTicketStatus(interaction.channelId!, 'open');

            // If the ticket was claimed, clear the claim and restore the Claim button
            if (ticket.claimedBy) {
                await unclaimTicket(interaction.channelId!);
                try {
                    const pins   = await (interaction.channel as any)?.messages.fetchPinned();
                    const pinned = pins?.first();
                    if (pinned && pinned.author.id === interaction.client.user?.id) {
                        await swapPinnedButton(
                            interaction.client, interaction.channelId!, pinned.id,
                            'ticket_unclaim', 'ticket_claim', 'Claim', 1,
                        );
                    }
                } catch (err) { logger.warn('Failed to restore claim button on reopen', err as any); }
            }

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('unlock')}  Ticket reopened by <@${interaction.user.id}>`)
                .separator(true)
                .actionRow(
                    btn('ticket_claim', 'Claim', ButtonStyle.Primary),
                    btn('ticket_close', 'Close', ButtonStyle.Danger),
                )
                .build();

            await interaction.reply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);
            return;
        }

        // ── Transcript ─────────────────────────────────────────────────────
        if (id === 'ticket_transcript') {
            const member = interaction.member as any;
            if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                await interaction.reply({ content: `${e('error')} Only staff can download transcripts.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            const transcript = await generateTranscript(interaction.channel as any);
            const buffer     = Buffer.from(transcript, 'utf-8');
            const attachment = new AttachmentBuilder(buffer, { name: `transcript-${interaction.channelId}.txt` });

            // Plain ephemeral reply — IS_COMPONENTS_V2 flag blocks file attachments
            await interaction.editReply({
                content: `${e('ticket')} **Transcript** · <#${interaction.channelId}> · <t:${Math.floor(Date.now() / 1000)}:R>`,
                files:   [attachment],
            });
            return;
        }

        // ── Unclaim ticket ──────────────────────────────────────────────────
        if (id === 'ticket_unclaim') {
            const ticket = await getTicket(interaction.channelId!);
            if (!ticket) {
                await interaction.reply({ content: `${e('error')} Could not find this ticket.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const member = interaction.member as any;
            if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                await interaction.reply({ content: `${e('error')} Only staff can unclaim tickets.`, flags: MessageFlags.Ephemeral });
                return;
            }

            if (!ticket.claimedBy) {
                await interaction.reply({ content: `${e('error')} This ticket is not claimed.`, flags: MessageFlags.Ephemeral });
                return;
            }

            if (interaction.user.id !== ticket.claimedBy) {
                await interaction.reply({ content: `${e('error')} Only <@${ticket.claimedBy}> (who claimed this ticket) can unclaim it.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await unclaimTicket(interaction.channelId!);

            const unclaimCard = new FadeContainer(Colours.WARNING)
                .text(`${e('refresh')}  Ticket unclaimed by <@${interaction.user.id}>`)
                .build();

            await interaction.reply({ components: [unclaimCard], flags: MessageFlags.IsComponentsV2 } as any);

            // Swap Unclaim → Claim back in the pinned opening message via raw REST
            try {
                const pins   = await (interaction.channel as any)?.messages.fetchPinned();
                const pinned = pins?.first();
                if (pinned && pinned.author.id === interaction.client.user?.id) {
                    await swapPinnedButton(
                        interaction.client, interaction.channelId!, pinned.id,
                        'ticket_unclaim', 'ticket_claim', 'Claim', 1,
                    );
                }
            } catch (err) { logger.warn('Failed to swap unclaim button', err as any); }
            return;
        }

        // ── Delete ticket ─────────────────────────────────────────────────────
        if (id === 'ticket_delete') {
            const member = interaction.member as any;
            if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
                await interaction.reply({ content: `${e('error')} Only staff can delete tickets.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const ticket = await getTicket(interaction.channelId!);
            if (ticket && ticket.status !== 'closed') {
                await interaction.reply({ content: `${e('error')} Close the ticket first before deleting it.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.reply({ content: `${e('warn')} Deleting ticket in 5 seconds...`, flags: MessageFlags.Ephemeral });
            await updateTicketStatus(interaction.channelId!, 'deleted');

            setTimeout(async () => {
                await interaction.channel?.delete('[Fade] Ticket deleted').catch(() => null);
            }, 5_000);
            return;
        }
    },
};

export default event;