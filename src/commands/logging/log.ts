// src/commands/logging/logs.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import { getLogConfig, updateLogConfig, toggleEvent, getLogIgnoreList, addLogIgnore, removeLogIgnore } from '../../db/queries/logging.js';
import { e, Colours } from '../../components/emojis.js';

const CATEGORY_FIELDS: Record<string, string> = {
    message: 'messageChannel',
    member:  'memberChannel',
    mod:     'modChannel',
    server:  'serverChannel',
    voice:   'voiceChannel',
    role:    'roleChannel',
    channel: 'channelChannel',
    emoji:   'emojiChannel',
};

const CATEGORY_LABELS: Record<string, string> = {
    message: 'Message events',
    member:  'Member events',
    mod:     'Mod actions',
    server:  'Server events',
    voice:   'Voice events',
    role:    'Role events',
    channel: 'Channel events',
    emoji:   'Emoji events',
};

const TOGGLEABLE_EVENTS = [
    'messageDelete', 'messageEdit', 'messageBulkDelete',
    'memberJoin', 'memberLeave', 'memberBan', 'memberUnban',
    'memberNickname', 'memberRoleAdd', 'memberRoleRemove', 'memberTimeout', 'memberAvatar',
    'channelCreate', 'channelDelete', 'channelUpdate',
    'roleCreate', 'roleDelete', 'roleUpdate',
    'voiceJoin', 'voiceLeave', 'voiceMove',
    'emojiCreate', 'emojiDelete', 'emojiUpdate',
    'serverNameUpdate', 'serverIconUpdate', 'serverBannerUpdate',
    'serverDescriptionUpdate', 'serverVanityUpdate', 'serverVerificationUpdate',
];

