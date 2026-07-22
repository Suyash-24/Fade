// src/commands/moderation/mute.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { fadeReply, sendMessage, FadeContainer } from '../../components/builders.js';
import { canModerate, dmUser, parseDuration, formatDuration } from '../../utils/moderation.js';
import { createCase } from '../../db/queries/moderation.js';
import { e, Colours } from '../../components/emojis.js';
import { sendLog, LogColour } from '../../utils/logsender.js';
import { hasPermission } from '../../utils/fakePerms.js';
import { getInvokeResponse } from '../../db/queries/invokeMessages.js';

// Max timeout Discord allows: 28 days
const MAX_TIMEOUT = 28 * 24 * 60 * 60;

export default {
    data: new SlashCommandBuilder()
        .setName('mute')
        .setDescription('Timeout (mute) a member')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addUserOption(o => o
            .setName('user')
            .setDescription('The member to mute')
            .setRequired(true)
        )
        .addStringOption(o => o
            .setName('duration')
            .setDescription('Timeout duration (e.g. 10m, 1h, 1d) — max 28 days')
            .setRequired(true)
        )
        .addStringOption(o => o
            .setName('reason')
            .setDescription('Reason for the mute')
            .setRequired(false)
        ),

    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ModerateMembers],
    botPermissions:  [PermissionFlagsBits.ModerateMembers],
    aliases:         ['timeout'],
    cooldown:        5,

    async execute(interaction, client) {
        const targetUser   = interaction.options.getUser('user', true);
        const durationStr  = interaction.options.getString('duration', true);
        const reason       = interaction.options.getString('reason') ?? 'No reason provided';
        const guild        = interaction.guild!;
        const moderator    = interaction.member as any;
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            await interaction.reply({ content: `${e('error')} That user is not in this server.`, flags: MessageFlags.Ephemeral });
            return;
        }

        const check = canModerate(moderator, targetMember, 'mute');
        if (!check.ok) {
            await interaction.reply({ content: `${e('error')} ${check.reason}`, flags: MessageFlags.Ephemeral });
            return;
        }

        const duration = parseDuration(durationStr);
        if (!duration || duration <= 0) {
            await interaction.reply({ content: `${e('error')} Invalid duration. Example: \`10m\`, \`1h\`, \`1d\``, flags: MessageFlags.Ephemeral });
            return;
        }

        if (duration > MAX_TIMEOUT) {
            await interaction.reply({ content: `${e('error')} Timeout duration cannot exceed 28 days.`, flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply();

        const expiresAt = new Date(Date.now() + duration * 1000);
        await targetMember.timeout(duration * 1000, `[Fade] ${reason} | Moderator: ${interaction.user.tag}`);

        const newCase = await createCase({
            guildId:      guild.id,
            type:         'mute',
            userId:       targetUser.id,
            userTag:      targetUser.tag,
            moderatorId:  interaction.user.id,
            moderatorTag: interaction.user.tag,
            reason,
            duration,
            expiresAt,
        });

        const dmSent = await dmUser(targetUser, guild, 'mute', reason, newCase.caseNumber, duration);

        // Send full case info to mod log
        await sendLog({
            guild,
            category: 'mod',
            event:    'memberTimeout',
            color:    LogColour.MOD,
            title:    `${e('mute')} Member Muted`,
            fields: [
                { name: 'User',      value: `<@${targetUser.id}> (${targetUser.tag})` },
                { name: 'Moderator', value: `<@${interaction.user.id}>` },
                { name: 'Duration',  value: `\`${formatDuration(duration)}\`` },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${targetUser.id}`,
        });

        // Short aesthetic response
        const card = new FadeContainer(Colours.SUCCESS)
            .text(
                `${e('success')}  Muted <@${targetUser.id}> · \`${formatDuration(duration)}\`` +
                `\n-# Case \`#${newCase.caseNumber}\`` +
                (dmSent === false ? ` · Could not DM user` : '')
            )
            .build();

        const invoke = await getInvokeResponse(guild.id, 'mute', {
            user: `<@${targetUser.id}>`, reason,
            moderator: `<@${interaction.user.id}>`, server: guild.name, caseNum: newCase.caseNumber,
        });
        if (invoke.dmMessage) await targetUser.send({ content: invoke.dmMessage }).catch(() => null);

        await interaction.reply({
            ...(fadeReply([invoke.message ? new FadeContainer(Colours.SUCCESS).text(invoke.message).build() : card], false) as any),
            allowedMentions: { parse: [] },
        } as any);
    },

    async prefixExecute(message, args, client) {
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const target = targetId ? await message.guild!.members.fetch(targetId).catch(() => null) : null;

        if (!target) { await message.reply(`${e('error')} Please mention a member.`); return; }
        if (!await hasPermission(message.member!, 'moderate_members')) {
            await message.reply(`${e('error')} You don't have permission to mute members.`); return;
        }

        const botMember = message.guild!.members.me;
        if (!botMember?.permissions.has(PermissionFlagsBits.ModerateMembers)) {
            await message.reply(`${e('error')} I need the \'Moderate Members\' permission to mute members.`);
            return;
        }

        const durationStr = args[1];
        const duration    = durationStr ? parseDuration(durationStr) : null;
        if (!duration) { await message.reply(`${e('error')} Please provide a duration. Example: \`10m\`, \`1h\``); return; }
        if (duration > MAX_TIMEOUT) { await message.reply(`${e('error')} Maximum timeout duration is 28 days.`); return; }

        const reason = args.slice(2).join(' ') || 'No reason provided';
        const check  = canModerate(message.member!, target, 'mute');
        if (!check.ok) { await message.reply(`${e('error')} ${check.reason}`); return; }

        const expiresAt = new Date(Date.now() + duration * 1000);
        try {
            await target.timeout(duration * 1000, `[Fade] ${reason} | Moderator: ${message.author.tag}`);
        } catch {
            await message.reply(`${e('error')} I couldn't mute that member. Check my role position and permissions.`);
            return;
        }

        const newCase = await createCase({
            guildId: message.guild!.id, type: 'mute',
            userId: target.id, userTag: target.user.tag,
            moderatorId: message.author.id, moderatorTag: message.author.tag,
            reason, duration, expiresAt,
        });

        const dmSent = await dmUser(target.user, message.guild!, 'mute', reason, newCase.caseNumber, duration);

        // Send full case info to mod log
        await sendLog({
            guild: message.guild!,
            category: 'mod',
            event:    'memberTimeout',
            color:    LogColour.MOD,
            title:    `${e('mute')} Member Muted`,
            fields: [
                { name: 'User',      value: `<@${target.id}> (${target.user.tag})` },
                { name: 'Moderator', value: `<@${message.author.id}>` },
                { name: 'Duration',  value: `\`${formatDuration(duration)}\`` },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${target.id}`,
        });

        const shortCard = new FadeContainer(Colours.SUCCESS)
            .text(
                `${e('success')}  Muted <@${target.id}> · \`${formatDuration(duration)}\`` +
                `\n-# Case \`#${newCase.caseNumber}\`` +
                (dmSent === false ? ` · Could not DM user` : '')
            )
            .build();
        await sendMessage(message, [shortCard]);
    },
} satisfies Command;