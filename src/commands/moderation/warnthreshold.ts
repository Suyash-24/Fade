// src/commands/moderation/warnthreshold.ts
// Configure automatic actions when a user reaches a warning threshold.
// e.g. "At 3 warnings → mute 1h", "At 5 warnings → ban"
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, fadeReply, sendMessage } from '../../components/builders.js';
import { getWarnThresholds, setWarnThreshold, removeWarnThreshold, clearWarnThresholds } from '../../db/queries/warnThresholds.js';
import { parseDuration } from '../../utils/moderation.js';
import { e, Colours } from '../../components/emojis.js';
import { hasPermission } from '../../utils/fakePerms.js';

const VALID_ACTIONS = ['mute', 'kick', 'ban', 'timeout'];

export default {
    data: new SlashCommandBuilder()
        .setName('warnthreshold')
        .setDescription('Configure auto-actions when a user reaches a warning count')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addSubcommand(s => s
            .setName('add')
            .setDescription('Add or update a warning threshold')
            .addIntegerOption(o => o.setName('count').setDescription('Warning count that triggers the action (e.g. 3)').setRequired(true).setMinValue(1))
            .addStringOption(o => o.setName('action').setDescription('Action to take').setRequired(true)
                .addChoices(
                    { name: 'Mute',    value: 'mute'    },
                    { name: 'Timeout', value: 'timeout' },
                    { name: 'Kick',    value: 'kick'    },
                    { name: 'Ban',     value: 'ban'     },
                ))
            .addStringOption(o => o.setName('duration').setDescription('Duration for mute/timeout (e.g. 1h, 7d). Leave empty for permanent').setRequired(false))
            .addStringOption(o => o.setName('reason').setDescription('Reason logged for the auto-action').setRequired(false))
        )
        .addSubcommand(s => s
            .setName('remove')
            .setDescription('Remove a warning threshold')
            .addIntegerOption(o => o.setName('count').setDescription('The warning count threshold to remove').setRequired(true).setMinValue(1))
        )
        .addSubcommand(s => s.setName('list').setDescription('List all warning thresholds'))
        .addSubcommand(s => s.setName('clear').setDescription('Remove all warning thresholds')),

    category: 'moderation', guildOnly: true,
    userPermissions: [PermissionFlagsBits.Administrator],
    cooldown: 5,

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        if (sub === 'add') {
            const count    = interaction.options.getInteger('count', true);
            const action   = interaction.options.getString('action', true);
            const durStr   = interaction.options.getString('duration');
            const reason   = interaction.options.getString('reason');
            const duration = durStr ? parseDuration(durStr) : null;

            if ((action === 'mute' || action === 'timeout') && !duration) {
                await interaction.reply({ content: `${e('error')} Please provide a duration for \`${action}\` actions.`, flags: MessageFlags.Ephemeral }); return;
            }

            await setWarnThreshold(guild.id, count, action, duration, reason);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Warning threshold set!\n\`${count} warnings\` → \`${action}\`${duration ? ` for \`${durStr}\`` : ''}`)
                .build();
            await interaction.reply({ ...(fadeReply([card], true) as any) });
            return;
        }

        if (sub === 'remove') {
            const count = interaction.options.getInteger('count', true);
            await removeWarnThreshold(guild.id, count);
            await interaction.reply({ content: `${e('success')} Removed threshold for \`${count}\` warnings.`, flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'clear') {
            await clearWarnThresholds(guild.id);
            await interaction.reply({ content: `${e('success')} Cleared all warning thresholds.`, flags: MessageFlags.Ephemeral });
            return;
        }

        // list
        const thresholds = await getWarnThresholds(guild.id);
        const card = new FadeContainer(Colours.FADE)
            .text(`## ${e('warn')} Warning Thresholds`)
            .separator(true)
            .text(
                thresholds.length === 0
                    ? '*No thresholds configured. Use `/warnthreshold add` to add one.*'
                    : thresholds.map(t =>
                        `**${t.count} warnings** → \`${t.action}\`${t.duration ? ` · \`${t.duration}s\`` : ''}`
                      ).join('\n')
            )
            .build();

        await interaction.reply({ ...(fadeReply([card], true) as any) });
    },

    async prefixExecute(message, args, client) {
        if (!await hasPermission(message.member!, 'administrator')) {
            await message.reply(`${e('error')} You need Administrator permission.`); return;
        }

        const sub = args[0]?.toLowerCase();

        if (sub === 'list' || !sub) {
            const thresholds = await getWarnThresholds(message.guild!.id);
            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('warn')} Warning Thresholds`)
                .separator(true)
                .text(
                    thresholds.length === 0
                        ? '*No thresholds set.*'
                        : thresholds.map(t =>
                            `**${t.count} warnings** → \`${t.action}\`${t.duration ? ` · \`${t.duration}s\`` : ''}`
                          ).join('\n')
                )
                .build();
            await sendMessage(message, [card]); return;
        }

        if (sub === 'clear') {
            await clearWarnThresholds(message.guild!.id);
            await message.reply(`${e('success')} Cleared all warning thresholds.`); return;
        }

        if (sub === 'remove') {
            const count = parseInt(args[1]);
            if (isNaN(count)) { await message.reply(`${e('error')} Usage: \`f!warnthreshold remove <count>\``); return; }
            await removeWarnThreshold(message.guild!.id, count);
            await message.reply(`${e('success')} Removed threshold for \`${count}\` warnings.`); return;
        }

        if (sub === 'add') {
            const count = parseInt(args[1]);
            const action = args[2]?.toLowerCase();
            if (isNaN(count) || !action || !VALID_ACTIONS.includes(action)) {
                await message.reply(`${e('error')} Usage: \`f!warnthreshold add <count> <mute|timeout|kick|ban> [duration] [reason]\``); return;
            }
            const durStr = args[3];
            const duration = durStr ? parseDuration(durStr) : null;
            const reason = args.slice(durStr ? 4 : 3).join(' ') || null;

            if ((action === 'mute' || action === 'timeout') && !duration) {
                await message.reply(`${e('error')} Please provide a duration for \`${action}\` actions.`); return;
            }

            await setWarnThreshold(message.guild!.id, count, action, duration, reason);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Threshold set: \`${count} warnings\` → \`${action}\`${duration ? ` for \`${durStr}\`` : ''}`)
                .build();
            await sendMessage(message, [card]); return;
        }

        await message.reply(`${e('error')} Usage: \`f!warnthreshold <add|remove|list|clear>\``);
    },
} satisfies Command;
