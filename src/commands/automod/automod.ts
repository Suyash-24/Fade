// src/commands/automod/automod.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import { getAutomodConfig, updateAutomodConfig } from '../../db/queries/automod.js';
import { e, Colours } from '../../components/emojis.js';

const RULE_FIELDS: Record<string, string> = {
    spam:     'antiSpam',
    links:    'antiLinks',
    invites:  'antiInvites',
    mentions: 'antiMassMention',
    caps:     'antiCaps',
    slurs:    'antiSlurs',
};

const RULE_LABELS: Record<string, string> = {
    spam:     'Anti-Spam',
    links:    'Anti-Links',
    invites:  'Anti-Invites',
    mentions: 'Anti-Mass-Mention',
    caps:     'Anti-Caps',
    slurs:    'Anti-Slurs',
};

const PUNISHMENT_FIELD: Record<string, string> = {
    spam:     'spamPunishment',
    links:    'linksPunishment',
    invites:  'invitesPunishment',
    mentions: 'mentionsPunishment',
    caps:     'capsPunishment',
    slurs:    'slursPunishment',
};

const RULE_CHOICES = [
    { name: 'Anti-Spam',        value: 'spam'     },
    { name: 'Anti-Links',       value: 'links'    },
    { name: 'Anti-Invites',     value: 'invites'  },
    { name: 'Anti-Mentions',    value: 'mentions' },
    { name: 'Anti-Caps',        value: 'caps'     },
    { name: 'Anti-Slurs',       value: 'slurs'    },
];

const PUNISHMENT_CHOICES = [
    { name: 'Delete', value: 'delete' },
    { name: 'Warn',   value: 'warn'   },
    { name: 'Mute',   value: 'mute'   },
    { name: 'Kick',   value: 'kick'   },
    { name: 'Ban',    value: 'ban'    },
];

