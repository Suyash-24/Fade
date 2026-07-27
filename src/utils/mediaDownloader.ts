// src/utils/mediaDownloader.ts
import { AttachmentBuilder, Message, ChatInputCommandInteraction } from 'discord.js';
import { e, Colours } from '../components/emojis.js';
import { FadeContainer, sendMessage } from '../components/builders.js';

interface CobaltResponse {
    status: 'error' | 'redirect' | 'stream' | 'success' | 'rate-limit' | 'picker';
    url?: string;
    text?: string;
}

let cachedInstances: string[] = [];
let lastFetch = 0;

async function getInstances(): Promise<string[]> {
    if (cachedInstances.length > 0 && Date.now() - lastFetch < 3600000) {
        return cachedInstances;
    }
    try {
        const res = await fetch('https://instances.cobalt.best/api/instances');
        if (res.ok) {
            const data = await res.json() as any[];
            // Filter instances that are online, have score > 0, and support API
            const valid = data.filter(d => d.api_online && d.score > 0).map(d => d.api || d.endpoint);
            if (valid.length > 0) {
                cachedInstances = valid;
                lastFetch = Date.now();
                return valid;
            }
        }
    } catch (e) {
        // Fallback gracefully
    }
    // Hardcoded fallbacks if tracker fails
    return [
        'https://cobalt.casi.ooo',
        'https://cobalt.q0.wtf',
        'https://cobalt.kwiatekit.com',
        'https://cobalt.wuk.sh'
    ];
}

export async function fetchCobalt(url: string): Promise<CobaltResponse> {
    const instances = await getInstances();
    let lastError = 'Failed to contact download server';

    for (const instance of instances) {
        try {
            // Ensure endpoint does not end with /api/json, v10 uses base URL /
            const baseUrl = instance.replace(/\/api\/json\/?$/, '');
            const response = await fetch(baseUrl, {
                method: 'POST',
                headers: {
                    'Accept': 'application/json',
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    url,
                    videoQuality: '720',
                    filenamePattern: 'nerdy'
                })
            });
            
            if (!response.ok) {
                const text = await response.text().catch(() => '');
                lastError = `API ${response.status}: ${text}`;
                continue; // Try next instance
            }
            
            return await response.json() as CobaltResponse;
        } catch (err) {
            console.error(`[Media] Cobalt error on ${instance}:`, err);
            continue; // Try next instance
        }
    }
    return { status: 'error', text: lastError };
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
