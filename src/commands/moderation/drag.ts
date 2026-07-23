// src/commands/moderation/drag.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, GuildMember } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendResponse, sendMessage, FadeContainer } from '../../components/builders.js';
import { canModerate } from '../../utils/moderation.js';
import { e, Colours } from '../../components/emojis.js';
import { createCase } from '../../db/queries/moderation.js';
import { sendLog, LogColour } from '../../utils/logsender.js';
import { hasPermission } from '../../utils/fakePerms.js';

export default {
    data: { name: 'drag', description: 'Drag a member into your current voice channel' },
    prefixOnly:      true,

    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.MoveMembers],
    botPermissions:  [PermissionFlagsBits.MoveMembers],
    cooldown:        3,



    async prefixExecute(message, args, client) {
        const hasPerm = message.member!.permissions.has(PermissionFlagsBits.MoveMembers);
        if (!hasPerm) {
            const missing = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} You are missing the \`MoveMembers\` permission to run this command.`)
                .build();
            await sendMessage(message, [missing]);
            return;
        }

        if (!args[0]) {
            await message.reply(`${e('error')} Please specify a member to drag.`);
            return;
        }

        const guild        = message.guild!;
        const moderator    = message.member!;
        let targetMember: GuildMember | null = null;

        if (message.mentions.members?.size) {
            targetMember = message.mentions.members.first() || null;
        } else {
            const match = args[0].replace(/[<@!>]/g, '');
            targetMember = await guild.members.fetch(match).catch(() => null);
        }

        if (!targetMember) {
            await message.reply(`${e('error')} That user is not in this server.`);
            return;
        }

        if (!moderator.voice.channelId) {
            await message.reply(`${e('error')} You must be in a voice channel to drag someone.`);
            return;
        }

        if (!targetMember.voice.channelId) {
            await message.reply(`${e('error')} That user is not currently in a voice channel.`);
            return;
        }

        if (moderator.voice.channelId === targetMember.voice.channelId) {
            await message.reply(`${e('error')} That user is already in your voice channel.`);
            return;
        }

        const check = canModerate(moderator, targetMember, 'drag');
        if (!check.ok) {
            await message.reply(`${e('error')} ${check.reason}`);
            return;
        }

        try {
            await targetMember.voice.setChannel(moderator.voice.channelId, `Dragged by ${message.author.tag}`);
            
            const newCase = await createCase({
                guildId:      guild.id,
                type:         'drag',
                userId:       targetMember.id,
                userTag:      targetMember.user.tag,
                moderatorId:  moderator.id,
                moderatorTag: message.author.tag,
                reason:       'No reason provided',
            });

            await sendLog({
                guild,
                category: 'mod',
                event:    'memberVoiceDrag',
                color:    LogColour.MOD,
                title:    `${e('voice')} Member Voice Dragged`,
                fields: [
                    { name: 'User',      value: `<@${targetMember.id}> (${targetMember.user.tag})` },
                    { name: 'Moderator', value: `<@${moderator.id}>` },
                    { name: 'Destination', value: `<#${moderator.voice.channelId}>` },
                    { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
                ],
                footer: `ID: ${targetMember.id}`,
            });

            const c = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} Successfully dragged <@${targetMember.id}> to <#${moderator.voice.channelId}>.`)
                .build();
            await sendMessage(message, [c]);
        } catch (error) {
            const c = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} Failed to drag the user. Check my permissions or channel limits.`)
                .build();
            await sendMessage(message, [c]);
        }
    },
} as Command;
