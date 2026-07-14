// src/commands/utility/sticky.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
} from 'discord.js';
import type { Guild } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import {
    setStickyMessage,
    deleteStickyMessage,
    getStickyByChannel,
    getStickyMessages,
    toggleStickyMessage,
} from '../../db/queries/stickyMessages.js';

const MIN_COOLDOWN = 5;
const MAX_COOLDOWN = 3600;

function formatCooldown(seconds: number) {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m`;
    const hours = Math.floor(mins / 60);
    return `${hours}h`;
}

async function safeDeleteStickyMessage(
    guild: Guild,
    channelId: string,
    messageId: string,
): Promise<void> {
    const channel = await guild.channels.fetch(channelId).catch(() => null);
    if (!channel || !channel.isTextBased()) return;
    if (!('messages' in channel)) return;
    await channel.messages.delete(messageId).catch(() => null);
}

export default {
    data: new SlashCommandBuilder()
        .setName('sticky')
        .setDescription('Manage sticky messages in channels')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s
            .setName('set')
            .setDescription('Set or update a sticky message')
            .addStringOption(o => o
                .setName('message')
                .setDescription('Sticky message content')
                .setRequired(true)
                .setMaxLength(2000)
            )
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel to stick the message in')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
            .addIntegerOption(o => o
                .setName('cooldown')
                .setDescription('Minimum seconds between reposts (5-3600)')
                .setMinValue(MIN_COOLDOWN)
                .setMaxValue(MAX_COOLDOWN)
                .setRequired(false)
            )
        )
        .addSubcommand(s => s
            .setName('remove')
            .setDescription('Remove a sticky message from a channel')
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel to clear')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
        )
        .addSubcommand(s => s
            .setName('toggle')
            .setDescription('Enable or disable a sticky message')
            .addBooleanOption(o => o
                .setName('enabled')
                .setDescription('On or off')
                .setRequired(true)
            )
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel to update')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
        )
        .addSubcommand(s => s
            .setName('view')
            .setDescription('View the sticky message for a channel')
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel to view')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
        )
        .addSubcommand(s => s
            .setName('list')
            .setDescription('List all sticky messages in this server')
        ),

    category:        'utility',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        3,

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guild!.id;
        const fallbackChannel = interaction.channel;

        if (sub === 'set') {
            const channel = interaction.options.getChannel('channel') ?? fallbackChannel;
            let message = interaction.options.getString('message', true);
            message = message.replace(/\\n/g, '\n');
            const cooldown = interaction.options.getInteger('cooldown') ?? 30;

            if (!channel || channel.type !== ChannelType.GuildText) {
                await interaction.reply({
                    content: `${e('error')} Please select a text channel.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const existing = await getStickyByChannel(guildId, channel.id);
            if (existing?.lastMessageId) {
                await safeDeleteStickyMessage(interaction.guild!, channel.id, existing.lastMessageId);
            }

            const entry = await setStickyMessage({
                guildId,
                channelId: channel.id,
                message,
                cooldown,
            });

            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `${e('success')}  Sticky message set in <#${channel.id}>\n` +
                    `-# Cooldown: ${formatCooldown(entry.cooldown)} · Status: ${entry.enabled ? 'enabled' : 'disabled'}`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'remove') {
            const channel = interaction.options.getChannel('channel') ?? fallbackChannel;
            if (!channel || channel.type !== ChannelType.GuildText) {
                await interaction.reply({
                    content: `${e('error')} Please select a text channel.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const existing = await getStickyByChannel(guildId, channel.id);
            if (!existing) {
                await interaction.reply({
                    content: `${e('error')} No sticky message found for <#${channel.id}>.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            if (existing.lastMessageId) {
                await safeDeleteStickyMessage(interaction.guild!, channel.id, existing.lastMessageId);
            }

            await deleteStickyMessage(guildId, channel.id);

            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('success')}  Sticky message removed from <#${channel.id}>`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'toggle') {
            const channel = interaction.options.getChannel('channel') ?? fallbackChannel;
            const enabled = interaction.options.getBoolean('enabled', true);
            if (!channel || channel.type !== ChannelType.GuildText) {
                await interaction.reply({
                    content: `${e('error')} Please select a text channel.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const existing = await getStickyByChannel(guildId, channel.id);
            if (!existing) {
                await interaction.reply({
                    content: `${e('error')} No sticky message found for <#${channel.id}>.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            if (!enabled && existing.lastMessageId) {
                await safeDeleteStickyMessage(interaction.guild!, channel.id, existing.lastMessageId);
            }

            await toggleStickyMessage(existing.id, enabled);

            const card = new FadeContainer(Colours.FADE)
                .text(`${e('settings')}  Sticky message ${enabled ? 'enabled' : 'disabled'} for <#${channel.id}>`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'view') {
            const channel = interaction.options.getChannel('channel') ?? fallbackChannel;
            if (!channel || channel.type !== ChannelType.GuildText) {
                await interaction.reply({
                    content: `${e('error')} Please select a text channel.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const entry = await getStickyByChannel(guildId, channel.id);
            if (!entry) {
                await interaction.reply({
                    content: `${e('error')} No sticky message found for <#${channel.id}>.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const lastSent = entry.lastSent
                ? Math.floor(new Date(entry.lastSent).getTime() / 1000)
                : null;

            const card = new FadeContainer(Colours.FADE)
                .text(
                    `## ${e('settings')} Sticky — <#${channel.id}>\n` +
                    `**Status:** ${entry.enabled ? 'Enabled' : 'Disabled'}\n` +
                    `**Cooldown:** ${formatCooldown(entry.cooldown)}\n` +
                    `**Last sent:** ${lastSent ? `<t:${lastSent}:R>` : 'Never'}\n\n` +
                    `**Message:**\n${entry.message}`
                )
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        if (sub === 'list') {
            const stickies = await getStickyMessages(guildId);

            if (!stickies.length) {
                await interaction.reply({
                    content: `${e('error')} No sticky messages configured. Use \`/sticky set\` to add one.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const lines = stickies.map(s =>
                `${s.enabled ? '🟢' : '⚫'} <#${s.channelId}> · ${formatCooldown(s.cooldown)}`
            ).join('\n');

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('settings')} Sticky Messages\n${lines}`)
                .build();
            await sendResponse(interaction, [card], true);
        }
    },
} satisfies Command;
