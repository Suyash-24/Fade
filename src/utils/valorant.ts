// src/utils/valorant.ts
// Wrapper for valorant-api.com — completely free, no API key needed.

const BASE = 'https://valorant-api.com/v1';

async function get(path: string): Promise<any> {
    const res = await fetch(`${BASE}${path}`, {
        headers: { 'User-Agent': 'FadeDiscordBot/1.0' },
    });
    if (!res.ok) throw new Error(`Valorant API ${res.status}`);
    const data = await res.json() as any;
    return data.data;
}

// ── Agents ────────────────────────────────────────────────────────────────────

export async function getAgents(): Promise<any[]> {
    return get('/agents?isPlayableCharacter=true&language=en-US');
}

export async function findAgent(query: string): Promise<any | null> {
    const agents = await getAgents();
    const q = query.toLowerCase();
    return agents.find((a: any) => a.displayName.toLowerCase().includes(q)) ?? null;
}

// ── Weapons ───────────────────────────────────────────────────────────────────

export async function getWeapons(): Promise<any[]> {
    return get('/weapons?language=en-US');
}

export async function findWeapon(query: string): Promise<any | null> {
    const weapons = await getWeapons();
    const q = query.toLowerCase();
    return weapons.find((w: any) => w.displayName.toLowerCase().includes(q)) ?? null;
}

// ── Skins ─────────────────────────────────────────────────────────────────────

export async function findSkin(query: string): Promise<any | null> {
    const weapons = await getWeapons();
    const q = query.toLowerCase();
    for (const weapon of weapons) {
        for (const skin of weapon.skins ?? []) {
            if (skin.displayName.toLowerCase().includes(q) && skin.displayName !== `Standard ${weapon.displayName}`) {
                return { ...skin, weaponName: weapon.displayName };
            }
        }
    }
    return null;
}

// ── Maps ──────────────────────────────────────────────────────────────────────

export async function getMaps(): Promise<any[]> {
    const maps = await get('/maps?language=en-US');
    return maps.filter((m: any) => m.tacticalDescription); // only playable maps
}

export async function findMap(query: string): Promise<any | null> {
    const maps = await getMaps();
    const q = query.toLowerCase();
    return maps.find((m: any) => m.displayName.toLowerCase().includes(q)) ?? null;
}

// ── Tier colours ──────────────────────────────────────────────────────────────

export const TIER_COLORS: Record<string, number> = {
    'Select Edition':    0x009587,
    'Deluxe Edition':    0x0070CC,
    'Premium Edition':   0x9B4DCA,
    'Ultra Edition':     0xFFD700,
    'Exclusive Edition': 0xFF4655,
};

export function tierColor(tier: string): number {
    return TIER_COLORS[tier] ?? 0xFF4655;
}
