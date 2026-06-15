// src/commands/moderation/fakeban.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { fadeReply, sendMessage, FadeContainer } from '../../components/builders.js';
import { canModerate } from '../../utils/moderation.js';
import { e, Colours } from '../../components/emojis.js';
import { hasPermission } from '../../utils/fakePerms.js';

export default {
    data: new SlashCommandBuilder()
        .setName('fakeban')
        .setDescription('Pretend to ban a member from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addUserOption(o => o
            .setName('user')
            .setDescription('The user to fake-ban')
            .setRequired(true)
        )
        .addStringOption(o => o
            .setName('reason')
            .setDescription('Reason for the fake ban')
            .setRequired(false)
        ),

    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.BanMembers],
    botPermissions:  [PermissionFlagsBits.BanMembers],
    cooldown:        3,

    async execute(interaction, client) {
        const targetUser  = interaction.options.getUser('user', true);
        const guild       = interaction.guild!;
        const moderator   = interaction.member as any;

        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (targetMember) {
            const check = canModerate(moderator, targetMember, 'ban');
            if (!check.ok) {
                await interaction.reply({ content: `${e('error')} ${check.reason}`, flags: MessageFlags.Ephemeral });
                return;
            }
        }

        const fakeCaseNum = Math.floor(Math.random() * 8999) + 1000;

        const card = new FadeContainer(Colours.DANGER)
            .text(
                `${e('ban')}  Banned <@${targetUser.id}>` +
                `\n-# Case \`#${fakeCaseNum}\``
            )
            .build();

        await interaction.reply({
            ...(fadeReply([card], false) as any),
            allowedMentions: { parse: [] },
        } as any);
    },

    async prefixExecute(message, args, client) {
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const target = targetId ? await client.users.fetch(targetId).catch(() => null) : null;

        if (!target) {
            await message.reply(`${e('error')} Please mention a user or provide their ID.`);
            return;
        }

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

        const fakeCaseNum = Math.floor(Math.random() * 8999) + 1000;

        const card = new FadeContainer(Colours.DANGER)
            .text(
                `${e('ban')}  Banned <@${target.id}>` +
                `\n-# Case \`#${fakeCaseNum}\``
            )
            .build();
            
        await sendMessage(message, [card]);
    },
} satisfies Command;
