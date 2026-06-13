// src/commands/utility/alias.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getGuildAliases, getAlias, createAlias, deleteAliasByName } from '../../db/queries/commandAliases.js';
import { invalidateAliasCache } from '../../events/messagecreate.js';

const MAX_ALIASES = 25;

export default {
    data: new SlashCommandBuilder()
        .setName('alias')
        .setDescription('Create custom command shortcuts for this server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s
            .setName('add')
            .setDescription('Create a new alias')
            .addStringOption(o => o
                .setName('alias')
                .setDescription('The shortcut name (e.g. "bc" for "ban")')
                .setRequired(true)
                .setMinLength(1)
                .setMaxLength(32)
            )
            .addStringOption(o => o
                .setName('command')
                .setDescription('The command it maps to (e.g. "ban")')
                .setRequired(true)
                .setMaxLength(64)
            )
        )
        .addSubcommand(s => s
            .setName('remove')
            .setDescription('Delete an alias')
            .addStringOption(o => o
                .setName('alias')
                .setDescription('The alias to remove')
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('list')
            .setDescription('View all aliases in this server')
        ),

    category:        'utility',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        3,

    async execute(interaction, client) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild!.id;

        if (sub === 'add') {
            const alias   = interaction.options.getString('alias', true).toLowerCase().trim();
            const command = interaction.options.getString('command', true).toLowerCase().trim();

            // Validate alias doesn't clash with a built-in command or alias
            if (client.commands.has(alias) || client.aliases.has(alias)) {
                await interaction.reply({
                    content: `${e('error')} \`${alias}\` is already a built-in command or alias.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            // Validate target command exists
            const targetName    = client.aliases.get(command) ?? command;
            const targetCommand = client.commands.get(targetName);
            if (!targetCommand) {
                await interaction.reply({
                    content: `${e('error')} \`${command}\` is not a recognised command.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            // Check cap
            const existing = await getGuildAliases(guildId);
            if (existing.length >= MAX_ALIASES) {
                await interaction.reply({
                    content: `${e('error')} This server has reached the limit of **${MAX_ALIASES}** aliases.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            // Check duplicate
            if (existing.some(a => a.alias === alias)) {
                await interaction.reply({
                    content: `${e('error')} An alias named \`${alias}\` already exists. Remove it first.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await createAlias({ guildId, alias, command: targetName, createdBy: interaction.user.id });
            invalidateAliasCache(guildId);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Alias \`${alias}\` → \`${targetName}\` created.\n-# Use \`f!${alias}\` as a shortcut for \`f!${targetName}\`.`)
                .build();
            await interaction.reply({ components: [card] as any, flags: MessageFlags.Ephemeral });
        }

        else if (sub === 'remove') {
            const alias = interaction.options.getString('alias', true).toLowerCase().trim();
            const entry = await getAlias(guildId, alias);

            if (!entry) {
                await interaction.reply({
                    content: `${e('error')} No alias named \`${alias}\` found.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await deleteAliasByName(guildId, alias);
            invalidateAliasCache(guildId);

            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('success')}  Alias \`${alias}\` removed.`)
                .build();
            await interaction.reply({ components: [card] as any, flags: MessageFlags.Ephemeral });
        }

        else if (sub === 'list') {
            const aliases = await getGuildAliases(guildId);

            if (!aliases.length) {
                await interaction.reply({
                    content: `${e('error')} No aliases configured. Use \`/alias add\` to create one.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            const lines = aliases
                .map(a => `\`${a.alias}\` → \`${a.command}\``)
                .join('\n');

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('settings')} Command Aliases\n${lines}\n-# ${aliases.length}/${MAX_ALIASES} used`)
                .build();
            await interaction.reply({ components: [card] as any, flags: MessageFlags.Ephemeral });
        }
    },
} satisfies Command;
