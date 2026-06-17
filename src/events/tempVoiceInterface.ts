// src/events/tempVoiceInterface.ts
// Handles all TempVoice interface button and modal interactions.
import {
    MessageFlags,
    PermissionFlagsBits,
} from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import {
    getTempChannel,
    transferOwnership,
} from '../db/queries/tempvoice.js';
import {
    nameModal, limitModal, permitModal,
    rejectModal, kickModal, transferModal,
    banModal, unbanModal, muteModal, unmuteModal, deafenModal, undeafenModal,
} from '../utils/tempVoiceInterface.js';
import { FadeContainer } from '../components/builders.js';
import { e, Colours } from '../components/emojis.js';
import { logger } from '../utils/logger.js';

// ── Helper: verify ownership ──────────────────────────────────────────────────

async function verifyOwner(interaction: any): Promise<{ channel: any; data: any } | null> {
    const voiceChannel = interaction.member?.voice?.channel;
    if (!voiceChannel) {
        await interaction.reply({
            content: `${e('error')} You must be in your temp voice channel.`,
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
            content: `${e('error')} Only the channel owner <@${data.ownerId}> can do this.`,
            flags: MessageFlags.Ephemeral,
        });
        return null;
    }

    return { channel: voiceChannel, data };
}

// ── Quick reply helper ────────────────────────────────────────────────────────

async function quickReply(interaction: any, color: number, text: string) {
    const card = new FadeContainer(color).text(text).build();
    await interaction.reply({
        components: [card],
        flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
    } as any);
}

// ── Button handler ────────────────────────────────────────────────────────────

