// src/commands/utility/timer.ts
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { parseDuration, formatDuration } from '../../utils/moderation.js';
import {
    getTimerMessages,
    getTimerByChannel,
    createTimerMessage,
    deleteTimerMessage,
} from '../../db/queries/timerMessages.js';

const MIN_INTERVAL = 10 * 60; // 10 minutes

export default {
    data: new SlashCommandBuilder()
        .setName('timer')
        .setDescription('Schedule a recurring message in a channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s
            .setName('add')
            .setDescription('Create an auto message for a channel')
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel to send the message in')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
            .addStringOption(o => o
                .setName('interval')
                .setDescription('How often to send (e.g. 30m, 2h, 1d)')
                .setRequired(true)
            )
            .addStringOption(o => o
                .setName('message')
                .setDescription('Message content to send')
                .setRequired(true)
                .setMaxLength(2000)
            )
        )
        .addSubcommand(s => s
            .setName('remove')
            .setDescription('Remove the auto message from a channel')
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel to remove the timer from')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('view')
            .setDescription('View the auto message for a channel')
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel to view')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('list')
            .setDescription('List all auto messages in this server')
        ),

    category:        'utility',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        3,

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild!.id;

        if (sub === 'add') {
            const channel     = interaction.options.getChannel('channel', true);
            const intervalStr = interaction.options.getString('interval', true);
            const message     = interaction.options.getString('message', true);
            const seconds     = parseDuration(intervalStr);

            if (!seconds || seconds < MIN_INTERVAL) {
                await interaction.reply({
                    content: `${e('error')} Minimum interval is **10 minutes**.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const existing = await getTimerByChannel(guildId, channel.id);
            if (existing) {
                await interaction.reply({
                    content: `${e('error')} <#${channel.id}> already has an auto message. Remove it first with \`/timer remove\`.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await createTimerMessage({ guildId, channelId: channel.id, message, interval: seconds });

            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `${e('success')}  Auto message set in <#${channel.id}>\n` +
                    `-# Sends every **${formatDuration(seconds)}**`
                )
                .build();
            await sendResponse(interaction, [card]);
        }

        else if (sub === 'remove') {
            const channel = interaction.options.getChannel('channel', true);
            const existing = await getTimerByChannel(guildId, channel.id);

            if (!existing) {
                await interaction.reply({
                    content: `${e('error')} No auto message found for <#${channel.id}>.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await deleteTimerMessage(guildId, channel.id);

            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('success')}  Auto message removed from <#${channel.id}>`)
                .build();
            await sendResponse(interaction, [card]);
        }

        else if (sub === 'view') {
            const channel = interaction.options.getChannel('channel', true);
            const entry   = await getTimerByChannel(guildId, channel.id);

            if (!entry) {
                await interaction.reply({
                    content: `${e('error')} No auto message found for <#${channel.id}>.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const nextSend = entry.lastSent
                ? Math.floor((new Date(entry.lastSent).getTime() + entry.interval * 1000) / 1000)
                : Math.floor(Date.now() / 1000);

            const card = new FadeContainer(Colours.FADE)
                .text(
                    `## ${e('settings')} Auto Message — <#${channel.id}>\n` +
                    `**Interval:** every ${formatDuration(entry.interval)}\n` +
                    `**Next send:** <t:${nextSend}:R>\n\n` +
                    `**Message:**\n${entry.message}`
                )
                .build();
            await sendResponse(interaction, [card], true);
        }

        else if (sub === 'list') {
            const timers = await getTimerMessages(guildId);

            if (!timers.length) {
                await interaction.reply({
                    content: `${e('error')} No auto messages configured. Use \`/timer add\` to create one.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const lines = timers.map(t =>
                `<#${t.channelId}> — every **${formatDuration(t.interval)}**`
            ).join('\n');

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('settings')} Auto Messages\n${lines}`)
                .build();
            await sendResponse(interaction, [card], true);
        }
    },
} satisfies Command;
