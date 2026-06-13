// src/commands/moderation/reason.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { getCase, updateCaseReason } from '../../db/queries/moderation.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('reason')
        .setDescription('Update the reason for a moderation case')
        .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
        .addIntegerOption(o => o.setName('case').setDescription('Case number to update').setRequired(true))
        .addStringOption(o => o.setName('reason').setDescription('New reason').setRequired(true)),

    category: 'moderation', guildOnly: true,
    userPermissions: [PermissionFlagsBits.ModerateMembers],
    cooldown: 5,

    async execute(interaction, client) {
        const num    = interaction.options.getInteger('case', true);
        const reason = interaction.options.getString('reason', true);
        const c      = await getCase(interaction.guild!.id, num);

        if (!c) {
            await interaction.reply({ content: `${e('error')} Case #${num} not found.`, flags: MessageFlags.Ephemeral });
            return;
        }

        // Only the original moderator or admins can update
        const isAdmin = (interaction.member as any).permissions.has(PermissionFlagsBits.Administrator);
        if (c.moderatorId !== interaction.user.id && !isAdmin) {
            await interaction.reply({ content: `${e('error')} You can only update cases you created.`, flags: MessageFlags.Ephemeral });
            return;
        }

        await updateCaseReason(interaction.guild!.id, num, reason);

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`${e('success')}  **Case #${num} updated**`)
            .separator(false)
            .text(`**New reason** — ${reason}`)
            .build();

        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const num = parseInt(args[0]);
        if (isNaN(num)) { await message.reply(`${e('error')} Please provide a case number.`); return; }

        const reason = args.slice(1).join(' ');
        if (!reason) { await message.reply(`${e('error')} Please provide a new reason.`); return; }

        const c = await getCase(message.guild!.id, num);
        if (!c) { await message.reply(`${e('error')} Case #${num} not found.`); return; }

        await updateCaseReason(message.guild!.id, num, reason);

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`${e('success')}  **Case #${num} updated**\n**New reason** — ${reason}`)
            .build();

        await sendMessage(message, [card]);
    },
} satisfies Command;