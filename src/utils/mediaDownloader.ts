import { AttachmentBuilder, Message, ChatInputCommandInteraction } from 'discord.js';
import { e } from '../components/emojis.js';
import { Downloader as TiktokDL } from '@tobyg74/tiktok-api-dl';

export async function handleMediaDownload(
    context: Message | ChatInputCommandInteraction,
    url: string,
    platformName: string
) {
    const isInteraction = 'reply' in context && !('content' in context);
    const replyFn = async (content: string, ephemeral = false, files: AttachmentBuilder[] = []) => {
        const payload: any = { content, files };
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
    } else if (!isInteraction) {
        if ((context.channel as any)?.sendTyping) await (context.channel as any).sendTyping().catch(() => null);
    }

    let fixupUrl = url;
    try {
        const parsedUrl = new URL(url);
        if (platformName === 'TikTok') parsedUrl.hostname = 'vxtiktok.com';
        else if (platformName === 'Twitter' || platformName === 'X') parsedUrl.hostname = 'vxtwitter.com';
        else if (platformName === 'Instagram') parsedUrl.hostname = 'ddinstagram.com';
        
        if (platformName !== 'YouTube') {
            fixupUrl = parsedUrl.toString().split('?')[0];
        } else {
            fixupUrl = parsedUrl.toString();
        }
    } catch (e) {}

    try {
        let mediaUrl: string | null = null;

        if (platformName === 'TikTok') {
            const result = await TiktokDL(url, { version: 'v1' });
            if (result.status === 'success' && result.result?.video?.playAddr?.length) {
                mediaUrl = result.result.video.playAddr[0];
            } else {
                throw new Error("TikTok download failed");
            }
        } else if (platformName === 'Instagram') {
            const ddUrl = new URL(url);
            ddUrl.hostname = 'ddinstagram.com';
            // We use ddinstagram's proxy to extract the direct MP4
            const res = await fetch(ddUrl.toString()).then(r => r.text());
            const match = res.match(/<meta\s+property="og:video"\s+content="([^"]+)"/i);
            if (match && match[1]) {
                mediaUrl = match[1].startsWith('http') ? match[1] : `https://ddinstagram.com${match[1]}`;
            } else {
                throw new Error("Could not extract video from ddinstagram");
            }
        } else if (platformName === 'Pinterest') {
            // Attempt multiple REST APIs for Pinterest since yt-dlp gets blocked
            const apiRes = await fetch(`https://api.vreden.my.id/api/dowloader/pinterest?url=${encodeURIComponent(url)}`).then(r => r.json()).catch(() => null);
            if (apiRes?.result?.url) {
                mediaUrl = apiRes.result.url;
            } else {
                const altRes = await fetch(`https://api.tiklydown.eu.org/api/download?url=${encodeURIComponent(url)}`).then(r => r.json()).catch(() => null);
                if (altRes?.video) {
                   mediaUrl = typeof altRes.video === 'string' ? altRes.video : altRes.video.noWatermark;
                } else {
                    throw new Error("Pinterest APIs failed");
                }
            }
        } else {
            // For YouTube / Twitter / others, the fixup/embed URL provides native playback in Discord instantly
            return await replyFn(`🎥 **${platformName} Media**\nRequested by ${isInteraction ? (context as ChatInputCommandInteraction).user : (context as Message).author}\n${fixupUrl}`);
        }

        if (!mediaUrl) {
            throw new Error("No media URL found");
        }

        const attachment = new AttachmentBuilder(mediaUrl, { name: `${platformName.toLowerCase()}_video.mp4` });
        return await replyFn(`🎥 **${platformName} Media**\nRequested by ${isInteraction ? (context as ChatInputCommandInteraction).user : (context as Message).author}`, false, [attachment]);
        
    } catch (err: any) {
        console.error(`[MediaDownloader] Error parsing URL for ${platformName}:`, err.message || err);
        return await replyFn(`🎥 **${platformName} Media**\n*(Direct download blocked by platform, sending embed link instead)*\n${fixupUrl}`);
    }
}
