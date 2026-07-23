// src/commands/moderation/drag.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, GuildMember } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendResponse, sendMessage, FadeContainer } from '../../components/builders.js';
import { canModerate } from '../../utils/moderation.js';
import { e, Colours } from '../../components/emojis.js';
import { hasPermission } from '../../utils/fakePerms.js';

export default {
    data: new SlashCommandBuilder()
        .setName('drag')
        .setDescription('Drag a member into your current voice channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.MoveMembers)
        .addUserOption(o => o
            .setName('user')
            .setDescription('The member to drag')
            .setRequired(true)
        ),

    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.MoveMembers],
    botPermissions:  [PermissionFlagsBits.MoveMembers],
    cooldown:        3,

    async execute(interaction, client) {
        const targetUser   = interaction.options.getUser('user', true);
        const guild        = interaction.guild!;
        const moderator    = interaction.member as GuildMember;
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (!targetMember) {
            await interaction.reply({ content: `${e('error')} That user is not in this server.`, flags: MessageFlags.Ephemeral });
            return;
        }

        if (!moderator.voice.channelId) {
            await interaction.reply({ content: `${e('error')} You must be in a voice channel to drag someone.`, flags: MessageFlags.Ephemeral });
            return;
        }

        if (!targetMember.voice.channelId) {
            await interaction.reply({ content: `${e('error')} That user is not currently in a voice channel.`, flags: MessageFlags.Ephemeral });
            return;
        }

        if (moderator.voice.channelId === targetMember.voice.channelId) {
            await interaction.reply({ content: `${e('error')} That user is already in your voice channel.`, flags: MessageFlags.Ephemeral });
            return;
        }

        const check = canModerate(moderator, targetMember, 'drag');
        if (!check.ok) {
            await interaction.reply({ content: `${e('error')} ${check.reason}`, flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply();

        try {
            await targetMember.voice.setChannel(moderator.voice.channelId, `Dragged by ${interaction.user.tag}`);
            
            const c = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} Successfully dragged <@${targetUser.id}> to <#${moderator.voice.channelId}>.`)
                .build();
            await sendResponse(interaction, [c]);
        } catch (error) {
            const c = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} Failed to drag the user. Check my permissions or channel limits.`)
                .build();
            await sendResponse(interaction, [c]);
        }
    },

    async prefixExecute(message, args, client) {
        const hasPerm = await hasPermission(message.member!, 'drag', [PermissionFlagsBits.MoveMembers]);
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
