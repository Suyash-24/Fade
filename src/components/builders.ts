// src/components/builders.ts
// Fade's Components v2 builder — uses discord.js native builders.
// Works on both slash command interactions AND regular messages.
import {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SectionBuilder,
    ThumbnailBuilder,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    SeparatorSpacingSize,
    MessageFlags,
    type AnyComponentBuilder,
} from 'discord.js';
import type {
    ChatInputCommandInteraction,
    MessageComponentInteraction,
    Message,
} from 'discord.js';

export {
    ButtonStyle,
    SeparatorSpacingSize,
    MessageFlags,
};

// ── Primitive helpers ─────────────────────────────────────────────────────────

export const txt = (content: string) =>
    new TextDisplayBuilder().setContent(content);

export const sep = (divider = true, spacing = SeparatorSpacingSize.Small) =>
    new SeparatorBuilder().setDivider(divider).setSpacing(spacing);

export const thumb = (url: string) =>
    new ThumbnailBuilder().setURL(url);

export const btn = (
    customId: string,
    label: string,
    style: ButtonStyle = ButtonStyle.Secondary,
    disabled = false,
) =>
    new ButtonBuilder()
        .setCustomId(customId)
        .setLabel(label)
        .setStyle(style)
        .setDisabled(disabled);

export const linkBtn = (url: string, label: string) =>
    new ButtonBuilder()
        .setURL(url)
        .setLabel(label)
        .setStyle(ButtonStyle.Link);

export const row = (...buttons: ButtonBuilder[]) =>
    new ActionRowBuilder<ButtonBuilder>().addComponents(...buttons);

export const gallery = (...urls: { url: string; description?: string }[]) =>
    new MediaGalleryBuilder().addItems(
        ...urls.map(u => {
            const item = new MediaGalleryItemBuilder().setURL(u.url);
            if (u.description) item.setDescription(u.description);
            return item;
        })
    );

export const section = (
    texts: string[],
    accessory?: ThumbnailBuilder | ButtonBuilder,
) => {
    const s = new SectionBuilder()
        .addTextDisplayComponents(...texts.map(t => txt(t)));
    if (accessory) s.setThumbnailAccessory(accessory as ThumbnailBuilder);
    return s;
};

// ── Container builder ─────────────────────────────────────────────────────────

export class FadeContainer {
    private container: ContainerBuilder;

    constructor(accentColor?: number | null) {
        this.container = new ContainerBuilder();
        if (accentColor !== undefined && accentColor !== null) {
            this.container.setAccentColor(accentColor);
        }
    }

    text(content: string) {
        this.container.addTextDisplayComponents(txt(content));
        return this;
    }

    separator(divider = true, spacing = SeparatorSpacingSize.Small) {
        this.container.addSeparatorComponents(sep(divider, spacing));
        return this;
    }

    section(texts: string[], accessory?: ThumbnailBuilder | ButtonBuilder) {
        this.container.addSectionComponents(section(texts, accessory));
        return this;
    }

    gallery(items: { url: string; description?: string }[]) {
        this.container.addMediaGalleryComponents(gallery(...items));
        return this;
    }

    actionRow(...buttons: ButtonBuilder[]) {
        this.container.addActionRowComponents(row(...buttons));
        return this;
    }

    build() {
        return this.container;
    }
}

// ── Response sender ───────────────────────────────────────────────────────────

export interface FadeReplyOptions {
    components:      ContainerBuilder[];
    flags:           number;
    allowedMentions?: { users?: string[]; roles?: string[]; parse?: string[] };
}

export function fadeReply(
    containers: ContainerBuilder[],
    ephemeral = false,
    allowedMentions?: FadeReplyOptions['allowedMentions'],
): FadeReplyOptions {
    let flags = MessageFlags.IsComponentsV2;
    if (ephemeral) flags |= MessageFlags.Ephemeral;
    const opts: FadeReplyOptions = { components: containers, flags };
    if (allowedMentions) opts.allowedMentions = allowedMentions;
    return opts;
}

// Send as slash command reply
export async function sendResponse(
    interaction: ChatInputCommandInteraction,
    containers: ContainerBuilder[],
    ephemeral = false,
    allowedMentions?: FadeReplyOptions['allowedMentions'],
): Promise<void> {
    const payload = fadeReply(containers, ephemeral, allowedMentions) as any;
    if (interaction.deferred || interaction.replied) {
        await interaction.editReply(payload);
    } else {
        await interaction.reply(payload);
    }
}

// Send as regular message (prefix commands)
export async function sendMessage(
    message: Message,
    containers: ContainerBuilder[],
): Promise<Message> {
    const payload = {
        components: containers,
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { repliedUser: false },
    } as any;

    return message.reply(payload).catch((err) => {
        // If message was deleted (Invalid Form Body for message_reference), fallback to channel send
        if (err.code === 10008 || err.code === 50035) {
            return (message.channel as any).send(payload);
        }
        throw err;
    });
}

// Update existing message (button refresh)
export async function updateResponse(
    interaction: MessageComponentInteraction,
    containers: ContainerBuilder[],
    ephemeral = false,
): Promise<void> {
    await interaction.update(fadeReply(containers, ephemeral) as any);
}