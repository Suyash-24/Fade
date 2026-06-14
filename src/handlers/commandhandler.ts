// src/handlers/commandHandler.ts
import { readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { REST, Routes } from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Command } from '../types/command.js';
import { logger } from '../utils/logger.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

function getFiles(dir: string): string[] {
    const results: string[] = [];
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) {
            results.push(...getFiles(full));
        } else if ((full.endsWith('.ts') || full.endsWith('.js')) && !full.endsWith('.d.ts')) {
            results.push(full);
        }
    }
    return results;
}

function registerCommand(client: FadeClient, command: Command): void {
    if (!command?.data?.name) return;
    client.commands.set(command.data.name, command);
    if (command.aliases?.length) {
        for (const alias of command.aliases) {
            client.aliases.set(alias, command.data.name);
        }
    }
}

export async function loadCommands(client: FadeClient): Promise<void> {
    const commandsPath = join(__dirname, '..', 'commands');
    const files        = getFiles(commandsPath);
    let loaded         = 0;

    for (const file of files) {
        try {
            const mod      = await import(pathToFileURL(file).href);
            const exported = mod.default ?? mod;

            // Support array exports (e.g. snipe.ts exports 3 commands)
            if (Array.isArray(exported)) {
                for (const command of exported) {
                    registerCommand(client, command);
                    loaded++;
                }
            } else {
                registerCommand(client, exported);
                loaded++;
            }
        } catch (err) {
            logger.error(`Failed to load command: ${file}`, err);
        }
    }

    logger.success('Commands loaded', { count: loaded });
}

export async function registerCommands(client: FadeClient): Promise<void> {
    const token    = process.env.DISCORD_TOKEN!;
    const clientId = process.env.CLIENT_ID!;
    const guildId  = process.env.DEV_GUILD_ID;
    const rest     = new REST().setToken(token);
    const body     = client.commands
        .filter(cmd => cmd.category !== 'music' && !cmd.prefixOnly && cmd.data && typeof cmd.data.toJSON === 'function')
        .map(cmd => cmd.data!.toJSON!());

    try {
        if (guildId) {
            await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body });
            logger.success('Slash commands registered (guild)', { guild: guildId });
        } else {
            await rest.put(Routes.applicationCommands(clientId), { body });
            logger.success('Slash commands registered (global)');
        }
    } catch (err) {
        logger.error('Failed to register slash commands', err);
    }
}