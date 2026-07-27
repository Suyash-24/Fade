// src/utils/mediaDownloader.ts
import { AttachmentBuilder, Message, ChatInputCommandInteraction } from 'discord.js';
import { e, Colours } from '../components/emojis.js';
import { FadeContainer, sendMessage } from '../components/builders.js';

interface CobaltResponse {
    status: 'error' | 'redirect' | 'stream' | 'success' | 'rate-limit' | 'picker';
    url?: string;
    text?: string;
}

export async function fetchCobalt(url: string): Promise<CobaltResponse> {
    try {
        const response = await fetch('https://api.cobalt.tools/api/json', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                url,
                vCodec: 'h264',
                vQuality: '720',
                isNoTTWatermark: true,
                filenamePattern: 'nerdy'
            })
        });
        
        if (!response.ok) {
            return { status: 'error', text: `API returned ${response.status}` };
        }
        
        return await response.json() as CobaltResponse;
    } catch (err) {
        console.error('[Media] Cobalt error:', err);
        return { status: 'error', text: 'Failed to contact download server' };
    }
}

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

    const data = await fetchCobalt(url);

    if (data.status === 'error' || data.status === 'rate-limit') {
        return replyFn(`${e('error')} ${data.text || 'Failed to fetch media from this URL.'}`);
    }

    if (data.status === 'picker') {
        return replyFn(`${e('error')} This URL contains a gallery/slideshow, which is currently unsupported.`);
    }

    const mediaUrl = data.url;
    if (!mediaUrl) {
        return replyFn(`${e('error')} Received an empty response from the download server.`);
    }

    try {
        const attachment = new AttachmentBuilder(mediaUrl, { name: `${platformName.toLowerCase()}_video.mp4` });
        
        if (isInteraction) {
            await (context as ChatInputCommandInteraction).editReply({ files: [attachment] });
        } else {
            await (context as Message).reply({ files: [attachment] });
        }
    } catch (err) {
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
