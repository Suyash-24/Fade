// src/db/queries/reminders.ts
import { eq, lte } from 'drizzle-orm';
import { db } from '../index.js';
import { reminders } from '../schema.js';

export async function createReminder(opts: {
    userId:    string;
    channelId: string;
    guildId?:  string;
    message:   string;
    remindAt:  Date;
}) {
    const [entry] = await db.insert(reminders).values(opts).returning();
    return entry;
}

export async function getDueReminders() {
    return db.query.reminders.findMany({
        where: lte(reminders.remindAt, new Date()),
    });
}

export async function getUserReminders(userId: string) {
    return db.query.reminders.findMany({
        where: eq(reminders.userId, userId),
        orderBy: (t, { asc }) => [asc(t.remindAt)],
    });
}

export async function deleteReminder(id: number) {
    await db.delete(reminders).where(eq(reminders.id, id));
}
