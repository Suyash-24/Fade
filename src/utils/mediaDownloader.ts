// src/utils/mediaDownloader.ts
import { AttachmentBuilder, Message, ChatInputCommandInteraction } from 'discord.js';
import { e, Colours } from '../components/emojis.js';
import { FadeContainer, sendMessage } from '../components/builders.js';
import { Downloader } from '@tobyg74/tiktok-api-dl';
import play from 'play-dl';

export async function handleMediaDownload(
    context: Message | ChatInputCommandInteraction,
    url: string,
    platformName: string
) {
    const isInteraction = 'reply' in context && !('content' in context);
    const replyFn = async (content: string, ephemeral = false) => {
        if (isInteraction) {
            if ((context as ChatInputCommandInteraction).deferred) {
                return (context as ChatInputCommandInteraction).editReply({ content });
            }
            return (context as ChatInputCommandInteraction).reply({ content, ephemeral });
        } else {
            return (context as Message).reply({ content });
        }
    };

    if (isInteraction && !(context as ChatInputCommandInteraction).deferred) {
        await (context as ChatInputCommandInteraction).deferReply();
    } else if (!isInteraction) {
        if ((context.channel as any)?.sendTyping) await (context.channel as any).sendTyping().catch(() => null);
    }

    let mediaUrl: string | undefined = undefined;

    try {
        if (platformName === 'TikTok') {
            const result = await Downloader(url, { version: 'v1' });
            if (result.status === 'success' && result.result?.video?.playAddr?.length) {
                mediaUrl = result.result.video.playAddr[0]; // First element is usually highest quality no-watermark
            } else {
                return replyFn(`${e('error')} Failed to extract TikTok video. The video might be private or deleted.`);
            }
        } 
        else if (platformName === 'YouTube') {
            const info = await play.video_info(url);
            // YouTube separates audio and video on high qualities. We need a combined format for standard MP4 playback.
            const combinedFormats = info.format.filter(f => (f as any).hasVideo && (f as any).hasAudio);
            if (combinedFormats.length > 0) {
                // Get the best combined format
                const best = combinedFormats.sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0))[0];
                mediaUrl = best.url;
            } else {
                return replyFn(`${e('error')} Could not find a suitable combined video/audio format for this YouTube link.`);
            }
        }
        else {
            // Generic Fallback API for IG, Twitter, Pinterest
            // Using a highly available Indonesian REST API that aggregates scrapers
            let endpoint = 'igdl';
            if (platformName === 'Twitter') endpoint = 'twitter';
            if (platformName === 'Pinterest') endpoint = 'pinterest';
            
            const apiRes = await fetch(`https://api.vreden.my.id/api/dowloader/${endpoint}?url=${encodeURIComponent(url)}`);
            if (!apiRes.ok) throw new Error('API down');
            const data = await apiRes.json();
            
            if (platformName === 'Instagram') {
                mediaUrl = data?.result?.[0]?.url || data?.result?.url;
            } else if (platformName === 'Twitter') {
                mediaUrl = data?.result?.video;
            } else if (platformName === 'Pinterest') {
                mediaUrl = data?.result?.video;
            }
            
            if (!mediaUrl) {
                throw new Error('No media extracted');
            }
        }
    } catch (err) {
        console.error(`[MediaDownloader] Error for ${platformName}:`, err);
        return replyFn(`${e('error')} Failed to extract media. The link might be private, unsupported, or the platform blocked the request.`);
    }

    if (!mediaUrl) {
        return replyFn(`${e('error')} Received an empty response from the download server.`);
    }

    // Try to attach natively (25MB limit)
    try {
        const attachment = new AttachmentBuilder(mediaUrl, { name: `${platformName.toLowerCase()}_video.mp4` });
        
        if (isInteraction) {
            await (context as ChatInputCommandInteraction).editReply({ files: [attachment] });
        } else {
            await (context as Message).reply({ files: [attachment] });
        }
    } catch (err) {
        // Fallback to sending the raw link if Discord rejects the upload
        const card = new FadeContainer(Colours.SUCCESS)
            .text(`${e('success')} Video successfully downloaded, but it is too large to attach natively!\n\n🔗 **[Download ${platformName} Video](${mediaUrl})**`)
            .build();
            
        if (isInteraction) {
            await (context as ChatInputCommandInteraction).editReply(card as any);
        } else {
            await sendMessage(context as Message, [card]);
        }
    }
}
