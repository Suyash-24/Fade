// src/events/automod.ts
// Hooks AutoMod into the messageCreate event.
// Runs after the prefix command handler so commands still work.
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { runAutomod } from '../utils/automod.js';

const event: Event<'messageCreate'> = {
    name: 'messageCreate',
    async execute(client: FadeClient, message) {
        // runAutomod handles all guards internally
        await runAutomod(message);
    },
};

export default event;