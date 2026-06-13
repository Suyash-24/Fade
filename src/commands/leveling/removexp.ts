// src/commands/leveling/removexp.ts
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { getUserLevel, setXp } from '../../db/queries/leveling.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('removexp')
        .setDescription('Remove XP from a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(o => o.setName('amount').setDescription('XP amount to remove').setMinValue(1).setRequired(true)),

    category:        'leveling',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        3,

    async execute(interaction, client) {
        const target  = interaction.options.getUser('user', true);
        const amount  = interaction.options.getInteger('amount', true);
        const row     = await getUserLevel(interaction.guild!.id, target.id);
        const newXp   = Math.max(0, row.xp - amount);
        await setXp(interaction.guild!.id, target.id, newXp);

        const card = new FadeContainer(Colours.WARNING)
            .text(`${e('success')}  Removed \`${amount} XP\` from **${target.username}**\n-# Remaining: \`${newXp.toLocaleString()} XP\``)
            .build();
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const target = targetId ? await client.users.fetch(targetId).catch(() => null) : null;
        const amount = parseInt(args[1] ?? args[0]);
        if (!target || isNaN(amount)) { await message.reply(`${e('error')} Usage: \`f!removexp @user <amount>\``); return; }
        if (!message.member!.permissions.has(PermissionFlagsBits.ManageGuild)) {
            await message.reply(`${e('error')} You need Manage Server permission.`); return;
        }
        const row   = await getUserLevel(message.guild!.id, target.id);
        const newXp = Math.max(0, row.xp - amount);
        await setXp(message.guild!.id, target.id, newXp);
        const card = new FadeContainer(Colours.WARNING)
            .text(`${e('success')}  Removed \`${amount} XP\` from **${target.username}** · Remaining: \`${newXp.toLocaleString()}\``)
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;