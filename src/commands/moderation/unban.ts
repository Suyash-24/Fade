// src/commands/moderation/unban.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { fadeReply, sendMessage, FadeContainer } from '../../components/builders.js';
import { createCase } from '../../db/queries/moderation.js';
import { e, Colours } from '../../components/emojis.js';
import { sendLog, LogColour } from '../../utils/logsender.js';
import { hasPermission } from '../../utils/fakePerms.js';

export default {
    data: new SlashCommandBuilder()
        .setName('unban')
        .setDescription('Unban a user from the server')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(o => o.setName('user_id').setDescription('The user ID to unban').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('Reason').setRequired(false)),

    category: 'moderation', guildOnly: true,
    userPermissions: [PermissionFlagsBits.BanMembers],
    botPermissions:  [PermissionFlagsBits.BanMembers],
    cooldown: 5,

    async execute(interaction, client) {
        const userId = interaction.options.getString('user_id', true);
        const reason = interaction.options.getString('reason') ?? 'No reason provided';
        const guild  = interaction.guild!;

        // Verify they're actually banned
        const ban = await guild.bans.fetch(userId).catch(() => null);
        if (!ban) {
            await interaction.reply({ content: `${e('error')} That user is not banned.`, flags: MessageFlags.Ephemeral });
            return;
        }

        await guild.bans.remove(userId, `[Fade] ${reason} | Moderator: ${interaction.user.tag}`);

        const newCase = await createCase({
            guildId: guild.id, type: 'unban',
            userId, userTag: ban.user.tag,
            moderatorId: interaction.user.id, moderatorTag: interaction.user.tag,
            reason,
        });

        await sendLog({
            guild,
            category: 'mod',
            event:    'memberUnban',
            color:    LogColour.CREATE,
            title:    `${e('unlock')} Member Unbanned`,
            fields: [
                { name: 'User',      value: `<@${ban.user.id}> (${ban.user.tag})` },
                { name: 'Moderator', value: `<@${interaction.user.id}>` },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${ban.user.id}`,
        });

        const card = new FadeContainer(Colours.SUCCESS)
            .text(
                `${e('unlock')}  Unbanned ${ban.user.tag}` +
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
        if (!await hasPermission(message.member!, 'ban_members')) {
            await message.reply(`${e('error')} You don't have permission to unban members.`); return;
        }

        const ban = await message.guild!.bans.fetch(userId).catch(() => null);
        if (!ban) { await message.reply(`${e('error')} That user is not banned.`); return; }

        const reason = args.slice(1).join(' ') || 'No reason provided';
        await message.guild!.bans.remove(userId, `[Fade] ${reason}`);

        const newCase = await createCase({
            guildId: message.guild!.id, type: 'unban',
            userId, userTag: ban.user.tag,
            moderatorId: message.author.id, moderatorTag: message.author.tag, reason,
        });

        await sendLog({
            guild: message.guild!,
            category: 'mod',
            event:    'memberUnban',
            color:    LogColour.CREATE,
            title:    `${e('unlock')} Member Unbanned`,
            fields: [
                { name: 'User',      value: `<@${ban.user.id}> (${ban.user.tag})` },
                { name: 'Moderator', value: `<@${message.author.id}>` },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${ban.user.id}`,
        });

        const card = new FadeContainer(Colours.SUCCESS)
            .text(
                `${e('unlock')}  Unbanned ${ban.user.tag}` +
                `\n-# Case \`#${newCase.caseNumber}\``
            )
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;