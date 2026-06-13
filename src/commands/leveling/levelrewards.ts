// src/commands/leveling/levelrewards.ts
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import { getLevelRewards, addLevelReward, removeLevelReward } from '../../db/queries/leveling.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('levelrewards')
        .setDescription('Manage role rewards given at certain levels')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s
            .setName('list')
            .setDescription('List all level rewards')
        )
        .addSubcommand(s => s
            .setName('add')
            .setDescription('Add a role reward for reaching a level')
            .addIntegerOption(o => o.setName('level').setDescription('Level required').setMinValue(1).setRequired(true))
            .addRoleOption(o => o.setName('role').setDescription('Role to give').setRequired(true))
            .addBooleanOption(o => o.setName('remove_on_level').setDescription('Remove this role when user levels past it').setRequired(false))
        )
        .addSubcommand(s => s
            .setName('remove')
            .setDescription('Remove a level reward')
            .addIntegerOption(o => o.setName('level').setDescription('Level to remove reward from').setMinValue(1).setRequired(true))
        ),

    category:        'leveling',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        5,

    async execute(interaction, client) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        if (sub === 'list') {
            const rewards = await getLevelRewards(guild.id);
            if (!rewards.length) {
                const card = new FadeContainer(Colours.FADE)
                    .text(`${e('roles')} No level rewards set up yet.\nUse \`/levelrewards add\` to add one.`)
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }

            const lines = rewards.map(r =>
                `**Level ${r.level}** → <@&${r.roleId}>${r.remove ? ' *(removed on level-up)*' : ''}`
            );

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('roles')} Level Rewards`)
                .separator(true)
                .text(lines.join('\n'))
                .build();

            await sendResponse(interaction, [card], true);
            return;
        }

        if (sub === 'add') {
            const level    = interaction.options.getInteger('level', true);
            const role     = interaction.options.getRole('role', true);
            const removeOn = interaction.options.getBoolean('remove_on_level') ?? false;
            await addLevelReward(guild.id, level, role.id, removeOn);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `${e('success')}  **Level reward added**\n` +
                    `-# Reaching Level ${level} → <@&${role.id}>` +
                    (removeOn ? ' *(removed on next level)*' : '')
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'remove') {
            const level = interaction.options.getInteger('level', true);
            await removeLevelReward(guild.id, level);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Level ${level} reward removed.`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }
    },
} satisfies Command;