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
