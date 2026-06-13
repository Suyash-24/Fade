// src/commands/antinuke/antinuke.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
    ChannelType,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import {
    getAntinukeConfig,
    updateAntinukeConfig,
    getWhitelist,
    addWhitelist,
    removeWhitelist,
    isWhitelisted,
    getAntinukeAdmins,
    addAntinukeAdmin,
    removeAntinukeAdmin,
    isAntinukeAdmin,
} from '../../db/queries/antinuke.js';
import { e, Colours } from '../../components/emojis.js';

// Who can configure antinuke: owner OR antinuke admin
async function canConfigure(guildId: string, userId: string, ownerId: string): Promise<boolean> {
    if (userId === ownerId) return true;
    return isAntinukeAdmin(guildId, userId);
}

const MODULE_CHOICES = [
    { name: 'Ban',            value: 'ban'     },
    { name: 'Kick',           value: 'kick'    },
    { name: 'Channel delete', value: 'channel' },
    { name: 'Role delete',    value: 'role'    },
    { name: 'Webhook create', value: 'webhook' },
    { name: 'Emoji delete',   value: 'emoji'   },
];

const PUNISHMENT_CHOICES = [
    { name: 'Ban',   value: 'ban'   },
    { name: 'Kick',  value: 'kick'  },
    { name: 'Strip', value: 'strip' },
];

