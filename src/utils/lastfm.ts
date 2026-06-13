// src/utils/lastfm.ts
// Last.fm API wrapper — read-only, no auth needed for public data.
// Docs: https://www.last.fm/api

const BASE = 'https://ws.audioscrobbler.com/2.0/';

function apiKey() {
    const key = process.env.LASTFM_API_KEY;
    if (!key || key === 'your_lastfm_api_key_here') throw new Error('LASTFM_API_KEY not set');
    return key;
}

async function call(method: string, params: Record<string, string>): Promise<any> {
    const url = new URL(BASE);
    url.searchParams.set('method', method);
    url.searchParams.set('api_key', apiKey());
    url.searchParams.set('format', 'json');
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);

    const res = await fetch(url.toString(), {
        headers: { 'User-Agent': 'FadeDiscordBot/1.0' },
    });
    const data = await res.json() as any;
    if (data.error) throw new Error(data.message ?? `Last.fm error ${data.error}`);
    return data;
}

// ── User endpoints ────────────────────────────────────────────────────────────

export async function getRecentTracks(username: string, limit = 5) {
    const data = await call('user.getRecentTracks', { user: username, limit: String(limit), extended: '1' });
    return data.recenttracks;
}

export async function getTopArtists(username: string, period: Period = 'overall', limit = 10) {
    const data = await call('user.getTopArtists', { user: username, period, limit: String(limit) });
    return data.topartists;
}

export async function getTopAlbums(username: string, period: Period = 'overall', limit = 10) {
    const data = await call('user.getTopAlbums', { user: username, period, limit: String(limit) });
    return data.topalbums;
}

export async function getTopTracks(username: string, period: Period = 'overall', limit = 10) {
    const data = await call('user.getTopTracks', { user: username, period, limit: String(limit) });
    return data.toptracks;
}

export async function getUserInfo(username: string) {
    const data = await call('user.getInfo', { user: username });
    return data.user;
}

// ── Types ─────────────────────────────────────────────────────────────────────

export type Period = 'overall' | '7day' | '1month' | '3month' | '6month' | '12month';

export const PERIOD_LABELS: Record<Period, string> = {
    overall:  'All Time',
    '7day':   '7 Days',
    '1month': '1 Month',
    '3month': '3 Months',
    '6month': '6 Months',
    '12month':'1 Year',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

export function getImage(images: any[], size = 'large'): string | null {
    if (!images?.length) return null;
    const img = images.find((i: any) => i.size === size) ?? images[images.length - 1];
    return img?.['#text'] || null;
}

export function isNowPlaying(track: any): boolean {
    return track?.['@attr']?.nowplaying === 'true';
}

export function formatPlays(n: string | number): string {
    const num = typeof n === 'string' ? parseInt(n) : n;
    if (num >= 1_000_000) return `${(num / 1_000_000).toFixed(1)}M`;
    if (num >= 1_000)     return `${(num / 1_000).toFixed(1)}K`;
    return String(num);
}
