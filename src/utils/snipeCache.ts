// src/utils/snipeCache.ts
// In-memory snipe cache — no DB needed, data is ephemeral by nature.
// Stores last deleted and edited message per channel.
// Cache expires after 5 minutes automatically.

interface SnipeEntry {
    content:    string;
    authorId:   string;
    authorTag:  string;
    authorAvatar: string | null;
    channelId:  string;
    guildId:    string;
    imageUrl?:  string;
    deletedAt:  number;
}

interface EditSnipeEntry {
    before:     string;
    after:      string;
    authorId:   string;
    authorTag:  string;
    authorAvatar: string | null;
    channelId:  string;
    guildId:    string;
    messageUrl: string;
    editedAt:   number;
}

// channelId → SnipeEntry
const snipeCache     = new Map<string, SnipeEntry>();
// channelId → EditSnipeEntry
const editSnipeCache = new Map<string, EditSnipeEntry>();

const TTL = 5 * 60 * 1_000; // 5 minutes

// ── Snipe (deleted messages) ──────────────────────────────────────────────────

export function setSnipe(channelId: string, entry: SnipeEntry): void {
    snipeCache.set(channelId, entry);
    // Auto-expire
    setTimeout(() => {
        const current = snipeCache.get(channelId);
        if (current?.deletedAt === entry.deletedAt) {
            snipeCache.delete(channelId);
        }
    }, TTL);
}

export function getSnipe(channelId: string): SnipeEntry | null {
    return snipeCache.get(channelId) ?? null;
}

export function clearSnipe(channelId: string): void {
    snipeCache.delete(channelId);
}

export function clearAllSnipes(guildId: string): void {
    for (const [channelId, entry] of snipeCache) {
        if (entry.guildId === guildId) snipeCache.delete(channelId);
    }
}

// ── Edit snipe (edited messages) ──────────────────────────────────────────────

export function setEditSnipe(channelId: string, entry: EditSnipeEntry): void {
    editSnipeCache.set(channelId, entry);
    setTimeout(() => {
        const current = editSnipeCache.get(channelId);
        if (current?.editedAt === entry.editedAt) {
            editSnipeCache.delete(channelId);
        }
    }, TTL);
}

export function getEditSnipe(channelId: string): EditSnipeEntry | null {
    return editSnipeCache.get(channelId) ?? null;
}

export function clearEditSnipe(channelId: string): void {
    editSnipeCache.delete(channelId);
}