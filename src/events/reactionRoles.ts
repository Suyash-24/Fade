// src/events/reactionRoles.ts
// Handles button role interactions, select menu role interactions,
// and reaction role add/remove — with exclusive mode support.
import { MessageFlags } from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import {
    getButtonRolesByMessage,
    getReactionRole,
    getReactionRolesByMessage,
} from '../db/queries/roles.js';
import { FadeContainer } from '../components/builders.js';
import { e, Colours } from '../components/emojis.js';
import { logger } from '../utils/logger.js';

// ── Button role handler ───────────────────────────────────────────────────────

export const buttonRoleHandler: Event<'interactionCreate'> = {
    name: 'interactionCreate',
    async execute(client: FadeClient, interaction) {
        if (!interaction.isMessageComponent()) return;
        if (!interaction.guild) return;

        const id = interaction.customId;
        if (!id.startsWith('brole_')) return;

        try {
            const roleId = id.replace('brole_', '');
            const member = interaction.member as any;
            if (!member) return;

            const messageId = interaction.message.id;
            const hasRole   = member.roles.cache.has(roleId);

            // Check if panel is exclusive
            const allEntries = await getButtonRolesByMessage(messageId);
            // Only consider button entries (style !== 0; style 0 = select menu)
            const buttonEntries = allEntries.filter(e => e.style !== 0);
            const isExclusive   = buttonEntries.some(e => e.exclusive);

            if (hasRole) {
                // Remove role
                await member.roles.remove(roleId, '[Fade] Button role removed').catch(() => null);
                const card = new FadeContainer(Colours.WARNING)
                    .text(`${e('roles')}  <@&${roleId}> removed`)
                    .build();
                await interaction.reply({
                    components: [card],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                } as any);
            } else {
                if (isExclusive) {
                    // Remove all other roles from this panel first
                    const otherRoleIds = buttonEntries
                        .map(e => e.roleId)
                        .filter(r => r !== roleId && member.roles.cache.has(r));
                    for (const rid of otherRoleIds) {
                        await member.roles.remove(rid, '[Fade] Exclusive button role swap').catch(() => null);
                    }
                }

                // Add role
                await member.roles.add(roleId, '[Fade] Button role added').catch(() => null);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  <@&${roleId}> added`)
                    .build();
                await interaction.reply({
                    components: [card],
                    flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
                } as any);
            }

        } catch (err) {
            logger.error('Button role handler failed', err, { id, guildId: interaction.guild.id });
        }
    },
};

// ── Select menu role handler ──────────────────────────────────────────────────

export const selectRoleHandler: Event<'interactionCreate'> = {
    name: 'interactionCreate',
    async execute(client: FadeClient, interaction) {
        if (!interaction.isStringSelectMenu()) return;
        if (!interaction.guild) return;

        const id = interaction.customId;
        if (!id.startsWith('srole_')) return;

        try {
            const member      = interaction.member as any;
            const selectedIds = interaction.values; // role IDs selected
            if (!member) return;

            // New encoding: srole_<messageId>
            const messageId = id.replace('srole_', '');

            // Get all select entries for this message from DB
            const allEntries = (await getButtonRolesByMessage(messageId)).filter(e => e.style === 0);
            const allRoleIds = allEntries.map(e => e.roleId);

            // Remove all roles in this menu first
            const toRemove = allRoleIds.filter(r => member.roles.cache.has(r));
            if (toRemove.length) {
                await member.roles.remove(toRemove, '[Fade] Select role updated').catch(() => null);
            }

            // Add selected roles
            if (selectedIds.length) {
                await member.roles.add(selectedIds, '[Fade] Select role added').catch(() => null);
            }

            const added = selectedIds.length
                ? selectedIds.map(r => `<@&${r}>`).join(', ')
                : '`None`';

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Roles updated → ${added}`)
                .build();

            await interaction.reply({
                components: [card],
                flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            } as any);

        } catch (err) {
            logger.error('Select role handler failed', err, { id, guildId: interaction.guild.id });
        }
    },
};

// ── Reaction role add ─────────────────────────────────────────────────────────

export const reactionAdd: Event<'messageReactionAdd'> = {
    name: 'messageReactionAdd',
    async execute(client, reaction, user) {
        if (user.bot) return;
        if (!reaction.message.guild) return;

        try {
            if (reaction.partial) await reaction.fetch().catch(() => null);
            if (reaction.message.partial) await reaction.message.fetch().catch(() => null);

            const emoji = reaction.emoji.id
                ? `<${reaction.emoji.animated ? 'a' : ''}:${reaction.emoji.name}:${reaction.emoji.id}>`
                : reaction.emoji.name ?? '';

            const entry = await getReactionRole(reaction.message.id, emoji);
            if (!entry) return;

            const guild  = reaction.message.guild;
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            // Check exclusive mode
            if (entry.exclusive) {
                const allEntries = await getReactionRolesByMessage(reaction.message.id);
                const otherRoleIds = allEntries
                    .map(e => e.roleId)
                    .filter(r => r !== entry.roleId && member.roles.cache.has(r));
                for (const rid of otherRoleIds) {
                    await member.roles.remove(rid, '[Fade] Exclusive reaction role swap').catch(() => null);
                }
                // Also remove other reactions from the user on this message
                for (const otherEntry of allEntries) {
                    if (otherEntry.emoji === emoji) continue;
                    const otherReaction = reaction.message.reactions.cache.find(
                        r => (r.emoji.id ? `<${r.emoji.animated ? 'a' : ''}:${r.emoji.name}:${r.emoji.id}>` : r.emoji.name) === otherEntry.emoji
                    );
                    if (otherReaction) {
                        await otherReaction.users.remove(user.id).catch(() => null);
                    }
                }
            }

            await member.roles.add(entry.roleId, '[Fade] Reaction role added').catch(() => null);

        } catch (err) {
            logger.error('Reaction role add failed', err);
        }
    },
};

// ── Reaction role remove ──────────────────────────────────────────────────────

export const reactionRemove: Event<'messageReactionRemove'> = {
    name: 'messageReactionRemove',
    async execute(client, reaction, user) {
        if (user.bot) return;
        if (!reaction.message.guild) return;

        try {
            if (reaction.partial) await reaction.fetch().catch(() => null);

            const emoji = reaction.emoji.id
                ? `<${reaction.emoji.animated ? 'a' : ''}:${reaction.emoji.name}:${reaction.emoji.id}>`
                : reaction.emoji.name ?? '';

            const entry = await getReactionRole(reaction.message.id, emoji);
            if (!entry) return;

            const guild  = reaction.message.guild;
            const member = await guild.members.fetch(user.id).catch(() => null);
            if (!member) return;

            await member.roles.remove(entry.roleId, '[Fade] Reaction role removed').catch(() => null);

        } catch (err) {
            logger.error('Reaction role remove failed', err);
        }
    },
};

export default [buttonRoleHandler, selectRoleHandler, reactionAdd, reactionRemove];