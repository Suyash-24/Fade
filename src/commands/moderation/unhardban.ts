// src/commands/moderation/unhardban.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { fadeReply, sendMessage, FadeContainer } from '../../components/builders.js';
import { createCase } from '../../db/queries/moderation.js';
import { removeHardban, isHardbanned } from '../../db/queries/hardbans.js';
import { e, Colours } from '../../components/emojis.js';
import { sendLog, LogColour } from '../../utils/logsender.js';
import { hasPermission } from '../../utils/fakePerms.js';

export default {
    data: new SlashCommandBuilder()
        .setName('unhardban')
        .setDescription('Remove a user from the hardban blacklist and unban them')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
        .addStringOption(o => o.setName('user_id').setDescription('The user ID to unhardban').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

    category: 'moderation', guildOnly: true,
    userPermissions: [PermissionFlagsBits.Administrator, PermissionFlagsBits.BanMembers],
    botPermissions:  [PermissionFlagsBits.BanMembers],
    cooldown: 5,

    async execute(interaction, client) {
        const userId = interaction.options.getString('user_id', true);
        const reason = interaction.options.getString('reason') ?? 'No reason provided';
        const guild  = interaction.guild!;

        if (!(await isHardbanned(guild.id, userId))) {
            await interaction.reply({ content: `${e('error')} This user is not on the hardban list.`, flags: MessageFlags.Ephemeral });
            return;
        }

        // Remove from blacklist
        await removeHardban(guild.id, userId);

        // Try to unban them from discord
        const ban = await guild.bans.fetch(userId).catch(() => null);
        if (ban) {
            await guild.bans.remove(userId, `[Fade Unhardban] ${reason} | Moderator: ${interaction.user.tag}`);
        }

        const newCase = await createCase({
            guildId: guild.id, type: 'unban',
            userId, userTag: ban ? ban.user.tag : 'Unknown User',
            moderatorId: interaction.user.id, moderatorTag: interaction.user.tag,
            reason: `[Unhardban] ${reason}`,
        });

        await sendLog({
            guild,
            category: 'mod',
            event:    'memberUnban',
            color:    LogColour.CREATE,
            title:    `${e('unlock')} Member Unhardbanned`,
            fields: [
                { name: 'User',      value: `<@${userId}>` },
                { name: 'Moderator', value: `<@${interaction.user.id}>` },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${userId}`,
        });

        const card = new FadeContainer(Colours.SUCCESS)
            .text(
                `${e('unlock')}  Unhardbanned <@${userId}>` +
                `\n-# Case \`#${newCase.caseNumber}\``
            )
            .build();

        await interaction.reply({
            ...(fadeReply([card], false) as any),
            allowedMentions: { parse: [] },
        } as any);
    },

    async prefixExecute(message, args, client) {
        const userId = args[0];
        if (!userId) { await message.reply(`${e('error')} Please provide a user ID.`); return; }
        if (!await hasPermission(message.member!, 'administrator')) {
            await message.reply(`${e('error')} You don't have permission to unhardban members.`); return;
        }

        if (!(await isHardbanned(message.guild!.id, userId))) {
            await message.reply(`${e('error')} This user is not on the hardban list.`); return;
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';
        
        await removeHardban(message.guild!.id, userId);
        const ban = await message.guild!.bans.fetch(userId).catch(() => null);
        if (ban) {
            await message.guild!.bans.remove(userId, `[Fade Unhardban] ${reason}`);
        }

        const newCase = await createCase({
            guildId: message.guild!.id, type: 'unban',
            userId, userTag: ban ? ban.user.tag : 'Unknown User',
            moderatorId: message.author.id, moderatorTag: message.author.tag, reason: `[Unhardban] ${reason}`,
        });

        await sendLog({
            guild: message.guild!,
            category: 'mod',
            event:    'memberUnban',
            color:    LogColour.CREATE,
            title:    `${e('unlock')} Member Unhardbanned`,
            fields: [
                { name: 'User',      value: `<@${userId}>` },
                { name: 'Moderator', value: `<@${message.author.id}>` },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${userId}`,
        });

        const card = new FadeContainer(Colours.SUCCESS)
            .text(
                `${e('unlock')}  Unhardbanned <@${userId}>` +
                `\n-# Case \`#${newCase.caseNumber}\``
            )
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;
