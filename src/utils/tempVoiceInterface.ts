// src/utils/tempVoiceInterface.ts
import {
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageFlags,
    ModalBuilder,
    ContainerBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
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
    components: any[];
    files: AttachmentBuilder[];
    flags: number;
}> {
    // Generate the canvas image buffer
    const buffer = await generateTempVoiceCanvas();
    const attachment = new AttachmentBuilder(buffer, { name: 'interface.png' });

    // Build the ActionRows directly from the grid mapping
    const container = new ContainerBuilder()
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `## ${e('voice')} Voice Interface\n` +
                `-# Use the buttons below to manage your temporary voice channel.`
            )
        )
        .addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL('attachment://interface.png')
            )
        );

    let currentButtons: ButtonBuilder[] = [];

    for (let i = 0; i < tvcButtons.length; i++) {
        const btnDef = tvcButtons[i];
        
        let djsStyle = ButtonStyle.Secondary;
        if (btnDef.style === 'success') djsStyle = ButtonStyle.Success;
        else if (btnDef.style === 'danger') djsStyle = ButtonStyle.Danger;
        else if (btnDef.style === 'primary') djsStyle = ButtonStyle.Primary;
        
        currentButtons.push(makeBtn(btnDef.id, djsStyle, btnDef.emojiId));

        if (currentButtons.length === 5 || i === tvcButtons.length - 1) {
            container.addActionRowComponents(new ActionRowBuilder<ButtonBuilder>().addComponents(...currentButtons));
            currentButtons = [];
        }
    }

    return {
        components: [container],
        files: [attachment],
        flags: MessageFlags.IsComponentsV2,
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