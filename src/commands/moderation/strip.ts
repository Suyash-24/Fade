// src/commands/moderation/strip.ts
// Strip all manageable roles from a member instantly.
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, fadeReply, sendMessage } from '../../components/builders.js';
import { canModerate } from '../../utils/moderation.js';
import { e, Colours } from '../../components/emojis.js';
import { sendLog, LogColour } from '../../utils/logsender.js';
import { hasPermission } from '../../utils/fakePerms.js';
import { createCase } from '../../db/queries/moderation.js';

export default {
    data: new SlashCommandBuilder()
        .setName('strip')
        .setDescription('Remove all roles from a member')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageRoles)
        .addUserOption(o => o
            .setName('user')
            .setDescription('The member to strip roles from')
            .setRequired(true)
        )
        .addStringOption(o => o
            .setName('reason')
            .setDescription('Reason for stripping roles')
            .setRequired(false)
        ),

    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageRoles],
    botPermissions:  [PermissionFlagsBits.ManageRoles],
    cooldown:        5,

    async execute(interaction) {
        await interaction.deferReply();
        const targetUser   = interaction.options.getUser('user', true);
        const reason       = interaction.options.getString('reason') ?? 'No reason provided';
        const guild        = interaction.guild!;
        const moderator    = interaction.member as any;
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            await interaction.editReply(`${e('error')} That user is not in this server.`);
            return;
        }

        const check = canModerate(moderator, targetMember, 'strip');
        if (!check.ok) {
            await interaction.editReply(`${e('error')} ${check.reason}`);
            return;
        }

        // Collect all removable roles (not managed, not @everyone, below bot's highest role)
        const botHighest   = guild.members.me!.roles.highest.position;
        const rolesToRemove = targetMember.roles.cache.filter(r =>
            r.id !== guild.id &&
            !r.managed &&
            r.position < botHighest
        );

        if (!rolesToRemove.size) {
            await interaction.editReply(`${e('error')} That member has no roles I can remove.`);
            return;
        }

        await targetMember.roles.remove([...rolesToRemove.keys()], `[Fade Strip] ${reason} | Moderator: ${interaction.user.tag}`);

        const newCase = await createCase({
            guildId:      guild.id,
            type:         'strip',
            userId:       targetUser.id,
            userTag:      targetUser.tag,
            moderatorId:  interaction.user.id,
            moderatorTag: interaction.user.tag,
            reason,
        });

        await sendLog({
            guild,
            category: 'mod',
            event:    'memberStrip',
            color:    LogColour.MOD,
            title:    `${e('roles')} Roles Stripped`,
            fields: [
                { name: 'User',          value: `<@${targetUser.id}> (${targetUser.tag})` },
                { name: 'Moderator',     value: `<@${interaction.user.id}>` },
                { name: 'Roles Removed', value: `${rolesToRemove.size} roles` },
                { name: 'Reason',        value: reason },
                { name: 'Case',          value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${targetUser.id}`,
        });

        const card = new FadeContainer(Colours.WARNING)
            .text(
                `${e('warn')}  Stripped **${rolesToRemove.size}** roles from <@${targetUser.id}>\n` +
                `-# Case \`#${newCase.caseNumber}\` · ${reason}`
            )
            .build();

        await interaction.editReply({
            ...(fadeReply([card], false) as any),
            allowedMentions: { parse: [] },
        } as any);
    },

    async prefixExecute(message, args) {
        if (!message.guild || !message.member) return;

        if (!await hasPermission(message.member as any, 'manage_roles')) {
            await message.reply(`${e('error')} You need **Manage Roles** permission.`);
            return;
        }

        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const target   = targetId ? await message.guild.members.fetch(targetId).catch(() => null) : null;

        if (!target) {
            await message.reply(`${e('error')} Please mention a member or provide their ID.`);
            return;
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';

        const check = canModerate(message.member as any, target, 'strip');
        if (!check.ok) {
            await message.reply(`${e('error')} ${check.reason}`);
            return;
        }

        const botHighest    = message.guild.members.me!.roles.highest.position;
        const rolesToRemove = target.roles.cache.filter(r =>
            r.id !== message.guild!.id &&
            !r.managed &&
            r.position < botHighest
        );

        if (!rolesToRemove.size) {
            await message.reply(`${e('error')} That member has no roles I can remove.`);
            return;
        }

        await target.roles.remove([...rolesToRemove.keys()], `[Fade Strip] ${reason} | Moderator: ${message.author.tag}`);

        const newCase = await createCase({
            guildId:      message.guild.id,
            type:         'strip',
            userId:       target.id,
            userTag:      target.user.tag,
            moderatorId:  message.author.id,
            moderatorTag: message.author.tag,
            reason,
        });

        await sendLog({
            guild:    message.guild,
            category: 'mod',
            event:    'memberStrip',
            color:    LogColour.MOD,
            title:    `${e('roles')} Roles Stripped`,
            fields: [
                { name: 'User',          value: `<@${target.id}> (${target.user.tag})` },
                { name: 'Moderator',     value: `<@${message.author.id}>` },
                { name: 'Roles Removed', value: `${rolesToRemove.size} roles` },
                { name: 'Reason',        value: reason },
                { name: 'Case',          value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${target.id}`,
        });

        const card = new FadeContainer(Colours.WARNING)
            .text(
                `${e('warn')}  Stripped **${rolesToRemove.size}** roles from <@${target.id}>\n` +
                `-# Case \`#${newCase.caseNumber}\` · ${reason}`
            )
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;
