// src/utils/socialPollers.ts
// Pollers for YouTube, Twitch, and Reddit social notifications.
// Each poller fetches latest content and returns new items since lastPostId.

// ── YouTube ───────────────────────────────────────────────────────────────────

export async function resolveYouTubeChannel(input: string): Promise<{ id: string; name: string } | null> {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key || key === 'your_youtube_api_key_here') throw new Error('YOUTUBE_API_KEY not set');

    // Handle channel URL formats
    const urlMatch = input.match(/(?:youtube\.com\/(?:channel\/|@|c\/|user\/))([\w-]+)/);
    const query    = urlMatch ? urlMatch[1] : input;

    // Try direct channel ID first
    if (query.startsWith('UC')) {
        const res  = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&id=${query}&key=${key}`);
        const data = await res.json() as any;
        if (data.items?.[0]) return { id: data.items[0].id, name: data.items[0].snippet.title };
    }

    // Try handle (@username)
    const handleQuery = query.startsWith('@') ? query : `@${query}`;
    const handleRes   = await fetch(`https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${encodeURIComponent(handleQuery)}&key=${key}`);
    const handleData  = await handleRes.json() as any;
    if (handleData.items?.[0]) return { id: handleData.items[0].id, name: handleData.items[0].snippet.title };

    // Search fallback
    const searchRes  = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&type=channel&q=${encodeURIComponent(query)}&maxResults=1&key=${key}`);
    const searchData = await searchRes.json() as any;
    if (searchData.items?.[0]) {
        return { id: searchData.items[0].snippet.channelId, name: searchData.items[0].snippet.channelTitle };
    }

    return null;
}

export interface SocialPost {
    id:       string;
    title:    string;
    url:      string;
    thumbnail?: string;
    isLive?:  boolean;
}

export async function pollYouTube(channelId: string): Promise<SocialPost | null> {
    const key = process.env.YOUTUBE_API_KEY;
    if (!key || key === 'your_youtube_api_key_here') return null;

    try {
        const res  = await fetch(
            `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&order=date&maxResults=1&type=video&key=${key}`
        );
        const data = await res.json() as any;
        const item = data.items?.[0];
        if (!item) return null;

        return {
            id:        item.id.videoId,
            title:     item.snippet.title,
            url:       `https://www.youtube.com/watch?v=${item.id.videoId}`,
            thumbnail: item.snippet.thumbnails?.high?.url,
        };
    } catch { return null; }
}

// ── Twitch ────────────────────────────────────────────────────────────────────

let twitchToken: string | null = null;
let twitchTokenExpiry = 0;

async function getTwitchToken(): Promise<string | null> {
    const clientId     = process.env.TWITCH_CLIENT_ID;
    const clientSecret = process.env.TWITCH_CLIENT_SECRET;
    if (!clientId || !clientSecret ||
        clientId === 'your_twitch_client_id_here') return null;

    if (twitchToken && Date.now() < twitchTokenExpiry) return twitchToken;

    try {
        const res  = await fetch(
            `https://id.twitch.tv/oauth2/token?client_id=${clientId}&client_secret=${clientSecret}&grant_type=client_credentials`,
            { method: 'POST' }
        );
        const data = await res.json() as any;
        twitchToken       = data.access_token;
        twitchTokenExpiry = Date.now() + (data.expires_in - 60) * 1000;
        return twitchToken;
    } catch { return null; }
}

export async function pollTwitch(username: string): Promise<SocialPost | null> {
    const clientId = process.env.TWITCH_CLIENT_ID;
    const token    = await getTwitchToken();
    if (!token || !clientId) return null;

    try {
        const res  = await fetch(
            `https://api.twitch.tv/helix/streams?user_login=${username}`,
            { headers: { 'Client-ID': clientId, 'Authorization': `Bearer ${token}` } }
        );
        const data = await res.json() as any;
        const stream = data.data?.[0];
        if (!stream) return null; // not live

        return {
            id:        stream.id,
            title:     stream.title,
            url:       `https://twitch.tv/${username}`,
            thumbnail: stream.thumbnail_url?.replace('{width}', '1280').replace('{height}', '720'),
            isLive:    true,
        };
    } catch { return null; }
}

// ── Reddit ────────────────────────────────────────────────────────────────────

export async function pollReddit(subreddit: string): Promise<SocialPost | null> {
    try {
        const res  = await fetch(
            `https://www.reddit.com/r/${subreddit}/new.json?limit=1`,
            { headers: { 'User-Agent': 'FadeDiscordBot/1.0' } }
        );
        const data = await res.json() as any;
        const post = data.data?.children?.[0]?.data;
        if (!post) return null;

        return {
            id:        post.id,
            title:     post.title,
            url:       `https://reddit.com${post.permalink}`,
            thumbnail: post.thumbnail?.startsWith('http') ? post.thumbnail : undefined,
        };
    } catch { return null; }
}
