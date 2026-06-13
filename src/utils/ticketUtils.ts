// src/utils/ticketUtils.ts
import {
    type Guild,
    type GuildMember,
    type TextChannel,
    ChannelType,
    PermissionFlagsBits,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    MessageFlags,
} from 'discord.js';
import { FadeContainer, btn } from '../components/builders.js';
import { e, Colours } from '../components/emojis.js';

// ── Create ticket channel ─────────────────────────────────────────────────────

export async function createTicketChannel(
    guild: Guild,
    member: GuildMember,
    label: string,
    categoryId?: string | null,
    supportRoles?: string[],
): Promise<TextChannel> {
    const channelName = `ticket-${member.user.username.toLowerCase().replace(/[^a-z0-9]/g, '')}`;

    // Build permission overwrites
    const permissionOverwrites: any[] = [
        {
            // @everyone — deny view
            id:    guild.id,
            deny:  [PermissionFlagsBits.ViewChannel],
        },
        {
            // Ticket creator — allow view + send
            id:    member.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
                PermissionFlagsBits.AttachFiles,
            ],
        },
        {
            // Fade bot — full access
            id:    guild.members.me!.id,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ManageChannels,
                PermissionFlagsBits.ReadMessageHistory,
            ],
        },
    ];

    // Support roles — allow view + send
    for (const roleId of supportRoles ?? []) {
        permissionOverwrites.push({
            id:    roleId,
            allow: [
                PermissionFlagsBits.ViewChannel,
                PermissionFlagsBits.SendMessages,
                PermissionFlagsBits.ReadMessageHistory,
            ],
        });
    }

    const channel = await guild.channels.create({
        name:                 channelName,
        type:                 ChannelType.GuildText,
        parent:               categoryId ?? undefined,
        topic:                `Ticket for ${member.user.tag} · ${label}`,
        permissionOverwrites,
    });

    return channel as TextChannel;
}

// ── Send opening message inside the ticket ────────────────────────────────────

export async function sendTicketOpening(
    channel: TextChannel,
    member: GuildMember,
    label: string,
    customMessage?: string | null,
    supportRoles?: string[],
    formAnswers?: { label: string; value: string }[],
) {
    const rolesMention = supportRoles?.length
        ? supportRoles.map(id => `<@&${id}>`).join(' ')
        : null;

    const message = customMessage
        ?? `Thank you for opening a ticket, ${member.toString()}!\n\nA staff member will be with you shortly.`;

    const card = new FadeContainer(Colours.FADE)
        .text(`## ${e('ticket')} ${label}`)
        .separator(true)
        .text(message);

    // Append form answers if present
    if (formAnswers?.length) {
        card.separator(true);
        const answersText = formAnswers
            .map(a => `**${a.label}**\n${a.value}`)
            .join('\n\n');
        card.text(answersText);
    }

    card.separator(true)
        .actionRow(
            btn('ticket_claim', 'Claim', ButtonStyle.Primary),
            btn('ticket_close', 'Close', ButtonStyle.Danger),
        );

    // Use a top-level TextDisplay for the role ping — keeps everything in one Components V2 message
    const components: any[] = [];
    if (rolesMention) {
        components.push(new TextDisplayBuilder().setContent(rolesMention));
    }
    components.push(card.build());

    const msg = await channel.send({
        components,
        flags:           MessageFlags.IsComponentsV2,
        allowedMentions: { roles: supportRoles ?? [], users: [member.id] },
    } as any);

    await msg.pin().catch(() => null);
    return msg;
}

// ── Build panel message ───────────────────────────────────────────────────────

export async function buildPanelMessage(
    label: string,
    description?: string | null,
    color?: number | null,
    options?: { id: number; label: string; emoji?: string | null }[],
) {
    const card = new FadeContainer(0x00CED1)
        .text(`## ${e('ticket')} ${label}`)
        .separator(description ? true : false);

    if (description) card.text(description);

    card.separator(true);
    card.text(`-# Click a button below to open a ticket`);

    // Build buttons for each option (max 5 per action row)
    const buttons = (options ?? []).slice(0, 5).map(opt =>
        new ButtonBuilder()
            .setCustomId(`ticket_open_${opt.id}`)
            .setLabel(opt.label)
            .setStyle(ButtonStyle.Success)
            .setEmoji(opt.emoji || e('ticketbutton'))
    );

    card.actionRow(...buttons as any);

    return card.build();
}

// ── Generate transcript ───────────────────────────────────────────────────────

export async function generateTranscript(channel: TextChannel): Promise<string> {
    const messages = await channel.messages.fetch({ limit: 100 });
    const sorted   = [...messages.values()].reverse();

    const lines = sorted.map(msg => {
        const ts      = new Date(msg.createdTimestamp).toISOString();
        const content = msg.content || (msg.embeds.length ? '[embed]' : '[attachment]');
        return `[${ts}] ${msg.author.tag}: ${content}`;
    });

    return lines.join('\n');
}