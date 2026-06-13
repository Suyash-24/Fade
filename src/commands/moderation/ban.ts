// src/commands/moderation/ban.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { fadeReply, sendMessage, FadeContainer } from '../../components/builders.js';
import { canModerate, dmUser, parseDuration } from '../../utils/moderation.js';
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
        .setName('ban')
        .setDescription('Ban a member from the server')
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
        )
        .addIntegerOption(o => o
            .setName('delete_messages')
            .setDescription('Delete message history (days)')
            .setMinValue(0)
            .setMaxValue(7)
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
        const reason      = interaction.options.getString('reason') ?? 'No reason provided';
        const durationStr = interaction.options.getString('duration');
        const deleteDays  = interaction.options.getInteger('delete_messages') ?? 0;
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
        const dmSent = await dmUser(targetUser, guild, 'ban', reason, 0, duration ?? undefined);

        // Execute ban
        await guild.bans.create(targetUser.id, {
            reason:           `[Fade] ${reason} | Moderator: ${interaction.user.tag}`,
            deleteMessageSeconds: deleteDays * 86400,
        });

        // Create case
        const newCase = await createCase({
            guildId:      guild.id,
            type:         'ban',
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
            color:    LogColour.MOD,
            title:    `${e('ban')} Member Banned`,
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

        const reason      = args.slice(1).join(' ') || 'No reason provided';
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

        const dmSent = await dmUser(target, guild, 'ban', reason, 0);

        await guild.bans.create(target.id, {
            reason: `[Fade] ${reason} | Moderator: ${message.author.tag}`,
        });

        const newCase = await createCase({
            guildId:      guild.id,
            type:         'ban',
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
            color:    LogColour.MOD,
            title:    `${e('ban')} Member Banned`,
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
                `${e('ban')}  Banned <@${target.id}>` +
                `\n-# Case \`#${newCase.caseNumber}\`` +
                (dmSent === false ? ` · Could not DM user` : '')
            )
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;