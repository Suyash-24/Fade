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
    idle_timeout:    20,       // close idle connections before Supabase abruptly kills them
    connect_timeout: 10,       // fail fast if can't connect in 10s
    prepare:         false,    // disable prepared statements for PgBouncer/Supabase Pooler compat
});

export const db = drizzle(client, { schema });

export type DB = typeof db;