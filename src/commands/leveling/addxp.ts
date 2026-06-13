// src/commands/leveling/addxp.ts
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { addXp, setXp, setLevel } from '../../db/queries/leveling.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('addxp')
        .setDescription('Add XP to a user')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addUserOption(o => o.setName('user').setDescription('Target user').setRequired(true))
        .addIntegerOption(o => o.setName('amount').setDescription('XP amount to add').setMinValue(1).setRequired(true)),

    category:        'leveling',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        3,

    async execute(interaction, client) {
        const target = interaction.options.getUser('user', true);
        const amount = interaction.options.getInteger('amount', true);
        const result = await addXp(interaction.guild!.id, target.id, amount);

        const card = new FadeContainer(Colours.SUCCESS)
            .text(
                `${e('success')}  Added \`${amount} XP\` to **${target.username}**\n` +
                `-# Total: \`${result.totalXp.toLocaleString()} XP\` · Level ${result.newLevel}` +
                (result.levelled ? ` · ${e('level')} Levelled up!` : '')
            )
            .build();
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const target = targetId ? await client.users.fetch(targetId).catch(() => null) : null;
        const amount = parseInt(args[1] ?? args[0]);
        if (!target || isNaN(amount)) { await message.reply(`${e('error')} Usage: \`f!addxp @user <amount>\``); return; }
        if (!message.member!.permissions.has(PermissionFlagsBits.ManageGuild)) {
            await message.reply(`${e('error')} You need Manage Server permission.`); return;
        }
        const result = await addXp(message.guild!.id, target.id, amount);
        const card = new FadeContainer(Colours.SUCCESS)
            .text(`${e('success')}  Added \`${amount} XP\` to **${target.username}** · Level ${result.newLevel}`)
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;