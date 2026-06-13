// src/client.ts
import {
    Client,
    Collection,
    GatewayIntentBits,
    Partials,
} from 'discord.js';
import type { Command } from './types/command.js';
import type { Event } from './types/event.js';

export class FadeClient extends Client {
    // All loaded slash + prefix commands
    commands = new Collection<string, Command>();

    // Prefix command aliases (e.g. "p" → "play")
    aliases  = new Collection<string, string>();

    // component custom_id → handler name
    components = new Collection<string, string>();

    // Cooldown tracking: "userId:commandName" → expiry timestamp
    cooldowns = new Collection<string, number>();

    constructor() {
        super({
            intents: [
                GatewayIntentBits.Guilds,
                GatewayIntentBits.GuildMembers,
                GatewayIntentBits.GuildMessages,
                GatewayIntentBits.GuildMessageReactions,
                GatewayIntentBits.GuildVoiceStates,
                GatewayIntentBits.MessageContent,
                GatewayIntentBits.GuildModeration,
                GatewayIntentBits.GuildEmojisAndStickers,
                GatewayIntentBits.GuildInvites,
                GatewayIntentBits.AutoModerationExecution,
                GatewayIntentBits.GuildPresences,
            ],
            partials: [
                Partials.Channel,
                Partials.GuildMember,
                Partials.Message,
                Partials.Reaction,
                Partials.User,
                Partials.GuildScheduledEvent,
            ],
            // Allow time for large guild member lists to cache
            waitGuildTimeout: 5_000,
        });
    }

    // Kazagumo music manager — attached in index.ts after client is ready
    music?: import('kazagumo').Kazagumo;
}