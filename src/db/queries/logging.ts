// src/db/queries/logging.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { logConfig, logIgnore } from '../schema.js';
import { ensureGuild } from './guilds.js';

export async function getLogConfig(guildId: string) {
    await ensureGuild(guildId);
    let config = await db.query.logConfig.findFirst({
        where: eq(logConfig.guildId, guildId),
    });
    if (!config) {
        [config] = await db.insert(logConfig)
            .values({ guildId })
            .returning();
    }
    return config;
}

export async function updateLogConfig(
    guildId: string,
    values: Partial<typeof logConfig.$inferInsert>,
) {
    await db.insert(logConfig)
        .values({ guildId, ...values })
        .onConflictDoUpdate({
            target: logConfig.guildId,
            set: { ...values, updatedAt: new Date() },
        });
}

// Get the right channel for a given event type
export type LogCategory =
    | 'message'
    | 'member'
    | 'mod'
    | 'server'
    | 'voice'
    | 'role'
    | 'channel'
    | 'emoji';

export async function getLogChannel(
    guildId: string,
    category: LogCategory,
): Promise<string | null> {
    const config = await getLogConfig(guildId);
    const map: Record<LogCategory, string | null | undefined> = {
        message: config.messageChannel,
        member:  config.memberChannel,
        mod:     config.modChannel,
        server:  config.serverChannel,
        voice:   config.voiceChannel,
        role:    config.roleChannel,
        channel: config.channelChannel,
        emoji:   config.emojiChannel,
    };
    return map[category] ?? null;
}

// Check if an event is disabled
export async function isEventDisabled(guildId: string, event: string): Promise<boolean> {
    const config = await getLogConfig(guildId);
    const disabled = config.disabledEvents as string[] ?? [];
    return disabled.includes(event);
}

export async function toggleEvent(guildId: string, event: string): Promise<boolean> {
    const config  = await getLogConfig(guildId);
    const current = config.disabledEvents as string[] ?? [];
    let updated: string[];
    let isNowDisabled: boolean;

    if (current.includes(event)) {
        updated = current.filter(e => e !== event);
        isNowDisabled = false;
    } else {
        updated = [...current, event];
        isNowDisabled = true;
    }

    await updateLogConfig(guildId, { disabledEvents: updated });
    return isNowDisabled;
}

// ── Log ignore ────────────────────────────────────────────────────────────────

export async function getLogIgnoreList(guildId: string) {
    return db.query.logIgnore.findMany({
        where: eq(logIgnore.guildId, guildId),
    });
}

export async function isLogIgnored(guildId: string, targetId: string): Promise<boolean> {
    const entry = await db.query.logIgnore.findFirst({
        where: and(eq(logIgnore.guildId, guildId), eq(logIgnore.targetId, targetId)),
    });
    return !!entry;
}

export async function addLogIgnore(guildId: string, targetId: string, type: 'user' | 'channel') {
    await ensureGuild(guildId);
    await db.insert(logIgnore).values({ guildId, targetId, type }).onConflictDoNothing();
}

export async function removeLogIgnore(guildId: string, targetId: string) {
    await db.delete(logIgnore).where(
        and(eq(logIgnore.guildId, guildId), eq(logIgnore.targetId, targetId)),
    );
}