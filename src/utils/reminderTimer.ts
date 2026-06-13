// src/utils/reminderTimer.ts
// Checks for due reminders every 30 seconds and delivers them.
import { MessageFlags, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import type { FadeClient } from '../client.js';
import { getDueReminders, deleteReminder } from '../db/queries/reminders.js';
import { Colours, e } from '../components/emojis.js';
import { logger } from './logger.js';

export function startReminderTimer(client: FadeClient): void {
    setInterval(async () => {
        try {
            const due = await getDueReminders();
            for (const reminder of due) {
                // Delete first — fire-and-forget delivery, no retry on fail
                await deleteReminder(reminder.id);

                const channel = await client.channels.fetch(reminder.channelId).catch(() => null) as any;
                if (!channel?.isTextBased()) continue;

                const card = new ContainerBuilder()
                    .setAccentColor(Colours.FADE)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `${e('uptime')}  <@${reminder.userId}> reminder!\n${reminder.message}`
                        )
                    );

                await channel.send({
                    content:    `<@${reminder.userId}>`,
                    components: [card],
                    flags:      MessageFlags.IsComponentsV2,
                } as any).catch(() => null);
            }
        } catch (err) {
            logger.error('Reminder timer failed', err);
        }
    }, 30_000);

    logger.info('Reminder timer started');
}
