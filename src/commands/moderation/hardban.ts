// src/commands/moderation/ban.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { fadeReply, sendMessage, FadeContainer } from '../../components/builders.js';
import { canModerate, dmUser, parseDuration, extractFlags, executeAutoAction } from '../../utils/moderation.js';
import { createCase } from '../../db/queries/moderation.js';
import { e, Colours } from '../../components/emojis.js';
import { sendLog, LogColour } from '../../utils/logsender.js';
import { hasPermission } from '../../utils/fakePerms.js';
import { getInvokeResponse } from '../../db/queries/invokeMessages.js';

async function isAlreadyBanned(guild: any, userId: string) {
    return guild.bans.fetch(userId).then(() => true).catch(() => false);
}

export default {
    data: new SlashCommandBuilder()
        .setName('hardban')
        .setDescription('Hardban a member (bans and wipes 7 days of messages)')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(o => o
            .setName('user')
            .setDescription('The user to ban')
            .setRequired(true)
        )
        .addStringOption(o => o
            .setName('reason')
            .setDescription('Reason for the ban')
            .setRequired(false)
        )
        .addStringOption(o => o
            .setName('duration')
            .setDescription('Temp ban duration (e.g. 7d, 24h) — leave empty for permanent')
            .setRequired(false)
        ),
    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.BanMembers],
    botPermissions:  [PermissionFlagsBits.BanMembers],
    cooldown:        5,

    async execute(interaction, client) {
        await interaction.deferReply();

        const targetUser  = interaction.options.getUser('user', true);
        const { reason, doAction, doDuration } = extractFlags(interaction.options.getString('reason') ?? 'No reason provided');
        const durationStr = interaction.options.getString('duration');
        const guild       = interaction.guild!;
        const moderator   = interaction.member as any;

        // Fetch member (may not be in guild)
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        // Permission checks
        if (targetMember) {
            const check = canModerate(moderator, targetMember, 'ban');
            if (!check.ok) {
                await interaction.editReply({ content: `${e('error')} ${check.reason}` });
                return;
            }
        }

        if (await isAlreadyBanned(guild, targetUser.id)) {
            await interaction.editReply({ content: `${e('error')} That user is already banned.` });
            return;
        }

        // Parse duration
        const duration  = durationStr ? parseDuration(durationStr) : null;
        const expiresAt = duration ? new Date(Date.now() + duration * 1000) : undefined;

        // DM before ban (can't DM after)
        const dmSent = await dmUser(targetUser, guild, 'hardban', reason, 0, duration ?? undefined);

        // Execute ban
        await guild.bans.create(targetUser.id, {
            reason:           `[Fade] ${reason} | Moderator: ${interaction.user.tag}`,
            deleteMessageSeconds: 604800,
        });

        // Create case
        const newCase = await createCase({
            guildId:      guild.id,
            type:         'hardban',
            userId:       targetUser.id,
            userTag:      targetUser.tag,
            moderatorId:  interaction.user.id,
            moderatorTag: interaction.user.tag,
            reason,
            duration:     duration ?? undefined,
            expiresAt,
        });

        await sendLog({
            guild,
            category: 'mod',
            event:    'memberBan',
            color:    LogColour.DELETE,
            title:    `${e('ban')} Member Hardbanned`,
            fields: [
                { name: 'User',      value: `<@${targetUser.id}> (${targetUser.tag})` },
                { name: 'Moderator', value: `<@${interaction.user.id}>` },
                { name: 'Reason',    value: reason },
                ...(duration ? [{ name: 'Duration', value: `\`${durationStr!}\`` }] : []),
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${targetUser.id}`,
        });

        const card = new FadeContainer(Colours.DANGER)
            .text(
                `${e('ban')}  Banned <@${targetUser.id}>` +
                (duration ? ` · \`${durationStr}\`` : '') +
                `\n-# Case \`#${newCase.caseNumber}\`` +
                (dmSent === false ? ` · Could not DM user` : '')
            )
            .build();

        if (doAction && targetMember) {
            const inlineReason = `Inline flag action from case #${newCase.caseNumber}`;
            await executeAutoAction(guild, targetUser, targetMember, moderator, doAction, doDuration, inlineReason, client.user!);
        }

        // Invoke message override
        const invoke = await getInvokeResponse(guild.id, 'ban', {
            user:      `<@${targetUser.id}>`,
            reason,
            moderator: `<@${interaction.user.id}>`,
            server:    guild.name,
            caseNum:   newCase.caseNumber,
        });
        if (invoke.dmMessage) await targetUser.send({ content: invoke.dmMessage }).catch(() => null);

        await interaction.editReply({
            ...(fadeReply([invoke.message ? new FadeContainer(Colours.DANGER).text(invoke.message).build() : card], false) as any),
            allowedMentions: { parse: [] },
        } as any);
    },

    async prefixExecute(message, args, client) {
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const target = targetId ? await client.users.fetch(targetId).catch(() => null) : null;

        if (!target) {
            await message.reply(`${e('error')} Please mention a user or provide their ID.`);
            return;
        }

        const reasonStr = args.slice(1).join(' ');
        const { reason, doAction, doDuration } = extractFlags(reasonStr || 'No reason provided');
        const guild       = message.guild!;
        const moderator   = message.member!;
        const targetMember = await guild.members.fetch(target.id).catch(() => null);

        if (!await hasPermission(moderator, 'ban_members')) {
            await message.reply(`${e('error')} You don't have permission to ban members.`);
            return;
        }

        if (targetMember) {
            const check = canModerate(moderator, targetMember, 'ban');
            if (!check.ok) {
                await message.reply(`${e('error')} ${check.reason}`);
                return;
            }
        }

        if (await isAlreadyBanned(guild, target.id)) {
            await message.reply(`${e('error')} That user is already banned.`);
            return;
        }

        const dmSent = await dmUser(target, guild, 'hardban', reason, 0);

        await guild.bans.create(target.id, {
            reason: `[Fade] ${reason} | Moderator: ${message.author.tag}`,
            deleteMessageSeconds: 604800,
        });

        const newCase = await createCase({
            guildId:      guild.id,
            type:         'hardban',
            userId:       target.id,
            userTag:      target.tag,
            moderatorId:  message.author.id,
            moderatorTag: message.author.tag,
            reason,
        });

        await sendLog({
            guild: message.guild!,
            category: 'mod',
            event:    'memberBan',
            color:    LogColour.DELETE,
            title:    `${e('ban')} Member Hardbanned`,
            fields: [
                { name: 'User',      value: `<@${target.id}> (${target.tag})` },
                { name: 'Moderator', value: `<@${message.author.id}>` },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${target.id}`,
        });

        const card = new FadeContainer(Colours.DANGER)
            .text(
                `${e('ban')}  Hardbanned <@${target.id}>` +
                `\n-# Case \`#${newCase.caseNumber}\`` +
                (dmSent === false ? ` · Could not DM user` : '')
            )
            .build();

        if (doAction && targetMember) {
            const inlineReason = `Inline flag action from case #${newCase.caseNumber}`;
            await executeAutoAction(message.guild!, target, targetMember, message.member, doAction, doDuration, inlineReason, client.user!);
        }

        await sendMessage(message, [card]);
    },
} satisfies Command;