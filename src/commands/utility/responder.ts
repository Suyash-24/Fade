// src/commands/utility/responder.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import {
    getResponders,
    getResponder,
    createResponder,
    updateResponder,
    deleteResponder,
    toggleResponder,
} from '../../db/queries/responders.js';
import { invalidateResponderCache } from '../../events/responders.js';
import { e, Colours } from '../../components/emojis.js';

const MATCH_LABELS: Record<string, string> = {
    contains:   'Contains — anywhere in message',
    startsWith: 'Starts with — beginning of message',
    exact:      'Exact — full message match',
};

export default {
    data: new SlashCommandBuilder()
        .setName('responder')
        .setDescription('Manage auto responders')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(s => s
            .setName('add')
            .setDescription('Add a new auto responder')
            .addStringOption(o => o.setName('trigger').setDescription('Trigger word or phrase').setRequired(true))
            .addStringOption(o => o.setName('response').setDescription('Response message. Use {user}, {username}, {server}, {channel}').setRequired(true))
            .addStringOption(o => o
                .setName('match')
                .setDescription('How to match the trigger (default: contains)')
                .setRequired(false)
                .addChoices(
                    { name: 'Contains — anywhere in message', value: 'contains'   },
                    { name: 'Starts with — beginning',        value: 'startsWith' },
                    { name: 'Exact — full message only',      value: 'exact'      },
                )
            )
        )
        .addSubcommand(s => s
            .setName('list')
            .setDescription('List all auto responders')
        )
        .addSubcommand(s => s
            .setName('view')
            .setDescription('View a specific responder')
            .addIntegerOption(o => o.setName('id').setDescription('Responder ID').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('edit')
            .setDescription('Edit an existing responder')
            .addIntegerOption(o => o.setName('id').setDescription('Responder ID').setRequired(true))
            .addStringOption(o => o.setName('trigger').setDescription('New trigger').setRequired(false))
            .addStringOption(o => o.setName('response').setDescription('New response').setRequired(false))
        )
        .addSubcommand(s => s
            .setName('toggle')
            .setDescription('Enable or disable a responder')
            .addIntegerOption(o => o.setName('id').setDescription('Responder ID').setRequired(true))
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('delete')
            .setDescription('Delete a responder')
            .addIntegerOption(o => o.setName('id').setDescription('Responder ID').setRequired(true))
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
            const response  = interaction.options.getString('response', true);
            const matchType = (interaction.options.getString('match') ?? 'contains') as any;

            const all = await getResponders(guild.id);
            if (all.length >= 50) {
                await interaction.reply({ content: `${e('error')} Maximum 50 responders per server.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const entry = await createResponder({ guildId: guild.id, trigger, response, matchType });
            invalidateResponderCache(guild.id);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `## ${e('success')} Responder Added\n` +
                    `${e('id')}  **ID** — \`${entry.id}\`\n` +
                    `**Trigger** — \`${trigger}\`\n` +
                    `**Match** — \`${matchType}\`\n` +
                    `**Response** — ${response.slice(0, 100)}${response.length > 100 ? '…' : ''}`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── List ──────────────────────────────────────────────────────────────
        if (sub === 'list') {
            const all = await getResponders(guild.id);

            if (!all.length) {
                const card = new FadeContainer(Colours.NONE)
                    .text(`${e('search')} No responders set up yet.\nUse \`/responder add\` to create one.`)
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }

            const lines = all.map(r =>
                `\`#${r.id}\` ${r.enabled ? '🟢' : '🔴'} · \`${r.trigger}\` (${r.matchType}) → ${r.response.slice(0, 40)}${r.response.length > 40 ? '…' : ''}`
            );

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('search')} Auto Responders (${all.length}/50)`)
                .separator(true)
                .text(lines.join('\n'))
                .separator(false)
                .text(`-# Use \`/responder view id:<id>\` for full details`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── View ──────────────────────────────────────────────────────────────
        if (sub === 'view') {
            const id    = interaction.options.getInteger('id', true);
            const entry = await getResponder(id);

            if (!entry || entry.guildId !== guild.id) {
                await interaction.reply({ content: `${e('error')} Responder #${id} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('search')} Responder #${entry.id}`)
                .separator(true)
                .text([
                    `**Status** — ${entry.enabled ? '🟢 Enabled' : '🔴 Disabled'}`,
                    `**Trigger** — \`${entry.trigger}\``,
                    `**Match type** — \`${entry.matchType}\``,
                    `**Response** — ${entry.response}`,
                ].join('\n'))
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Edit ──────────────────────────────────────────────────────────────
        if (sub === 'edit') {
            const id      = interaction.options.getInteger('id', true);
            const trigger = interaction.options.getString('trigger');
            const response= interaction.options.getString('response');
            const entry   = await getResponder(id);

            if (!entry || entry.guildId !== guild.id) {
                await interaction.reply({ content: `${e('error')} Responder #${id} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await updateResponder(id, {
                ...(trigger  ? { trigger  } : {}),
                ...(response ? { response } : {}),
            });
            invalidateResponderCache(guild.id);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Responder #${id} updated`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Toggle ────────────────────────────────────────────────────────────
        if (sub === 'toggle') {
            const id      = interaction.options.getInteger('id', true);
            const enabled = interaction.options.getBoolean('enabled', true);
            const entry   = await getResponder(id);

            if (!entry || entry.guildId !== guild.id) {
                await interaction.reply({ content: `${e('error')} Responder #${id} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await toggleResponder(id, enabled);
            invalidateResponderCache(guild.id);

            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(`${e('success')}  Responder #${id} **${enabled ? 'enabled' : 'disabled'}**`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Delete ────────────────────────────────────────────────────────────
        if (sub === 'delete') {
            const id    = interaction.options.getInteger('id', true);
            const entry = await getResponder(id);

            if (!entry || entry.guildId !== guild.id) {
                await interaction.reply({ content: `${e('error')} Responder #${id} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await deleteResponder(id);
            invalidateResponderCache(guild.id);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Responder #${id} deleted`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }
    },

    // Prefix: f!responder list / f!responder add <trigger> | <response>
    async prefixExecute(message, args, client) {
        if (!message.guild) return;
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            await message.reply(`${e('error')} You need Manage Server permission.`);
            return;
        }

        const action = args[0]?.toLowerCase();

        if (!action || action === 'list') {
            const all = await getResponders(message.guild.id);
            if (!all.length) {
                await sendMessage(message, [
                    new FadeContainer(Colours.NONE)
                        .text(`${e('search')} No responders set up yet.`)
                        .build() as any,
                ]);
                return;
            }
            const lines = all.map(r =>
                `\`#${r.id}\` ${r.enabled ? '🟢' : '🔴'} · \`${r.trigger}\` → ${r.response.slice(0, 40)}${r.response.length > 40 ? '…' : ''}`
            );
            const card = new FadeContainer(Colours.FADE)
                .text(`## Auto Responders\n${lines.join('\n')}`)
                .build();
            await sendMessage(message, [card as any]);
            return;
        }

        if (action === 'add') {
            // Format: f!responder add trigger | response
            const rest    = args.slice(1).join(' ');
            const parts   = rest.split('|');
            const trigger = parts[0]?.trim();
            const response= parts[1]?.trim();

            if (!trigger || !response) {
                await message.reply(`${e('error')} Usage: \`f!responder add <trigger> | <response>\``);
                return;
            }

            const entry = await createResponder({
                guildId: message.guild.id, trigger, response, matchType: 'contains',
            });
            invalidateResponderCache(message.guild.id);
            await message.reply(`${e('success')} Responder #${entry.id} added (\`${trigger}\`)`);
            return;
        }

        if (action === 'delete' || action === 'remove') {
            const id    = parseInt(args[1]);
            if (isNaN(id)) { await message.reply(`${e('error')} Please provide a responder ID.`); return; }
            const entry = await getResponder(id);
            if (!entry || entry.guildId !== message.guild.id) {
                await message.reply(`${e('error')} Responder #${id} not found.`);
                return;
            }
            await deleteResponder(id);
            invalidateResponderCache(message.guild.id);
            await message.reply(`${e('success')} Responder #${id} deleted`);
            return;
        }

        await message.reply(`${e('error')} Usage: \`f!responder list\` · \`f!responder add <trigger> | <response>\` · \`f!responder delete <id>\``);
    },
} satisfies Command;