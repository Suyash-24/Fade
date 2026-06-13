// src/commands/tempvoice/vc.ts
// User controls for their own TempVoice channel.
// All subcommands check that the user is in a temp channel they own.
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import {
    getTempChannel,
    getOwnerChannel,
    transferOwnership,
} from '../../db/queries/tempvoice.js';
import { e, Colours } from '../../components/emojis.js';

// Helper — get the user's owned temp channel or reply with error
async function getOwnedChannel(interaction: any): Promise<{ channel: any; data: any } | null> {
    const voiceChannel = interaction.member?.voice?.channel;

    if (!voiceChannel) {
        await interaction.reply({
            content: `${e('error')} You must be in a voice channel to use this command.`,
            flags: MessageFlags.Ephemeral,
        });
        return null;
    }

    const data = await getTempChannel(voiceChannel.id);

    if (!data) {
        await interaction.reply({
            content: `${e('error')} This is not a TempVoice channel.`,
            flags: MessageFlags.Ephemeral,
        });
        return null;
    }

    if (data.ownerId !== interaction.user.id) {
        await interaction.reply({
            content: `${e('error')} You don't own this channel. The owner is <@${data.ownerId}>.`,
            flags: MessageFlags.Ephemeral,
        });
        return null;
    }

    return { channel: voiceChannel, data };
}

