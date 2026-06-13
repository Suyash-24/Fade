// src/handlers/eventHandler.ts
import { readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function registerEvent(client: FadeClient, event: Event) {
    if (!event?.name) return false;
    if (event.once) {
        client.once(event.name, (...args) =>
            event.execute(client, ...args as any).catch(err =>
                logger.error(`Event error [${event.name}]`, err)
            )
        );
    } else {
        client.on(event.name, (...args) =>
            event.execute(client, ...args as any).catch(err =>
                logger.error(`Event error [${event.name}]`, err)
            )
        );
    }
    return true;
}

export async function loadEvents(client: FadeClient): Promise<void> {
    const eventsPath = join(__dirname, '..', 'events');
    let loaded = 0;

    for (const file of readdirSync(eventsPath)) {
        if (!file.endsWith('.ts') && !file.endsWith('.js')) continue;

        const full = join(eventsPath, file);
        try {
            const mod = await import(pathToFileURL(full).href);
            const exported = mod.default ?? mod;

            // Support both single event and array of events (e.g. antinuke.ts)
            if (Array.isArray(exported)) {
                for (const event of exported) {
                    if (registerEvent(client, event)) loaded++;
                }
            } else {
                if (registerEvent(client, exported)) loaded++;
            }
        } catch (err) {
            logger.error(`Failed to load event: ${file}`, err);
        }
    }

    logger.success('Events loaded', { count: loaded });
}