export default {
    data: new SlashCommandBuilder()
        .setName('automod')
        .setDescription('Configure the AutoMod system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(s => s
            .setName('view')
            .setDescription('View current AutoMod settings')
        )
        .addSubcommand(s => s
            .setName('toggle')
            .setDescription('Enable or disable AutoMod entirely')
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('rule')
            .setDescription('Enable or disable a specific rule')
            .addStringOption(o => o.setName('name').setDescription('Rule').setRequired(true).addChoices(...RULE_CHOICES))
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('punishment')
            .setDescription('Set the punishment for a rule')
            .addStringOption(o => o.setName('rule').setDescription('Rule').setRequired(true).addChoices(...RULE_CHOICES))
            .addStringOption(o => o.setName('action').setDescription('Punishment').setRequired(true).addChoices(...PUNISHMENT_CHOICES))
        )
        .addSubcommand(s => s
            .setName('threshold')
            .setDescription('Set detection thresholds')
            .addStringOption(o => o
                .setName('rule')
                .setDescription('Rule to configure')
                .setRequired(true)
                .addChoices(
                    { name: 'Spam',     value: 'spam'     },
                    { name: 'Mentions', value: 'mentions' },
                    { name: 'Caps',     value: 'caps'     },
                )
            )
            .addIntegerOption(o => o.setName('value').setDescription('Value').setMinValue(1).setMaxValue(100).setRequired(true))
        )
        .addSubcommand(s => s
            .setName('spammode')
            .setDescription('Track spam per-channel instead of per-server')
            .addBooleanOption(o => o.setName('enabled').setDescription('Per-channel = true, server-wide = false').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('whitelist')
            .setDescription('Allow a domain through Anti-Links (e.g. youtube.com)')
            .addStringOption(o => o
                .setName('action')
                .setDescription('Add, remove, or view')
                .setRequired(true)
                .addChoices(
                    { name: 'Add domain',    value: 'add'    },
                    { name: 'Remove domain', value: 'remove' },
                    { name: 'View list',     value: 'view'   },
                )
            )
            .addStringOption(o => o.setName('domain').setDescription('Domain (e.g. youtube.com)').setRequired(false))
        )
        .addSubcommand(s => s
            .setName('logchannel')
            .setDescription('Set the AutoMod log channel')
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel (leave empty to disable)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
        )
        .addSubcommand(s => s
            .setName('ignorechannel')
            .setDescription('Toggle a channel being ignored by AutoMod')
            .addChannelOption(o => o.setName('channel').setDescription('Channel').addChannelTypes(ChannelType.GuildText).setRequired(true))
            .addStringOption(o => o.setName('rule').setDescription('Specific rule to ignore (leave blank for ALL rules)').setRequired(false).addChoices(...RULE_CHOICES))
        )
        .addSubcommand(s => s
            .setName('ignorerole')
            .setDescription('Toggle a role being ignored by AutoMod')
            .addRoleOption(o => o.setName('role').setDescription('Role').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('blacklist')
            .setDescription('Manage the slur/word blacklist')
            .addStringOption(o => o
                .setName('action')
                .setDescription('Add, remove, or view')
                .setRequired(true)
                .addChoices(
                    { name: 'Add word',    value: 'add'    },
                    { name: 'Remove word', value: 'remove' },
                    { name: 'View list',   value: 'view'   },
                )
            )
            .addStringOption(o => o.setName('word').setDescription('The word').setRequired(false))
        ),

    category:        'automod',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        5,

    async execute(interaction, client) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        // ── View ──────────────────────────────────────────────────────────────
        if (sub === 'view') {
            const config = await getAutomodConfig(guild.id);
            const c      = config as any;
            const rs     = (on: boolean) => on ? '🟢' : '🔴';

            const ignoredCh = (config.ignoredChannels as string[] ?? []).map(id => `<#${id}>`).join(', ') || '`None`';
            
            const ruleIgnoredMap = c.ruleIgnoredChannels as Record<string, string[]> ?? {};
            const ruleIgnoredStr = Object.entries(ruleIgnoredMap)
                .filter(([_, channels]) => channels.length > 0)
                .map(([rule, channels]) => `**${RULE_LABELS[rule] ?? rule}**: ${channels.map(id => `<#${id}>`).join(', ')}`)
                .join('\n');

            const ignoredRo = (config.ignoredRoles   as string[] ?? []).map(id => `<@&${id}>`).join(', ') || '`None`';
            const domains   = (c.whitelistedDomains  as string[] ?? []).join(', ') || '`None`';

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('automod')} AutoMod Config`)
                .separator(true)
                .text([
                    `**Enabled** — \`${config.enabled ? 'Yes' : 'No'}\``,
                    `**Log channel** — ${config.logChannelId ? `<#${config.logChannelId}>` : '`Not set`'}`,
                    `**Spam mode** — \`${c.spamPerChannel ? 'Per-channel' : 'Server-wide'}\``,
                ].join('\n'))
                .separator(true)
                .text([
                    `**Rules & punishments:**`,
                    `${rs(config.antiSpam)}  **Anti-Spam** — \`${config.spamThreshold}\`/10s → \`${c.spamPunishment ?? 'mute'}\``,
                    `${rs(config.antiLinks)}  **Anti-Links** → \`${c.linksPunishment ?? 'delete'}\` · whitelist: ${domains}`,
                    `${rs(config.antiInvites)}  **Anti-Invites** → \`${c.invitesPunishment ?? 'delete'}\``,
                    `${rs(config.antiMassMention)}  **Anti-Mentions** — \`${config.mentionLimit}\` max → \`${c.mentionsPunishment ?? 'delete'}\``,
                    `${rs(config.antiCaps)}  **Anti-Caps** — \`${config.capsPercent}%\` → \`${c.capsPunishment ?? 'delete'}\``,
                    `${rs(config.antiSlurs)}  **Anti-Slurs** — \`${(c.blacklist as string[] ?? []).length}\` words → \`${c.slursPunishment ?? 'ban'}\``,
                ].join('\n'))
                .separator(true)
                .text([
                    `**Global ignored channels** — ${ignoredCh}`,
                    ruleIgnoredStr ? `**Rule-specific ignored channels**:\n${ruleIgnoredStr}` : '',
                    `**Ignored roles** — ${ignoredRo}`,
                ].filter(Boolean).join('\n'))
                .build();

            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Toggle ────────────────────────────────────────────────────────────
        if (sub === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateAutomodConfig(guild.id, { enabled });
            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(`${e('automod')} AutoMod **${enabled ? 'enabled' : 'disabled'}**`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Rule toggle ───────────────────────────────────────────────────────
        if (sub === 'rule') {
            const name    = interaction.options.getString('name', true);
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateAutomodConfig(guild.id, { [RULE_FIELDS[name]]: enabled } as any);
            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(`${e('success')}  **${RULE_LABELS[name]}** ${enabled ? 'enabled' : 'disabled'}`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Punishment ────────────────────────────────────────────────────────
        if (sub === 'punishment') {
            const rule   = interaction.options.getString('rule', true);
            const action = interaction.options.getString('action', true);
            await updateAutomodConfig(guild.id, { [PUNISHMENT_FIELD[rule]]: action } as any);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  **${RULE_LABELS[rule]}** punishment → \`${action}\``)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Threshold ─────────────────────────────────────────────────────────
        if (sub === 'threshold') {
            const rule  = interaction.options.getString('rule', true);
            const value = interaction.options.getInteger('value', true);
            const fieldMap: Record<string, string> = {
                spam: 'spamThreshold', mentions: 'mentionLimit', caps: 'capsPercent',
            };
            await updateAutomodConfig(guild.id, { [fieldMap[rule]]: value } as any);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  **${RULE_LABELS[rule]}** threshold → \`${value}\``)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Spam mode ─────────────────────────────────────────────────────────
        if (sub === 'spammode') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateAutomodConfig(guild.id, { spamPerChannel: enabled } as any);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `${e('success')}  Spam tracking → \`${enabled ? 'Per-channel' : 'Server-wide'}\`\n` +
                    `-# ${enabled ? 'Spam is now tracked per channel — users can be active across channels' : 'Spam tracked globally across the server'}`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Domain whitelist ──────────────────────────────────────────────────
        if (sub === 'whitelist') {
            const action = interaction.options.getString('action', true);
            const config = await getAutomodConfig(guild.id);
            const list   = (config as any).whitelistedDomains as string[] ?? [];

            if (action === 'view') {
                const card = new FadeContainer(Colours.FADE)
                    .text(
                        list.length
                            ? `## ${e('link')} Whitelisted Domains\n${list.map(d => `\`${d}\``).join(', ')}`
                            : `${e('warn')} No domains whitelisted.\nAll links are blocked. Use \`/automod whitelist add\` to allow specific domains.`
                    )
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }

            const domain = interaction.options.getString('domain')?.toLowerCase().trim()
                .replace(/^https?:\/\//, '').split('/')[0]; // normalize

            if (!domain) {
                await interaction.reply({ content: `${e('error')} Please provide a domain (e.g. \`youtube.com\`).`, flags: MessageFlags.Ephemeral });
                return;
            }

            if (action === 'add') {
                if (list.includes(domain)) {
                    await interaction.reply({ content: `${e('error')} \`${domain}\` is already whitelisted.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                await updateAutomodConfig(guild.id, { whitelistedDomains: [...list, domain] } as any);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  \`${domain}\` added to whitelist\n-# Links from this domain will not be blocked`)
                    .build();
                await sendResponse(interaction, [card]);
            } else {
                if (!list.includes(domain)) {
                    await interaction.reply({ content: `${e('error')} \`${domain}\` is not whitelisted.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                await updateAutomodConfig(guild.id, { whitelistedDomains: list.filter(d => d !== domain) } as any);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  \`${domain}\` removed from whitelist`)
                    .build();
                await sendResponse(interaction, [card]);
            }
            return;
        }

        // ── Log channel ───────────────────────────────────────────────────────
        if (sub === 'logchannel') {
            const channel = interaction.options.getChannel('channel');
            await updateAutomodConfig(guild.id, { logChannelId: channel?.id ?? null });
            const card = new FadeContainer(channel ? Colours.SUCCESS : Colours.WARNING)
                .text(channel ? `${e('success')}  AutoMod logs → <#${channel.id}>` : `${e('success')}  AutoMod log channel disabled`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Ignore channel ────────────────────────────────────────────────────
        if (sub === 'ignorechannel') {
            const channel = interaction.options.getChannel('channel', true);
            const rule    = interaction.options.getString('rule');
            const config  = await getAutomodConfig(guild.id);
            
            if (rule) {
                const map = (config as any).ruleIgnoredChannels as Record<string, string[]> ?? {};
                const current = map[rule] ?? [];
                const has = current.includes(channel.id);
                const updated = has ? current.filter(id => id !== channel.id) : [...current, channel.id];
                const newMap = { ...map, [rule]: updated };
                await updateAutomodConfig(guild.id, { ruleIgnoredChannels: newMap } as any);
                
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  <#${channel.id}> **${has ? 'removed from' : 'added to'}** ignore list for **${RULE_LABELS[rule]}**`)
                    .build();
                await sendResponse(interaction, [card]);
            } else {
                const current = config.ignoredChannels as string[] ?? [];
                const has     = current.includes(channel.id);
                const updated = has ? current.filter(id => id !== channel.id) : [...current, channel.id];
                await updateAutomodConfig(guild.id, { ignoredChannels: updated });
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  <#${channel.id}> **${has ? 'removed from' : 'added to'}** global ignore list`)
                    .build();
                await sendResponse(interaction, [card]);
            }
            return;
        }

        // ── Ignore role ───────────────────────────────────────────────────────
        if (sub === 'ignorerole') {
            const role    = interaction.options.getRole('role', true);
            const config  = await getAutomodConfig(guild.id);
            const current = config.ignoredRoles as string[] ?? [];
            const has     = current.includes(role.id);
            const updated = has ? current.filter(id => id !== role.id) : [...current, role.id];
            await updateAutomodConfig(guild.id, { ignoredRoles: updated });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  <@&${role.id}> **${has ? 'removed from' : 'added to'}** ignore list`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Blacklist ─────────────────────────────────────────────────────────
        if (sub === 'blacklist') {
            const action = interaction.options.getString('action', true);
            const config = await getAutomodConfig(guild.id);
            const list   = (config as any).blacklist as string[] ?? [];

            if (action === 'view') {
                const card = new FadeContainer(Colours.FADE)
                    .text(
                        list.length
                            ? `## ${e('automod')} Blacklisted Words (${list.length})\n||${list.join(', ')}||`
                            : `${e('warn')} No words blacklisted yet.`
                    )
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }

            const word = interaction.options.getString('word')?.toLowerCase().trim();
            if (!word) {
                await interaction.reply({ content: `${e('error')} Please provide a word.`, flags: MessageFlags.Ephemeral });
                return;
            }

            if (action === 'add') {
                if (list.includes(word)) {
                    await interaction.reply({ content: `${e('error')} That word is already blacklisted.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                if (list.length >= 100) {
                    await interaction.reply({ content: `${e('error')} Maximum 100 blacklisted words.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                await updateAutomodConfig(guild.id, { blacklist: [...list, word] } as any);
                const card = new FadeContainer(Colours.SUCCESS).text(`${e('success')}  Word added to blacklist`).build();
                await sendResponse(interaction, [card]);
            } else {
                if (!list.includes(word)) {
                    await interaction.reply({ content: `${e('error')} That word is not blacklisted.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                await updateAutomodConfig(guild.id, { blacklist: list.filter(w => w !== word) } as any);
                const card = new FadeContainer(Colours.SUCCESS).text(`${e('success')}  Word removed from blacklist`).build();
                await sendResponse(interaction, [card]);
            }
            return;
        }
    },
} satisfies Command;