// src/utils/aiMemory.ts
// Core memory engine for Fade's Server Memory AI.
// Embeddings run 100% locally via @huggingface/transformers (ONNX, no API calls).
// Similarity search runs against the server_memories table via cosine distance.

import { db } from '../db/index.js';
import { serverMemories, aiConfig } from '../db/schema.js';
import { eq, sql } from 'drizzle-orm';
import { generateAnswer } from './aiProvider.js';
import { logger } from './logger.js';

// ── Lazy-loaded embedder ────────────────────────────────────────────────────
// Loaded once on first use, cached in memory for the process lifetime.
let embedder: any = null;

async function getEmbedder() {
    if (embedder) return embedder;
    logger.info('[AI] Loading local embedding model (first-time, ~30MB)...');
    const { pipeline } = await import('@huggingface/transformers' as any);
    embedder = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', { dtype: 'fp32' });
    logger.info('[AI] Embedding model ready.');
    return embedder;
}

// Pre-warm so first user question is instant — called non-blocking at startup
export async function warmEmbedder(): Promise<void> {
    try { await getEmbedder(); } catch { /* retry on first use */ }
}

// ── Embedding generation ────────────────────────────────────────────────────
export async function generateEmbedding(text: string): Promise<number[]> {
    const pipe = await getEmbedder();
    const output = await pipe(text, { pooling: 'mean', normalize: true });
    return Array.from(output.data as Float32Array);
}

// ── Cosine similarity (pure JS fallback for search) ─────────────────────────
function cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
        dot  += a[i] * b[i];
        magA += a[i] * a[i];
        magB += b[i] * b[i];
    }
    if (magA === 0 || magB === 0) return 0;
    return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

// ── Ingest a memory ─────────────────────────────────────────────────────────
export async function ingestMemory(
    guildId: string,
    content: string,
    addedBy: string
): Promise<number> {
    const embedding = await generateEmbedding(content);
    const [row] = await db.insert(serverMemories).values({
        guildId,
        content,
        addedBy,
        embedding: JSON.stringify(embedding),
    }).returning({ id: serverMemories.id });
    return row.id;
}

// ── Search memories by semantic similarity ───────────────────────────────────
export async function searchMemory(
    guildId: string,
    question: string,
    topK = 5
): Promise<{ id: number; content: string; similarity: number }[]> {
    const queryEmbedding = await generateEmbedding(question);

    // Fetch all memories for the guild (max 500 for safety)
    const rows = await db.select({
        id: serverMemories.id,
        content: serverMemories.content,
        embedding: serverMemories.embedding,
    })
        .from(serverMemories)
        .where(eq(serverMemories.guildId, guildId))
        .limit(500);

    if (rows.length === 0) return [];

    // Compute cosine similarity for each row
    const scored = rows.map(row => {
        const vec = JSON.parse(row.embedding) as number[];
        return {
            id: row.id,
            content: row.content,
            similarity: cosineSimilarity(queryEmbedding, vec),
        };
    });

    // Sort by similarity descending and return top K
    return scored
        .sort((a, b) => b.similarity - a.similarity)
        .slice(0, topK)
        .filter(r => r.similarity > 0.15); // 15% threshold to handle paraphrase variants
}

// ── Full pipeline: search + generate ─────────────────────────────────────────
export async function askBrain(
    guildId: string,
    question: string
): Promise<{ answer: string; provider: string; memories: string[] } | null> {
    const results = await searchMemory(guildId, question);

    if (results.length === 0) return null; // Bot genuinely has no relevant memory

    const memoryTexts = results.map(r => r.content);
    const { text, provider } = await generateAnswer(question, memoryTexts);

    return { answer: text, provider, memories: memoryTexts };
}

// ── AI config helpers ─────────────────────────────────────────────────────────
export async function isAiEnabled(guildId: string): Promise<boolean> {
    const [config] = await db.select()
        .from(aiConfig)
        .where(eq(aiConfig.guildId, guildId))
        .limit(1);
    return config?.enabled ?? true; // Default to enabled
}

export async function deleteMemory(id: number, guildId: string): Promise<boolean> {
    const result = await db.delete(serverMemories)
        .where(sql`${serverMemories.id} = ${id} AND ${serverMemories.guildId} = ${guildId}`);
    return !!(result as any).rowCount || Array.isArray(result) && result.length > 0 || true;
}

export async function clearAllMemories(guildId: string): Promise<number> {
    const result = await db.delete(serverMemories)
        .where(eq(serverMemories.guildId, guildId));
    return (result as any).rowCount ?? 0;
}

export async function listMemories(guildId: string) {
    return db.select({
        id:        serverMemories.id,
        content:   serverMemories.content,
        addedBy:   serverMemories.addedBy,
        createdAt: serverMemories.createdAt,
    })
        .from(serverMemories)
        .where(eq(serverMemories.guildId, guildId))
        .orderBy(serverMemories.createdAt);
}
