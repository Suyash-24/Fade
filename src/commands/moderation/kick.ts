// src/commands/moderation/kick.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendResponse, sendMessage, FadeContainer } from '../../components/builders.js';
import { canModerate, dmUser } from '../../utils/moderation.js';
import { createCase } from '../../db/queries/moderation.js';
import { e, Colours } from '../../components/emojis.js';
import { sendLog, LogColour } from '../../utils/logsender.js';
import { hasPermission } from '../../utils/fakePerms.js';
import { getInvokeResponse } from '../../db/queries/invokeMessages.js';

export default {
    data: new SlashCommandBuilder()
        .setName('kick')
        .setDescription('Kick a member from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
        .addUserOption(o => o
            .setName('user')
            .setDescription('The member to kick')
            .setRequired(true)
        )
        .addStringOption(o => o
            .setName('reason')
            .setDescription('Reason for the kick')
            .setRequired(false)
        ),

    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.KickMembers],
    botPermissions:  [PermissionFlagsBits.KickMembers],
    cooldown:        5,

    async execute(interaction, client) {
        const targetUser   = interaction.options.getUser('user', true);
        const reason       = interaction.options.getString('reason') ?? 'No reason provided';
        const guild        = interaction.guild!;
        const moderator    = interaction.member as any;
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            await interaction.reply({ content: `${e('error')} That user is not in this server.`, flags: MessageFlags.Ephemeral });
            return;
        }

        const check = canModerate(moderator, targetMember, 'kick');
        if (!check.ok) {
            await interaction.reply({ content: `${e('error')} ${check.reason}`, flags: MessageFlags.Ephemeral });
            return;
        }

        const dmSent = await dmUser(targetUser, guild, 'kick', reason, 0);
        await targetMember.kick(`[Fade] ${reason} | Moderator: ${interaction.user.tag}`);

        const newCase = await createCase({
            guildId:      guild.id,
            type:         'kick',
            userId:       targetUser.id,
            userTag:      targetUser.tag,
            moderatorId:  interaction.user.id,
            moderatorTag: interaction.user.tag,
            reason,
        });

        await sendLog({
            guild,
            category: 'mod',
            event:    'memberKick',
            color:    LogColour.MOD,
            title:    `${e('kick')} Member Kicked`,
            fields: [
                { name: 'User',      value: `<@${targetUser.id}> (${targetUser.tag})` },
                { name: 'Moderator', value: `<@${interaction.user.id}>` },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${targetUser.id}`,
        });

        const card = new FadeContainer(Colours.DANGER)
            .text(
                `${e('kick')}  Kicked <@${targetUser.id}>` +
                `\n-# Case \`#${newCase.caseNumber}\`` +
                (dmSent === false ? ` · Could not DM user` : '')
            )
            .build();

        const invoke = await getInvokeResponse(guild.id, 'kick', {
            user: `<@${targetUser.id}>`, reason,
            moderator: `<@${interaction.user.id}>`, server: guild.name, caseNum: newCase.caseNumber,
        });
        if (invoke.dmMessage) await targetUser.send({ content: invoke.dmMessage }).catch(() => null);
        await sendResponse(interaction, [invoke.message ? new FadeContainer(Colours.DANGER).text(invoke.message).build() : card]);
    },

    async prefixExecute(message, args, client) {
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const target = targetId ? await message.guild!.members.fetch(targetId).catch(() => null) : null;

        if (!target) {
            await message.reply(`${e('error')} Please mention a member or provide their ID.`);
            return;
        }

        if (!await hasPermission(message.member!, 'kick_members')) {
            await message.reply(`${e('error')} You don't have permission to kick members.`);
            return;
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';
        const check  = canModerate(message.member!, target, 'kick');
        if (!check.ok) { await message.reply(`${e('error')} ${check.reason}`); return; }

        const dmSent = await dmUser(target.user, message.guild!, 'kick', reason, 0);
        await target.kick(`[Fade] ${reason} | Moderator: ${message.author.tag}`);

        const newCase = await createCase({
            guildId:      message.guild!.id,
            type:         'kick',
            userId:       target.id,
            userTag:      target.user.tag,
            moderatorId:  message.author.id,
            moderatorTag: message.author.tag,
            reason,
        });

        await sendLog({
            guild: message.guild!,
            category: 'mod',
            event:    'memberKick',
            color:    LogColour.MOD,
            title:    `${e('kick')} Member Kicked`,
            fields: [
                { name: 'User',      value: `<@${target.id}> (${target.user.tag})` },
                { name: 'Moderator', value: `<@${message.author.id}>` },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${target.id}`,
        });

        const card = new FadeContainer(Colours.DANGER)
            .text(
                `${e('kick')}  Kicked <@${target.id}>` +
                `\n-# Case \`#${newCase.caseNumber}\`` +
                (dmSent === false ? ` · Could not DM user` : '')
            )
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;