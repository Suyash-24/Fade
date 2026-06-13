// src/commands/utility/remind.ts
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendResponse, sendMessage, FadeContainer } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { createReminder, getUserReminders, deleteReminder } from '../../db/queries/reminders.js';
import { parseDuration } from '../../utils/moderation.js';

const MAX_REMINDERS = 10;

export default {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Set a reminder — bot will ping you when time is up')
        .addSubcommand(s => s
            .setName('set')
            .setDescription('Create a reminder')
            .addStringOption(o => o
                .setName('time')
                .setDescription('When to remind you (e.g. 10m, 2h, 1d)')
                .setRequired(true)
            )
            .addStringOption(o => o
                .setName('message')
                .setDescription('What to remind you about')
                .setRequired(true)
                .setMaxLength(300)
            )
        )
        .addSubcommand(s => s
            .setName('list')
            .setDescription('View your active reminders')
        )
        .addSubcommand(s => s
            .setName('cancel')
            .setDescription('Cancel a reminder by ID')
            .addIntegerOption(o => o
                .setName('id')
                .setDescription('Reminder ID from /remind list')
                .setRequired(true)
                .setMinValue(1)
            )
        ),

    category: 'utility',
    cooldown: 3,

    async execute(interaction) {
        const sub    = interaction.options.getSubcommand();
        const userId = interaction.user.id;

        if (sub === 'set') {
            const timeStr = interaction.options.getString('time', true);
            const message = interaction.options.getString('message', true);
            const seconds = parseDuration(timeStr);

            if (!seconds || seconds < 10 || seconds > 60 * 60 * 24 * 30) {
                await interaction.reply({
                    content: `${e('error')} Invalid duration. Use e.g. \`10m\`, \`2h\`, \`1d\`. Max 30 days.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const existing = await getUserReminders(userId);
            if (existing.length >= MAX_REMINDERS) {
                await interaction.reply({
                    content: `${e('error')} You already have ${MAX_REMINDERS} active reminders. Cancel one first.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const remindAt = new Date(Date.now() + seconds * 1000);
            await createReminder({
                userId,
                channelId: interaction.channelId,
                guildId:   interaction.guildId ?? undefined,
                message,
                remindAt,
            });

            const ts = Math.floor(remindAt.getTime() / 1000);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('uptime')}  Reminder set\n-# I'll ping you <t:${ts}:R> — ${message}`)
                .build();
            await sendResponse(interaction, [card]);
        }

        else if (sub === 'list') {
            const reminders = await getUserReminders(userId);
            if (!reminders.length) {
                await interaction.reply({ content: `${e('error')} You have no active reminders.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const lines = reminders.map(r => {
                const ts = Math.floor(new Date(r.remindAt).getTime() / 1000);
                return `\`#${r.id}\` <t:${ts}:R> — ${r.message}`;
            }).join('\n');

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('uptime')} Your Reminders\n${lines}`)
                .build();
            await sendResponse(interaction, [card], true);
        }

        else if (sub === 'cancel') {
            const id      = interaction.options.getInteger('id', true);
            const reminders = await getUserReminders(userId);
            const entry   = reminders.find(r => r.id === id);

            if (!entry) {
                await interaction.reply({ content: `${e('error')} Reminder \`#${id}\` not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await deleteReminder(id);
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('success')}  Reminder \`#${id}\` cancelled.`)
                .build();
            await sendResponse(interaction, [card], true);
        }
    },

    async prefixExecute(message, args) {
        const userId  = message.author.id;
        const timeStr = args[0];
        const msg     = args.slice(1).join(' ');

        if (!timeStr || !msg) {
            await message.reply(`${e('error')} Usage: \`f!remind <time> <message>\` — e.g. \`f!remind 30m take a break\``);
            return;
        }

        const seconds = parseDuration(timeStr);
        if (!seconds || seconds < 10 || seconds > 60 * 60 * 24 * 30) {
            await message.reply(`${e('error')} Invalid duration. Use e.g. \`10m\`, \`2h\`, \`1d\`. Max 30 days.`);
            return;
        }

        const existing = await getUserReminders(userId);
        if (existing.length >= MAX_REMINDERS) {
            await message.reply(`${e('error')} You already have ${MAX_REMINDERS} active reminders.`);
            return;
        }

        const remindAt = new Date(Date.now() + seconds * 1000);
        await createReminder({
            userId,
            channelId: message.channelId,
            guildId:   message.guildId ?? undefined,
            message:   msg,
            remindAt,
        });

        const ts   = Math.floor(remindAt.getTime() / 1000);
        const card = new FadeContainer(Colours.SUCCESS)
            .text(`${e('uptime')}  Reminder set\n-# I'll ping you <t:${ts}:R> — ${msg}`)
            .build();
        await sendMessage(message, [card]);
    },

    aliases: ['remindme', 'reminder'],
} satisfies Command;
