// src/utils/mediaDownloader.ts
import { Message, ChatInputCommandInteraction } from 'discord.js';
import { e, Colours } from '../components/emojis.js';
import { FadeContainer, sendMessage } from '../components/builders.js';

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

    let fixupUrl = url;

    try {
        const parsedUrl = new URL(url);

        if (platformName === 'TikTok') {
            parsedUrl.hostname = 'vxtiktok.com';
            fixupUrl = parsedUrl.toString();
        } else if (platformName === 'Twitter' || platformName === 'X') {
            parsedUrl.hostname = 'vxtwitter.com';
            fixupUrl = parsedUrl.toString();
        } else if (platformName === 'Instagram') {
            parsedUrl.hostname = 'ddinstagram.com';
            fixupUrl = parsedUrl.toString();
        } else if (platformName === 'YouTube') {
            // YouTube already embeds perfectly natively, no fixup needed
            fixupUrl = url;
        } else {
            // Unhandled or Pinterest (which also has some native embedding)
            fixupUrl = url;
        }

        // Clean query parameters to keep links neat (except YouTube which needs ?v=)
        if (platformName !== 'YouTube') {
            const cleanUrl = fixupUrl.split('?')[0];
            fixupUrl = cleanUrl;
        }

    } catch (err) {
        console.error(`[MediaDownloader] Error parsing URL for ${platformName}:`, err);
        return replyFn(`${e('error')} Invalid URL provided.`);
    }

    // Since we are using fixup URLs, we don't attach files. We just send the URL and let Discord embed it.
    // If it's a message, we reply without an embed so Discord can unfurl the media.
    const messageContent = `🎥 **${platformName} Media**\n${fixupUrl}`;
    
    return replyFn(messageContent);
}
