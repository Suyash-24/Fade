// src/db/queries/birthdays.ts
import { eq, and } from 'drizzle-orm';
import { db } from '../index.js';
import { birthdays, birthdayConfig } from '../schema.js';
import { ensureGuild } from './guilds.js';

// ── Config ────────────────────────────────────────────────────────────────────

export async function getBirthdayConfig(guildId: string) {
    return db.query.birthdayConfig.findFirst({
        where: eq(birthdayConfig.guildId, guildId),
    });
}

export async function upsertBirthdayConfig(guildId: string, values: Partial<{
    channelId: string | null;
    roleId:    string | null;
    message:   string | null;
    style:     string;
    enabled:   boolean;
}>) {
    await ensureGuild(guildId);
    await db.insert(birthdayConfig)
        .values({ guildId, ...values })
        .onConflictDoUpdate({
            target: birthdayConfig.guildId,
            set:    { ...values, updatedAt: new Date() },
        });
}

// ── Per-user birthdays ────────────────────────────────────────────────────────

export async function getBirthday(guildId: string, userId: string) {
    return db.query.birthdays.findFirst({
        where: and(eq(birthdays.guildId, guildId), eq(birthdays.userId, userId)),
    });
}

export async function setBirthday(guildId: string, userId: string, birthday: string, timezone = 'UTC') {
    await ensureGuild(guildId);
    await db.insert(birthdays)
        .values({ guildId, userId, birthday, timezone })
        .onConflictDoUpdate({
            target: [birthdays.guildId, birthdays.userId],
            set:    { birthday, timezone },
        });
}

export async function removeBirthday(guildId: string, userId: string) {
    await db.delete(birthdays).where(
        and(eq(birthdays.guildId, guildId), eq(birthdays.userId, userId)),
    );
}

export async function getTodaysBirthdays(monthDay: string) {
    // monthDay format: MM-DD
    return db.query.birthdays.findMany({
        where: eq(birthdays.birthday, monthDay),
    });
}

export async function getGuildBirthdays(guildId: string) {
    return db.query.birthdays.findMany({
        where: eq(birthdays.guildId, guildId),
        orderBy: (t, { asc }) => [asc(t.birthday)],
    });
}
