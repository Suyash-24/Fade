// src/commands/utility/birthday.ts
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import {
    getBirthdayConfig, upsertBirthdayConfig,
    getBirthday, setBirthday, removeBirthday, getGuildBirthdays,
} from '../../db/queries/birthdays.js';

const MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

function parseDate(input: string): string | null {
    // Accept: MM-DD, MM/DD, "January 5", "5 January"
    const slash = input.match(/^(\d{1,2})[\/\-](\d{1,2})$/);
    if (slash) {
        const m = parseInt(slash[1]), d = parseInt(slash[2]);
        if (m < 1 || m > 12 || d < 1 || d > 31) return null;
        return `${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    }
    return null;
}

function formatBirthday(mmdd: string): string {
    const [m, d] = mmdd.split('-').map(Number);
    return `${MONTHS[m - 1]} ${d}`;
}

export default {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Birthday system')

        .addSubcommand(s => s
            .setName('set')
            .setDescription('Set your birthday')
            .addStringOption(o => o
                .setName('date')
                .setDescription('Your birthday (MM-DD or MM/DD, e.g. 05-20)')
                .setRequired(true)
            )
            .addStringOption(o => o
                .setName('timezone')
                .setDescription('Your timezone (e.g. UTC, America/New_York)')
                .setRequired(false)
            )
        )
        .addSubcommand(s => s
            .setName('remove')
            .setDescription('Remove your birthday')
        )
        .addSubcommand(s => s
            .setName('view')
            .setDescription('View your or someone else\'s birthday')
            .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(false))
        )
        .addSubcommand(s => s
            .setName('list')
            .setDescription('View all birthdays in this server')
        )
        .addSubcommandGroup(g => g
            .setName('config')
            .setDescription('Configure birthday announcements (admin)')
            .addSubcommand(s => s
                .setName('channel')
                .setDescription('Set the announcement channel')
                .addChannelOption(o => o
                    .setName('channel')
                    .setDescription('Channel for birthday announcements')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
                )
            )
            .addSubcommand(s => s
                .setName('role')
                .setDescription('Role to give on someone\'s birthday')
                .addRoleOption(o => o.setName('role').setDescription('Birthday role').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('message')
                .setDescription('Custom announcement message. Supports plain text, {embed}$v... or {card}$v... scripts')
                .addStringOption(o => o.setName('text').setDescription('Message text or script').setRequired(true).setMaxLength(1000))
            )
            .addSubcommand(s => s
                .setName('style')
                .setDescription('Set the message style')
                .addStringOption(o => o
                    .setName('style')
                    .setDescription('Message style')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Text — plain message with variables', value: 'text'  },
                        { name: 'Embed — classic Discord embed',       value: 'embed' },
                        { name: 'Card — Components v2 card',           value: 'card'  },
                    )
                )
            )
            .addSubcommand(s => s
                .setName('toggle')
                .setDescription('Enable or disable birthday announcements')
                .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('view')
                .setDescription('View current birthday config')
            )
        ),

    category:  'utility',
    guildOnly: true,
    cooldown:  3,

    async execute(interaction) {
        const group   = interaction.options.getSubcommandGroup(false);
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild!.id;

        // ── Config (admin) ────────────────────────────────────────────────────
        if (group === 'config') {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                await interaction.reply({ content: `${e('error')} You need **Manage Server**.`, flags: MessageFlags.Ephemeral });
                return;
            }

            if (sub === 'channel') {
                const channel = interaction.options.getChannel('channel', true);
                await upsertBirthdayConfig(guildId, { channelId: channel.id });
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Birthday announcements → <#${channel.id}>`)
                    .build();
                await sendResponse(interaction, [card]);
            } else if (sub === 'role') {
                const role = interaction.options.getRole('role', true);
                await upsertBirthdayConfig(guildId, { roleId: role.id });
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Birthday role set to <@&${role.id}>`)
                    .build();
                await sendResponse(interaction, [card]);
            } else if (sub === 'message') {
                const text  = interaction.options.getString('text', true);
                const style = (await getBirthdayConfig(guildId))?.style ?? 'text';

                // Validate script if embed/card style
                if (style !== 'text' && text.length > 0) {
                    try {
                        const { buildScriptedEmbed: bse, buildScriptedCard: bsc } = await import('../../utils/welcomecard.js');
                        const fakeMember = { toString: () => '@User', user: { username: 'User', createdTimestamp: Date.now(), displayAvatarURL: () => '', id: '0' }, guild: { name: 'Server', memberCount: 1, iconURL: () => '' }, id: '0' };
                        if (style === 'embed') bse(text, fakeMember as any);
                        else bsc(text, fakeMember as any);
                    } catch (err: any) {
                        await interaction.reply({ content: `${e('error')} Script error: ${err.message ?? 'Invalid script syntax.'}`, flags: MessageFlags.Ephemeral });
                        return;
                    }
                }

                await upsertBirthdayConfig(guildId, { message: text });
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Birthday message set\n-# ${text.slice(0, 80)}${text.length > 80 ? '…' : ''}`)
                    .build();
                await sendResponse(interaction, [card]);
            } else if (sub === 'style') {
                const style = interaction.options.getString('style', true);
                await upsertBirthdayConfig(guildId, { style });
                const hints: Record<string, string> = {
                    text:  'Use {user} {date} variables in your message',
                    embed: 'Use {embed}$v{title: ...}$v{description: ...} script in your message',
                    card:  'Use {card}$v{header: ...}$v{body: ...} script in your message',
                };
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Birthday style set to \`${style}\`\n-# ${hints[style]}`)
                    .build();
                await sendResponse(interaction, [card]);
            } else if (sub === 'toggle') {
                const enabled = interaction.options.getBoolean('enabled', true);
                await upsertBirthdayConfig(guildId, { enabled });
                const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                    .text(`${e('success')}  Birthday announcements **${enabled ? 'enabled' : 'disabled'}**`)
                    .build();
                await sendResponse(interaction, [card]);
            } else if (sub === 'view') {
                const config = await getBirthdayConfig(guildId);
                const card = new FadeContainer(Colours.FADE)
                    .text(
                        `## 🎂 Birthday Config\n` +
                        `**Enabled** — \`${config?.enabled !== false ? 'Yes' : 'No'}\`\n` +
                        `**Channel** — ${config?.channelId ? `<#${config.channelId}>` : '`Not set`'}\n` +
                        `**Role** — ${config?.roleId ? `<@&${config.roleId}>` : '`Not set`'}\n` +
                        `**Style** — \`${config?.style ?? 'text'}\`\n` +
                        `**Message** — ${config?.message ? `\`${config.message.slice(0, 60)}…\`` : '`Default`'}`
                    )
                    .build();
                await sendResponse(interaction, [card], true);
            }
            return;
        }

        // ── Set ───────────────────────────────────────────────────────────────
        if (sub === 'set') {
            const input    = interaction.options.getString('date', true);
            const timezone = interaction.options.getString('timezone') ?? 'UTC';
            const parsed   = parseDate(input);
            if (!parsed) {
                await interaction.reply({ content: `${e('error')} Invalid date. Use format \`MM-DD\` e.g. \`05-20\` for May 20.`, flags: MessageFlags.Ephemeral });
                return;
            }
            await setBirthday(guildId, interaction.user.id, parsed, timezone);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`🎂  Birthday set to **${formatBirthday(parsed)}**\n-# Timezone: \`${timezone}\``)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Remove ────────────────────────────────────────────────────────────
        if (sub === 'remove') {
            await removeBirthday(guildId, interaction.user.id);
            const card = new FadeContainer(Colours.DANGER).text(`${e('success')}  Birthday removed`).build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── View ──────────────────────────────────────────────────────────────
        if (sub === 'view') {
            const target = interaction.options.getUser('user') ?? interaction.user;
            const entry  = await getBirthday(guildId, target.id);
            if (!entry) {
                await interaction.reply({ content: `${e('error')} ${target.id === interaction.user.id ? 'You haven\'t' : `<@${target.id}> hasn't`} set a birthday.`, flags: MessageFlags.Ephemeral });
                return;
            }
            const card = new FadeContainer(Colours.FADE)
                .text(`🎂  **${target.username}**'s birthday is **${formatBirthday(entry.birthday)}**\n-# Timezone: \`${entry.timezone}\``)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── List ──────────────────────────────────────────────────────────────
        if (sub === 'list') {
            const all = await getGuildBirthdays(guildId);
            if (!all.length) {
                await interaction.reply({ content: `${e('error')} No birthdays set in this server.`, flags: MessageFlags.Ephemeral });
                return;
            }
            const lines = all.map(b => `<@${b.userId}> — **${formatBirthday(b.birthday)}**`).join('\n');
            const card  = new FadeContainer(Colours.FADE)
                .text(`## 🎂 Birthdays (${all.length})\n${lines}`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }
    },

    async prefixExecute(message, args) {
        const guildId = message.guild!.id;
        const sub     = args[0]?.toLowerCase();

        if (sub === 'set') {
            const parsed = parseDate(args[1] ?? '');
            if (!parsed) { await message.reply(`${e('error')} Usage: \`f!birthday set MM-DD\``); return; }
            const timezone = args[2] ?? 'UTC';
            await setBirthday(guildId, message.author.id, parsed, timezone);
            const card = new FadeContainer(Colours.SUCCESS).text(`🎂  Birthday set to **${formatBirthday(parsed)}**`).build();
            await sendMessage(message, [card]);
        } else if (sub === 'remove') {
            await removeBirthday(guildId, message.author.id);
            const card = new FadeContainer(Colours.DANGER).text(`${e('success')}  Birthday removed`).build();
            await sendMessage(message, [card]);
        } else if (sub === 'list') {
            const all = await getGuildBirthdays(guildId);
            if (!all.length) { await message.reply(`${e('error')} No birthdays set.`); return; }
            const lines = all.map(b => `<@${b.userId}> — **${formatBirthday(b.birthday)}**`).join('\n');
            const card  = new FadeContainer(Colours.FADE).text(`## 🎂 Birthdays\n${lines}`).build();
            await sendMessage(message, [card]);
        } else {
            const targetId = args[0]?.replace(/[<@!>]/g, '');
            const explicitTarget = targetId ? await message.client.users.fetch(targetId).catch(() => null) : null;
            const target = explicitTarget || message.author;
            const entry  = await getBirthday(guildId, target.id);
            if (!entry) { await message.reply(`${e('error')} No birthday set.`); return; }
            const card = new FadeContainer(Colours.FADE).text(`🎂  **${target.username}** — **${formatBirthday(entry.birthday)}**`).build();
            await sendMessage(message, [card]);
        }
    },

    aliases: ['bday', 'bd'],
} satisfies Command;
