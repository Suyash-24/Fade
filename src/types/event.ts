// src/types/event.ts
import type { ClientEvents } from 'discord.js';
import type { FadeClient } from '../client.js';

export interface Event<K extends keyof ClientEvents = keyof ClientEvents> {
    // Must match a discord.js ClientEvents key exactly (e.g. 'ready', 'guildMemberAdd')
    name: K;

    // If true, fires only once then unregisters (used for 'ready')
    once?: boolean;

    execute(client: FadeClient, ...args: ClientEvents[K]): Promise<void>;
}