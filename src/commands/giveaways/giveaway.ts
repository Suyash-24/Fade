//src/commands/giveaways/giveaway.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, fadeReply } from '../../components/builders.js';
import {
    createGiveaway,
    updateGiveawayMessage,
    updateGiveaway,
    getGiveaway,
    getActiveGiveaways,
    getAllGiveaways,
    cancelGiveaway,
    pickWinners,
    getEntryCount,
} from '../../db/queries/giveaways.js';
import { buildGiveawayCard, concludeGiveaway } from '../../utils/giveawayUtils.js';
import { getLevelConfig } from '../../db/queries/leveling.js';
import { parseDuration, formatDuration } from '../../utils/moderation.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('giveaway')
        .setDescription('Manage giveaways')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(s => s
            .setName('start')
            .setDescription('Start a new giveaway')
            .addStringOption(o => o.setName('prize').setDescription('What are you giving away?').setRequired(true))
            .addStringOption(o => o.setName('duration').setDescription('How long? (e.g. 1h, 30m, 7d)').setRequired(true))
            .addIntegerOption(o => o
                .setName('winners')
                .setDescription('Number of winners (default 1)')
                .setMinValue(1).setMaxValue(20)
                .setRequired(false)
            )
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel to post in (default: current channel)')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(false)
            )
            .addRoleOption(o => o
                .setName('required_role')
                .setDescription('Role required to enter')
                .setRequired(false)
            )
            .addIntegerOption(o => o
                .setName('min_level')
                .setDescription('Minimum level required to enter')
                .setMinValue(1)
                .setRequired(false)
            )
            .addStringOption(o => o
                .setName('description')
                .setDescription('Giveaway description text')
                .setRequired(false)
                .setMaxLength(500)
            )
            .addStringOption(o => o
                .setName('image')
                .setDescription('Image URL for the giveaway card')
                .setRequired(false)
            )
        )

        .addSubcommand(s => s
            .setName('end')
            .setDescription('End a giveaway early and pick winners')
            .addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true))
        )

        .addSubcommand(s => s
            .setName('reroll')
            .setDescription('Reroll winners for an ended giveaway')
            .addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true))
            .addIntegerOption(o => o
                .setName('winners')
                .setDescription('Number of winners to reroll (default: original count)')
                .setMinValue(1).setMaxValue(20)
                .setRequired(false)
            )
        )

        .addSubcommand(s => s
            .setName('list')
            .setDescription('List all active giveaways in this server')
        )

        .addSubcommand(s => s
            .setName('delete')
            .setDescription('Cancel and delete a giveaway')
            .addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true))
        )

        .addSubcommandGroup(g => g
            .setName('edit')
            .setDescription('Edit an active giveaway')
            .addSubcommand(s => s
                .setName('prize')
                .setDescription('Change the prize')
                .addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true))
                .addStringOption(o => o.setName('prize').setDescription('New prize').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('winners')
                .setDescription('Change the winner count')
                .addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true))
                .addIntegerOption(o => o.setName('count').setDescription('New winner count').setMinValue(1).setMaxValue(20).setRequired(true))
            )
            .addSubcommand(s => s
                .setName('duration')
                .setDescription('Change the end time')
                .addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true))
                .addStringOption(o => o.setName('duration').setDescription('New duration from now (e.g. 2h, 1d)').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('host')
                .setDescription('Change the host')
                .addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true))
                .addUserOption(o => o.setName('host').setDescription('New host').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('description')
                .setDescription('Set a description')
                .addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true))
                .addStringOption(o => o.setName('text').setDescription('Description text').setRequired(true).setMaxLength(500))
            )
            .addSubcommand(s => s
                .setName('image')
                .setDescription('Set an image URL')
                .addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true))
                .addStringOption(o => o.setName('url').setDescription('Image URL').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('requiredroles')
                .setDescription('Set required roles (comma-separated mentions)')
                .addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true))
                .addStringOption(o => o.setName('roles').setDescription('Role mentions separated by spaces').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('minlevel')
                .setDescription('Set minimum level requirement')
                .addIntegerOption(o => o.setName('id').setDescription('Giveaway ID').setRequired(true))
                .addIntegerOption(o => o.setName('level').setDescription('Minimum level (0 = disabled)').setMinValue(0).setRequired(true))
            )
        ),

    category:        'giveaways',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        5,

    async execute(interaction, client) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        // ── Start ─────────────────────────────────────────────────────────────
        if (sub === 'start') {
            const prize        = interaction.options.getString('prize', true);
            const durationStr  = interaction.options.getString('duration', true);
            const winnerCount  = interaction.options.getInteger('winners') ?? 1;
            const channel      = (interaction.options.getChannel('channel') ?? interaction.channel) as any;
            const requiredRole = interaction.options.getRole('required_role');
            const minLevel     = interaction.options.getInteger('min_level') ?? 0;
            const description  = interaction.options.getString('description');
            const image        = interaction.options.getString('image');

            const duration = parseDuration(durationStr);
            if (!duration || duration < 60) {
                await interaction.reply({
                    content: `${e('error')} Invalid duration. Minimum is 1 minute. Example: \`30m\`, \`1h\`, \`7d\``,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await interaction.deferReply({ flags: MessageFlags.Ephemeral });

            let warningText = '';
            if (minLevel > 0) {
                const levelConfig = await getLevelConfig(guild.id);
                if (!levelConfig.enabled) {
                    warningText = `⚠️ Heads up — Fade's leveling system is not enabled in this server. Members will need XP earned through Fade to meet this requirement. Enable it with \`/levelconfig toggle enabled:true\``;
                }
            }

            const endsAt = new Date(Date.now() + duration * 1000);

            // Create in DB first to get the ID
            const giveaway = await createGiveaway({
                guildId:      guild.id,
                channelId:    channel.id,
                hostId:       interaction.user.id,
                prize,
                winnerCount,
                endsAt,
                requiredRole: requiredRole?.id,
                minLevel,
                description:  description || null,
                image:        image || null,
            });

            // Build and send the giveaway card
            const card = buildGiveawayCard({
                id:           giveaway.id,
                prize,
                hostId:       interaction.user.id,
                winnerCount,
                endsAt,
                entryCount:   0,
                requiredRole: requiredRole?.id,
                minLevel,
                description:  description || null,
                image:        image || null,
            });

            const msg = await channel.send({
                components: [card],
                flags:      MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
            } as any);

            await updateGiveawayMessage(giveaway.id, msg.id);

            // Confirm to the command user
            const confirmCard = new FadeContainer(Colours.SUCCESS)
                .text(
                    `## ${e('tada')} Giveaway Started!\n` +
                    `**${prize}**\n` +
                    `${e('date')}  Ends <t:${Math.floor(endsAt.getTime() / 1000)}:R>\n` +
                    `${e('members')}  ${winnerCount} winner${winnerCount > 1 ? 's' : ''}\n` +
                    (requiredRole ? `${e('roles')}  Requires <@&${requiredRole.id}>\n` : '') +
                    (minLevel ? `${e('level')}  Min level ${minLevel}\n` : '') +
                    `-# ID: ${giveaway.id} · Posted in <#${channel.id}>` +
                    (warningText ? `\n\n${warningText}` : '')
                )
                .build();

            await interaction.editReply(fadeReply([confirmCard]) as any);
            return;
        }

        // ── End ───────────────────────────────────────────────────────────────
        if (sub === 'end') {
            const id       = interaction.options.getInteger('id', true);
            const giveaway = await getGiveaway(id);

            if (!giveaway || giveaway.guildId !== guild.id) {
                await interaction.reply({ content: `${e('error')} Giveaway #${id} not found.`, flags: MessageFlags.Ephemeral });
                return;
            }

            if (giveaway.status !== 'active') {
                await interaction.reply({ content: `${e('error')} That giveaway has already ended.`, flags: MessageFlags.Ephemeral });
                return;
            }

            await interaction.deferReply();
            const winners = await concludeGiveaway(guild, giveaway);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `${e('success')}  Giveaway **${giveaway.prize}** ended\n` +
                    (winners.length
                        ? `🏆  Winner${winners.length > 1 ? 's' : ''}: ${winners.map(w => `<@${w}>`).join(', ')}`
                        : `-# No entries — no winners selected`)
                )
                .build();

            await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);
            return;
        }

        // ── Reroll ────────────────────────────────────────────────────────────
        if (sub === 'reroll') {
            const id          = interaction.options.getInteger('id', true);
            const winnerCount = interaction.options.getInteger('winners');
            
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const giveaway    = await getGiveaway(id);

            if (!giveaway || giveaway.guildId !== guild.id) {
                await interaction.editReply({ content: `${e('error')} Giveaway #${id} not found.` });
                return;
            }

            if (giveaway.status === 'active') {
                await interaction.editReply({ content: `${e('error')} That giveaway is still active. Use \`/giveaway end\` first.` });
                return;
            }

            const count   = winnerCount ?? giveaway.winnerCount;
            const winners = await pickWinners(id, count);

            if (!winners.length) {
                await interaction.editReply({ content: `${e('error')} No entries to pick from.` });
                return;
            }

            // Send reroll announcement
            const channel = guild.channels.cache.get(giveaway.channelId) as any;
            if (channel?.isTextBased()) {
                const winnerMentions = winners.map(w => `<@${w}>`).join(', ');
                const announceCard = new FadeContainer(Colours.FADE)
                    .text(
                        `## 🎊 Reroll — ${giveaway.prize}\n` +
                        `New winner${winners.length > 1 ? 's' : ''}: ${winnerMentions}\n` +
                        `-# Rerolled by <@${interaction.user.id}>`
                    )
                    .build();

                await channel.send({
                    content:    winnerMentions,
                    components: [announceCard],
                    flags:      MessageFlags.IsComponentsV2,
                } as any).catch(() => null);
            }

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Rerolled **${giveaway.prize}**\nNew winners: ${winners.map(w => `<@${w}>`).join(', ')}`)
                .build();

            await interaction.editReply(fadeReply([card]) as any);
            return;
        }

        // ── List ──────────────────────────────────────────────────────────────
        if (sub === 'list') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const all = await getAllGiveaways(guild.id);

            if (!all.length) {
                const card = new FadeContainer(Colours.FADE)
                    .text(`${e('tada')} No giveaways found.\nStart one with \`/giveaway start\`!`)
                    .build();
                await interaction.editReply(fadeReply([card]) as any);
                return;
            }

            const lines = await Promise.all(all.map(async g => {
                const count  = await getEntryCount(g.id);
                const endsTs = Math.floor(new Date(g.endsAt).getTime() / 1000);
                const status = g.status === 'active' ? '🟢' : g.status === 'ended' ? '🔴' : '⚫';
                return `${status} **#${g.id}** · **${g.prize}** · ${count} entries · <t:${endsTs}:R>`;
            }));

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('tada')} Giveaways (${all.length})`)
                .separator(true)
                .text(lines.join('\n'))
                .build();

            await interaction.editReply(fadeReply([card]) as any);
            return;
        }

        // ── Edit ──────────────────────────────────────────────────────────────
        const group = interaction.options.getSubcommandGroup(false);
        if (group === 'edit') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const id       = interaction.options.getInteger('id', true);
            const giveaway = await getGiveaway(id);

            if (!giveaway || giveaway.guildId !== guild.id) {
                await interaction.editReply({ content: `${e('error')} Giveaway #${id} not found.` });
                return;
            }
            if (giveaway.status !== 'active') {
                await interaction.editReply({ content: `${e('error')} That giveaway has already ended.` });
                return;
            }

            let updateValues: any = {};
            let confirmText = '';

            if (sub === 'prize') {
                const prize = interaction.options.getString('prize', true);
                updateValues = { prize };
                confirmText = `Prize updated to **${prize}**`;
            } else if (sub === 'winners') {
                const count = interaction.options.getInteger('count', true);
                updateValues = { winnerCount: count };
                confirmText = `Winner count updated to **${count}**`;
            } else if (sub === 'duration') {
                const durationStr = interaction.options.getString('duration', true);
                const seconds = parseDuration(durationStr);
                if (!seconds || seconds < 60) {
                    await interaction.editReply({ content: `${e('error')} Invalid duration.` });
                    return;
                }
                const endsAt = new Date(Date.now() + seconds * 1000);
                updateValues = { endsAt };
                confirmText = `End time updated to <t:${Math.floor(endsAt.getTime() / 1000)}:R>`;
            } else if (sub === 'host') {
                const host = interaction.options.getUser('host', true);
                updateValues = { hostId: host.id };
                confirmText = `Host updated to <@${host.id}>`;
            } else if (sub === 'description') {
                const text = interaction.options.getString('text', true);
                updateValues = { description: text };
                confirmText = `Description updated`;
            } else if (sub === 'image') {
                const url = interaction.options.getString('url', true);
                updateValues = { image: url };
                confirmText = `Image updated`;
            } else if (sub === 'requiredroles') {
                const rolesStr = interaction.options.getString('roles', true);
                const roleIds  = [...rolesStr.matchAll(/<@&(\d+)>/g)].map(m => m[1]);
                updateValues = { requiredRoles: roleIds };
                confirmText = `Required roles updated to ${roleIds.map((r: string) => `<@&${r}>`).join(', ') || 'none'}`;
            } else if (sub === 'minlevel') {
                const level = interaction.options.getInteger('level', true);
                updateValues = { minLevel: level };
                confirmText = `Min level updated to **${level || 'disabled'}**`;
            }

            await updateGiveaway(id, updateValues);

            // Rebuild the giveaway card
            const updated = await getGiveaway(id);
            if (updated?.messageId) {
                const channel = guild.channels.cache.get(updated.channelId) as any;
                const msg = await channel?.messages.fetch(updated.messageId).catch(() => null);
                if (msg) {
                    const entryCount = await getEntryCount(id);
                    const card = buildGiveawayCard({
                        id,
                        prize:        updated.prize,
                        hostId:       updated.hostId,
                        winnerCount:  updated.winnerCount,
                        endsAt:       new Date(updated.endsAt),
                        entryCount,
                        requiredRole: updated.requiredRole,
                        minLevel:     updated.minLevel,
                    });
                    await msg.edit({ 
                        components: [card], 
                        flags: MessageFlags.IsComponentsV2,
                        allowedMentions: { parse: [] },
                    } as any).catch(() => null);
                }
            }

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  ${confirmText}`)
                .build();
            await interaction.editReply(fadeReply([card]) as any);
            return;
        }

        // ── Delete ────────────────────────────────────────────────────────────
        if (sub === 'delete') {
            await interaction.deferReply({ flags: MessageFlags.Ephemeral });
            const id       = interaction.options.getInteger('id', true);
            const giveaway = await getGiveaway(id);

            if (!giveaway || giveaway.guildId !== guild.id) {
                await interaction.editReply({ content: `${e('error')} Giveaway #${id} not found.` });
                return;
            }

            await cancelGiveaway(id);

            // Delete the giveaway message
            if (giveaway.messageId) {
                const channel = guild.channels.cache.get(giveaway.channelId) as any;
                await channel?.messages.delete(giveaway.messageId).catch(() => null);
            }

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Giveaway **${giveaway.prize}** cancelled and deleted`)
                .build();

            await interaction.editReply(fadeReply([card]) as any);
            return;
        }
    },
} satisfies Command;