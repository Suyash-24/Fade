// src/commands/stats/managestats.ts
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import {
    addUserMessages,
    removeUserMessages,
    addUserVoiceSeconds,
    removeUserVoiceSeconds,
    resetUserMessages,
    resetUserVoice,
    getUserMessages,
    getUserVoiceSeconds,
} from '../../db/queries/stats.js';
import { addToBlacklist, removeFromBlacklist } from '../../db/queries/statsBlacklist.js';
import { StatsTracker } from '../../utils/statsTracker.js';
import { parseDuration } from '../../utils/moderation.js';

function formatDuration(seconds: number): string {
    if (seconds === 0) return '0m';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h === 0) return `${m}m`;
    if (m === 0) return `${h}h`;
    return `${h}h ${m}m`;
}

export default {
    data: new SlashCommandBuilder()
        .setName('managestats')
        .setDescription('Manage activity stats for users')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(s => s
            .setName('addmessages')
            .setDescription('Add messages to a user\'s count')
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('Number of messages to add').setMinValue(1).setRequired(true))
        )
        .addSubcommand(s => s
            .setName('removemessages')
            .setDescription('Remove messages from a user\'s count')
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
            .addIntegerOption(o => o.setName('amount').setDescription('Number of messages to remove').setMinValue(1).setRequired(true))
        )
        .addSubcommand(s => s
            .setName('addvctime')
            .setDescription('Add voice time to a user')
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
            .addStringOption(o => o.setName('duration').setDescription('Duration to add (e.g. 1h30m, 2h, 45m)').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('removevctime')
            .setDescription('Remove voice time from a user')
            .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
            .addStringOption(o => o.setName('duration').setDescription('Duration to remove (e.g. 1h30m, 2h, 45m)').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('resetmessages')
            .setDescription('Reset message stats for a user or entire server')
            .addUserOption(o => o.setName('user').setDescription('User to reset (leave empty for entire server)').setRequired(false))
        )
        .addSubcommand(s => s
            .setName('resetvoice')
            .setDescription('Reset voice stats for a user or entire server')
            .addUserOption(o => o.setName('user').setDescription('User to reset (leave empty for entire server)').setRequired(false))
        )
        .addSubcommand(s => s
            .setName('blacklistchannel')
            .setDescription('Exclude a channel from being tracked in stats')
            .addChannelOption(o => o.setName('channel').setDescription('Channel to blacklist').setRequired(true))
            .addBooleanOption(o => o.setName('remove').setDescription('Set to true to remove from blacklist').setRequired(false))
        )
        .addSubcommand(s => s
            .setName('blacklistcategory')
            .setDescription('Exclude an entire category from being tracked in stats')
            .addChannelOption(o => o.setName('category').setDescription('Category to blacklist').setRequired(true))
            .addBooleanOption(o => o.setName('remove').setDescription('Set to true to remove from blacklist').setRequired(false))
        ),

    category: 'stats',
    guildOnly: true,
    cooldown: 5,

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        switch (sub) {
            case 'addmessages': {
                const user = interaction.options.getUser('user', true);
                const amount = interaction.options.getInteger('amount', true);
                await addUserMessages(guild.id, user.id, amount);
                const total = await getUserMessages(guild.id, user.id, 'alltime');
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(
                        `## ${e('success')} Messages Added\n` +
                        `${e('pinkarrow')} **User** — ${user}\n` +
                        `${e('pinkarrow')} **Added** — \`${amount.toLocaleString()}\` messages\n` +
                        `${e('pinkarrow')} **New Total** — \`${total.toLocaleString()}\` messages`
                    ).build();
                await sendResponse(interaction, [card]);
                break;
            }

            case 'removemessages': {
                const user = interaction.options.getUser('user', true);
                const amount = interaction.options.getInteger('amount', true);
                await removeUserMessages(guild.id, user.id, amount);
                const total = await getUserMessages(guild.id, user.id, 'alltime');
                const card = new FadeContainer(Colours.DANGER)
                    .text(
                        `## ${e('success')} Messages Removed\n` +
                        `${e('pinkarrow')} **User** — ${user}\n` +
                        `${e('pinkarrow')} **Removed** — \`${amount.toLocaleString()}\` messages\n` +
                        `${e('pinkarrow')} **New Total** — \`${total.toLocaleString()}\` messages`
                    ).build();
                await sendResponse(interaction, [card]);
                break;
            }

            case 'addvctime': {
                const user = interaction.options.getUser('user', true);
                const durationStr = interaction.options.getString('duration', true);
                const ms = parseDuration(durationStr);
                if (!ms) {
                    const err = new FadeContainer(Colours.DANGER).text(`${e('error')} Invalid duration. Use formats like \`1h30m\`, \`2h\`, \`45m\`.`).build();
                    await sendResponse(interaction, [err], true);
                    return;
                }
                const seconds = Math.floor(ms / 1000);
                await addUserVoiceSeconds(guild.id, user.id, seconds);
                const total = await getUserVoiceSeconds(guild.id, user.id, 'alltime');
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(
                        `## ${e('success')} Voice Time Added\n` +
                        `${e('pinkarrow')} **User** — ${user}\n` +
                        `${e('pinkarrow')} **Added** — \`${formatDuration(seconds)}\`\n` +
                        `${e('pinkarrow')} **New Total** — \`${formatDuration(total)}\``
                    ).build();
                await sendResponse(interaction, [card]);
                break;
            }

            case 'removevctime': {
                const user = interaction.options.getUser('user', true);
                const durationStr = interaction.options.getString('duration', true);
                const ms = parseDuration(durationStr);
                if (!ms) {
                    const err = new FadeContainer(Colours.DANGER).text(`${e('error')} Invalid duration. Use formats like \`1h30m\`, \`2h\`, \`45m\`.`).build();
                    await sendResponse(interaction, [err], true);
                    return;
                }
                const seconds = Math.floor(ms / 1000);
                await removeUserVoiceSeconds(guild.id, user.id, seconds);
                const total = await getUserVoiceSeconds(guild.id, user.id, 'alltime');
                const card = new FadeContainer(Colours.DANGER)
                    .text(
                        `## ${e('success')} Voice Time Removed\n` +
                        `${e('pinkarrow')} **User** — ${user}\n` +
                        `${e('pinkarrow')} **Removed** — \`${formatDuration(seconds)}\`\n` +
                        `${e('pinkarrow')} **New Total** — \`${formatDuration(total)}\``
                    ).build();
                await sendResponse(interaction, [card]);
                break;
            }

            case 'resetmessages': {
                const user = interaction.options.getUser('user');
                await resetUserMessages(guild.id, user?.id);
                const target = user ? `${user}` : 'the entire server';
                const card = new FadeContainer(Colours.WARNING)
                    .text(
                        `## ${e('refresh')} Messages Reset\n` +
                        `${e('pinkarrow')} **Target** — ${target}\n` +
                        `${e('pinkarrow')} All message counts have been set to \`0\``
                    ).build();
                await sendResponse(interaction, [card]);
                break;
            }

            case 'resetvoice': {
                const user = interaction.options.getUser('user');
                await resetUserVoice(guild.id, user?.id);
                const target = user ? `${user}` : 'the entire server';
                const card = new FadeContainer(Colours.WARNING)
                    .text(
                        `## ${e('refresh')} Voice Stats Reset\n` +
                        `${e('pinkarrow')} **Target** — ${target}\n` +
                        `${e('pinkarrow')} All voice time has been set to \`0\``
                    ).build();
                await sendResponse(interaction, [card]);
                break;
            }

            case 'blacklistchannel': {
                const channel = interaction.options.getChannel('channel', true);
                const remove = interaction.options.getBoolean('remove') ?? false;
                
                if (remove) {
                    await removeFromBlacklist(guild.id, channel.id);
                } else {
                    await addToBlacklist(guild.id, channel.id, 'channel');
                }
                
                // Refresh memory cache
                await StatsTracker.refreshBlacklist(guild.id);
                
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')} Channel <#${channel.id}> has been ${remove ? 'removed from' : 'added to'} the stats blacklist.`)
                    .build();
                await sendResponse(interaction, [card]);
                break;
            }

            case 'blacklistcategory': {
                const category = interaction.options.getChannel('category', true);
                const remove = interaction.options.getBoolean('remove') ?? false;
                
                if ((category as any).type !== 4) { // ChannelType.GuildCategory is 4
                    const err = new FadeContainer(Colours.DANGER).text(`${e('error')} Please select a Category channel.`).build();
                    await sendResponse(interaction, [err], true);
                    return;
                }

                if (remove) {
                    await removeFromBlacklist(guild.id, category.id);
                } else {
                    await addToBlacklist(guild.id, category.id, 'category');
                }
                
                // Refresh memory cache
                await StatsTracker.refreshBlacklist(guild.id);
                
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')} Category **${category.name}** has been ${remove ? 'removed from' : 'added to'} the stats blacklist.`)
                    .build();
                await sendResponse(interaction, [card]);
                break;
            }
        }
    },

    async prefixExecute(message, args, client) {
        const card = new FadeContainer(Colours.FADE)
            .text(`${e('settings')} Please use the slash command \`/managestats\` for admin stats management.`)
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;
