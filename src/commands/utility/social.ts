// src/commands/utility/social.ts
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import {
    getSocialNotifications, addSocialNotification,
    removeSocialNotification, updateSocialMessage,
    type Platform,
} from '../../db/queries/socialNotifications.js';
import { resolveYouTubeChannel } from '../../utils/socialPollers.js';

const PLATFORM_CHOICES = [
    { name: 'YouTube',  value: 'youtube' },
    { name: 'Twitch',   value: 'twitch'  },
    { name: 'Reddit',   value: 'reddit'  },
];

const PLATFORM_EMOJI: Record<string, string> = {
    youtube: '▶️',
    twitch:  '🟣',
    reddit:  '🟠',
};

export default {
    data: new SlashCommandBuilder()
        .setName('social')
        .setDescription('Manage social media notifications')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(s => s
            .setName('add')
            .setDescription('Add a social notification')
            .addStringOption(o => o
                .setName('platform')
                .setDescription('Platform')
                .setRequired(true)
                .addChoices(...PLATFORM_CHOICES)
            )
            .addStringOption(o => o
                .setName('username')
                .setDescription('Channel/username/subreddit to monitor')
                .setRequired(true)
            )
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel to post notifications in')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
            .addRoleOption(o => o
                .setName('role')
                .setDescription('Role to ping (optional)')
                .setRequired(false)
            )
        )
        .addSubcommand(s => s
            .setName('remove')
            .setDescription('Remove a social notification by ID')
            .addIntegerOption(o => o.setName('id').setDescription('Notification ID (from /social list)').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('list')
            .setDescription('List all social notifications')
            .addStringOption(o => o
                .setName('platform')
                .setDescription('Filter by platform (optional)')
                .addChoices(...PLATFORM_CHOICES)
            )
        )
        .addSubcommand(s => s
            .setName('message')
            .setDescription('Set a custom notification message for an entry')
            .addIntegerOption(o => o.setName('id').setDescription('Notification ID').setRequired(true))
            .addStringOption(o => o
                .setName('text')
                .setDescription('Message text. Variables: {name} {url} {title}. Leave empty to reset.')
                .setRequired(false)
                .setMaxLength(300)
            )
        ),

    category:        'utility',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        5,

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild!.id;

        if (sub === 'add') {
            const platform = interaction.options.getString('platform', true) as Platform;
            const username = interaction.options.getString('username', true).trim();
            const channel  = interaction.options.getChannel('channel', true);
            const role     = interaction.options.getRole('role');

            await interaction.deferReply();

            // Resolve account ID and canonical name
            let accountId   = username;
            let accountName = username;

            try {
                if (platform === 'youtube') {
                    const resolved = await resolveYouTubeChannel(username);
                    if (!resolved) {
                        await interaction.editReply(`${e('error')} YouTube channel \`${username}\` not found.`);
                        return;
                    }
                    accountId   = resolved.id;
                    accountName = resolved.name;
                } else if (platform === 'twitch') {
                    accountName = username.toLowerCase();
                    accountId   = username.toLowerCase();
                } else if (platform === 'reddit') {
                    // Strip r/ prefix
                    accountName = username.replace(/^r\//i, '');
                    accountId   = accountName.toLowerCase();
                }
            } catch {
                await interaction.editReply(`${e('error')} Could not resolve \`${username}\`. Check the name and try again.`);
                return;
            }

            // Check for duplicate
            const existing = await getSocialNotifications(guildId, platform);
            if (existing.some(n => n.accountId === accountId)) {
                await interaction.editReply(`${e('error')} Already monitoring **${accountName}** on ${platform}.`);
                return;
            }

            const entry = await addSocialNotification({
                guildId,
                channelId:   channel.id,
                platform,
                accountId,
                accountName,
                roleId:      role?.id,
            });

            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `${PLATFORM_EMOJI[platform]}  **${accountName}** added\n` +
                    `-# ${platform} · notifications → <#${channel.id}>` +
                    (role ? ` · pings <@&${role.id}>` : '') +
                    `\n-# ID: \`${entry.id}\``
                )
                .build();
            await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);
            return;
        }

        if (sub === 'remove') {
            const id      = interaction.options.getInteger('id', true);
            const all     = await getSocialNotifications(guildId);
            const entry   = all.find(n => n.id === id);
            if (!entry) {
                await interaction.reply({ content: `${e('error')} Notification #${id} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }
            await removeSocialNotification(id);
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('success')}  Removed **${entry.accountName}** (${entry.platform}) notification`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'list') {
            const platform = interaction.options.getString('platform') as Platform | null;
            const all      = await getSocialNotifications(guildId, platform ?? undefined);

            if (!all.length) {
                await interaction.reply({ content: `${e('error')} No social notifications configured.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const lines = all.map(n =>
                `\`#${n.id}\` ${PLATFORM_EMOJI[n.platform]} **${n.accountName}** → <#${n.channelId}>${n.roleId ? ` · <@&${n.roleId}>` : ''}`
            ).join('\n');

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('link')} Social Notifications\n${lines}`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        if (sub === 'message') {
            const id   = interaction.options.getInteger('id', true);
            const text = interaction.options.getString('text') ?? null;
            const all  = await getSocialNotifications(guildId);
            if (!all.find(n => n.id === id)) {
                await interaction.reply({ content: `${e('error')} Notification #${id} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }
            await updateSocialMessage(id, text);
            const card = new FadeContainer(text ? Colours.SUCCESS : Colours.DANGER)
                .text(text
                    ? `${e('success')}  Custom message set for #${id}\n-# Variables: \`{name}\` \`{url}\` \`{title}\``
                    : `${e('success')}  Message reset to default for #${id}`)
                .build();
            await sendResponse(interaction, [card]);
        }
    },

    async prefixExecute(message, args) {
        if (!message.member!.permissions.has(PermissionFlagsBits.ManageGuild)) {
            await message.reply(`${e('error')} You need **Manage Server**.`);
            return;
        }
        const guildId = message.guild!.id;
        const sub     = args[0]?.toLowerCase();

        if (sub === 'list') {
            const all = await getSocialNotifications(guildId);
            if (!all.length) { await message.reply(`${e('error')} No social notifications.`); return; }
            const lines = all.map(n => `\`#${n.id}\` ${PLATFORM_EMOJI[n.platform]} **${n.accountName}** → <#${n.channelId}>`).join('\n');
            const card  = new FadeContainer(Colours.FADE).text(`## ${e('link')} Social Notifications\n${lines}`).build();
            await sendMessage(message, [card]);
        } else if (sub === 'remove') {
            const id = parseInt(args[1]);
            if (isNaN(id)) { await message.reply(`${e('error')} Usage: \`f!social remove <id>\``); return; }
            await removeSocialNotification(id);
            const card = new FadeContainer(Colours.DANGER).text(`${e('success')}  Notification #${id} removed`).build();
            await sendMessage(message, [card]);
        } else {
            await message.reply(`Use \`/social add\` to add notifications. Prefix: \`f!social list\` · \`f!social remove <id>\``);
        }
    },

    aliases: ['notify', 'notifications'],
} satisfies Command;
