// src/commands/moderation/nickname.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendMessage, FadeContainer, fadeReply } from '../../components/builders.js';
import { canModerate } from '../../utils/moderation.js';
import { e, Colours } from '../../components/emojis.js';
import { hasPermission } from '../../utils/fakePerms.js';

export default {
    data: new SlashCommandBuilder()
        .setName('nickname')
        .setDescription('Change or reset a member\'s nickname')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageNicknames)
        .addSubcommand(sub => sub
            .setName('set')
            .setDescription('Set a new nickname for a member')
            .addUserOption(o => o
                .setName('user')
                .setDescription('The member to modify')
                .setRequired(true)
            )
            .addStringOption(o => o
                .setName('nickname')
                .setDescription('The new nickname (leave empty to reset)')
                .setRequired(false)
                .setMaxLength(32)
            )
        )
        .addSubcommand(sub => sub
            .setName('reset')
            .setDescription('Reset a member\'s nickname')
            .addUserOption(o => o
                .setName('user')
                .setDescription('The member to modify')
                .setRequired(true)
            )
        ),

    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageNicknames],
    botPermissions:  [PermissionFlagsBits.ManageNicknames],
    cooldown:        3,

    async execute(interaction, client) {
        await interaction.deferReply();
        const sub = interaction.options.getSubcommand();
        const targetUser = interaction.options.getUser('user', true);
        const guild = interaction.guild!;
        const moderator = interaction.member as any;

        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);
        if (!targetMember) {
            await interaction.editReply({ content: `${e('error')} Could not find that member in the server.` });
            return;
        }

        const check = canModerate(moderator, targetMember, 'manage_nicknames');
        if (!check.ok) {
            await interaction.editReply({ content: `${e('error')} ${check.reason}` });
            return;
        }

        const newNick = sub === 'reset' ? null : interaction.options.getString('nickname');

        try {
            await targetMember.setNickname(newNick, `Requested by ${interaction.user.tag}`);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} Successfully ${newNick ? `changed nickname to **${newNick}**` : 'reset nickname'} for <@${targetUser.id}>`)
                .build();
            await interaction.editReply({
                ...(fadeReply([card], false) as any),
                allowedMentions: { parse: [] },
            });
        } catch (error) {
            await interaction.editReply({ content: `${e('error')} I don't have permission to change that member's nickname (they might have higher roles than me).` });
        }
    },

    async prefixExecute(message, args, client) {
        if (!args[0]) {
            await message.reply(`${e('error')} Usage: \`f!nickname <@user> [new name]\` or \`f!nickname reset <@user>\``);
            return;
        }

        let actualTarget: any = null;
        let actualNick: string | null = null;

        if (args[0].toLowerCase() === 'reset') {
            const targetId = args[1]?.replace(/[<@!>]/g, '');
            actualTarget = targetId ? await message.guild?.members.fetch(targetId).catch(() => null) : null;
            if (!actualTarget) {
                await message.reply(`${e('error')} Please mention a user to reset their nickname.`);
                return;
            }
        } else {
            const targetId = args[0].replace(/[<@!>]/g, '');
            actualTarget = await message.guild?.members.fetch(targetId).catch(() => null);
            if (!actualTarget) {
                await message.reply(`${e('error')} Please mention a valid user.`);
                return;
            }
            actualNick = args.slice(1).join(' ');
            if (!actualNick || actualNick.trim() === '' || actualNick.toLowerCase() === 'reset') {
                actualNick = null;
            }
        }

        const moderator = message.member!;
        if (!await hasPermission(moderator, 'manage_nicknames')) {
            await message.reply(`${e('error')} You don't have permission to manage nicknames.`);
            return;
        }

        const check = canModerate(moderator, actualTarget, 'manage_nicknames');
        if (!check.ok) {
            await message.reply(`${e('error')} ${check.reason}`);
            return;
        }

        if (actualNick && actualNick.length > 32) {
            await message.reply(`${e('error')} Nicknames cannot exceed 32 characters.`);
            return;
        }

        try {
            await actualTarget.setNickname(actualNick, `Requested by ${message.author.tag}`);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} Successfully ${actualNick ? `changed nickname to **${actualNick}**` : 'reset nickname'} for <@${actualTarget.id}>`)
                .build();
            await sendMessage(message, [card]);
        } catch (error) {
            await message.reply(`${e('error')} I don't have permission to change that member's nickname.`);
        }
    },
} satisfies Command;
