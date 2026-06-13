// src/commands/utility/reactiontrigger.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import {
    getReactionTriggers,
    getReactionTrigger,
    createReactionTrigger,
    deleteReactionTrigger,
    toggleReactionTrigger,
} from '../../db/queries/reactionTriggers.js';
import { invalidateReactionTriggerCache } from '../../events/reactionTriggers.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('reactiontrigger')
        .setDescription('Manage auto reaction triggers')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(s => s
            .setName('add')
            .setDescription('Add a reaction trigger')
            .addStringOption(o => o.setName('trigger').setDescription('Word or phrase to trigger on').setRequired(true))
            .addStringOption(o => o.setName('emoji').setDescription('Emoji to react with').setRequired(true))
            .addStringOption(o => o
                .setName('match')
                .setDescription('How to match (default: contains)')
                .setRequired(false)
                .addChoices(
                    { name: 'Contains',   value: 'contains'   },
                    { name: 'Starts with',value: 'startsWith' },
                    { name: 'Exact',      value: 'exact'      },
                )
            )
        )
        .addSubcommand(s => s
            .setName('list')
            .setDescription('List all reaction triggers')
        )
        .addSubcommand(s => s
            .setName('toggle')
            .setDescription('Enable or disable a trigger')
            .addIntegerOption(o => o.setName('id').setDescription('Trigger ID').setRequired(true))
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('delete')
            .setDescription('Delete a reaction trigger')
            .addIntegerOption(o => o.setName('id').setDescription('Trigger ID').setRequired(true))
        ),

    category:        'utility',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        3,

    async execute(interaction, client) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        // ── Add ───────────────────────────────────────────────────────────────
        if (sub === 'add') {
            const trigger   = interaction.options.getString('trigger', true);
            const emoji     = interaction.options.getString('emoji', true);
            const matchType = (interaction.options.getString('match') ?? 'contains') as any;

            const all = await getReactionTriggers(guild.id);
            if (all.length >= 30) {
                await interaction.reply({ content: `${e('error')} Maximum 30 reaction triggers per server.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const entry = await createReactionTrigger({ guildId: guild.id, trigger, emoji, matchType });
            invalidateReactionTriggerCache(guild.id);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `${e('success')}  Reaction trigger added\n` +
                    `${e('id')}  **ID** — \`${entry.id}\`\n` +
                    `**Trigger** — \`${trigger}\` (${matchType})\n` +
                    `**Emoji** — ${emoji}`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── List ──────────────────────────────────────────────────────────────
        if (sub === 'list') {
            const all = await getReactionTriggers(guild.id);

            if (!all.length) {
                const card = new FadeContainer(Colours.NONE)
                    .text(`No reaction triggers set up yet.\nUse \`/reactiontrigger add\` to create one.`)
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }

            const lines = all.map(t =>
                `\`#${t.id}\` ${t.enabled ? '🟢' : '🔴'} · ${t.emoji} · \`${t.trigger}\` (${t.matchType})`
            );

            const card = new FadeContainer(Colours.FADE)
                .text(`## Reaction Triggers (${all.length}/30)`)
                .separator(true)
                .text(lines.join('\n'))
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Toggle ────────────────────────────────────────────────────────────
        if (sub === 'toggle') {
            const id      = interaction.options.getInteger('id', true);
            const enabled = interaction.options.getBoolean('enabled', true);
            const entry   = await getReactionTrigger(id);

            if (!entry || entry.guildId !== guild.id) {
                await interaction.reply({ content: `${e('error')} Trigger #${id} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await toggleReactionTrigger(id, enabled);
            invalidateReactionTriggerCache(guild.id);

            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(`${e('success')}  Trigger #${id} **${enabled ? 'enabled' : 'disabled'}**`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Delete ────────────────────────────────────────────────────────────
        if (sub === 'delete') {
            const id    = interaction.options.getInteger('id', true);
            const entry = await getReactionTrigger(id);

            if (!entry || entry.guildId !== guild.id) {
                await interaction.reply({ content: `${e('error')} Trigger #${id} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await deleteReactionTrigger(id);
            invalidateReactionTriggerCache(guild.id);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Trigger #${id} deleted`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }
    },

    // Prefix: f!reactiontrigger list / add / delete
    async prefixExecute(message, args, client) {
        if (!message.guild) return;
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            await message.reply(`${e('error')} You need Manage Server permission.`);
            return;
        }

        const action = args[0]?.toLowerCase();

        if (!action || action === 'list') {
            const all = await getReactionTriggers(message.guild.id);
            if (!all.length) { await message.reply(`No reaction triggers set up.`); return; }
            const lines = all.map(t => `\`#${t.id}\` ${t.enabled ? '🟢' : '🔴'} · ${t.emoji} · \`${t.trigger}\``);
            await sendMessage(message, [
                new FadeContainer(Colours.FADE)
                    .text(`## Reaction Triggers\n${lines.join('\n')}`)
                    .build() as any,
            ]);
            return;
        }

        if (action === 'add') {
            const trigger = args[1];
            const emoji   = args[2];
            if (!trigger || !emoji) {
                await message.reply(`${e('error')} Usage: \`f!reactiontrigger add <trigger> <emoji>\``);
                return;
            }
            const entry = await createReactionTrigger({
                guildId: message.guild.id, trigger, emoji, matchType: 'contains',
            });
            invalidateReactionTriggerCache(message.guild.id);
            await message.reply(`${e('success')} Trigger #${entry.id} added — ${emoji} reacts to \`${trigger}\``);
            return;
        }

        if (action === 'delete' || action === 'remove') {
            const id = parseInt(args[1]);
            if (isNaN(id)) { await message.reply(`${e('error')} Provide a trigger ID.`); return; }
            const entry = await getReactionTrigger(id);
            if (!entry || entry.guildId !== message.guild.id) {
                await message.reply(`${e('error')} Trigger #${id} not found.`); return;
            }
            await deleteReactionTrigger(id);
            invalidateReactionTriggerCache(message.guild.id);
            await message.reply(`${e('success')} Trigger #${id} deleted`);
            return;
        }

        await message.reply(`Usage: \`f!reactiontrigger list\` · \`add <trigger> <emoji>\` · \`delete <id>\``);
    },
} satisfies Command;