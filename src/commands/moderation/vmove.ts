// src/commands/moderation/vmove.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, GuildMember, ChannelType, VoiceChannel, StageChannel } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendResponse, sendMessage, FadeContainer } from '../../components/builders.js';
import { canModerate } from '../../utils/moderation.js';
import { e, Colours } from '../../components/emojis.js';
import { createCase } from '../../db/queries/moderation.js';
import { sendLog, LogColour } from '../../utils/logsender.js';

export default {
    data: { name: 'vmove', description: 'Move a user or all members from one voice channel to another' },
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

        if (args.length < 2) {
            await message.reply(`${e('error')} **Usage:** \`!vmove <@user | #source_channel> <#destination_channel>\``);
            return;
        }

        const guild = message.guild!;
        const moderator = message.member!;

        // The LAST argument should be the destination channel
        const destArg = args[args.length - 1].replace(/[<#>]/g, '');
        const destChannel = await guild.channels.fetch(destArg).catch(() => null);

        if (!destChannel || (destChannel.type !== ChannelType.GuildVoice && destChannel.type !== ChannelType.GuildStageVoice)) {
            await message.reply(`${e('error')} Please mention a valid destination voice channel as the last argument.`);
            return;
        }

        // The first argument is either a user or a source channel
        const targetArg = args[0].replace(/[<@!#>]/g, '');
        const targetMember = await guild.members.fetch(targetArg).catch(() => null);
        const sourceChannel = await guild.channels.fetch(targetArg).catch(() => null);

        if (!targetMember && (!sourceChannel || (sourceChannel.type !== ChannelType.GuildVoice && sourceChannel.type !== ChannelType.GuildStageVoice))) {
            await message.reply(`${e('error')} The first argument must be a valid user or voice channel.`);
            return;
        }

        // 1. Moving a single user
        if (targetMember) {
            if (!targetMember.voice.channelId) {
                await message.reply(`${e('error')} That user is not currently in a voice channel.`);
                return;
            }

            if (targetMember.voice.channelId === destChannel.id) {
                await message.reply(`${e('error')} That user is already in the destination channel.`);
                return;
            }

            const check = canModerate(moderator, targetMember, 'vmove');
            if (!check.ok) {
                await message.reply(`${e('error')} ${check.reason}`);
                return;
            }

            try {
                await targetMember.voice.setChannel(destChannel as VoiceChannel, `Moved by ${message.author.tag}`);
                
                const newCase = await createCase({
                    guildId:      guild.id,
                    type:         'vmove',
                    userId:       targetMember.id,
                    userTag:      targetMember.user.tag,
                    moderatorId:  moderator.id,
                    moderatorTag: message.author.tag,
                    reason:       'No reason provided',
                });

                await sendLog({
                    guild,
                    category: 'mod',
                    event:    'memberVoiceMove',
                    color:    LogColour.MOD,
                    title:    `${e('voice')} Member Voice Moved`,
                    fields: [
                        { name: 'User',      value: `<@${targetMember.id}> (${targetMember.user.tag})` },
                        { name: 'Moderator', value: `<@${moderator.id}>` },
                        { name: 'Destination', value: `<#${destChannel.id}>` },
                        { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
                    ],
                    footer: `ID: ${targetMember.id}`,
                });

                const c = new FadeContainer(Colours.SUCCESS)
                    .text(`### 🎙️ Voice Move`)
                    .text(`**Target:** <@${targetMember.id}>\n**Moved To:** <#${destChannel.id}>\n**Moderator:** <@${moderator.id}>`)
                    .build();
                await sendMessage(message, [c]);
            } catch (error) {
                await message.reply(`${e('error')} Failed to move the user. Check my permissions or channel limits.`);
            }
            return;
        }

        // 2. Moving an entire channel
        if (sourceChannel) {
            if (sourceChannel.id === destChannel.id) {
                await message.reply(`${e('error')} Source and destination channels cannot be the same.`);
                return;
            }

            const fetchedSource = sourceChannel as VoiceChannel | StageChannel;
            const membersToMove = fetchedSource.members;

            if (membersToMove.size === 0) {
                await message.reply(`${e('error')} There is no one in <#${sourceChannel.id}> to move.`);
                return;
            }

            let movedCount = 0;
            let failedCount = 0;

            for (const [memberId, member] of membersToMove) {
                const check = canModerate(moderator, member, 'vmove');
                if (!check.ok) {
                    failedCount++;
                    continue;
                }
                try {
                    await member.voice.setChannel(destChannel as VoiceChannel, `Mass moved by ${message.author.tag}`);
                    movedCount++;
                } catch {
                    failedCount++;
                }
            }

            const c = new FadeContainer(Colours.SUCCESS)
                .text(`### 🎙️ Mass Voice Move`)
                .text(`**Source:** <#${sourceChannel.id}>\n**Destination:** <#${destChannel.id}>\n**Moved:** \`${movedCount}\` members\n**Failed:** \`${failedCount}\` members\n**Moderator:** <@${moderator.id}>`)
                .build();
            await sendMessage(message, [c]);

            if (movedCount > 0) {
                await sendLog({
                    guild,
                    category: 'mod',
                    event:    'memberVoiceMove',
                    color:    LogColour.MOD,
                    title:    `${e('voice')} Mass Voice Move`,
                    fields: [
                        { name: 'Moderator', value: `<@${moderator.id}>` },
                        { name: 'Source', value: `<#${sourceChannel.id}>` },
                        { name: 'Destination', value: `<#${destChannel.id}>` },
                        { name: 'Moved', value: `${movedCount} members` },
                    ],
                    footer: `ID: ${moderator.id}`,
                });
            }
        }
    },
} as Command;
