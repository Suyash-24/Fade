// src/db/queries/invokeMessages.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { invokeMessages } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getInvokeMessage(guildId: string, command: string) {
    return db.query.invokeMessages.findFirst({
        where: and(eq(invokeMessages.guildId, guildId), eq(invokeMessages.command, command)),
    });
}

export async function getGuildInvokeMessages(guildId: string) {
    return db.query.invokeMessages.findMany({
        where: eq(invokeMessages.guildId, guildId),
        orderBy: (t, { asc }) => [asc(t.command)],
    });
}

export async function setInvokeMessage(guildId: string, command: string, values: {
    message?:   string | null;
    dmMessage?: string | null;
}) {
    await ensureGuild(guildId);
    await db.insert(invokeMessages)
        .values({ guildId, command, ...values })
        .onConflictDoUpdate({
            target: [invokeMessages.guildId, invokeMessages.command],
            set:    values,
        });
}

export async function resetInvokeMessage(guildId: string, command: string) {
    await db.delete(invokeMessages).where(
        and(eq(invokeMessages.guildId, guildId), eq(invokeMessages.command, command)),
    );
}

// Resolve variables in an invoke message template
export function resolveInvokeVars(template: string, vars: {
    user:      string;
    reason:    string;
    moderator: string;
    server:    string;
    caseNum:   number;
}): string {
    return template
        .replace(/{user\.mention}/g,  vars.user)
        .replace(/{user}/g,           vars.user)
        .replace(/{reason}/g,         vars.reason)
        .replace(/{moderator}/g,      vars.moderator)
        .replace(/{server}/g,         vars.server)
        .replace(/{case}/g,           `#${vars.caseNum}`);
}

// Get resolved channel message and DM for a mod action
export async function getInvokeResponse(guildId: string, command: string, vars: {
    user:      string;
    reason:    string;
    moderator: string;
    server:    string;
    caseNum:   number;
}): Promise<{ message: string | null; dmMessage: string | null }> {
    const entry = await getInvokeMessage(guildId, command);
    return {
        message:   entry?.message   ? resolveInvokeVars(entry.message,   vars) : null,
        dmMessage: entry?.dmMessage ? resolveInvokeVars(entry.dmMessage, vars) : null,
    };
}
