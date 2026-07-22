// src/commands/moderation/unmute.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendResponse, sendMessage, FadeContainer } from '../../components/builders.js';
import { dmUser } from '../../utils/moderation.js';
import { createCase } from '../../db/queries/moderation.js';
import { e, Colours } from '../../components/emojis.js';
import { sendLog, LogColour } from '../../utils/logsender.js';
import { hasPermission } from '../../utils/fakePerms.js';

export default {
    data: new SlashCommandBuilder()
        .setName('unmute')
        .setDescription('Remove a timeout from a member')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(o => o.setName('user').setDescription('The member to unmute').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

    category: 'moderation', guildOnly: true,
    userPermissions: [PermissionFlagsBits.ModerateMembers],
    botPermissions:  [PermissionFlagsBits.ModerateMembers],
    cooldown: 5,

    async execute(interaction, client) {
        const targetUser   = interaction.options.getUser('user', true);
        const reason       = interaction.options.getString('reason') ?? 'No reason provided';
        const guild        = interaction.guild!;
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            await interaction.reply({ content: `${e('error')} That user is not in this server.`, flags: MessageFlags.Ephemeral });
            return;
        }

        const check = canModerate(interaction.member, targetMember, 'unmute');
        if (!check.ok) {
            await interaction.reply({ content: `${e('error')} ${check.reason}`, flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply();

        if (!targetMember.isCommunicationDisabled()) {
            await interaction.editReply({ content: `${e('error')} That member is not muted.` });
            return;
        }

        await targetMember.timeout(null, `[Fade] ${reason} | Moderator: ${interaction.user.tag}`);

        const newCase = await createCase({
            guildId: guild.id, type: 'unmute',
            userId: targetUser.id, userTag: targetUser.tag,
            moderatorId: interaction.user.id, moderatorTag: interaction.user.tag,
            reason,
        });

        const dmSent = await dmUser(targetUser, guild, 'unmute', reason, newCase.caseNumber);

        await sendLog({
            guild,
            category: 'mod',
            event:    'memberUnmute',
            color:    LogColour.CREATE,
            title:    `${e('unlock')} Member Unmuted`,
            fields: [
                { name: 'User',      value: `<@${targetUser.id}> (${targetUser.tag})` },
                { name: 'Moderator', value: `<@${interaction.user.id}>` },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${targetUser.id}`,
        });

        const card = new FadeContainer(Colours.SUCCESS)
            .text(
                `${e('unlock')}  Unmuted <@${targetUser.id}>` +
                `\n-# Case \`#${newCase.caseNumber}\`` +
                (dmSent === false ? ` · Could not DM user` : '')
            )
            .build();
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const target = targetId ? await message.guild!.members.fetch(targetId).catch(() => null) : null;
        if (!target) { await message.reply(`${e('error')} Please mention a member.`); return; }
        if (!await hasPermission(message.member!, 'moderate_members')) {
            await message.reply(`${e('error')} You don't have permission to unmute members.`); return;
        }
        if (!target.isCommunicationDisabled()) { await message.reply(`${e('error')} That member is not muted.`); return; }

        const reason = args.slice(1).join(' ') || 'No reason provided';
        await target.timeout(null, `[Fade] ${reason}`);

        const newCase = await createCase({
            guildId: message.guild!.id, type: 'unmute',
            userId: target.id, userTag: target.user.tag,
            moderatorId: message.author.id, moderatorTag: message.author.tag, reason,
        });

        const dmSent = await dmUser(target.user, message.guild!, 'unmute', reason, newCase.caseNumber);

        await sendLog({
            guild: message.guild!,
            category: 'mod',
            event:    'memberUnmute',
            color:    LogColour.CREATE,
            title:    `${e('unlock')} Member Unmuted`,
            fields: [
                { name: 'User',      value: `<@${target.id}> (${target.user.tag})` },
                { name: 'Moderator', value: `<@${message.author.id}>` },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${target.id}`,
        });

        const card = new FadeContainer(Colours.SUCCESS)
            .text(
                `${e('unlock')}  Unmuted <@${target.id}>` +
                `\n-# Case \`#${newCase.caseNumber}\`` +
                (dmSent === false ? ` · Could not DM user` : '')
            )
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;