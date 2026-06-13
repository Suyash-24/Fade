// src/utils/tempVoiceInterface.ts
// Builds and sends the TempVoice control interface.
// A persistent pinned message inside each temp channel with
// a full button grid for channel management.
import {
    type TextChannel,
    type VoiceChannel,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import { e, Colours } from '../components/emojis.js';

// ── Button definitions ────────────────────────────────────────────────────────

const makeBtn = (customId: string, label: string, style: ButtonStyle, emoji?: string) => {
    const b = new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(label)
        .setStyle(style);
    if (emoji) b.setEmoji({ name: emoji });
    return b;
};

// Row 1 — Channel settings
const row1 = () => new ActionRowBuilder<ButtonBuilder>().addComponents(
    makeBtn('tvc_name',     'Name',     ButtonStyle.Secondary, '✏️'),
    makeBtn('tvc_limit',    'Limit',    ButtonStyle.Secondary, '👥'),
    makeBtn('tvc_lock',     'Lock',     ButtonStyle.Secondary, '🔒'),
    makeBtn('tvc_hide',     'Hide',     ButtonStyle.Secondary, '👁️'),
    makeBtn('tvc_info',     'Info',     ButtonStyle.Secondary, 'ℹ️'),
);

// Row 2 — User management
const row2 = () => new ActionRowBuilder<ButtonBuilder>().addComponents(
    makeBtn('tvc_permit',   'Permit',   ButtonStyle.Success,   '✅'),
    makeBtn('tvc_reject',   'Reject',   ButtonStyle.Danger,    '🚫'),
    makeBtn('tvc_kick',     'Kick',     ButtonStyle.Danger,    '👢'),
    makeBtn('tvc_transfer', 'Transfer', ButtonStyle.Primary,   '👑'),
    makeBtn('tvc_claim',    'Claim',    ButtonStyle.Primary,   '🎯'),
);

// Row 3 — Danger zone
const row3 = () => new ActionRowBuilder<ButtonBuilder>().addComponents(
    makeBtn('tvc_unlock',   'Unlock',   ButtonStyle.Success,   '🔓'),
    makeBtn('tvc_unhide',   'Unhide',   ButtonStyle.Success,   '👀'),
    makeBtn('tvc_delete',   'Delete',   ButtonStyle.Danger,    '🗑️'),
);

// ── Interface card ────────────────────────────────────────────────────────────

export function buildInterface(ownerName: string): {
    components: any[];
    flags: number;
} {
    const container = new ContainerBuilder()
        .setAccentColor(Colours.FADE)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${e('voice')} TempVoice\n` +
                `-# Your personal voice channel · Owned by **${ownerName}**`
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                [
                    `**Channel controls**`,
                    `\`✏️ Name\` — rename your channel`,
                    `\`👥 Limit\` — set user limit`,
                    `\`🔒 Lock\` — prevent new joins · \`🔓 Unlock\` — allow joins`,
                    `\`👁️ Hide\` — make invisible · \`👀 Unhide\` — show channel`,
                    ``,
                    `**User controls**`,
                    `\`✅ Permit\` — allow a user in · \`🚫 Reject\` — remove access`,
                    `\`👢 Kick\` — remove from channel`,
                    `\`👑 Transfer\` — give ownership · \`🎯 Claim\` — claim ownerless channel`,
                ].join('\n')
            )
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addActionRowComponents(row1())
        .addActionRowComponents(row2())
        .addActionRowComponents(row3());

    return {
        components: [container],
        flags:      MessageFlags.IsComponentsV2,
    };
}

// ── Modals for inputs ─────────────────────────────────────────────────────────

export function nameModal(): ModalBuilder {
    return new ModalBuilder()
        .setCustomId('tvc_modal_name')
        .setTitle('Rename Channel')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('name')
                    .setLabel('New channel name')
                    .setStyle(TextInputStyle.Short)
                    .setMaxLength(100)
                    .setRequired(true)
            )
        );
}

export function limitModal(): ModalBuilder {
    return new ModalBuilder()
        .setCustomId('tvc_modal_limit')
        .setTitle('Set User Limit')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('limit')
                    .setLabel('User limit (0 = unlimited)')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('0')
                    .setMaxLength(2)
                    .setRequired(true)
            )
        );
}

export function permitModal(): ModalBuilder {
    return new ModalBuilder()
        .setCustomId('tvc_modal_permit')
        .setTitle('Permit User')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('user_id')
                    .setLabel('User ID to permit')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Right-click user → Copy User ID')
                    .setRequired(true)
            )
        );
}

export function rejectModal(): ModalBuilder {
    return new ModalBuilder()
        .setCustomId('tvc_modal_reject')
        .setTitle('Reject User')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('user_id')
                    .setLabel('User ID to reject')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Right-click user → Copy User ID')
                    .setRequired(true)
            )
        );
}

export function kickModal(): ModalBuilder {
    return new ModalBuilder()
        .setCustomId('tvc_modal_kick')
        .setTitle('Kick User')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('user_id')
                    .setLabel('User ID to kick')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Right-click user → Copy User ID')
                    .setRequired(true)
            )
        );
}

export function transferModal(): ModalBuilder {
    return new ModalBuilder()
        .setCustomId('tvc_modal_transfer')
        .setTitle('Transfer Ownership')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('user_id')
                    .setLabel('User ID of new owner')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Must be in your channel')
                    .setRequired(true)
            )
        );
}