// src/events/giveawayInteractions.ts
import { MessageFlags } from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import {
    getGiveaway,
    enterGiveaway,
    leaveGiveaway,
    getEntryCount,
    isEntered,
} from '../db/queries/giveaways.js';
import { getUserLevel } from '../db/queries/leveling.js';
import { FadeContainer } from '../components/builders.js';
import { e, Colours } from '../components/emojis.js';
import { buildGiveawayCard } from '../utils/giveawayUtils.js';
import { logger } from '../utils/logger.js';

const event: Event<'interactionCreate'> = {
    name: 'interactionCreate',
    async execute(client: FadeClient, interaction) {
        if (!interaction.isMessageComponent()) return;
        if (!interaction.guild) return;

        const id = interaction.customId;

        // ── Enter giveaway ────────────────────────────────────────────────────
        if (id.startsWith('giveaway_enter_')) {
            const giveawayId = parseInt(id.replace('giveaway_enter_', ''));
            const giveaway   = await getGiveaway(giveawayId);

            if (!giveaway || giveaway.status !== 'active') {
                await interaction.reply({
                    content: `${e('error')} This giveaway has ended.`,
                    flags:   MessageFlags.Ephemeral,
                });
                return;
            }

            // Check if already entered
            if (await isEntered(giveawayId, interaction.user.id)) {
                await interaction.reply({
                    content: `${e('error')} You are already entered in this giveaway.\nClick **Leave** to remove your entry.`,
                    flags:   MessageFlags.Ephemeral,
                });
                return;
            }

            // Required role check
            if (giveaway.requiredRole) {
                const member = interaction.member as any;
                if (!member.roles.cache.has(giveaway.requiredRole)) {
                    await interaction.reply({
                        content: `${e('error')} You need the <@&${giveaway.requiredRole}> role to enter this giveaway.`,
                        flags:   MessageFlags.Ephemeral,
                    });
                    return;
                }
            }

            // Minimum level check
            if (giveaway.minLevel && giveaway.minLevel > 0) {
                const levelData = await getUserLevel(interaction.guild.id, interaction.user.id);
                if (levelData.level < giveaway.minLevel) {
                    const content = `${e('error')} You need Level ${giveaway.minLevel} to enter.\nYour level: ${levelData.level}\n\n-# This server uses Fade's leveling system. \n   Chat to earn XP and level up!`;

                    await interaction.reply({
                        content,
                        flags:   MessageFlags.Ephemeral,
                    });
                    return;
                }
            }

            await enterGiveaway(giveawayId, interaction.user.id);
            const count = await getEntryCount(giveawayId);

            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `## ${e('tada')} You're entered!\n` +
                    `**${giveaway.prize}**\n` +
                    `-# ${count} total entries · Good luck!`
                )
                .build();

            await interaction.reply({
                components: [card],
                flags:      MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            } as any);

            // Update main card
            const mainCard = buildGiveawayCard({
                id:           giveaway.id,
                prize:        giveaway.prize,
                hostId:       giveaway.hostId,
                winnerCount:  giveaway.winnerCount,
                endsAt:       new Date(giveaway.endsAt),
                entryCount:   count,
                requiredRole: giveaway.requiredRole,
                minLevel:     giveaway.minLevel,
                description:  giveaway.description,
                image:        giveaway.image,
                ended:        false,
            });
            await interaction.message.edit({
                components: [mainCard],
                flags:      MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
            } as any).catch((err) => {
                logger.error("Failed to update giveaway card on enter", err, { giveawayId: giveaway.id });
            });
            return;
        }

        // ── Leave giveaway ────────────────────────────────────────────────────
        if (id.startsWith('giveaway_leave_')) {
            const giveawayId = parseInt(id.replace('giveaway_leave_', ''));
            const giveaway   = await getGiveaway(giveawayId);

            if (!giveaway || giveaway.status !== 'active') {
                await interaction.reply({
                    content: `${e('error')} This giveaway has ended.`,
                    flags:   MessageFlags.Ephemeral,
                });
                return;
            }

            if (!(await isEntered(giveawayId, interaction.user.id))) {
                await interaction.reply({
                    content: `${e('error')} You are not entered in this giveaway.`,
                    flags:   MessageFlags.Ephemeral,
                });
                return;
            }

            await leaveGiveaway(giveawayId, interaction.user.id);
            const count = await getEntryCount(giveawayId);

            const card = new FadeContainer(Colours.WARNING)
                .text(
                    `🚪 Entry removed from **${giveaway.prize}**\n` +
                    `-# ${count} entries remaining`
                )
                .build();

            await interaction.reply({
                components: [card],
                flags:      MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral,
            } as any);

            // Update main card
            const mainCard = buildGiveawayCard({
                id:           giveaway.id,
                prize:        giveaway.prize,
                hostId:       giveaway.hostId,
                winnerCount:  giveaway.winnerCount,
                endsAt:       new Date(giveaway.endsAt),
                entryCount:   count,
                requiredRole: giveaway.requiredRole,
                minLevel:     giveaway.minLevel,
                description:  giveaway.description,
                image:        giveaway.image,
                ended:        false,
            });
            await interaction.message.edit({
                components: [mainCard],
                flags:      MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
            } as any).catch((err) => {
                logger.error("Failed to update giveaway card on leave", err, { giveawayId: giveaway.id });
            });
            return;
        }
    },
};

export default event;