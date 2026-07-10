// src/db/index.ts
import postgres from 'postgres';
import { drizzle } from 'drizzle-orm/postgres-js';
import * as schema from './schema.js';
import { logger } from '../utils/logger.js';

if (!process.env.DATABASE_URL) {
    logger.error('DATABASE_URL is not set');
    process.exit(1);
}

// Connection pool — tuned for Supabase free tier
const client = postgres(process.env.DATABASE_URL, {
    max:             10,       // max connections (Supabase free: up to 15)
    max_lifetime:    1800,     // recycle connections every 30 min to avoid stale state
    idle_timeout:    60,       // keep connections alive longer to avoid cold-start delays
    connect_timeout: 10,       // fail fast if can't connect in 10s
    prepare:         false,    // disable prepared statements for PgBouncer/Supabase Pooler compat
});

// Keep-alive ping every 30s — prevents the connection pool from going fully cold
// during quiet periods (e.g. bot is in VC but no commands are being used)
setInterval(() => {
    client`SELECT 1`.catch(() => {}); // silent — we don't care about the result
}, 30_000);

export const db = drizzle(client, { schema });

export type DB = typeof db;