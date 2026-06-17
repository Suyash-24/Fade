// src/utils/tempVoiceInterface.ts
import {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageFlags,
    ModalBuilder,
    TextInputBuilder,
    TextInputStyle,
    AttachmentBuilder,
} from 'discord.js';
import { e, Colours } from '../components/emojis.js';
import { generateTempVoiceCanvas, tvcButtons } from './tempVoiceCanvas.js';

// ── Button definitions ────────────────────────────────────────────────────────

const makeBtn = (customId: string, style: ButtonStyle, emoji: string) => {
    // Determine if it's a custom emoji or unicode.
    // Our custom emojis are strictly `<:name:ID>` but we can just use the ID if we have it.
    // In our definition, emoji is the numeric ID.
    return new ButtonBuilder()
        .setCustomId(customId)
        .setStyle(style)
        .setEmoji({ id: emoji }); // Pass ID for custom emojis
};

// ── Interface card ────────────────────────────────────────────────────────────

export async function buildInterface(): Promise<{
    content: string;
    components: any[];
    files: AttachmentBuilder[];
    flags: number;
}> {
    // Generate the canvas image buffer
    const buffer = await generateTempVoiceCanvas();
    const attachment = new AttachmentBuilder(buffer, { name: 'interface.png' });

    // Build the ActionRows directly from the grid mapping
    // 19 buttons -> 4 rows: 5, 5, 5, 4
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let currentRow = new ActionRowBuilder<ButtonBuilder>();

    for (let i = 0; i < tvcButtons.length; i++) {
        const btnDef = tvcButtons[i];
        
        // Let's use secondary style for everything, or mix them. 
        // For aesthetics, pure Secondary (gray) buttons look incredibly clean below an image.
        // We'll use Secondary for all.
        currentRow.addComponents(makeBtn(btnDef.id, ButtonStyle.Secondary, btnDef.emojiId));

        if (currentRow.components.length === 5 || i === tvcButtons.length - 1) {
            rows.push(currentRow);
            currentRow = new ActionRowBuilder<ButtonBuilder>();
        }
    }

    return {
        // Empty content, just attaching the beautiful image and rows
        content: '',
        components: rows,
        files: [attachment],
        flags: 0,
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

export function banModal(): ModalBuilder {
    return new ModalBuilder()
        .setCustomId('tvc_modal_ban')
        .setTitle('Ban User from Voice')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('user_id')
                    .setLabel('User ID to ban')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Right-click user → Copy User ID')
                    .setRequired(true)
            )
        );
}

export function unbanModal(): ModalBuilder {
    return new ModalBuilder()
        .setCustomId('tvc_modal_unban')
        .setTitle('Unban User from Voice')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('user_id')
                    .setLabel('User ID to unban')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Right-click user → Copy User ID')
                    .setRequired(true)
            )
        );
}

export function muteModal(): ModalBuilder {
    return new ModalBuilder()
        .setCustomId('tvc_modal_mute')
        .setTitle('Mute User')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('user_id')
                    .setLabel('User ID to mute')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Right-click user → Copy User ID')
                    .setRequired(true)
            )
        );
}

export function unmuteModal(): ModalBuilder {
    return new ModalBuilder()
        .setCustomId('tvc_modal_unmute')
        .setTitle('Unmute User')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('user_id')
                    .setLabel('User ID to unmute')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Right-click user → Copy User ID')
                    .setRequired(true)
            )
        );
}

export function deafenModal(): ModalBuilder {
    return new ModalBuilder()
        .setCustomId('tvc_modal_deafen')
        .setTitle('Deafen User')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('user_id')
                    .setLabel('User ID to deafen')
                    .setStyle(TextInputStyle.Short)
                    .setPlaceholder('Right-click user → Copy User ID')
                    .setRequired(true)
            )
        );
}

export function undeafenModal(): ModalBuilder {
    return new ModalBuilder()
        .setCustomId('tvc_modal_undeafen')
        .setTitle('Undeafen User')
        .addComponents(
            new ActionRowBuilder<TextInputBuilder>().addComponents(
                new TextInputBuilder()
                    .setCustomId('user_id')
                    .setLabel('User ID to undeafen')
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