import { PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { fadeReply, sendMessage, FadeContainer } from '../../components/builders.js';
import { canModerate, dmUser } from '../../utils/moderation.js';
import { createCase } from '../../db/queries/moderation.js';
import { e, Colours } from '../../components/emojis.js';
import { sendLog, LogColour } from '../../utils/logsender.js';
import { hasPermission } from '../../utils/fakePerms.js';
import { getInvokeResponse } from '../../db/queries/invokeMessages.js';

const staffPermissions = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.ManageGuild,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.ManageMessages,
    PermissionFlagsBits.KickMembers,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.ModerateMembers,
];

export default {
    data: { name: 'stripstaff', description: 'Remove all staff/moderation roles from a member' },
    prefixOnly:      true,

    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageRoles],
    botPermissions:  [PermissionFlagsBits.ManageRoles],
    cooldown:        5,

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

        if (!await hasPermission(moderator, 'manage_roles')) {
            await message.reply(`${e('error')} You don't have permission to manage roles.`);
            return;
        }

        if (!targetMember) {
            await message.reply(`${e('error')} That user is not in the server.`);
            return;
        }

        const check = canModerate(moderator, targetMember, 'manage_roles');
        if (!check.ok) {
            await message.reply(`${e('error')} ${check.reason}`);
            return;
        }

        const botHighest = guild.members.me!.roles.highest.position;
        const rolesToRemove: string[] = [];

        for (const [roleId, role] of targetMember.roles.cache) {
            if (roleId === guild.id) continue; // Skip @everyone

            // Check if the role grants any staff permissions
            const hasStaffPerm = staffPermissions.some(perm => role.permissions.has(perm));
            
            if (hasStaffPerm) {
                if (role.position < botHighest) {
                    rolesToRemove.push(roleId);
                }
            }
        }

        if (rolesToRemove.length === 0) {
            const noRoles = new FadeContainer(Colours.INFO)
                .text(`${e('shield')} <@${target.id}> has no removable staff roles.`)
                .build();
            return await sendMessage(message, [noRoles]);
        }

        const dmSent = await dmUser(target, guild, 'stripstaff', reason, 0);

        try {
            await targetMember.roles.remove(rolesToRemove, `[Fade Stripstaff] ${reason} | Moderator: ${message.author.tag}`);
        } catch (err) {
            await message.reply(`${e('error')} Failed to strip staff roles. Check my permissions and role hierarchy.`);
            return;
        }

        const newCase = await createCase({
            guildId:      guild.id,
            type:         'stripstaff',
            userId:       target.id,
            userTag:      target.tag,
            moderatorId:  message.author.id,
            moderatorTag: message.author.tag,
            reason,
        });

        await sendLog({
            guild,
            category: 'mod',
            event:    'memberRoleUpdate',
            color:    LogColour.MOD,
            title:    `${e('shield')} Member Staff Roles Stripped`,
            fields: [
                { name: 'User',      value: `<@${target.id}> (${target.tag})` },
                { name: 'Moderator', value: `<@${message.author.id}>` },
                { name: 'Roles Removed', value: rolesToRemove.map(r => `<@&${r}>`).join(', ') },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${target.id}`,
        });

        const card = new FadeContainer(Colours.SUCCESS)
            .text(
                `${e('success')} Stripped \`${rolesToRemove.length}\` staff roles from <@${target.id}>` +
                `\n-# Case \`#${newCase.caseNumber}\`` +
                (dmSent === false ? ` · Could not DM user` : '')
            )
            .build();

        // Invoke message override
        const invoke = await getInvokeResponse(guild.id, 'strip', {
            user:      `<@${target.id}>`,
            reason,
            moderator: `<@${message.author.id}>`,
            server:    guild.name,
            caseNum:   newCase.caseNumber,
        });

        if (invoke.dmMessage) await target.send({ content: invoke.dmMessage }).catch(() => null);

        await sendMessage(message, [invoke.message ? new FadeContainer(Colours.SUCCESS).text(invoke.message).build() : card]);
    },
    syntax: "f!stripstaff",
    example: "f!stripstaff"
} as Command;
