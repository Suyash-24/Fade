// src/commands/utility/counter.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import {
    getCounters,
    getCounter,
    createCounter,
    deleteCounter,
    toggleCounter,
} from '../../db/queries/counters.js';
import { updateCounters } from '../../utils/counterUpdater.js';
import { e, Colours } from '../../components/emojis.js';

const COUNTER_TYPES: Record<string, string> = {
    members:               'Total members',
    humans:                'Human members only',
    bots:                  'Bot count',
    online:                'Online members',
    roles:                 'Role count',
    channels:              'All channels',
    boosters:              'Boost count',
    pending:               'Pending members',
    text_channels:         'Text channels',
    voice_channels:        'Voice channels',
    categories:            'Categories',
    announcement_channels: 'Announcement channels',
    stage_channels:        'Stage channels',
};

const COUNTER_EXAMPLES: Record<string, string> = {
    members:  'Members: {count}',
    humans:   'Humans: {count}',
    bots:     'Bots: {count}',
    online:   '🟢 Online: {count}',
    roles:    'Roles: {count}',
    channels: 'Channels: {count}',
    boosters: '🚀 Boosters: {count}',
};

export default {
    data: new SlashCommandBuilder()
        .setName('counter')
        .setDescription('Manage stat counter channels')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(s => s
            .setName('create')
            .setDescription('Create a counter channel')
            .addStringOption(o => o
                .setName('type')
                .setDescription('What to count')
                .setRequired(true)
                .addChoices(
                    { name: 'Members — total member count',          value: 'members'               },
                    { name: 'Humans — non-bot member count',         value: 'humans'                },
                    { name: 'Bots — bot count',                      value: 'bots'                  },
                    { name: 'Online — online members',               value: 'online'                },
                    { name: 'Roles — role count',                    value: 'roles'                 },
                    { name: 'Channels — all channels',               value: 'channels'              },
                    { name: 'Boosters — boost count',                value: 'boosters'              },
                    { name: 'Pending — pending members',             value: 'pending'               },
                    { name: 'Text channels',                         value: 'text_channels'         },
                    { name: 'Voice channels',                        value: 'voice_channels'        },
                    { name: 'Categories',                            value: 'categories'            },
                    { name: 'Announcement channels',                 value: 'announcement_channels' },
                    { name: 'Stage channels',                        value: 'stage_channels'        },
                )
            )
            .addStringOption(o => o
                .setName('template')
                .setDescription('Channel name template. Use {count} for the number. Example: Members: {count}')
                .setRequired(true)
            )
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Existing voice channel to use (leave empty to create new)')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(false)
            )
        )
        .addSubcommand(s => s
            .setName('list')
            .setDescription('List all counter channels')
        )
        .addSubcommand(s => s
            .setName('delete')
            .setDescription('Delete a counter')
            .addIntegerOption(o => o.setName('id').setDescription('Counter ID').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('toggle')
            .setDescription('Enable or disable a counter')
            .addIntegerOption(o => o.setName('id').setDescription('Counter ID').setRequired(true))
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('update')
            .setDescription('Force update all counters now')
        ),

    category:        'utility',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    botPermissions:  [PermissionFlagsBits.ManageChannels],
    cooldown:        10,

    async execute(interaction, client) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        // ── Create ────────────────────────────────────────────────────────────
        if (sub === 'create') {
            const type     = interaction.options.getString('type', true);
            const template = interaction.options.getString('template', true);
            const existing = interaction.options.getChannel('channel');

            if (!template.includes('{count}')) {
                await interaction.reply({
                    content: `${e('error')} Template must include \`{count}\`. Example: \`Members: {count}\``,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const all = await getCounters(guild.id);
            if (all.length >= 10) {
                await interaction.reply({ content: `${e('error')} Maximum 10 counters per server.`, flags: MessageFlags.Ephemeral });
                return;
            }

            let channelId: string;

            if (existing) {
                channelId = existing.id;
            } else {
                // Create a new voice channel — initial name uses template
                const initialCount = guild.memberCount;
                const initialName  = template.replace('{count}', initialCount.toLocaleString());
                const newChannel   = await guild.channels.create({
                    name:                 initialName,
                    type:                 ChannelType.GuildVoice,
                    permissionOverwrites: [{
                        id:   guild.id,
                        deny: [PermissionFlagsBits.Connect], // can't join, view only
                    }],
                });
                channelId = newChannel.id;
            }

            const counter = await createCounter({ guildId: guild.id, channelId, type, template });

            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `## ${e('stats')} Counter Created\n` +
                    `${e('id')}  **ID** — \`${counter.id}\`\n` +
                    `**Type** — \`${COUNTER_TYPES[type]}\`\n` +
                    `**Channel** — <#${channelId}>\n` +
                    `**Template** — \`${template}\`\n` +
                    `-# Updates every 10 minutes · Use \`/counter update\` to force refresh`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── List ──────────────────────────────────────────────────────────────
        if (sub === 'list') {
            const all = await getCounters(guild.id);

            if (!all.length) {
                const card = new FadeContainer(Colours.NONE)
                    .text(
                        `${e('stats')} No counters set up yet.\n` +
                        `Use \`/counter create\` to add one.\n` +
                        `-# Example: \`/counter create type:members template:Members: {count}\``
                    )
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }

            const lines = all.map(c =>
                `\`#${c.id}\` ${c.enabled ? '🟢' : '🔴'} · **${COUNTER_TYPES[c.type] ?? c.type}** · <#${c.channelId}> · \`${c.template}\``
            );

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('stats')} Counters (${all.length}/10)`)
                .separator(true)
                .text(lines.join('\n'))
                .separator(false)
                .text(`-# Updates every 10 minutes`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Delete ────────────────────────────────────────────────────────────
        if (sub === 'delete') {
            const id    = interaction.options.getInteger('id', true);
            const entry = await getCounter(id);

            if (!entry || entry.guildId !== guild.id) {
                await interaction.reply({ content: `${e('error')} Counter #${id} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await deleteCounter(id);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Counter #${id} deleted\n-# The voice channel was not deleted — remove it manually if needed`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Toggle ────────────────────────────────────────────────────────────
        if (sub === 'toggle') {
            const id      = interaction.options.getInteger('id', true);
            const enabled = interaction.options.getBoolean('enabled', true);
            const entry   = await getCounter(id);

            if (!entry || entry.guildId !== guild.id) {
                await interaction.reply({ content: `${e('error')} Counter #${id} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await toggleCounter(id, enabled);
            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(`${e('success')}  Counter #${id} **${enabled ? 'enabled' : 'disabled'}**`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Force update ──────────────────────────────────────────────────────
        if (sub === 'update') {
            await interaction.deferReply({ ephemeral: true });
            await updateCounters(client);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  All counters updated`)
                .build();
            await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);
            return;
        }
    },
} satisfies Command;