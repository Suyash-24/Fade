// src/utils/fortnite.ts
// Wrapper for fortnite-api.com — completely free, no API key needed.

const BASE = 'https://fortnite-api.com';

async function get(path: string): Promise<any> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'User-Agent': 'FadeDiscordBot/1.0' },
    });
    if (!res.ok) throw new Error(`Fortnite API error: ${res.status}`);
    return res.json();
}

// ── Shop ──────────────────────────────────────────────────────────────────────

export interface ShopEntry {
    name:      string;
    type:      string;
    price:     number;
    image:     string | null;
    rarity:    string;
}

export async function getShop(): Promise<ShopEntry[]> {
    const data = await get('/v2/shop?language=en');
    const entries: ShopEntry[] = [];

    for (const section of data.data?.featured?.entries ?? []) {
        const item = section.items?.[0];
        if (!item) continue;
        entries.push({
            name:   item.name,
            type:   item.type?.displayValue ?? 'Item',
            price:  section.finalPrice ?? 0,
            image:  item.images?.icon ?? item.images?.smallIcon ?? null,
            rarity: item.rarity?.displayValue ?? 'Common',
        });
    }
    for (const section of data.data?.daily?.entries ?? []) {
        const item = section.items?.[0];
        if (!item) continue;
        entries.push({
            name:   item.name,
            type:   item.type?.displayValue ?? 'Item',
            price:  section.finalPrice ?? 0,
            image:  item.images?.icon ?? item.images?.smallIcon ?? null,
            rarity: item.rarity?.displayValue ?? 'Common',
        });
    }

    return entries;
}

// ── Cosmetic search ───────────────────────────────────────────────────────────

export interface Cosmetic {
    id:          string;
    name:        string;
    description: string;
    type:        string;
    rarity:      string;
    image:       string | null;
    set?:        string;
    introduced?: string;
}

export async function searchCosmetic(query: string): Promise<Cosmetic | null> {
    try {
        const data = await get(`/v2/cosmetics/br/search?name=${encodeURIComponent(query)}&matchMethod=contains&language=en`);
        const item = data.data;
        if (!item) return null;
        return {
            id:          item.id,
            name:        item.name,
            description: item.description ?? '',
            type:        item.type?.displayValue ?? 'Item',
            rarity:      item.rarity?.displayValue ?? 'Common',
            image:       item.images?.icon ?? item.images?.smallIcon ?? null,
            set:         item.set?.value,
            introduced:  item.introduction?.text,
        };
    } catch { return null; }
}

// ── News ──────────────────────────────────────────────────────────────────────

export async function getNews(): Promise<{ title: string; body: string; image: string | null }[]> {
    const data = await get('/v2/news/br?language=en');
    return (data.data?.motds ?? []).map((m: any) => ({
        title: m.title,
        body:  m.body,
        image: m.image ?? null,
    }));
}

// ── Rarity colours ────────────────────────────────────────────────────────────

export const RARITY_COLORS: Record<string, number> = {
    'Common':    0x9E9E9E,
    'Uncommon':  0x4CAF50,
    'Rare':      0x2196F3,
    'Epic':      0x9C27B0,
    'Legendary': 0xFF9800,
    'Mythic':    0xFFD700,
    'Icon Series':0x00BCD4,
    'Marvel':    0xF44336,
    'DC':        0x3F51B5,
    'Star Wars': 0x000000,
};

export function rarityColor(rarity: string): number {
    return RARITY_COLORS[rarity] ?? 0x5865F2;
}
