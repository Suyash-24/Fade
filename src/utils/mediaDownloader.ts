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
        try {
            const attachment = new AttachmentBuilder(mediaUrl, { name: `${platformName.toLowerCase()}_video.mp4` });
            return await replyFn(`🎥 **${platformName} Media**\nRequested by ${isInteraction ? (context as ChatInputCommandInteraction).user : (context as Message).author}`, false, [attachment]);
        } catch (attachErr: any) {
            // Discord API error (usually if file exceeds 25MB limits or timeout)
            // Fallback to sending the raw link or a fixup link if it fails to attach
            let fixupUrl = url;
            try {
                const parsedUrl = new URL(url);
                if (platformName === 'TikTok') parsedUrl.hostname = 'vxtiktok.com';
                else if (platformName === 'Twitter' || platformName === 'X') parsedUrl.hostname = 'vxtwitter.com';
                else if (platformName === 'Instagram') parsedUrl.hostname = 'ddinstagram.com';
                fixupUrl = parsedUrl.toString();
            } catch (e) {}

            return await replyFn(`🎥 **${platformName} Media**\n*(Video was too large to attach, sending embed link instead)*\n${fixupUrl}`);
        }
    } catch (err: any) {
        console.error(`[MediaDownloader] Error parsing URL for ${platformName}:`, err);
        return await replyFn(`${e('error')} Failed to download media. The video might be private, deleted, or requires login.`);
    }
}
