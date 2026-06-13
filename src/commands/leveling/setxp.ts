// src/commands/leveling/setxp.ts
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { setXp, levelFromXp } from '../../db/queries/leveling.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setxp')
        .setDescription('Set a user\'s XP to a specific amount')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(o => o.setName('amount').setDescription('XP amount').setMinValue(0).setRequired(true)),

    category:        'leveling',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        3,

    async execute(interaction, client) {
        const target = interaction.options.getUser('user', true);
        const amount = interaction.options.getInteger('amount', true);
        await setXp(interaction.guild!.id, target.id, amount);
        const level  = levelFromXp(amount);

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`${e('success')}  Set **${target.username}**'s XP to \`${amount.toLocaleString()}\`\n-# Now at Level ${level}`)
            .build();
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const target = targetId ? await client.users.fetch(targetId).catch(() => null) : null;
        const amount = parseInt(args[1] ?? args[0]);
        if (!target || isNaN(amount)) { await message.reply(`${e('error')} Usage: \`f!setxp @user <amount>\``); return; }
        if (!message.member!.permissions.has(PermissionFlagsBits.ManageGuild)) {
            await message.reply(`${e('error')} You need Manage Server permission.`); return;
        }
        await setXp(message.guild!.id, target.id, amount);
        const card = new FadeContainer(Colours.SUCCESS)
            .text(`${e('success')}  Set **${target.username}**'s XP to \`${amount.toLocaleString()}\``)
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;