const buttonEvent: Event<'interactionCreate'> = {
    name: 'interactionCreate',
    async execute(client: FadeClient, interaction) {
        if (!interaction.isMessageComponent()) return;
        if (!interaction.guild) return;

        const id = interaction.customId;
        if (!id.startsWith('tvc_')) return;

        try {
            // ── Modals (no ownership check yet — modal handles it) ─────────────
            const modals: Record<string, () => any> = {
                tvc_name: nameModal,
                tvc_limit: limitModal,
                tvc_permit: permitModal,
                tvc_reject: rejectModal,
                tvc_kick: kickModal,
                tvc_transfer: transferModal,
                tvc_ban: banModal,
                tvc_unban: unbanModal,
                tvc_mute: muteModal,
                tvc_unmute: unmuteModal,
                tvc_deafen: deafenModal,
                tvc_undeafen: undeafenModal,
            };

            if (modals[id]) {
                const owned = await verifyOwner(interaction);
                if (!owned) return;
                await interaction.showModal(modals[id]());
                return;
            }

            // ── Instant actions ───────────────────────────────────────────────

            if (id === 'tvc_lock') {
                const owned = await verifyOwner(interaction);
                if (!owned) return;
                await owned.channel.permissionOverwrites.edit(interaction.guild.id, { Connect: false });
                await quickReply(interaction, Colours.WARNING, `${e('success')}  Channel **locked**`);
                return;
            }

            if (id === 'tvc_unlock') {
                const owned = await verifyOwner(interaction);
                if (!owned) return;
                await owned.channel.permissionOverwrites.edit(interaction.guild.id, { Connect: null });
                await quickReply(interaction, Colours.SUCCESS, `${e('success')}  Channel **unlocked**`);
                return;
            }

            if (id === 'tvc_hide') {
                const owned = await verifyOwner(interaction);
                if (!owned) return;
                await owned.channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: false });
                await quickReply(interaction, Colours.WARNING, `${e('success')}  Channel **hidden**`);
                return;
            }

            if (id === 'tvc_unhide') {
                const owned = await verifyOwner(interaction);
                if (!owned) return;
                await owned.channel.permissionOverwrites.edit(interaction.guild.id, { ViewChannel: null });
                await quickReply(interaction, Colours.SUCCESS, `${e('success')}  Channel **visible**`);
                return;
            }

            if (id === 'tvc_info' || id === 'tvc_privacy') {
                const voiceChannel = (interaction.member as any)?.voice?.channel;
                if (!voiceChannel) {
                    await interaction.reply({ content: `${e('error')} You are not in a voice channel.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                const data = await getTempChannel(voiceChannel.id);
                if (!data) {
                    await interaction.reply({ content: `${e('error')} Not a TempVoice channel.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                const createdAt = Math.floor(voiceChannel.createdTimestamp / 1000);
                const card = new FadeContainer(Colours.FADE)
                    .text(`## ${e('voice')} ${voiceChannel.name}`)
                    .separator(true)
                    .text([
                        `${e('crown')}  **Owner** — <@${data.ownerId}>`,
                        `${e('members')}  **Members** — \`${voiceChannel.members?.size ?? 0}${voiceChannel.userLimit ? `/${voiceChannel.userLimit}` : ''}\``,
                        `${e('date')}  **Created** — <t:${createdAt}:R>`,
                    ].join('\n'))
                    .build();
                await interaction.reply({ components: [card], flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral } as any);
                return;
            }

            if (id === 'tvc_claim') {
                const voiceChannel = (interaction.member as any)?.voice?.channel;
                if (!voiceChannel) {
                    await interaction.reply({ content: `${e('error')} You must be in a voice channel.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                const data = await getTempChannel(voiceChannel.id);
                if (!data) {
                    await interaction.reply({ content: `${e('error')} Not a TempVoice channel.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                if (voiceChannel.members?.has(data.ownerId)) {
                    await interaction.reply({
                        content: `${e('error')} The owner <@${data.ownerId}> is still in the channel.`,
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
                await transferOwnership(voiceChannel.id, interaction.user.id);
                await quickReply(interaction, Colours.SUCCESS, `${e('crown')}  You now own **${voiceChannel.name}**`);
                return;
            }

            if (id === 'tvc_delete') {
                const owned = await verifyOwner(interaction);
                if (!owned) return;
                await interaction.reply({ content: `${e('warn')} Deleting channel in 5 seconds...`, flags: MessageFlags.Ephemeral });
                setTimeout(async () => {
                    await owned.channel.delete('[Fade TempVoice] Deleted by owner').catch(() => null);
                }, 5_000);
                return;
            }

        } catch (err) {
            logger.error('TempVoice interface button failed', err, { id, guildId: interaction.guild.id });
        }
    },
};

// ── Modal handler ─────────────────────────────────────────────────────────────

const modalEvent: Event<'interactionCreate'> = {
    name: 'interactionCreate',
    async execute(client: FadeClient, interaction) {
        if (!interaction.isModalSubmit()) return;
        if (!interaction.guild) return;

        const id = interaction.customId;
        if (!id.startsWith('tvc_modal_')) return;

        const voiceChannel = (interaction.member as any)?.voice?.channel;
        if (!voiceChannel) {
            await interaction.reply({ content: `${e('error')} You must be in your voice channel.`, flags: MessageFlags.Ephemeral });
            return;
        }

        const data = await getTempChannel(voiceChannel.id);
        if (!data || data.ownerId !== interaction.user.id) {
            await interaction.reply({ content: `${e('error')} You don't own this channel.`, flags: MessageFlags.Ephemeral });
            return;
        }

        try {
            if (id === 'tvc_modal_name') {
                const name = interaction.fields.getTextInputValue('name');
                await voiceChannel.setName(name);
                await quickReply(interaction, Colours.SUCCESS, `${e('success')}  Renamed to **${name}**`);
                return;
            }

            if (id === 'tvc_modal_limit') {
                const limitStr = interaction.fields.getTextInputValue('limit');
                const limit    = parseInt(limitStr);
                if (isNaN(limit) || limit < 0 || limit > 99) {
                    await interaction.reply({ content: `${e('error')} Enter a number between 0 and 99.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                await voiceChannel.setUserLimit(limit);
                await quickReply(interaction, Colours.SUCCESS, `${e('success')}  Limit set to \`${limit === 0 ? 'Unlimited' : limit}\``);
                return;
            }

            if (id === 'tvc_modal_permit') {
                const userId = interaction.fields.getTextInputValue('user_id').trim();
                await voiceChannel.permissionOverwrites.edit(userId, { Connect: true, ViewChannel: true });
                await quickReply(interaction, Colours.SUCCESS, `${e('success')}  <@${userId}> permitted`);
                return;
            }

            if (id === 'tvc_modal_reject') {
                const userId = interaction.fields.getTextInputValue('user_id').trim();
                await voiceChannel.permissionOverwrites.edit(userId, { Connect: false, ViewChannel: false });
                const targetMember = voiceChannel.members?.get(userId);
                if (targetMember) await targetMember.voice.disconnect().catch(() => null);
                await quickReply(interaction, Colours.WARNING, `${e('success')}  <@${userId}> rejected`);
                return;
            }

            if (id === 'tvc_modal_kick') {
                const userId       = interaction.fields.getTextInputValue('user_id').trim();
                const targetMember = voiceChannel.members?.get(userId);
                if (!targetMember) {
                    await interaction.reply({ content: `${e('error')} That user is not in your channel.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                await targetMember.voice.disconnect('[Fade TempVoice] Kicked by owner');
                await quickReply(interaction, Colours.WARNING, `${e('success')}  <@${userId}> kicked`);
                return;
            }

            if (id === 'tvc_modal_ban') {
                const userId = interaction.fields.getTextInputValue('user_id').trim();
                // To ban from a voice channel, we deny Connect and ViewChannel, effectively banning them
                await voiceChannel.permissionOverwrites.edit(userId, { Connect: false, ViewChannel: false });
                const targetMember = voiceChannel.members?.get(userId);
                if (targetMember) await targetMember.voice.disconnect('[Fade TempVoice] Banned by owner');
                await quickReply(interaction, Colours.WARNING, `${e('success')}  <@${userId}> banned from your channel`);
                return;
            }

            if (id === 'tvc_modal_unban') {
                const userId = interaction.fields.getTextInputValue('user_id').trim();
                // To unban, we remove the specific deny overwrite
                await voiceChannel.permissionOverwrites.delete(userId);
                await quickReply(interaction, Colours.SUCCESS, `${e('success')}  <@${userId}> unbanned`);
                return;
            }

            if (id === 'tvc_modal_mute') {
                const userId = interaction.fields.getTextInputValue('user_id').trim();
                const targetMember = voiceChannel.members?.get(userId);
                if (!targetMember) {
                    await interaction.reply({ content: `${e('error')} User is not in your channel.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                await targetMember.voice.setMute(true, '[Fade TempVoice] Muted by owner');
                await quickReply(interaction, Colours.WARNING, `${e('success')}  <@${userId}> server muted`);
                return;
            }

            if (id === 'tvc_modal_unmute') {
                const userId = interaction.fields.getTextInputValue('user_id').trim();
                const targetMember = voiceChannel.members?.get(userId);
                if (!targetMember) {
                    await interaction.reply({ content: `${e('error')} User is not in your channel.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                await targetMember.voice.setMute(false, '[Fade TempVoice] Unmuted by owner');
                await quickReply(interaction, Colours.SUCCESS, `${e('success')}  <@${userId}> server unmuted`);
                return;
            }

            if (id === 'tvc_modal_deafen') {
                const userId = interaction.fields.getTextInputValue('user_id').trim();
                const targetMember = voiceChannel.members?.get(userId);
                if (!targetMember) {
                    await interaction.reply({ content: `${e('error')} User is not in your channel.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                await targetMember.voice.setDeaf(true, '[Fade TempVoice] Deafened by owner');
                await quickReply(interaction, Colours.WARNING, `${e('success')}  <@${userId}> server deafened`);
                return;
            }

            if (id === 'tvc_modal_undeafen') {
                const userId = interaction.fields.getTextInputValue('user_id').trim();
                const targetMember = voiceChannel.members?.get(userId);
                if (!targetMember) {
                    await interaction.reply({ content: `${e('error')} User is not in your channel.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                await targetMember.voice.setDeaf(false, '[Fade TempVoice] Undeafened by owner');
                await quickReply(interaction, Colours.SUCCESS, `${e('success')}  <@${userId}> server undeafened`);
                return;
            }

            if (id === 'tvc_modal_transfer') {
                const userId       = interaction.fields.getTextInputValue('user_id').trim();
                const targetMember = voiceChannel.members?.get(userId);
                if (!targetMember) {
                    await interaction.reply({ content: `${e('error')} That user must be in your channel.`, flags: MessageFlags.Ephemeral });
                    return;
                }
                await transferOwnership(voiceChannel.id, userId);
                await voiceChannel.permissionOverwrites.edit(userId, { ManageChannels: true, MoveMembers: true });
                await voiceChannel.permissionOverwrites.edit(interaction.user.id, { ManageChannels: null, MoveMembers: null });
                await quickReply(interaction, Colours.SUCCESS, `${e('crown')}  Ownership transferred to <@${userId}>`);
                return;
            }

        } catch (err) {
            logger.error('TempVoice modal failed', err, { id, guildId: interaction.guild.id });
            await interaction.reply({ content: `${e('error')} Something went wrong. Make sure my role is higher than the user.`, flags: MessageFlags.Ephemeral }).catch(() => null);
        }
    },
};

export default [buttonEvent, modalEvent];