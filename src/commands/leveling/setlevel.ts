// src/commands/leveling/setlevel.ts
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { setLevel, totalXpForLevel } from '../../db/queries/leveling.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('setlevel')
        .setDescription('Set a user\'s level directly')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(o => o.setName('level').setDescription('Level to set').setMinValue(0).setMaxValue(500).setRequired(true)),

    category:        'leveling',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        3,

    async execute(interaction, client) {
        const target = interaction.options.getUser('user', true);
        const level  = interaction.options.getInteger('level', true);
        await setLevel(interaction.guild!.id, target.id, level);
        const xp = totalXpForLevel(level);

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`${e('success')}  Set **${target.username}** to **Level ${level}**\n-# \`${xp.toLocaleString()} total XP\``)
            .build();
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const target = targetId ? await client.users.fetch(targetId).catch(() => null) : null;
        const level  = parseInt(args[1] ?? args[0]);
        if (!target || isNaN(level)) { await message.reply(`${e('error')} Usage: \`f!setlevel @user <level>\``); return; }
        if (!message.member!.permissions.has(PermissionFlagsBits.ManageGuild)) {
            await message.reply(`${e('error')} You need Manage Server permission.`); return;
        }
        await setLevel(message.guild!.id, target.id, level);
        const card = new FadeContainer(Colours.SUCCESS)
            .text(`${e('success')}  Set **${target.username}** to **Level ${level}**`)
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;