export default {
    data: new SlashCommandBuilder()
        .setName('logs')
        .setDescription('Configure the logging system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s
            .setName('view')
            .setDescription('View current logging configuration')
        )
        .addSubcommand(s => s
            .setName('set')
            .setDescription('Set a log channel for a category')
            .addStringOption(o => o
                .setName('category')
                .setDescription('Log category')
                .setRequired(true)
                .addChoices(
                    { name: 'Message events',  value: 'message' },
                    { name: 'Member events',   value: 'member'  },
                    { name: 'Mod actions',     value: 'mod'     },
                    { name: 'Server events',   value: 'server'  },
                    { name: 'Voice events',    value: 'voice'   },
                    { name: 'Role events',     value: 'role'    },
                    { name: 'Channel events',  value: 'channel' },
                    { name: 'Emoji events',    value: 'emoji'   },
                )
            )
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel to log to (leave empty to disable)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
        )
        .addSubcommand(s => s
            .setName('setall')
            .setDescription('Send all log categories to one channel')
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel for all logs')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('disable')
            .setDescription('Disable all logging')
        )
        .addSubcommand(s => s
            .setName('toggle')
            .setDescription('Enable or disable a specific log event')
            .addStringOption(o => o
                .setName('event')
                .setDescription('Event to toggle')
                .setRequired(true)
                .setAutocomplete(true)
            )
        )
        .addSubcommand(s => s
            .setName('ignore')
            .setDescription('Ignore a member or channel from being logged')
            .addMentionableOption(o => o
                .setName('target')
                .setDescription('User or channel to ignore')
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('unignore')
            .setDescription('Remove a member or channel from the ignore list')
            .addMentionableOption(o => o
                .setName('target')
                .setDescription('User or channel to unignore')
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('ignorelist')
            .setDescription('View all ignored members and channels')
        ),

    category:        'logging',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        5,

    async autocomplete(interaction) {
        const focused = interaction.options.getFocused().toLowerCase();
        const choices = TOGGLEABLE_EVENTS
            .filter(ev => ev.toLowerCase().includes(focused))
            .slice(0, 25)
            .map(ev => ({ name: ev, value: ev }));
        await interaction.respond(choices);
    },

    async execute(interaction, client) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        // ── View ──────────────────────────────────────────────────────────────
        if (sub === 'view') {
            const config   = await getLogConfig(guild.id);
            const disabled = config.disabledEvents as string[] ?? [];

            const categoryLines = Object.entries(CATEGORY_LABELS).map(([key, label]) => {
                const channelId = (config as any)[CATEGORY_FIELDS[key]];
                const status    = channelId ? `<#${channelId}>` : '`Not set`';
                return `${e('channels')}  **${label}** — ${status}`;
            });

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('logs')} Logging Config`)
                .separator(true)
                .text(categoryLines.join('\n'))
                .separator(true)
                .text(
                    disabled.length
                        ? `**Disabled events** — ${disabled.map(d => `\`${d}\``).join(', ')}`
                        : `${e('success')}  All events enabled`
                )
                .separator(false)
                .text(`-# Use \`/logs set\` to configure channels · \`/logs toggle\` to disable specific events`)
                .build();

            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Set channel ───────────────────────────────────────────────────────
        if (sub === 'set') {
            const category = interaction.options.getString('category', true);
            const channel  = interaction.options.getChannel('channel');
            const field    = CATEGORY_FIELDS[category];

            await updateLogConfig(guild.id, { [field]: channel?.id ?? null } as any);

            const card = new FadeContainer(channel ? Colours.SUCCESS : Colours.WARNING)
                .text(
                    channel
                        ? `${e('success')}  **${CATEGORY_LABELS[category]}** → <#${channel.id}>`
                        : `${e('success')}  **${CATEGORY_LABELS[category]}** disabled`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Set all ───────────────────────────────────────────────────────────
        if (sub === 'setall') {
            const channel = interaction.options.getChannel('channel', true);
            const values  = Object.values(CATEGORY_FIELDS).reduce((acc, field) => {
                (acc as any)[field] = channel.id;
                return acc;
            }, {} as any);

            await updateLogConfig(guild.id, values);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  All log categories → <#${channel.id}>`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Disable all ───────────────────────────────────────────────────────
        if (sub === 'disable') {
            const nullValues = Object.values(CATEGORY_FIELDS).reduce((acc, field) => {
                (acc as any)[field] = null;
                return acc;
            }, {} as any);

            await updateLogConfig(guild.id, nullValues);

            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('success')}  All logging disabled`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Toggle event ──────────────────────────────────────────────────────
        if (sub === 'toggle') {
            const event      = interaction.options.getString('event', true);
            const isDisabled = await toggleEvent(guild.id, event);

            const card = new FadeContainer(isDisabled ? Colours.WARNING : Colours.SUCCESS)
                .text(`${e('success')}  Event \`${event}\` **${isDisabled ? 'disabled' : 'enabled'}**`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Ignore ────────────────────────────────────────────────────────────
        if (sub === 'ignore') {
            const target = interaction.options.getMentionable('target', true) as any;
            const isUser = 'username' in target || 'user' in target;
            const id     = target.id ?? target.user?.id;
            const type   = isUser ? 'user' : 'channel';

            await addLogIgnore(guild.id, id, type);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  ${isUser ? `<@${id}>` : `<#${id}>`} will no longer be logged`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Unignore ──────────────────────────────────────────────────────────
        if (sub === 'unignore') {
            const target = interaction.options.getMentionable('target', true) as any;
            const id     = target.id ?? target.user?.id;
            const isUser = 'username' in target || 'user' in target;

            await removeLogIgnore(guild.id, id);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  ${isUser ? `<@${id}>` : `<#${id}>`} removed from ignore list`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Ignore list ───────────────────────────────────────────────────────
        if (sub === 'ignorelist') {
            const list = await getLogIgnoreList(guild.id);

            if (!list.length) {
                await interaction.reply({ content: `${e('error')} No ignored members or channels.`, flags: 64 });
                return;
            }

            const lines = list.map(entry =>
                entry.type === 'user' ? `<@${entry.targetId}>` : `<#${entry.targetId}>`
            ).join('\n');

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('logs')} Log Ignore List\n${lines}`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }
    },
} satisfies Command;