// src/utils/commandError.ts
// Centralized command error handler.
// Converts raw DiscordAPIErrors (especially permission errors) into friendly
// user-facing messages instead of the generic "Something went wrong."
import { DiscordAPIError } from 'discord.js';
import { logger } from './logger.js';

// Discord API error codes we handle specially
const MISSING_PERMS    = 50013; // Missing Permissions
const MISSING_ACCESS   = 50001; // Missing Access (bot can't see the channel)
const CANNOT_SEND      = 50007; // Cannot send messages to this user (DM blocked)
const UNKNOWN_MESSAGE  = 10008; // Unknown Message (already deleted)
const UNKNOWN_CHANNEL  = 10003; // Unknown Channel (deleted)
const THREAD_LOCKED    = 50083; // Thread is locked
const HIERARCHY_ERR    = 50148; // Role is above bot's highest role
const NOT_MANAGEABLE   = 50025; // Cannot modify a role higher than the bot's role

const FRIENDLY: Record<number, string> = {
    [MISSING_PERMS]:  "I'm missing the permissions needed to do that. Please check my role permissions in **Server Settings → Roles** and make sure I have the right access in this channel.",
    [MISSING_ACCESS]: "I don't have access to that channel. Check that my role has **View Channel** and **Send Messages** permissions there.",
    [CANNOT_SEND]:    "I couldn't send you a DM — you may have DMs disabled. Check your **Privacy Settings** and try again.",
    [UNKNOWN_MESSAGE]:"That message no longer exists (it may have been deleted).",
    [UNKNOWN_CHANNEL]:"That channel no longer exists.",
    [THREAD_LOCKED]:  "I can't send messages in a locked thread.",
    [HIERARCHY_ERR]:  "I can't perform that action — the target role is higher than or equal to my highest role. Drag my role above it in **Server Settings → Roles**.",
    [NOT_MANAGEABLE]: "I can't manage that role — it's higher than my highest role.",
};

export interface CommandErrorContext {
    commandName: string;
    userId:      string;
    guildId:     string;
}

/**
 * Handles a command execution error.
 * Returns a user-friendly error message string (never throws).
 * Also logs the error to the console.
 */
export function resolveCommandError(err: unknown, ctx: CommandErrorContext): string {
    logger.error(`Command failed: ${ctx.commandName}`, err, {
        user:  ctx.userId,
        guild: ctx.guildId,
    });

    if (err instanceof DiscordAPIError) {
        const code = Number(err.code);
        const friendly = FRIENDLY[code];
        if (friendly) return `❌ ${friendly}`;

        // Catch-all for other Discord API errors — show the raw Discord message
        // so the user has context instead of a generic "something went wrong"
        return `❌ Discord returned an error: **${err.message}** (\`${code}\`)`;
    }

    // Unknown / internal errors
    return '❌ Something went wrong. Please try again in a moment.';
}
