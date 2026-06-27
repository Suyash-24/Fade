// index.ts — Place in: project root (Fade/index.ts)
// Fade boot sequence:
//  1. Load environment variables
//  2. Validate required env vars
//  3. Load commands + events
//  4. Login to Discord
//  5. Setup Kazagumo music manager
import 'dotenv/config';
import { FadeClient } from './src/client.js';
import { loadCommands } from './src/handlers/commandhandler.js';
import { loadEvents } from './src/handlers/eventhandler.js';
import { logger } from './src/utils/logger.js';
import { setupMusic } from './src/music/manager.js';

// ── Validate environment ──────────────────────────────────────────────────────
const REQUIRED_ENV = ['DISCORD_TOKEN', 'CLIENT_ID', 'DATABASE_URL'];
const missing = REQUIRED_ENV.filter(k => !process.env[k]);
if (missing.length) {
    logger.error(`Missing required environment variables: ${missing.join(', ')}`);
    process.exit(1);
}

// ── Boot ──────────────────────────────────────────────────────────────────────
const client = new FadeClient();

process.on('uncaughtException',    err  => logger.error('Uncaught exception', err));
process.on('unhandledRejection', (err: any) => {
    if (err?.name === 'AbortError' || err?.message === 'This operation was aborted') return;
    logger.error('Unhandled rejection', err);
});
process.on('SIGINT', () => {
    logger.info('Shutting down Fade...');
    client.destroy();
    process.exit(0);
});

async function main() {
    logger.info('Starting Fade...');
    await loadCommands(client);
    await loadEvents(client);

    client.on('shardCreate', shard => {
        shard.setMaxListeners(0);
    });

    // Setup music manager BEFORE login so the connector is ready
    setupMusic(client);

    await client.login(process.env.DISCORD_TOKEN);
}

main().catch(err => {
    logger.error('Fatal error during startup', err);
    process.exit(1);
});