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

export interface ReactionSnipeEntry {
    emojiName:  string;
    emojiUrl:   string | null;
    authorId:   string;
    authorTag:  string;
    authorAvatar: string | null;
    channelId:  string;
    guildId:    string;
    messageUrl: string;
    removedAt:  number;
}

// channelId → SnipeEntry[]
const snipeCache     = new Map<string, SnipeEntry[]>();
// channelId → EditSnipeEntry[]
const editSnipeCache = new Map<string, EditSnipeEntry[]>();
// channelId → ReactionSnipeEntry[]
const reactionSnipeCache = new Map<string, ReactionSnipeEntry[]>();

const TTL = 10 * 60 * 1_000; // 10 minutes

// ── Snipe (deleted messages) ──────────────────────────────────────────────────

export function setSnipe(channelId: string, entry: SnipeEntry): void {
    if (!snipeCache.has(channelId)) {
        snipeCache.set(channelId, []);
    }
    const arr = snipeCache.get(channelId)!;
    arr.unshift(entry); // Push to front (newest at index 0)
    
    // Auto-expire this specific message after 10 mins
    setTimeout(() => {
        const currentArr = snipeCache.get(channelId);
        if (currentArr) {
            const idx = currentArr.findIndex(e => e.deletedAt === entry.deletedAt);
            if (idx !== -1) currentArr.splice(idx, 1);
            if (currentArr.length === 0) snipeCache.delete(channelId);
        }
    }, TTL);
}

export function getSnipe(channelId: string): SnipeEntry[] {
    return snipeCache.get(channelId) ?? [];
}

export function clearSnipe(channelId: string): void {
    snipeCache.delete(channelId);
}

export function clearAllSnipes(guildId: string): void {
    for (const [channelId, arr] of snipeCache) {
        if (arr.length > 0 && arr[0].guildId === guildId) {
            snipeCache.delete(channelId);
        }
    }
    for (const [channelId, arr] of editSnipeCache) {
        if (arr.length > 0 && arr[0].guildId === guildId) {
            editSnipeCache.delete(channelId);
        }
    }
    for (const [channelId, arr] of reactionSnipeCache) {
        if (arr.length > 0 && arr[0].guildId === guildId) {
            reactionSnipeCache.delete(channelId);
        }
    }
}

// ── Edit snipe (edited messages) ──────────────────────────────────────────────

export function setEditSnipe(channelId: string, entry: EditSnipeEntry): void {
    if (!editSnipeCache.has(channelId)) {
        editSnipeCache.set(channelId, []);
    }
    const arr = editSnipeCache.get(channelId)!;
    arr.unshift(entry); // Push to front (newest at index 0)

    setTimeout(() => {
        const currentArr = editSnipeCache.get(channelId);
        if (currentArr) {
            const idx = currentArr.findIndex(e => e.editedAt === entry.editedAt);
            if (idx !== -1) currentArr.splice(idx, 1);
            if (currentArr.length === 0) editSnipeCache.delete(channelId);
        }
    }, TTL);
}

export function getEditSnipe(channelId: string): EditSnipeEntry[] {
    return editSnipeCache.get(channelId) ?? [];
}

export function clearEditSnipe(channelId: string): void {
    editSnipeCache.delete(channelId);
}

// ── Reaction snipe (deleted reactions) ────────────────────────────────────────

export function setReactionSnipe(channelId: string, entry: ReactionSnipeEntry): void {
    if (!reactionSnipeCache.has(channelId)) {
        reactionSnipeCache.set(channelId, []);
    }
    const arr = reactionSnipeCache.get(channelId)!;
    arr.unshift(entry); // Push to front

    setTimeout(() => {
        const currentArr = reactionSnipeCache.get(channelId);
        if (currentArr) {
            const idx = currentArr.findIndex(e => e.removedAt === entry.removedAt);
            if (idx !== -1) currentArr.splice(idx, 1);
            if (currentArr.length === 0) reactionSnipeCache.delete(channelId);
        }
    }, TTL);
}

export function getReactionSnipe(channelId: string): ReactionSnipeEntry[] {
    return reactionSnipeCache.get(channelId) ?? [];
}

export function clearReactionSnipe(channelId: string): void {
    reactionSnipeCache.delete(channelId);
}