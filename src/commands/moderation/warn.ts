// src/commands/moderation/warn.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendResponse, sendMessage, FadeContainer } from '../../components/builders.js';
import { canModerate, dmUser, parseDuration } from '../../utils/moderation.js';
import { createCase, getWarningCount } from '../../db/queries/moderation.js';
import { getTriggeredThreshold } from '../../db/queries/warnThresholds.js';
import { e, Colours } from '../../components/emojis.js';
import { sendLog, LogColour } from '../../utils/logsender.js';
import { hasPermission } from '../../utils/fakePerms.js';
import { getInvokeResponse } from '../../db/queries/invokeMessages.js';
import { logger } from '../../utils/logger.js';

export default {
    data: new SlashCommandBuilder()
        .setName('warn')
        .setDescription('Warn a member')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(o => o
            .setName('user')
            .setDescription('The member to warn')
            .setRequired(true)
        )
        .addStringOption(o => o
            .setName('reason')
            .setDescription('Reason for the warning')
            .setRequired(true)
        ),

    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ModerateMembers],
    cooldown:        5,

    async execute(interaction, client) {
        const targetUser   = interaction.options.getUser('user', true);
        const reason       = interaction.options.getString('reason', true);
        const guild        = interaction.guild!;
        const moderator    = interaction.member as any;
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            await interaction.reply({ content: `${e('error')} That user is not in this server.`, flags: MessageFlags.Ephemeral });
            return;
        }

        const check = canModerate(moderator, targetMember, 'warn');
        if (!check.ok) {
            await interaction.reply({ content: `${e('error')} ${check.reason}`, flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply();

        const newCase = await createCase({
            guildId:      guild.id,
            type:         'warn',
            userId:       targetUser.id,
            userTag:      targetUser.tag,
            moderatorId:  interaction.user.id,
            moderatorTag: interaction.user.tag,
            reason,
        });

        const warnCount = await getWarningCount(guild.id, targetUser.id);
        const dmSent    = await dmUser(targetUser, guild, 'warn', reason, newCase.caseNumber);

        // ── Warning Threshold Auto-Actions ────────────────────────────────────
        const threshold = await getTriggeredThreshold(guild.id, warnCount);
        if (threshold && targetMember) {
            const thresholdReason = threshold.reason ?? 'Automatic action: warning threshold reached';
            try {
                if (threshold.action === 'kick') {
                    await dmUser(targetUser, guild, 'kick', thresholdReason, 0);
                    await targetMember.kick(`[Fade Auto] ${thresholdReason}`);
                    await createCase({ guildId: guild.id, type: 'kick', userId: targetUser.id, userTag: targetUser.tag, moderatorId: client.user!.id, moderatorTag: client.user!.tag, reason: thresholdReason });
                } else if (threshold.action === 'ban') {
                    await dmUser(targetUser, guild, 'ban', thresholdReason, 0);
                    await guild.bans.create(targetUser.id, { reason: `[Fade Auto] ${thresholdReason}` });
                    await createCase({ guildId: guild.id, type: 'ban', userId: targetUser.id, userTag: targetUser.tag, moderatorId: client.user!.id, moderatorTag: client.user!.tag, reason: thresholdReason });
                } else if ((threshold.action === 'mute' || threshold.action === 'timeout') && threshold.duration) {
                    const ms = threshold.duration * 1000;
                    await targetMember.timeout(ms, `[Fade Auto] ${thresholdReason}`);
                    await createCase({ guildId: guild.id, type: 'timeout', userId: targetUser.id, userTag: targetUser.tag, moderatorId: client.user!.id, moderatorTag: client.user!.tag, reason: thresholdReason, duration: threshold.duration });
                }
                await sendLog({
                    guild, category: 'mod', event: 'memberWarn', color: LogColour.DELETE,
                    title: `${e('warn')} Auto-Action Triggered`,
                    fields: [
                        { name: 'User', value: `<@${targetUser.id}>` },
                        { name: 'Action', value: `\`${threshold.action}\`` },
                        { name: 'Trigger', value: `\`${warnCount}\` warnings` },
                        { name: 'Reason', value: thresholdReason },
                    ],
                    footer: `ID: ${targetUser.id}`,
                });
            } catch (err) {
                logger.error('Warn threshold auto-action failed', err);
            }
        }

        await sendLog({
            guild,
            category: 'mod',
            event:    'memberWarn',
            color:    LogColour.UPDATE,
            title:    `${e('warn')} Member Warned`,
            fields: [
                { name: 'User',      value: `<@${targetUser.id}> (${targetUser.tag})` },
                { name: 'Moderator', value: `<@${interaction.user.id}>` },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
                { name: 'Warnings',  value: `\`${warnCount}\` total` },
            ],
            footer: `ID: ${targetUser.id}`,
        });

        const card = new FadeContainer(Colours.WARNING)
            .text(
                `${e('warn')}  Warned <@${targetUser.id}>` +
                `\n-# Case \`#${newCase.caseNumber}\` · Warning #${warnCount}` +
                (dmSent === false ? ` · Could not DM user` : '')
            )
            .build();

        const invoke = await getInvokeResponse(guild.id, 'warn', {
            user: `<@${targetUser.id}>`, reason,
            moderator: `<@${interaction.user.id}>`, server: guild.name, caseNum: newCase.caseNumber,
        });
        if (invoke.dmMessage) await targetUser.send({ content: invoke.dmMessage }).catch(() => null);
        await sendResponse(interaction, [invoke.message ? new FadeContainer(Colours.WARNING).text(invoke.message).build() : card]);
    },

    async prefixExecute(message, args, client) {
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const target = targetId ? await message.guild!.members.fetch(targetId).catch(() => null) : null;

        if (!target) { await message.reply(`${e('error')} Please mention a member.`); return; }
        if (!await hasPermission(message.member!, 'moderate_members')) {
            await message.reply(`${e('error')} You don't have permission to warn members.`); return;
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';
        const check  = canModerate(message.member!, target, 'warn');
        if (!check.ok) { await message.reply(`${e('error')} ${check.reason}`); return; }

        const newCase = await createCase({
            guildId:      message.guild!.id,
            type:         'warn',
            userId:       target.id,
            userTag:      target.user.tag,
            moderatorId:  message.author.id,
            moderatorTag: message.author.tag,
            reason,
        });

        const warnCount = await getWarningCount(message.guild!.id, target.id);
        const dmSent    = await dmUser(target.user, message.guild!, 'warn', reason, newCase.caseNumber);

        // ── Warning Threshold Auto-Actions ────────────────────────────────────
        const threshold = await getTriggeredThreshold(message.guild!.id, warnCount);
        if (threshold) {
            const thresholdReason = threshold.reason ?? 'Automatic action: warning threshold reached';
            try {
                if (threshold.action === 'kick') {
                    await dmUser(target.user, message.guild!, 'kick', thresholdReason, 0);
                    await target.kick(`[Fade Auto] ${thresholdReason}`);
                    await createCase({ guildId: message.guild!.id, type: 'kick', userId: target.id, userTag: target.user.tag, moderatorId: client.user!.id, moderatorTag: client.user!.tag, reason: thresholdReason });
                } else if (threshold.action === 'ban') {
                    await dmUser(target.user, message.guild!, 'ban', thresholdReason, 0);
                    await message.guild!.bans.create(target.id, { reason: `[Fade Auto] ${thresholdReason}` });
                    await createCase({ guildId: message.guild!.id, type: 'ban', userId: target.id, userTag: target.user.tag, moderatorId: client.user!.id, moderatorTag: client.user!.tag, reason: thresholdReason });
                } else if ((threshold.action === 'mute' || threshold.action === 'timeout') && threshold.duration) {
                    const ms = threshold.duration * 1000;
                    await target.timeout(ms, `[Fade Auto] ${thresholdReason}`);
                    await createCase({ guildId: message.guild!.id, type: 'timeout', userId: target.id, userTag: target.user.tag, moderatorId: client.user!.id, moderatorTag: client.user!.tag, reason: thresholdReason, duration: threshold.duration });
                }
                await sendLog({
                    guild: message.guild!, category: 'mod', event: 'memberWarn', color: LogColour.DELETE,
                    title: `${e('warn')} Auto-Action Triggered`,
                    fields: [
                        { name: 'User',    value: `<@${target.id}>` },
                        { name: 'Action',  value: `\`${threshold.action}\`` },
                        { name: 'Trigger', value: `\`${warnCount}\` warnings` },
                        { name: 'Reason',  value: thresholdReason },
                    ],
                    footer: `ID: ${target.id}`,
                });
            } catch (err) {
                logger.error('Warn threshold auto-action failed', err);
            }
        }

        await sendLog({
            guild: message.guild!,
            category: 'mod',
            event:    'memberWarn',
            color:    LogColour.UPDATE,
            title:    `${e('warn')} Member Warned`,
            fields: [
                { name: 'User',      value: `<@${target.id}> (${target.user.tag})` },
                { name: 'Moderator', value: `<@${message.author.id}>` },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
                { name: 'Warnings',  value: `\`${warnCount}\` total` },
            ],
            footer: `ID: ${target.id}`,
        });

        const card = new FadeContainer(Colours.WARNING)
            .text(
                `${e('warn')}  Warned <@${target.id}>` +
                `\n-# Case \`#${newCase.caseNumber}\` · Warning #${warnCount}` +
                (dmSent === false ? ` · Could not DM user` : '')
            )
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;