// src/commands/moderation/hardban.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { fadeReply, sendMessage, FadeContainer } from '../../components/builders.js';
import { canModerate, dmUser } from '../../utils/moderation.js';
import { createCase } from '../../db/queries/moderation.js';
import { addHardban, isHardbanned } from '../../db/queries/hardbans.js';
import { e, Colours } from '../../components/emojis.js';
import { sendLog, LogColour } from '../../utils/logsender.js';
import { hasPermission } from '../../utils/fakePerms.js';
import { getInvokeResponse } from '../../db/queries/invokeMessages.js';

export default {
    data: new SlashCommandBuilder()
        .setName('hardban')
        .setDescription('Permanently ban and blacklist a user (cannot be unbanned except via unhardban)')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator) // High permission required
        .addUserOption(o => o
            .setName('user')
            .setDescription('The user to hardban')
            .setRequired(true)
        )
        .addStringOption(o => o
            .setName('reason')
            .setDescription('Reason for the hardban')
            .setRequired(false)
        )
        .addIntegerOption(o => o
            .setName('delete_messages')
            .setDescription('Delete message history (days)')
            .setMinValue(0)
            .setMaxValue(7)
            .setRequired(false)
        ),

    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.Administrator, PermissionFlagsBits.BanMembers],
    botPermissions:  [PermissionFlagsBits.BanMembers],
    cooldown:        10,

    async execute(interaction, client) {
        await interaction.deferReply();

        const targetUser  = interaction.options.getUser('user', true);
        const reason      = interaction.options.getString('reason') ?? 'No reason provided';
        const deleteDays  = interaction.options.getInteger('delete_messages') ?? 7;
        const guild       = interaction.guild!;
        const moderator   = interaction.member as any;

        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (targetMember) {
            const check = canModerate(moderator, targetMember, 'ban');
            if (!check.ok) {
                await interaction.editReply({ content: `${e('error')} ${check.reason}` });
                return;
            }
        }

        if (await isHardbanned(guild.id, targetUser.id)) {
            await interaction.editReply({ content: `${e('error')} This user is already hardbanned.` });
            return;
        }

        // Add to hardban blacklist
        await addHardban(guild.id, targetUser.id, moderator.id, reason);

        // Try to DM
        let dmStatus = '`DMs Disabled`';
        if (targetMember) {
            const dmSuccess = await dmUser(targetUser, guild, 'ban', reason, 0);
            if (dmSuccess) dmStatus = '`DMs Sent`';
        }

        // Ban
        await guild.bans.create(targetUser.id, {
            reason: `[Fade Hardban] ${reason} | Moderator: ${interaction.user.tag}`,
            deleteMessageSeconds: deleteDays * 24 * 60 * 60,
        }).catch(async (err) => {
            // Even if banning fails (maybe they deleted their account), they are in the hardban DB
        });

        const newCase = await createCase({
            guildId: guild.id, type: 'ban',
            userId: targetUser.id, userTag: targetUser.tag,
            moderatorId: interaction.user.id, moderatorTag: interaction.user.tag,
            reason: `[Hardban] ${reason}`,
        });

        await sendLog({
            guild,
            category: 'mod',
            event:    'memberBanAdd',
            color:    LogColour.MOD,
            title:    `${e('ban')} Member Hardbanned`,
            fields: [
                { name: 'User',      value: `<@${targetUser.id}> (${targetUser.tag})` },
                { name: 'Moderator', value: `<@${interaction.user.id}>` },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${targetUser.id}`,
        });

        let responseText = `${e('ban')}  Hardbanned <@${targetUser.id}> | ${dmStatus}\n-# Case \`#${newCase.caseNumber}\``;
        const customMsg = await getInvokeResponse(guild.id, 'ban', {
            user:      `<@${targetUser.id}>`,
            reason,
            moderator: `<@${interaction.user.id}>`,
            server:    guild.name,
            caseNum:   newCase.caseNumber,
        });
        if (customMsg.message) responseText = customMsg.message;

        const card = new FadeContainer(Colours.DANGER).text(responseText).build();
        await interaction.editReply({
            ...(fadeReply([card], false) as any),
            allowedMentions: { parse: [] },
        });
    },

    async prefixExecute(message, args, client) {
        if (!args.length) {
            await message.reply(`${e('error')} Please provide a user to hardban.`);
            return;
        }
        if (!await hasPermission(message.member!, 'administrator')) {
            await message.reply(`${e('error')} You don't have permission to hardban members (Administrator required).`);
            return;
        }

        const match = args[0].match(/^<@!?(\d+)>$/) || args[0].match(/^(\d+)$/);
        const targetId = match ? match[1] : args[0];
        const targetUser = await client.users.fetch(targetId).catch(() => null);

        if (!targetUser) {
            await message.reply(`${e('error')} Could not find that user.`);
            return;
        }

        const reason = args.slice(1).join(' ') || 'No reason provided';
        const guild = message.guild!;
        const targetMember = await guild.members.fetch(targetUser.id).catch(() => null);

        if (targetMember) {
            const check = canModerate(message.member as any, targetMember, 'ban');
            if (!check.ok) {
                await message.reply(`${e('error')} ${check.reason}`);
                return;
            }
        }

        if (await isHardbanned(guild.id, targetUser.id)) {
            await message.reply(`${e('error')} This user is already hardbanned.`);
            return;
        }

        await addHardban(guild.id, targetUser.id, message.author.id, reason);

        let dmStatus = '`DMs Disabled`';
        if (targetMember) {
            const dmSuccess = await dmUser(targetUser, guild, 'ban', reason, 0);
            if (dmSuccess) dmStatus = '`DMs Sent`';
        }

        await guild.bans.create(targetUser.id, {
            reason: `[Fade Hardban] ${reason} | Moderator: ${message.author.tag}`,
            deleteMessageSeconds: 7 * 24 * 60 * 60,
        }).catch(() => null);

        const newCase = await createCase({
            guildId: guild.id, type: 'ban',
            userId: targetUser.id, userTag: targetUser.tag,
            moderatorId: message.author.id, moderatorTag: message.author.tag,
            reason: `[Hardban] ${reason}`,
        });

        await sendLog({
            guild, category: 'mod', event: 'memberBanAdd', color: LogColour.MOD,
            title: `${e('ban')} Member Hardbanned`,
            fields: [
                { name: 'User',      value: `<@${targetUser.id}> (${targetUser.tag})` },
                { name: 'Moderator', value: `<@${message.author.id}>` },
                { name: 'Reason',    value: reason },
                { name: 'Case',      value: `\`#${newCase.caseNumber}\`` },
            ],
            footer: `ID: ${targetUser.id}`,
        });

        let responseText = `${e('ban')}  Hardbanned <@${targetUser.id}> | ${dmStatus}\n-# Case \`#${newCase.caseNumber}\``;
        const customMsg = await getInvokeResponse(guild.id, 'ban', {
            user:      `<@${targetUser.id}>`,
            reason,
            moderator: `<@${message.author.id}>`,
            server:    guild.name,
            caseNum:   newCase.caseNumber,
        });
        if (customMsg.message) responseText = customMsg.message;

        const card = new FadeContainer(Colours.DANGER).text(responseText).build();
        await sendMessage(message, [card]);
    },
} satisfies Command;
