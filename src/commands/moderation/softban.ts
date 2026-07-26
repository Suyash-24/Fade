import { PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { fadeReply, sendMessage, FadeContainer } from '../../components/builders.js';
import { canModerate, dmUser } from '../../utils/moderation.js';
import { createCase } from '../../db/queries/moderation.js';
import { e, Colours } from '../../components/emojis.js';
import { sendLog, LogColour } from '../../utils/logsender.js';
import { hasPermission } from '../../utils/fakePerms.js';
import { getInvokeResponse } from '../../db/queries/invokeMessages.js';

async function isAlreadyBanned(guild: any, userId: string) {
    return guild.bans.fetch(userId).then(() => true).catch(() => false);
}

export default {
    data: { name: 'softban', description: 'Instantly ban and unban a member to wipe their recent messages' },
    prefixOnly:      true,

    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.BanMembers],
    botPermissions:  [PermissionFlagsBits.BanMembers],
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
            await message.reply(`${e('error')} That user is already banned, so they cannot be softbanned.`);
            return;
        }

        // Send a DM before kicking/banning them so they get it
        const dmSent = await dmUser(target, guild, 'softban', reason, 0);

        try {
            // Ban with 7 days of message deletion
            await guild.members.ban(target.id, {
                deleteMessageSeconds: 604800, // 7 days
                reason: `[Fade Softban] ${reason} | Moderator: ${message.author.tag}`,
            });

            // Immediately unban
            await guild.members.unban(target.id, `[Fade Softban Release] Moderator: ${message.author.tag}`);
        } catch (err) {
            await message.reply(`${e('error')} Failed to softban the user. Check my permissions and role hierarchy.`);
            return;
        }

        const newCase = await createCase({
            guildId:      guild.id,
            type:         'softban',
            userId:       target.id,
            userTag:      target.tag,
            moderatorId:  message.author.id,
            moderatorTag: message.author.tag,
            reason,
        });

        await sendLog({
            guild: message.guild!,
            category: 'mod',
            event:    'memberBan', // Using standard ban log channel/event
            color:    LogColour.MOD,
            title:    `${e('ban')} Member Softbanned`,
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
                `${e('ban')} Softbanned <@${target.id}>` +
                `\n-# Case \`#${newCase.caseNumber}\`` +
                (dmSent === false ? ` · Could not DM user` : '')
            )
            .build();

        // Invoke message override
        const invoke = await getInvokeResponse(guild.id, 'softban', {
            user:      `<@${target.id}>`,
            reason,
            moderator: `<@${message.author.id}>`,
            server:    guild.name,
            caseNum:   newCase.caseNumber,
        });

        if (invoke.dmMessage) await target.send({ content: invoke.dmMessage }).catch(() => null);

        await sendMessage(message, [invoke.message ? new FadeContainer(Colours.DANGER).text(invoke.message).build() : card]);
    },
} as Command;
