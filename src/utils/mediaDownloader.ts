import { Message, ChatInputCommandInteraction } from 'discord.js';
import { e } from '../components/emojis.js';

/**
 * Media Downloader - Embed Proxy Approach
 * 
 * These proxy services (ddinstagram, vxtwitter, vxtiktok) serve og:video meta tags
 * ONLY to Discord's crawler (Discordbot UA from Discord IPs). When sent as a plain
 * message, Discord auto-embeds the video inline — no scraping or APIs needed.
 * 
 * For Pinterest, there is no reliable free proxy, so we just send the original link.
 */

const EMBED_PROXIES: Record<string, { hostReplace: string; stripQuery?: boolean }> = {
    'TikTok':    { hostReplace: 'vxtiktok.com', stripQuery: true },
    'Instagram': { hostReplace: 'ddinstagram.com', stripQuery: true },
    'Twitter':   { hostReplace: 'fxtwitter.com' },
    'X':         { hostReplace: 'fxtwitter.com' },
};

export async function handleMediaDownload(
    context: Message | ChatInputCommandInteraction,
    url: string,
    platformName: string
) {
    const isInteraction = 'reply' in context && !('content' in context);
    const replyFn = async (content: string, ephemeral = false) => {
        const payload: any = { content };
        if (isInteraction) {
            if ((context as ChatInputCommandInteraction).deferred) {
                return (context as ChatInputCommandInteraction).editReply(payload);
            }
            return (context as ChatInputCommandInteraction).reply({ ...payload, ephemeral });
        } else {
            return (context as Message).reply(payload);
        }
    };

    if (isInteraction && !(context as ChatInputCommandInteraction).deferred) {
        await (context as ChatInputCommandInteraction).deferReply();
    }

    try {
        const proxy = EMBED_PROXIES[platformName];
        let embedUrl: string;

        if (proxy) {
            const parsed = new URL(url);
            parsed.hostname = proxy.hostReplace;
            embedUrl = proxy.stripQuery ? parsed.origin + parsed.pathname : parsed.toString();
        } else {
            // Pinterest / unknown — just send the original link
            embedUrl = url;
        }

        const requester = isInteraction
            ? (context as ChatInputCommandInteraction).user
            : (context as Message).author;

        return await replyFn(
            `🎥 **${platformName} Media**\nRequested by ${requester}\n${embedUrl}`
        );
    } catch (err: any) {
        console.error(`[MediaDownloader] Error for ${platformName}:`, err.message || err);
        return await replyFn(`${e('error')} Failed to process the media link.`);
    }
}
