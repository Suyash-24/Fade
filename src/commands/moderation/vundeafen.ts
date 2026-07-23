// src/commands/moderation/vundeafen.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, GuildMember } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendResponse, sendMessage, FadeContainer } from '../../components/builders.js';
import { canModerate } from '../../utils/moderation.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: { name: 'vundeafen', description: 'Remove server deafen from a member in voice channels' },
    prefixOnly:      true,

    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.DeafenMembers],
    botPermissions:  [PermissionFlagsBits.DeafenMembers],
    cooldown:        3,



    async prefixExecute(message, args, client) {
        const hasPerm = message.member!.permissions.has(PermissionFlagsBits.DeafenMembers);
        if (!hasPerm) {
            const missing = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} You are missing the \`DeafenMembers\` permission to run this command.`)
                .build();
            await sendMessage(message, [missing]);
            return;
        }

        if (!args[0]) {
            await message.reply(`${e('error')} Please specify a member to server undeafen.`);
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

        const check = canModerate(moderator, targetMember, 'vundeafen');
        if (!check.ok) {
            await message.reply(`${e('error')} ${check.reason}`);
            return;
        }

        try {
            await targetMember.voice.setDeaf(false, `Voice undeafened by ${message.author.tag}`);
            
            const c = new FadeContainer(Colours.SUCCESS)
                .text(`### 🎙️ Voice Undeafen`)
                .text(`**Target:** <@${targetMember.id}>\n**Moderator:** <@${moderator.id}>`)
                .build();
            await sendMessage(message, [c]);
        } catch (error) {
            const c = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} Failed to server undeafen the user. They might not be in a voice channel, or my roles are too low.`)
                .build();
            await sendMessage(message, [c]);
        }
    },
} as Command;
