// src/types/command.ts
import type {
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    Message,
    SlashCommandBuilder,
    SlashCommandOptionsOnlyBuilder,
    SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';
import type { FadeClient } from '../client.js';

// Every command in Fade exports one object matching this interface.
// One file = one command = handles both slash and prefix.
export interface Command {
    // ── Slash command definition ──────────────────────────────────────────────
    data?:
        | SlashCommandBuilder
        | SlashCommandOptionsOnlyBuilder
        | SlashCommandSubcommandsOnlyBuilder
        | { name: string; description: string; [key: string]: any };

    // ── Slash handler ─────────────────────────────────────────────────────────
    execute?(
        interaction: ChatInputCommandInteraction,
        client: FadeClient,
    ): Promise<void>;

    // ── Autocomplete handler (optional) ──────────────────────────────────────
    autocomplete?(
        interaction: AutocompleteInteraction,
        client: FadeClient,
    ): Promise<void>;

    // ── Prefix handler (optional) ─────────────────────────────────────────────
    // If not defined, the command is slash-only.
    prefixExecute?(
        message: Message,
        args: string[],
        client: FadeClient,
    ): Promise<void>;

    // ── Metadata ──────────────────────────────────────────────────────────────
    // Prefix aliases (e.g. ["p", "pl"] for "play")
    aliases?: string[];

    // Cooldown in seconds (default: 3)
    cooldown?: number;

    // Require these permissions to run
    userPermissions?: bigint[];
    botPermissions?: bigint[];

    // If true, only works inside a guild (not DMs)
    guildOnly?: boolean;

    // If true, only bot owner can run this
    ownerOnly?: boolean;

    // Command category (used in /help)
    category?: string;

    // Subcommands metadata for help menu
    subcommands?: { name: string; description: string }[];

    // If true, command will not be registered as a slash command
    prefixOnly?: boolean;
}