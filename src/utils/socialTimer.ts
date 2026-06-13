// src/utils/socialTimer.ts
// Polls YouTube, Twitch, and Reddit every 5 minutes.
// Sends a notification card when new content is detected.
import { MessageFlags, ContainerBuilder, TextDisplayBuilder, SeparatorBuilder, SeparatorSpacingSize } from 'discord.js';
import type { FadeClient } from '../client.js';
import { getAllByPlatform, updateLastPostId } from '../db/queries/socialNotifications.js';
import { pollYouTube, pollTwitch, pollReddit } from './socialPollers.js';
import { Colours } from '../components/emojis.js';
import { logger } from './logger.js';

const PLATFORM_COLOR: Record<string, number> = {
    youtube: 0xFF0000,
    twitch:  0x9146FF,
    reddit:  0xFF4500,
};

const PLATFORM_LABEL: Record<string, string> = {
    youtube: '▶️ YouTube',
    twitch:  '🟣 Twitch',
    reddit:  '🟠 Reddit',
};

async function sendNotification(
    client: FadeClient,
    guildId: string,
    channelId: string,
    platform: string,
    post: { title: string; url: string; thumbnail?: string; isLive?: boolean },
    accountName: string,
    roleId?: string | null,
    customMessage?: string | null,
) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const channel = guild.channels.cache.get(channelId) as any;
    if (!channel?.isTextBased()) return;

    const label   = PLATFORM_LABEL[platform] ?? platform;
    const isLive  = post.isLive;
    const heading = isLive
        ? `${label} · **${accountName}** is live!`
        : `${label} · **${accountName}** posted`;

    const text = customMessage
        ? customMessage
            .replace(/{name}/g,  accountName)
            .replace(/{url}/g,   post.url)
            .replace(/{title}/g, post.title)
        : `${heading}\n**${post.title}**\n${post.url}`;

    const card = new ContainerBuilder()
        .setAccentColor(PLATFORM_COLOR[platform] ?? Colours.FADE)
        .addTextDisplayComponents(new TextDisplayBuilder().setContent(text));

    if (post.thumbnail) {
        card.addSeparatorComponents(
            new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
        );
        const { MediaGalleryBuilder, MediaGalleryItemBuilder } = await import('discord.js');
        card.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(new MediaGalleryItemBuilder().setURL(post.thumbnail))
        );
    }

    const roleMention = roleId ? `<@&${roleId}>` : undefined;

    await channel.send({
        content:    roleMention,
        components: [card],
        flags:      MessageFlags.IsComponentsV2,
        allowedMentions: roleId ? { roles: [roleId] } : { parse: [] },
    } as any).catch(() => null);
}

async function runPoll(client: FadeClient) {
    // ── YouTube ───────────────────────────────────────────────────────────────
    try {
        const entries = await getAllByPlatform('youtube');
        for (const entry of entries) {
            const post = await pollYouTube(entry.accountId);
            if (!post || post.id === entry.lastPostId) continue;
            await updateLastPostId(entry.id, post.id);
            // Skip first run (lastPostId was null — just initialise)
            if (!entry.lastPostId) continue;
            await sendNotification(client, entry.guildId, entry.channelId, 'youtube', post, entry.accountName, entry.roleId, entry.message);
        }
    } catch (err) { logger.error('YouTube poll failed', err); }

    // ── Twitch ────────────────────────────────────────────────────────────────
    try {
        const entries = await getAllByPlatform('twitch');
        for (const entry of entries) {
            const post = await pollTwitch(entry.accountId);
            // post is null = offline, non-null = live
            const isLive    = !!post;
            const wasLive   = entry.lastPostId === 'live';

            if (isLive && !wasLive) {
                // Just went live
                await updateLastPostId(entry.id, 'live');
                await sendNotification(client, entry.guildId, entry.channelId, 'twitch', post!, entry.accountName, entry.roleId, entry.message);
            } else if (!isLive && wasLive) {
                // Went offline — reset
                await updateLastPostId(entry.id, 'offline');
            }
        }
    } catch (err) { logger.error('Twitch poll failed', err); }

    // ── Reddit ────────────────────────────────────────────────────────────────
    try {
        const entries = await getAllByPlatform('reddit');
        for (const entry of entries) {
            const post = await pollReddit(entry.accountId);
            if (!post || post.id === entry.lastPostId) continue;
            await updateLastPostId(entry.id, post.id);
            if (!entry.lastPostId) continue;
            await sendNotification(client, entry.guildId, entry.channelId, 'reddit', post, entry.accountName, entry.roleId, entry.message);
        }
    } catch (err) { logger.error('Reddit poll failed', err); }
}

export function startSocialTimer(client: FadeClient): void {
    // Initial poll after 30s (let cache populate)
    setTimeout(() => runPoll(client), 30_000);
    // Then every 5 minutes
    setInterval(() => runPoll(client), 5 * 60 * 1_000);
    logger.info('Social notifications timer started');
}