export default {
    data: new SlashCommandBuilder()
        .setName('vc')
        .setDescription('Control your TempVoice channel')

        .addSubcommand(s => s
            .setName('name')
            .setDescription('Rename your voice channel')
            .addStringOption(o => o.setName('name').setDescription('New channel name').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('limit')
            .setDescription('Set the user limit for your channel (0 = unlimited)')
            .addIntegerOption(o => o
                .setName('limit')
                .setDescription('User limit (0–99)')
                .setMinValue(0).setMaxValue(99)
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('lock')
            .setDescription('Lock your channel — no one new can join')
        )
        .addSubcommand(s => s
            .setName('unlock')
            .setDescription('Unlock your channel')
        )
        .addSubcommand(s => s
            .setName('hide')
            .setDescription('Hide your channel from everyone')
        )
        .addSubcommand(s => s
            .setName('unhide')
            .setDescription('Make your channel visible again')
        )
        .addSubcommand(s => s
            .setName('permit')
            .setDescription('Allow a specific user to join your locked channel')
            .addUserOption(o => o.setName('user').setDescription('User to permit').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('reject')
            .setDescription('Remove a user\'s permission to join your channel')
            .addUserOption(o => o.setName('user').setDescription('User to reject').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('kick')
            .setDescription('Kick a user from your voice channel')
            .addUserOption(o => o.setName('user').setDescription('User to kick').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('transfer')
            .setDescription('Transfer ownership of your channel to another user')
            .addUserOption(o => o.setName('user').setDescription('New owner').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('claim')
            .setDescription('Claim an ownerless temp voice channel you are in')
        )
        .addSubcommand(s => s
            .setName('info')
            .setDescription('View info about your current temp voice channel')
        ),

    category: 'tempvoice',
    guildOnly: true,
    cooldown:  3,

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();

        // ── Claim (special — doesn't require ownership) ───────────────────────
        if (sub === 'claim') {
            const voiceChannel = (interaction.member as any)?.voice?.channel;
            if (!voiceChannel) {
                const card = new FadeContainer(Colours.DANGER)
                    .text(`${e('error')}  You must be in a voice channel to use this command.`)
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }

            const data = await getTempChannel(voiceChannel.id);
            if (!data) {
                const card = new FadeContainer(Colours.DANGER)
                    .text(`${e('error')}  This is not a TempVoice channel.`)
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }

            // Block if user is already the owner
            if (data.ownerId === interaction.user.id) {
                const card = new FadeContainer(Colours.DANGER)
                    .text(`${e('error')}  You already own this channel.`)
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }

            // Check if owner is still in the channel
            const ownerInChannel = voiceChannel.members?.has(data.ownerId);
            if (ownerInChannel) {
                const card = new FadeContainer(Colours.DANGER)
                    .text(`${e('error')}  The owner <@${data.ownerId}> is still in the channel.`)
                    .build();
                await sendResponse(interaction, [card], true, { users: [] });
                return;
            }

            await transferOwnership(voiceChannel.id, interaction.user.id);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  You now own **${voiceChannel.name}**`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── All other subcommands require ownership ────────────────────────────
        const owned = await getOwnedChannel(interaction);
        if (!owned) return;
        const { channel } = owned;

        // ── Name ──────────────────────────────────────────────────────────────
        if (sub === 'name') {
            const name = interaction.options.getString('name', true);
            await channel.setName(name);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Channel renamed to **${name}**`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Limit ─────────────────────────────────────────────────────────────
        if (sub === 'limit') {
            const limit = interaction.options.getInteger('limit', true);
            await channel.setUserLimit(limit);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  User limit set to \`${limit === 0 ? 'Unlimited' : limit}\``)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Lock ──────────────────────────────────────────────────────────────
        if (sub === 'lock') {
            await channel.permissionOverwrites.edit(interaction.guild!.id, {
                Connect: false,
            });
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('lock')}  Channel locked — no new members can join`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Unlock ────────────────────────────────────────────────────────────
        if (sub === 'unlock') {
            await channel.permissionOverwrites.edit(interaction.guild!.id, {
                Connect: null, // Reset to default
            });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('unlock')}  Channel unlocked`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Hide ──────────────────────────────────────────────────────────────
        if (sub === 'hide') {
            await channel.permissionOverwrites.edit(interaction.guild!.id, {
                ViewChannel: false,
            });
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('offline')}  Channel hidden from everyone`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Unhide ────────────────────────────────────────────────────────────
        if (sub === 'unhide') {
            await channel.permissionOverwrites.edit(interaction.guild!.id, {
                ViewChannel: null, // Reset to default
            });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('online')}  Channel visible again`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Permit ────────────────────────────────────────────────────────────
        if (sub === 'permit') {
            const target = interaction.options.getUser('user', true);
            await channel.permissionOverwrites.edit(target.id, {
                Connect:     true,
                ViewChannel: true,
            });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  <@${target.id}> can now join your channel`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Reject ────────────────────────────────────────────────────────────
        if (sub === 'reject') {
            const target = interaction.options.getUser('user', true);
            await channel.permissionOverwrites.edit(target.id, {
                Connect:     false,
                ViewChannel: false,
            });
            // Kick them if they're in the channel
            const targetMember = channel.members?.get(target.id);
            if (targetMember) {
                await targetMember.voice.disconnect('[Fade TempVoice] Rejected by owner').catch(() => null);
            }
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('success')}  <@${target.id}> rejected from your channel`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Kick ──────────────────────────────────────────────────────────────
        if (sub === 'kick') {
            const target       = interaction.options.getUser('user', true);
            const targetMember = channel.members?.get(target.id);

            if (!targetMember) {
                await interaction.reply({
                    content: `${e('error')} <@${target.id}> is not in your channel.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await targetMember.voice.disconnect('[Fade TempVoice] Kicked by channel owner').catch(() => null);
            const card = new FadeContainer(Colours.WARNING)
                .text(`${e('success')}  <@${target.id}> kicked from your channel`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Transfer ──────────────────────────────────────────────────────────
        if (sub === 'transfer') {
            const target       = interaction.options.getUser('user', true);
            const targetMember = channel.members?.get(target.id);

            if (!targetMember) {
                await interaction.reply({
                    content: `${e('error')} <@${target.id}> must be in your channel to transfer ownership.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            if (target.id === interaction.user.id) {
                await interaction.reply({
                    content: `${e('error')} You already own this channel.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await transferOwnership(channel.id, target.id);

            // Update channel permissions
            await channel.permissionOverwrites.edit(target.id, {
                ManageChannels: true,
                MoveMembers:    true,
                MuteMembers:    true,
            });
            await channel.permissionOverwrites.edit(interaction.user.id, {
                ManageChannels: null,
                MoveMembers:    null,
                MuteMembers:    null,
            });

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Ownership transferred to <@${target.id}>`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Info ──────────────────────────────────────────────────────────────
        if (sub === 'info') {
            const data      = owned.data;
            const members   = [...(channel.members?.values() ?? [])];
            const createdAt = Math.floor(channel.createdTimestamp / 1000);

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('voice')} ${channel.name}`)
                .separator(true)
                .text([
                    `${e('crown')}  **Owner** — <@${data.ownerId}>`,
                    `${e('members')}  **Members** — \`${members.length}${channel.userLimit ? `/${channel.userLimit}` : ''}\``,
                    `${e('date')}  **Created** — <t:${createdAt}:R>`,
                    `${e('lock')}  **Status** — \`${channel.permissionsFor(interaction.guild!.id)?.has('Connect') === false ? 'Locked' : 'Open'}\``,
                ].join('\n'))
                .build();
            await sendResponse(interaction, [card], true, { users: [] });
            return;
        }
    },
} satisfies Command;