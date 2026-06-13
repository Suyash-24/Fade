// src/commands/antiraid/antiraid.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import {
    getAntiraidConfig, updateAntiraidConfig,
    getAntiraidWhitelist, isAntiraidWhitelisted,
    addAntiraidWhitelist, removeAntiraidWhitelist,
} from '../../db/queries/antiraid.js';
import { parseDuration } from '../../utils/moderation.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('antiraid')
        .setDescription('Configure the antiraid protection system')
        .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)

        .addSubcommand(s => s
            .setName('view')
            .setDescription('View current antiraid settings')
        )
        .addSubcommand(s => s
            .setName('toggle')
            .setDescription('Enable or disable antiraid')
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('action')
            .setDescription('Set what happens to raiders')
            .addStringOption(o => o
                .setName('type')
                .setDescription('Action to take')
                .setRequired(true)
                .addChoices(
                    { name: 'Ban',     value: 'ban'     },
                    { name: 'Kick',    value: 'kick'    },
                    { name: 'Timeout', value: 'timeout' },
                    { name: 'None',    value: 'none'    },
                )
            )
        )
        .addSubcommand(s => s
            .setName('threshold')
            .setDescription('Set how many joins in how many seconds triggers antiraid')
            .addIntegerOption(o => o
                .setName('joins')
                .setDescription('Number of joins to trigger (3–50)')
                .setMinValue(3).setMaxValue(50)
                .setRequired(true)
            )
            .addIntegerOption(o => o
                .setName('seconds')
                .setDescription('Time window in seconds (3–60)')
                .setMinValue(3).setMaxValue(60)
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('accountage')
            .setDescription('Kick accounts younger than a minimum age (0 = disabled)')
            .addIntegerOption(o => o
                .setName('days')
                .setDescription('Minimum account age in days (0 to disable)')
                .setMinValue(0).setMaxValue(365)
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('avatarrequired')
            .setDescription('Kick members who join without a profile picture')
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('lock')
            .setDescription('Lock all channels when a raid is detected')
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('whitelist')
            .setDescription('View whitelisted users (exempt from antiraid)')
        )
        .addSubcommand(s => s
            .setName('trust')
            .setDescription('Exempt a user from antiraid checks')
            .addUserOption(o => o.setName('user').setDescription('User to exempt').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('untrust')
            .setDescription('Remove a user from the antiraid whitelist')
            .addUserOption(o => o.setName('user').setDescription('User to remove').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('state')
            .setDescription('Manually toggle raid state (unlocks channels, re-enables events)')
            .addBooleanOption(o => o.setName('active').setDescription('true = raid active, false = end raid').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('recentban')
            .setDescription('Ban the last N accounts that joined the server')
            .addIntegerOption(o => o
                .setName('amount')
                .setDescription('Number of recent joiners to ban (1–100)')
                .setMinValue(1).setMaxValue(100).setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('raid')
            .setDescription('Ban or kick all accounts that joined in the last X time')
            .addStringOption(o => o
                .setName('duration')
                .setDescription('How far back to look (e.g. 30m, 2h)')
                .setRequired(true)
            )
            .addStringOption(o => o
                .setName('action')
                .setDescription('Action to take')
                .setRequired(true)
                .addChoices(
                    { name: 'Ban', value: 'ban' },
                    { name: 'Kick', value: 'kick' },
                )
            )
        ),

    category:        'antiraid',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.Administrator],
    cooldown:        5,

    async execute(interaction, client) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        // Only owner or admins
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
            await interaction.reply({ content: `${e('error')} You need Administrator permission.`, flags: 64 });
            return;
        }

        // ── View ──────────────────────────────────────────────────────────────
        if (sub === 'view') {
            const config = await getAntiraidConfig(guild.id);
            const minAgeDays = Math.floor(config.minAccountAge / 86_400);

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('protect')} Antiraid Config`)
                .separator(true)
                .text([
                    `**Enabled** — \`${config.enabled ? 'Yes' : 'No'}\``,
                    `**Action** — \`${config.action}\``,
                    `**Threshold** — \`${config.joinThreshold}\` joins in \`${config.joinWindow}s\``,
                    `**Min account age** — \`${minAgeDays > 0 ? `${minAgeDays} days` : 'Disabled'}\``,
                    `**Avatar required** — \`${config.requireAvatar ? 'Yes' : 'No'}\``,
                    `**Lock on raid** — \`${(config as any).lockOnRaid ? 'Yes' : 'No'}\``,
                ].join('\n'))
                .separator(false)
                .text(`-# Antiraid works alongside Antinuke for full server protection`)
                .build();

            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Toggle ────────────────────────────────────────────────────────────
        if (sub === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateAntiraidConfig(guild.id, { enabled });
            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(
                    `## ${e('protect')} Antiraid ${enabled ? 'Enabled' : 'Disabled'}\n` +
                    `-# ${enabled ? 'Your server is protected against mass join raids' : 'Raid protection is off'}`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Action ────────────────────────────────────────────────────────────
        if (sub === 'action') {
            const action = interaction.options.getString('type', true);
            await updateAntiraidConfig(guild.id, { action });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Antiraid action set to \`${action}\``)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Threshold ─────────────────────────────────────────────────────────
        if (sub === 'threshold') {
            const joins   = interaction.options.getInteger('joins', true);
            const seconds = interaction.options.getInteger('seconds', true);
            await updateAntiraidConfig(guild.id, {
                joinThreshold: joins,
                joinWindow:    seconds,
            });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `${e('success')}  Antiraid threshold set\n` +
                    `-# Triggers when \`${joins}\` members join within \`${seconds}s\``
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Account age ───────────────────────────────────────────────────────
        if (sub === 'accountage') {
            const days = interaction.options.getInteger('days', true);
            // Convert days to seconds for storage
            await updateAntiraidConfig(guild.id, { minAccountAge: days * 86_400 });
            const card = new FadeContainer(days > 0 ? Colours.SUCCESS : Colours.WARNING)
                .text(
                    days > 0
                        ? `${e('success')}  Accounts younger than \`${days} day${days === 1 ? '' : 's'}\` will be kicked on join`
                        : `${e('success')}  Account age filter disabled`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Avatar required ───────────────────────────────────────────────────
        if (sub === 'avatarrequired') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateAntiraidConfig(guild.id, { requireAvatar: enabled });
            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(`${e('success')}  Avatar requirement **${enabled ? 'enabled' : 'disabled'}**\n` +
                    (enabled ? `-# Members without a profile picture will be kicked` : ''))
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Lock on raid ──────────────────────────────────────────────────────
        if (sub === 'lock') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateAntiraidConfig(guild.id, { lockOnRaid: enabled } as any);
            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(`${e('success')}  Channel lock on raid **${enabled ? 'enabled' : 'disabled'}**\n` +
                    (enabled ? `-# All text channels will be locked when a raid is detected` : ''))
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Whitelist view ────────────────────────────────────────────────────
        if (sub === 'whitelist') {
            const list = await getAntiraidWhitelist(guild.id);
            if (!list.length) {
                await interaction.reply({ content: `${e('error')} No users whitelisted from antiraid.`, flags: MessageFlags.Ephemeral });
                return;
            }
            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('protect')} Antiraid Whitelist\n${list.map(w => `<@${w.userId}>`).join('\n')}`)
                .build();
            await sendResponse(interaction, [card], true, { parse: [] });
            return;
        }

        // ── Trust ─────────────────────────────────────────────────────────────
        if (sub === 'trust') {
            const user = interaction.options.getUser('user', true);
            if (await isAntiraidWhitelisted(guild.id, user.id)) {
                await interaction.reply({ content: `${e('error')} ${user.username} is already whitelisted.`, flags: MessageFlags.Ephemeral });
                return;
            }
            await addAntiraidWhitelist(guild.id, user.id);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  <@${user.id}> exempted from antiraid checks`)
                .build();
            await sendResponse(interaction, [card], false, { parse: [] });
            return;
        }

        // ── Untrust ───────────────────────────────────────────────────────────
        if (sub === 'untrust') {
            const user = interaction.options.getUser('user', true);
            await removeAntiraidWhitelist(guild.id, user.id);
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('success')}  <@${user.id}> removed from antiraid whitelist`)
                .build();
            await sendResponse(interaction, [card], false, { parse: [] });
            return;
        }

        // ── State ─────────────────────────────────────────────────────────────
        if (sub === 'state') {
            await interaction.deferReply();
            const active = interaction.options.getBoolean('active', true);
            const { setRaidState } = await import('../../events/antiraid.js');
            await setRaidState(guild, active);
            const card = new FadeContainer(active ? Colours.DANGER : Colours.SUCCESS)
                .text(
                    active
                        ? `${e('warn')}  Raid state **activated** manually\n-# Channels locked, new joiners will be actioned`
                        : `${e('success')}  Raid state **cleared**\n-# Channels unlocked, events re-enabled`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Recentban ─────────────────────────────────────────────────────────
        if (sub === 'recentban') {
            const amount = interaction.options.getInteger('amount', true);
            await interaction.deferReply();

            const recent = [...guild.members.cache.values()]
                .filter(m => !m.user.bot && m.id !== guild.ownerId)
                .sort((a, b) => (b.joinedTimestamp ?? 0) - (a.joinedTimestamp ?? 0))
                .slice(0, amount);

            let banned = 0;
            for (const m of recent) {
                const ok = await guild.bans.create(m.id, { reason: '[Fade] recentban command', deleteMessageSeconds: 0 }).catch(() => null);
                if (ok) banned++;
            }

            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('ban')}  Banned **${banned}** of the last **${amount}** accounts that joined`)
                .build();
            await interaction.editReply({ components: [card] as any, flags: 1 << 15 } as any);
            return;
        }

        // ── Raid cleanup ──────────────────────────────────────────────────────
        if (sub === 'raid') {
            const durationStr = interaction.options.getString('duration', true);
            const action      = interaction.options.getString('action', true) as 'ban' | 'kick';
            const seconds     = parseDuration(durationStr);

            if (!seconds) {
                await interaction.reply({ content: `${e('error')} Invalid duration. Use e.g. \`30m\`, \`2h\`.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.deferReply();

            const cutoff  = Date.now() - seconds * 1_000;
            const targets = [...guild.members.cache.values()].filter(m =>
                !m.user.bot &&
                m.id !== guild.ownerId &&
                m.joinedTimestamp !== null &&
                m.joinedTimestamp > cutoff
            );

            let affected = 0;
            for (const m of targets) {
                const reason = `[Fade] raid cleanup — joined in last ${durationStr}`;
                if (action === 'ban') {
                    await guild.bans.create(m.id, { reason, deleteMessageSeconds: 0 }).catch(() => null);
                } else {
                    await m.kick(reason).catch(() => null);
                }
                affected++;
            }

            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('ban')}  **${action === 'ban' ? 'Banned' : 'Kicked'}** **${affected}** accounts that joined in the last **${durationStr}**`)
                .build();
            await interaction.editReply({ components: [card] as any, flags: 1 << 15 } as any);
            return;
        }
    },
} satisfies Command;