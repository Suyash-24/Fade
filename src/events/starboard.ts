// src/events/starboard.ts
// Fires on every reaction add/remove and handles starboard logic.
// Flow:
//   1. Check if reaction matches configured emoji + threshold
//   2. If new entry → post to starboard channel
//   3. If existing entry → update star count on starboard message
//   4. If stars drop below threshold → remove from starboard
import {
    type MessageReaction,
    type User,
    type TextChannel,
    type Message,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
    MessageFlags,
    ChannelType,
} from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import {
    getStarboardConfig,
    getStarboardEntry,
    createStarboardEntry,
    updateStarCount,
    deleteStarboardEntry,
} from '../db/queries/starboard.js';
import { Colours } from '../components/emojis.js';
import { logger } from '../utils/logger.js';

// ── Card builder ──────────────────────────────────────────────────────────────

function buildStarboardCard(
    message: Message,
    starCount: number,
    emoji: string,
    config: any,
) {
    const author    = message.author;
    const createdTs = Math.floor(message.createdTimestamp / 1000);
    const color     = config.color ?? Colours.WARNING;

    const showAttachments = config.showAttachments !== false;
    const showTimestamp   = config.showTimestamp !== false;
    const showJumpUrl     = config.showJumpUrl !== false;

    const image = showAttachments
        ? (message.attachments.find(a => a.contentType?.startsWith('image/'))?.url
            ?? message.embeds[0]?.image?.url
            ?? message.embeds[0]?.thumbnail?.url)
        : undefined;

    // ── Header: emoji + count + source channel
    const header = `${emoji} **${starCount}** · <#${message.channelId}>`;

    // ── Content: quoted, truncated
    const rawContent = message.content?.trim();
    const content = rawContent
        ? `> ${rawContent.slice(0, 800).replace(/\n/g, '\n> ')}`
        : `-# *No text content*`;

    // ── Footer: author · timestamp · jump
    const footerParts: string[] = [`<@${author.id}>`];
    if (showTimestamp) footerParts.push(`<t:${createdTs}:d>`);
    if (showJumpUrl)   footerParts.push(`[↗ Jump](${message.url})`);
    const footer = `-# ${footerParts.join(' · ')}`;

    const container = new ContainerBuilder()
        .setAccentColor(color)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(header)
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(content)
        );

    if (image) {
        container.addSeparatorComponents(
            new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
        );
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(image))
        );
    }

    // Footer always last — sits below image if present
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(footer)
    );

    return container;
}

// ── Reaction handler ──────────────────────────────────────────────────────────

async function handleReaction(
    client: FadeClient,
    reaction: MessageReaction,
    user: User,
    added: boolean,
): Promise<void> {
    if (!reaction.message.guild) return;

    if (reaction.partial) await reaction.fetch().catch(() => null);
    if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

    const message = reaction.message as Message;
    const guild   = message.guild!;

    try {
        const config = await getStarboardConfig(guild.id);

        const reactionEmoji = reaction.emoji.id
            ? (reaction.emoji.animated
                ? `<a:${reaction.emoji.name}:${reaction.emoji.id}>`
                : `<:${reaction.emoji.name}:${reaction.emoji.id}>`)
            : reaction.emoji.name ?? '⭐';

        logger.debug('[Starboard] Reaction fired', {
            reactionEmoji,
            configEmoji:   config.emoji,
            emojiMatch:    reactionEmoji === config.emoji,
            enabled:       config.enabled,
            channelId:     config.channelId,
            isBot:         message.author?.bot,
            count:         reaction.count,
        });

        // Don't star bot messages or messages in the starboard channels
        if (message.author?.bot) return;
        if (message.channelId === config.channelId || message.channelId === (config as any).clownChannelId) return;

        // Ignore NSFW if configured
        const channel = guild.channels.cache.get(message.channelId);
        if (config.ignoreNsfw && channel?.type === ChannelType.GuildText && (channel as any).nsfw) return;

        // Process starboard
        if (config.enabled && config.channelId && reactionEmoji === config.emoji) {
            await processBoard(guild, message, reaction, config, config.channelId, config.emoji, config.threshold, added, false);
        }

        // Process clownboard
        const c = config as any;
        if (c.clownEnabled && c.clownChannelId && reactionEmoji === c.clownEmoji) {
            await processBoard(guild, message, reaction, config, c.clownChannelId, c.clownEmoji, c.clownThreshold, added, true);
        }

    } catch (err) {
        logger.error('Starboard handler failed', err, { guildId: guild.id });
    }
}

async function processBoard(
    guild: any,
    message: Message,
    reaction: MessageReaction,
    config: any,
    boardChannelId: string,
    emoji: string,
    threshold: number,
    added: boolean,
    isClown: boolean,
) {
    // Effective star count: subtract the author's own reaction when self-star is disabled
    const rawCount  = reaction.count ?? 0;
    const reactorMap = await reaction.users.fetch().catch(() => null);
    const authorReacted = reactorMap?.has(message.author?.id ?? '') ?? false;
    const selfStarEnabled = !!(config as any).selfStar;
    const starCount = (!selfStarEnabled && authorReacted) ? rawCount - 1 : rawCount;

    logger.debug('[Starboard] processBoard', {
        rawCount,
        authorReacted,
        selfStarEnabled,
        starCount,
        threshold,
        added,
        isClown,
        messageId: message.id,
    });

    // Use a prefixed key for clownboard entries to avoid collision
    const entryKey  = isClown ? `clown_${message.id}` : message.id;
    const existing  = await getStarboardEntry(entryKey);
    const boardChannel = guild.channels.cache.get(boardChannelId) as TextChannel | undefined;
    if (!boardChannel?.isTextBased()) {
        logger.debug('[Starboard] Board channel not found or not text-based', { boardChannelId });
        return;
    }

    if (starCount < threshold) {
        if (existing?.starboardId) {
            await boardChannel.messages.delete(existing.starboardId).catch(() => null);
            await deleteStarboardEntry(entryKey);
        }
        return;
    }

    const card = buildStarboardCard(message, starCount, emoji, config);
    const noMentions = { parse: [] as any[] };

    if (existing?.starboardId) {
        await boardChannel.messages.edit(existing.starboardId, {
            components:      [card],
            flags:           MessageFlags.IsComponentsV2,
            allowedMentions: noMentions,
        } as any).catch(() => null);
        await updateStarCount(entryKey, starCount);
        return;
    }

    if (starCount >= threshold && added) {
        logger.debug('[Starboard] Posting new entry', { messageId: message.id, starCount });
        const posted = await boardChannel.send({
            components:      [card],
            flags:           MessageFlags.IsComponentsV2,
            allowedMentions: noMentions,
        } as any);

        await createStarboardEntry({
            guildId:     guild.id,
            originalId:  entryKey,
            starboardId: posted.id,
            authorId:    message.author?.id ?? '',
            channelId:   message.channelId,
            starCount,
        });
    }
}

// ── Events ────────────────────────────────────────────────────────────────────

export const reactionAdd: Event<'messageReactionAdd'> = {
    name: 'messageReactionAdd',
    async execute(client, reaction, user) {
        if (user.bot) return;
        await handleReaction(client, reaction as any, user as any, true);
    },
};

export const reactionRemove: Event<'messageReactionRemove'> = {
    name: 'messageReactionRemove',
    async execute(client, reaction, user) {
        if (user.bot) return;
        await handleReaction(client, reaction as any, user as any, false);
    },
};

export default [reactionAdd, reactionRemove];