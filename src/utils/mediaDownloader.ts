import { AttachmentBuilder, Message, ChatInputCommandInteraction } from 'discord.js';
import { e, Colours } from '../components/emojis.js';
import youtubedl from 'youtube-dl-exec';

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
        
        // Strip query parameters for fixup links (except YouTube where ?v= matters)
        if (platformName !== 'YouTube') {
            fixupUrl = parsedUrl.toString().split('?')[0];
        } else {
            fixupUrl = parsedUrl.toString();
        }
    } catch (e) {}

    try {
        // Use youtube-dl-exec to extract the direct MP4 stream URL
        const youtubedlAny = (youtubedl as any).default || youtubedl;
        const output = await youtubedlAny(url, {
            dumpJson: true,
            noWarnings: true,
            preferFreeFormats: true,
            format: 'bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best'
        }) as any;

        const mediaUrl = output.url || output.requested_downloads?.[0]?.url;

        if (!mediaUrl) {
            throw new Error("No download URL returned from yt-dlp.");
        }

        // Try to attach the video directly as a file upload
        const attachment = new AttachmentBuilder(mediaUrl, { name: `${platformName.toLowerCase()}_video.mp4` });
        return await replyFn(`🎥 **${platformName} Media**\nRequested by ${isInteraction ? (context as ChatInputCommandInteraction).user : (context as Message).author}`, false, [attachment]);
        
    } catch (err: any) {
        // yt-dlp failed (e.g. YouTube bot detection block on Heroku IP) OR file size > 25MB
        console.error(`[MediaDownloader] Error parsing URL for ${platformName}:`, err.message || err);
        
        // Fallback to sending the raw link / fixup link
        return await replyFn(`🎥 **${platformName} Media**\n*(Direct download blocked by platform, sending embed link instead)*\n${fixupUrl}`);
    }
}
