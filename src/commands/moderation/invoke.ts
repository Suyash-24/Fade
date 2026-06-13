// src/commands/moderation/invoke.ts
// Customize the channel response and DM for each mod command.
// Variables: {user} {user.mention} {reason} {moderator} {server} {case}
//
// Bleed syntax: ,invoke ban message {text}  /  ,invoke ban dm {text}
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import {
    getInvokeMessage,
    getGuildInvokeMessages,
    setInvokeMessage,
    resetInvokeMessage,
} from '../../db/queries/invokeMessages.js';

const COMMANDS = ['ban', 'kick', 'warn', 'mute', 'timeout'] as const;
const CMD_CHOICES = COMMANDS.map(c => ({ name: c, value: c }));

export default {
    data: new SlashCommandBuilder()
        .setName('invoke')
        .setDescription('Customize mod command responses and DMs')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(s => s
            .setName('message')
            .setDescription('Set the channel response for a mod command')
            .addStringOption(o => o.setName('command').setDescription('Mod command').setRequired(true).addChoices(...CMD_CHOICES))
            .addStringOption(o => o.setName('text').setDescription('Response text. Variables: {user} {reason} {moderator} {server} {case}').setRequired(true).setMaxLength(500))
        )
        .addSubcommand(s => s
            .setName('dm')
            .setDescription('Set the DM sent to the punished user')
            .addStringOption(o => o.setName('command').setDescription('Mod command').setRequired(true).addChoices(...CMD_CHOICES))
            .addStringOption(o => o.setName('text').setDescription('DM text. Variables: {user} {reason} {moderator} {server} {case}').setRequired(true).setMaxLength(500))
        )
        .addSubcommand(s => s
            .setName('view')
            .setDescription('View invoke messages for a command (or all)')
            .addStringOption(o => o.setName('command').setDescription('Mod command (leave empty for all)').addChoices(...CMD_CHOICES))
        )
        .addSubcommand(s => s
            .setName('reset')
            .setDescription('Reset invoke messages for a command back to default')
            .addStringOption(o => o.setName('command').setDescription('Mod command').setRequired(true).addChoices(...CMD_CHOICES))
        ),

    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        3,

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild!.id;

        if (sub === 'message') {
            const command = interaction.options.getString('command', true);
            const text    = interaction.options.getString('text', true);
            await setInvokeMessage(guildId, command, { message: text });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Channel response for \`${command}\` set\n-# ${text}`)
                .build();
            await sendResponse(interaction, [card]);
        }

        else if (sub === 'dm') {
            const command = interaction.options.getString('command', true);
            const text    = interaction.options.getString('text', true);
            await setInvokeMessage(guildId, command, { dmMessage: text });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  DM message for \`${command}\` set\n-# ${text}`)
                .build();
            await sendResponse(interaction, [card]);
        }

        else if (sub === 'view') {
            const command = interaction.options.getString('command');

            if (command) {
                const entry = await getInvokeMessage(guildId, command);
                const card = new FadeContainer(Colours.FADE)
                    .text(
                        `## ${e('settings')} Invoke — \`${command}\`\n` +
                        `**Channel response:** ${entry?.message ?? '`Default (👍)`'}\n` +
                        `**DM:** ${entry?.dmMessage ?? '`Default`'}`
                    )
                    .build();
                await sendResponse(interaction, [card], true);
            } else {
                const all = await getGuildInvokeMessages(guildId);
                const lines = COMMANDS.map(cmd => {
                    const entry = all.find(a => a.command === cmd);
                    return `**${cmd}** — msg: ${entry?.message ? `\`${entry.message.slice(0, 40)}…\`` : '`default`'} · dm: ${entry?.dmMessage ? `\`${entry.dmMessage.slice(0, 40)}…\`` : '`default`'}`;
                });
                const card = new FadeContainer(Colours.FADE)
                    .text(`## ${e('settings')} Invoke Messages\n${lines.join('\n')}`)
                    .build();
                await sendResponse(interaction, [card], true);
            }
        }

        else if (sub === 'reset') {
            const command = interaction.options.getString('command', true);
            await resetInvokeMessage(guildId, command);
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('success')}  Invoke messages for \`${command}\` reset to default`)
                .build();
            await sendResponse(interaction, [card]);
        }
    },

    async prefixExecute(message, args) {
        if (!message.member!.permissions.has(PermissionFlagsBits.ManageGuild)) {
            await message.reply(`${e('error')} You need **Manage Server** to use this command.`);
            return;
        }

        const guildId = message.guild!.id;
        const command = args[0]?.toLowerCase();
        const type    = args[1]?.toLowerCase(); // message | dm | view | reset
        const text    = args.slice(2).join(' ');

        if (!command || !COMMANDS.includes(command as any)) {
            await message.reply(`${e('error')} Usage: \`f!invoke <${COMMANDS.join('|')}> <message|dm|view|reset> [text]\``);
            return;
        }

        if (type === 'message' && text) {
            await setInvokeMessage(guildId, command, { message: text });
            const card = new FadeContainer(Colours.SUCCESS).text(`${e('success')}  Channel response for \`${command}\` set`).build();
            await sendMessage(message, [card]);
        } else if (type === 'dm' && text) {
            await setInvokeMessage(guildId, command, { dmMessage: text });
            const card = new FadeContainer(Colours.SUCCESS).text(`${e('success')}  DM for \`${command}\` set`).build();
            await sendMessage(message, [card]);
        } else if (type === 'view' || !type) {
            const entry = await getInvokeMessage(guildId, command);
            const card = new FadeContainer(Colours.FADE)
                .text(`**${command}** — msg: ${entry?.message ?? '`default`'} · dm: ${entry?.dmMessage ?? '`default`'}`)
                .build();
            await sendMessage(message, [card]);
        } else if (type === 'reset') {
            await resetInvokeMessage(guildId, command);
            const card = new FadeContainer(Colours.DANGER).text(`${e('success')}  \`${command}\` invoke reset`).build();
            await sendMessage(message, [card]);
        }
    },

    aliases: ['invokemsg'],
} satisfies Command;