export default {
    data: new SlashCommandBuilder()
        .setName('antinuke')
        .setDescription('Configure the antinuke protection system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        // ── View ──────────────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('view')
            .setDescription('View current antinuke settings')
        )

        // ── Toggle ────────────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('toggle')
            .setDescription('Enable or disable antinuke')
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )

        // ── Module toggle ─────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('module')
            .setDescription('Enable or disable a specific protection module')
            .addStringOption(o => o
                .setName('type').setDescription('Module').setRequired(true)
                .addChoices(...MODULE_CHOICES)
            )
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )

        // ── Per-module punishment ─────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('punishment')
            .setDescription('Set punishment for a specific module (or global default)')
            .addStringOption(o => o
                .setName('type').setDescription('Punishment').setRequired(true)
                .addChoices(...PUNISHMENT_CHOICES)
            )
            .addStringOption(o => o
                .setName('module').setDescription('Module to set punishment for (leave empty for global)')
                .addChoices(...MODULE_CHOICES)
            )
        )

        // ── Threshold ─────────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('threshold')
            .setDescription('Set how many actions trigger protection')
            .addStringOption(o => o
                .setName('module').setDescription('Module').setRequired(true)
                .addChoices(...MODULE_CHOICES)
            )
            .addIntegerOption(o => o
                .setName('count').setDescription('Actions before triggering (1–10)')
                .setMinValue(1).setMaxValue(10).setRequired(true)
            )
        )

        // ── Time window ───────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('window')
            .setDescription('Set the time window for tracking actions')
            .addIntegerOption(o => o
                .setName('seconds').setDescription('Seconds (5–60)')
                .setMinValue(5).setMaxValue(60).setRequired(true)
            )
        )

        // ── Bot protection ────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('botprotection')
            .setDescription('Block unauthorized bot additions')
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )

        // ── Vanity protection ─────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('vanity')
            .setDescription('Protect against unauthorized vanity URL changes')
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )

        // ── Logging ───────────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('logging')
            .setDescription('Set the channel where antinuke alerts are sent')
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('The text channel to send alerts to (leave empty to reset)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
        )

        // ── Whitelist ─────────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('whitelist')
            .setDescription('View trusted users (bypasses all detection)')
        )
        .addSubcommand(s => s
            .setName('trust')
            .setDescription('Add a user to the whitelist (bypasses detection)')
            .addUserOption(o => o.setName('user').setDescription('User to trust').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('untrust')
            .setDescription('Remove a user from the whitelist')
            .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true))
        )

        // ── Antinuke admins ───────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('admins')
            .setDescription('View users who can configure antinuke')
        )
        .addSubcommand(s => s
            .setName('admin')
            .setDescription('Grant a user permission to configure antinuke (owner only)')
            .addUserOption(o => o.setName('user').setDescription('User to grant access').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('unadmin')
            .setDescription('Revoke antinuke config access from a user (owner only)')
            .addUserOption(o => o.setName('user').setDescription('User to revoke').setRequired(true))
        ),

    category:        'antinuke',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.Administrator],
    cooldown:        5,

    async execute(interaction, client) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;
        const isOwner = interaction.user.id === guild.ownerId;

        // Admin-only subcommands
        const ownerOnly = ['admin', 'unadmin'];
        if (ownerOnly.includes(sub) && !isOwner) {
            await interaction.reply({
                content: `${e('error')} Only the server owner can manage antinuke admins.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        // All other subcommands require owner OR antinuke admin
        if (!ownerOnly.includes(sub)) {
            const authorized = await canConfigure(guild.id, interaction.user.id, guild.ownerId);
            if (!authorized) {
                await interaction.reply({
                    content: `${e('error')} Only the server owner or antinuke admins can configure antinuke.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }
        }

        // ── View ──────────────────────────────────────────────────────────────
        if (sub === 'view') {
            const config = await getAntinukeConfig(guild.id);
            const c = config as any;

            const moduleStatus = (enabled: boolean, threshold: number, punishment: string) =>
                `${enabled ? '🟢' : '🔴'} threshold \`${threshold}\` · punishment \`${punishment}\``;

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('protect')} Antinuke Config`)
                .separator(true)
                .text([
                    `**Enabled** — \`${config.enabled ? 'Yes' : 'No'}\``,
                    `**Global punishment** — \`${config.punishment}\``,
                    `**Time window** — \`${config.timeWindow}s\``,
                    `**Bot protection** — \`${config.botAdd ? 'Yes' : 'No'}\``,
                    `**Vanity protection** — \`${c.vanityEnabled ?? false ? 'Yes' : 'No'}\``,
                    `**Log Channel** — ${c.logChannelId ? `<#${c.logChannelId}>` : '\`Default\`'}`,
                ].join('\n'))
                .separator(true)
                .text([
                    `**Modules:**`,
                    `${e('ban')}  **Ban** — ${moduleStatus(c.banEnabled ?? true, config.banThreshold, c.banPunishment ?? config.punishment)}`,
                    `${e('kick')}  **Kick** — ${moduleStatus(c.kickEnabled ?? true, config.kickThreshold, c.kickPunishment ?? config.punishment)}`,
                    `${e('channels')}  **Channel delete** — ${moduleStatus(c.channelEnabled ?? true, config.channelThreshold, c.channelPunishment ?? config.punishment)}`,
                    `${e('roles')}  **Role delete** — ${moduleStatus(c.roleEnabled ?? true, config.roleThreshold, c.rolePunishment ?? config.punishment)}`,
                    `**Webhook create** — ${moduleStatus(c.webhookEnabled ?? true, config.webhookThreshold, c.webhookPunishment ?? config.punishment)}`,
                    `${e('star')}  **Emoji delete** — ${moduleStatus(c.emojiEnabled ?? true, c.emojiThreshold ?? 5, c.emojiPunishment ?? config.punishment)}`,
                ].join('\n'))
                .separator(false)
                .text(`-# Use \`/antinuke trust @user\` to whitelist · \`/antinuke admin @user\` for config access`)
                .build();

            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Toggle ────────────────────────────────────────────────────────────
        if (sub === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateAntinukeConfig(guild.id, { enabled });
            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(
                    `## ${e('protect')} Antinuke ${enabled ? 'Enabled' : 'Disabled'}\n` +
                    `-# ${enabled ? 'Your server is now protected' : 'Your server is no longer protected'}`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Module toggle ─────────────────────────────────────────────────────
        if (sub === 'module') {
            const type    = interaction.options.getString('type', true);
            const enabled = interaction.options.getBoolean('enabled', true);

            const fieldMap: Record<string, string> = {
                ban: 'banEnabled', kick: 'kickEnabled',
                channel: 'channelEnabled', role: 'roleEnabled', webhook: 'webhookEnabled',
                emoji: 'emojiEnabled',
            };

            await updateAntinukeConfig(guild.id, { [fieldMap[type]]: enabled } as any);
            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(`${e('success')}  **${type}** protection **${enabled ? 'enabled' : 'disabled'}**`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Punishment ────────────────────────────────────────────────────────
        if (sub === 'punishment') {
            const type    = interaction.options.getString('type', true);
            const module  = interaction.options.getString('module');

            const fieldMap: Record<string, string> = {
                ban: 'banPunishment', kick: 'kickPunishment',
                channel: 'channelPunishment', role: 'rolePunishment', webhook: 'webhookPunishment',
                emoji: 'emojiPunishment',
            };

            if (module) {
                await updateAntinukeConfig(guild.id, { [fieldMap[module]]: type } as any);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  **${module}** punishment set to \`${type}\``)
                    .build();
                await sendResponse(interaction, [card]);
            } else {
                await updateAntinukeConfig(guild.id, { punishment: type });
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Global punishment set to \`${type}\`\n-# Modules without custom punishment will use this`)
                    .build();
                await sendResponse(interaction, [card]);
            }
            return;
        }

        // ── Threshold ─────────────────────────────────────────────────────────
        if (sub === 'threshold') {
            const module = interaction.options.getString('module', true);
            const count  = interaction.options.getInteger('count', true);

            const fieldMap: Record<string, string> = {
                ban: 'banThreshold', kick: 'kickThreshold',
                channel: 'channelThreshold', role: 'roleThreshold', webhook: 'webhookThreshold',
                emoji: 'emojiThreshold',
            };

            await updateAntinukeConfig(guild.id, { [fieldMap[module]]: count } as any);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  **${module}** threshold set to \`${count}\` actions`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Window ────────────────────────────────────────────────────────────
        if (sub === 'window') {
            const seconds = interaction.options.getInteger('seconds', true);
            await updateAntinukeConfig(guild.id, { timeWindow: seconds });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Time window set to \`${seconds}s\``)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Bot protection ────────────────────────────────────────────────────
        if (sub === 'botprotection') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateAntinukeConfig(guild.id, { botAdd: enabled });
            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(`${e('success')}  Bot join protection **${enabled ? 'enabled' : 'disabled'}**`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Vanity ────────────────────────────────────────────────────────────
        if (sub === 'vanity') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateAntinukeConfig(guild.id, { vanityEnabled: enabled } as any);
            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(
                    `${e('success')}  Vanity URL protection **${enabled ? 'enabled' : 'disabled'}**\n` +
                    (enabled ? `-# Unauthorized vanity changes will be reverted and punished` : '')
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Logging ───────────────────────────────────────────────────────────
        if (sub === 'logging') {
            const channel = interaction.options.getChannel('channel');
            await updateAntinukeConfig(guild.id, { logChannelId: channel ? channel.id : null } as any);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(channel 
                    ? `${e('success')}  Antinuke alerts will now be sent to <#${channel.id}>`
                    : `${e('success')}  Antinuke alerts channel reset to default`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Whitelist view ────────────────────────────────────────────────────
        if (sub === 'whitelist') {
            const list = await getWhitelist(guild.id);
            if (!list.length) {
                const card = new FadeContainer(Colours.FADE)
                    .text(`${e('protect')} No users whitelisted.\n-# Whitelisted users bypass all antinuke detection.`)
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }
            const lines = list.map(w =>
                `<@${w.userId}> · added by <@${w.addedBy}> · <t:${Math.floor(new Date(w.createdAt).getTime() / 1000)}:R>`
            );
            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('protect')} Whitelist — ${list.length} user${list.length === 1 ? '' : 's'}`)
                .separator(true)
                .text(lines.join('\n'))
                .separator(false)
                .text(`-# Whitelisted users bypass all detection. Use /antinuke admin for config access only.`)
                .build();
            await sendResponse(interaction, [card], true, { parse: [] });
            return;
        }

        // ── Trust ─────────────────────────────────────────────────────────────
        if (sub === 'trust') {
            const target = interaction.options.getUser('user', true);
            if (target.id === guild.ownerId) {
                await interaction.reply({ content: `${e('error')} The server owner is always trusted.`, flags: MessageFlags.Ephemeral });
                return;
            }
            if (await isWhitelisted(guild.id, target.id)) {
                await interaction.reply({ content: `${e('error')} ${target.username} is already whitelisted.`, flags: MessageFlags.Ephemeral });
                return;
            }
            await addWhitelist(guild.id, target.id, interaction.user.id);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  <@${target.id}> added to whitelist\n-# They are now exempt from all antinuke detection`)
                .build();
            await sendResponse(interaction, [card], false, { parse: [] });
            return;
        }

        // ── Untrust ───────────────────────────────────────────────────────────
        if (sub === 'untrust') {
            const target = interaction.options.getUser('user', true);
            if (!(await isWhitelisted(guild.id, target.id))) {
                await interaction.reply({ content: `${e('error')} ${target.username} is not whitelisted.`, flags: MessageFlags.Ephemeral });
                return;
            }
            await removeWhitelist(guild.id, target.id);
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('success')}  <@${target.id}> removed from whitelist`)
                .build();
            await sendResponse(interaction, [card], false, { parse: [] });
            return;
        }

        // ── Admins view ───────────────────────────────────────────────────────
        if (sub === 'admins') {
            const admins = await getAntinukeAdmins(guild.id);
            if (!admins.length) {
                const card = new FadeContainer(Colours.FADE)
                    .text(`${e('protect')} No antinuke admins set.\n-# Antinuke admins can configure settings but are NOT whitelisted from detection.`)
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }
            const lines = admins.map(a =>
                `<@${a.userId}> · added by <@${a.addedBy}> · <t:${Math.floor(new Date(a.createdAt).getTime() / 1000)}:R>`
            );
            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('protect')} Antinuke Admins — ${admins.length}`)
                .separator(true)
                .text(lines.join('\n'))
                .separator(false)
                .text(`-# Admins can configure antinuke settings but are NOT exempt from detection.`)
                .build();
            await sendResponse(interaction, [card], true, { parse: [] });
            return;
        }

        // ── Admin add ─────────────────────────────────────────────────────────
        if (sub === 'admin') {
            const target = interaction.options.getUser('user', true);
            if (target.id === guild.ownerId) {
                await interaction.reply({ content: `${e('error')} The server owner always has full access.`, flags: MessageFlags.Ephemeral });
                return;
            }
            if (await isAntinukeAdmin(guild.id, target.id)) {
                await interaction.reply({ content: `${e('error')} ${target.username} is already an antinuke admin.`, flags: MessageFlags.Ephemeral });
                return;
            }
            await addAntinukeAdmin(guild.id, target.id, interaction.user.id);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `${e('success')}  <@${target.id}> granted antinuke admin\n` +
                    `-# They can configure settings but are NOT exempt from detection`
                )
                .build();
            await sendResponse(interaction, [card], false, { parse: [] });
            return;
        }

        // ── Admin remove ──────────────────────────────────────────────────────
        if (sub === 'unadmin') {
            const target = interaction.options.getUser('user', true);
            if (!(await isAntinukeAdmin(guild.id, target.id))) {
                await interaction.reply({ content: `${e('error')} ${target.username} is not an antinuke admin.`, flags: MessageFlags.Ephemeral });
                return;
            }
            await removeAntinukeAdmin(guild.id, target.id);
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('success')}  <@${target.id}> antinuke admin access revoked`)
                .build();
            await sendResponse(interaction, [card], false, { parse: [] });
            return;
        }
    },
} satisfies Command;