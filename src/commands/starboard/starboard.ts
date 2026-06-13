// src/commands/starboard/starboard.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import { getStarboardConfig, updateStarboardConfig } from '../../db/queries/starboard.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('starboard')
        .setDescription('Configure the starboard system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(s => s
            .setName('view')
            .setDescription('View current starboard settings')
        )
        .addSubcommand(s => s
            .setName('setup')
            .setDescription('Set the starboard channel and enable it')
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel to post starred messages in')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('toggle')
            .setDescription('Enable or disable the starboard')
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('threshold')
            .setDescription('Set how many stars needed to appear on the starboard')
            .addIntegerOption(o => o
                .setName('count')
                .setDescription('Star count (1–25)')
                .setMinValue(1).setMaxValue(25)
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('emoji')
            .setDescription('Set the reaction emoji to use (default ⭐)')
            .addStringOption(o => o
                .setName('emoji')
                .setDescription('Emoji to use as the star reaction')
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('ignorensfw')
            .setDescription('Toggle whether NSFW channels are ignored')
            .addBooleanOption(o => o.setName('enabled').setDescription('Ignore NSFW channels').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('selfstar')
            .setDescription('Allow members to star their own messages')
            .addBooleanOption(o => o.setName('enabled').setDescription('Allow self-starring').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('color')
            .setDescription('Set the starboard embed accent color')
            .addStringOption(o => o.setName('color').setDescription('Hex color (e.g. #FFD700) or "reset"').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('timestamp')
            .setDescription('Toggle timestamp in starboard posts')
            .addBooleanOption(o => o.setName('enabled').setDescription('Show timestamp').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('jumpurl')
            .setDescription('Toggle jump URL in starboard posts')
            .addBooleanOption(o => o.setName('enabled').setDescription('Show jump URL').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('attachments')
            .setDescription('Toggle attachments in starboard posts')
            .addBooleanOption(o => o.setName('enabled').setDescription('Show attachments').setRequired(true))
        )
        .addSubcommandGroup(g => g
            .setName('clownboard')
            .setDescription('Second starboard with 🤡 emoji')
            .addSubcommand(s => s
                .setName('setup')
                .setDescription('Set the clownboard channel')
                .addChannelOption(o => o
                    .setName('channel')
                    .setDescription('Channel for clownboard posts')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
                )
            )
            .addSubcommand(s => s
                .setName('toggle')
                .setDescription('Enable or disable clownboard')
                .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('threshold')
                .setDescription('Set clownboard reaction threshold')
                .addIntegerOption(o => o.setName('count').setDescription('Reaction count').setMinValue(1).setMaxValue(25).setRequired(true))
            )
            .addSubcommand(s => s
                .setName('emoji')
                .setDescription('Set clownboard emoji (default 🤡)')
                .addStringOption(o => o.setName('emoji').setDescription('Emoji').setRequired(true))
            )
        ),

    category:        'starboard',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        5,

    async execute(interaction, client) {
        const sub   = interaction.options.getSubcommand();
        const group = interaction.options.getSubcommandGroup(false);
        const guild = interaction.guild!;

        // ── Clownboard (must check group FIRST — shares subcommand names with starboard) ──
        if (group === 'clownboard') {
            if (sub === 'setup') {
                const channel = interaction.options.getChannel('channel', true);
                await updateStarboardConfig(guild.id, { clownChannelId: channel.id, clownEnabled: true } as any);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Clownboard enabled in <#${channel.id}>\n-# React with 🤡 to clownboard a message`)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            if (sub === 'toggle') {
                const enabled = interaction.options.getBoolean('enabled', true);

                if (enabled) {
                    const config = await getStarboardConfig(guild.id);
                    if (!(config as any).clownChannelId) {
                        const card = new FadeContainer(Colours.WARNING)
                            .text(
                                `## ⚠️ No Channel Set\n` +
                                `Set a clownboard channel first before enabling it.\n` +
                                `-# Use \`/starboard clownboard setup\` to pick a channel — this will also enable it automatically.`
                            )
                            .build();
                        await sendResponse(interaction, [card], true);
                        return;
                    }
                }

                await updateStarboardConfig(guild.id, { clownEnabled: enabled } as any);
                const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                    .text(`${e('success')}  Clownboard **${enabled ? 'enabled' : 'disabled'}**`)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            if (sub === 'threshold') {
                const count = interaction.options.getInteger('count', true);
                await updateStarboardConfig(guild.id, { clownThreshold: count } as any);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Clownboard threshold set to \`${count}\``)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            if (sub === 'emoji') {
                const emoji = interaction.options.getString('emoji', true).trim();
                await updateStarboardConfig(guild.id, { clownEmoji: emoji } as any);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Clownboard emoji set to ${emoji}`)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            return;
        }

        // ── View ──────────────────────────────────────────────────────────────
        if (sub === 'view') {
            const config = await getStarboardConfig(guild.id);
            const c = config as any;
            const card = new FadeContainer(Colours.WARNING)
                .text(`## ⭐ Starboard Config`)
                .separator(true)
                .text([
                    `**Enabled** — \`${config.enabled ? 'Yes' : 'No'}\``,
                    `**Channel** — ${config.channelId ? `<#${config.channelId}>` : '`Not set`'}`,
                    `**Emoji** — ${config.emoji}`,
                    `**Threshold** — \`${config.threshold}\` reactions`,
                    `**Ignore NSFW** — \`${config.ignoreNsfw ? 'Yes' : 'No'}\``,
                    `**Self-star** — \`${c.selfStar ? 'Yes' : 'No'}\``,
                    `**Timestamp** — \`${c.showTimestamp !== false ? 'Yes' : 'No'}\``,
                    `**Jump URL** — \`${c.showJumpUrl !== false ? 'Yes' : 'No'}\``,
                    `**Attachments** — \`${c.showAttachments !== false ? 'Yes' : 'No'}\``,
                    `**Clownboard** — \`${c.clownEnabled ? `Yes — <#${c.clownChannelId}>` : 'No'}\``,
                ].join('\n'))
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Setup ─────────────────────────────────────────────────────────────
        if (sub === 'setup') {
            const channel = interaction.options.getChannel('channel', true);
            await updateStarboardConfig(guild.id, { channelId: channel.id, enabled: true });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `## ⭐ Starboard Enabled\n` +
                    `Starred messages will appear in <#${channel.id}>\n` +
                    `-# Default threshold: 3 reactions · Change with \`/starboard threshold\``
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Toggle ────────────────────────────────────────────────────────────
        if (sub === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled', true);

            if (enabled) {
                const config = await getStarboardConfig(guild.id);
                if (!config.channelId) {
                    const card = new FadeContainer(Colours.WARNING)
                        .text(
                            `## ⚠️ No Channel Set\n` +
                            `Set a starboard channel first before enabling it.\n` +
                            `-# Use \`/starboard setup\` to pick a channel — this will also enable the starboard automatically.`
                        )
                        .build();
                    await sendResponse(interaction, [card], true);
                    return;
                }
            }

            await updateStarboardConfig(guild.id, { enabled });
            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(`${e('success')}  Starboard **${enabled ? 'enabled' : 'disabled'}**`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Threshold ─────────────────────────────────────────────────────────
        if (sub === 'threshold') {
            const count = interaction.options.getInteger('count', true);
            await updateStarboardConfig(guild.id, { threshold: count });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Starboard threshold set to \`${count}\` reaction${count === 1 ? '' : 's'}`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Emoji ─────────────────────────────────────────────────────────────
        if (sub === 'emoji') {
            const emoji = interaction.options.getString('emoji', true).trim();
            await updateStarboardConfig(guild.id, { emoji });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Starboard emoji set to ${emoji}`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Ignore NSFW ───────────────────────────────────────────────────────
        if (sub === 'ignorensfw') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateStarboardConfig(guild.id, { ignoreNsfw: enabled });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  NSFW channels ${enabled ? 'ignored by' : 'included in'} starboard`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Self-star ─────────────────────────────────────────────────────────
        if (sub === 'selfstar') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateStarboardConfig(guild.id, { selfStar: enabled } as any);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Self-starring **${enabled ? 'allowed' : 'blocked'}**`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Color ─────────────────────────────────────────────────────────────
        if (sub === 'color') {
            const input = interaction.options.getString('color', true).trim();
            if (input.toLowerCase() === 'reset') {
                await updateStarboardConfig(guild.id, { color: null } as any);
                const card = new FadeContainer(Colours.SUCCESS).text(`${e('success')}  Starboard color reset`).build();
                await sendResponse(interaction, [card]);
                return;
            }
            const color = parseInt(input.replace('#', ''), 16);
            if (isNaN(color)) {
                const card = new FadeContainer(Colours.DANGER).text(`${e('error')}  Invalid hex color.`).build();
                await sendResponse(interaction, [card], true);
                return;
            }
            await updateStarboardConfig(guild.id, { color } as any);
            const card = new FadeContainer(color).text(`${e('success')}  Starboard color set to \`${input}\``).build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Timestamp ─────────────────────────────────────────────────────────
        if (sub === 'timestamp') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateStarboardConfig(guild.id, { showTimestamp: enabled } as any);
            const card = new FadeContainer(Colours.SUCCESS).text(`${e('success')}  Timestamp **${enabled ? 'shown' : 'hidden'}** in starboard posts`).build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Jump URL ──────────────────────────────────────────────────────────
        if (sub === 'jumpurl') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateStarboardConfig(guild.id, { showJumpUrl: enabled } as any);
            const card = new FadeContainer(Colours.SUCCESS).text(`${e('success')}  Jump URL **${enabled ? 'shown' : 'hidden'}** in starboard posts`).build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Attachments ───────────────────────────────────────────────────────
        if (sub === 'attachments') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateStarboardConfig(guild.id, { showAttachments: enabled } as any);
            const card = new FadeContainer(Colours.SUCCESS).text(`${e('success')}  Attachments **${enabled ? 'shown' : 'hidden'}** in starboard posts`).build();
            await sendResponse(interaction, [card]);
            return;
        }
    },
} satisfies Command;