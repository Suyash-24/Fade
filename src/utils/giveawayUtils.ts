// src/utils/giveawayUtils.ts
import {
    type Guild,
    type TextChannel,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    MessageFlags,
    MediaGalleryBuilder,
    MediaGalleryItemBuilder,
} from 'discord.js';
import {
    getEntryCount,
    pickWinners,
    endGiveaway,
    updateGiveawayMessage,
} from '../db/queries/giveaways.js';
import { e, Colours } from '../components/emojis.js';
import { logger } from './logger.js';

// ── Build giveaway card ───────────────────────────────────────────────────────

export function buildGiveawayCard(opts: {
    id:           number;
    prize:        string;
    hostId:       string;
    winnerCount:  number;
    endsAt:       Date;
    entryCount:   number;
    requiredRole?: string | null;
    minLevel?:    number;
    description?: string | null;
    image?:       string | null;
    ended?:       boolean;
    winners?:     string[];
}) {
    const endsTs    = Math.floor(opts.endsAt.getTime() / 1000);
    const endLabel  = opts.ended ? 'Ended' : 'Ends';
    const color     = Colours.WHITE;

    const title = opts.ended ? `## ${e('tada')} Giveaway Ended` : `## ${e('gift')} ${opts.prize} ${e('gift')}`;

    const lines = [];

    if (opts.ended) {
        lines.push(`**Prize** — ${opts.prize}`);
    }

    if (opts.description) {
        lines.push(opts.description, ``);
    }

    let winnersText = `\`${opts.winnerCount}\``;
    if (opts.ended && opts.winners && opts.winners.length > 0) {
        winnersText += ` (${opts.winners.map(w => `<@${w}>`).join(', ')})`;
    }

    lines.push(
        `${e('heartdot')}  **${endLabel}** — <t:${endsTs}:R> (<t:${endsTs}:F>)`,
        `${e('heartdot')}  **Hosted by** — <@${opts.hostId}>`,
        `${e('heartdot')}  **Winners** — ${winnersText}`,
        `${e('heartdot')}  **Entries** — \`${opts.entryCount}\``,
    );

    if (opts.requiredRole) {
        lines.push(`${e('heartdot')}  **Required role** — <@&${opts.requiredRole}>`);
    }
    if (opts.minLevel && opts.minLevel > 0) {
        lines.push(`${e('heartdot')}  **Min level** — \`${opts.minLevel}\``);
    }



    lines.push(``, `-# ID: ${opts.id}`);

    const container = new ContainerBuilder()
        .setAccentColor(color)
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(title)
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        )
        .addTextDisplayComponents(
            new TextDisplayBuilder().setContent(lines.join('\n'))
        )
        .addSeparatorComponents(
            new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
        );

    if (opts.image) {
        container.addMediaGalleryComponents(
            new MediaGalleryBuilder().addItems(
                new MediaGalleryItemBuilder().setURL(opts.image)
            )
        );
    }

    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(
            new ButtonBuilder()
                .setCustomId(`giveaway_enter_${opts.id}`)
                .setLabel('Enter Giveaway')
                .setStyle(ButtonStyle.Primary)
                .setEmoji(e('tada'))
                .setDisabled(!!opts.ended),
            new ButtonBuilder()
                .setCustomId(`giveaway_leave_${opts.id}`)
                .setLabel('Leave')
                .setStyle(ButtonStyle.Secondary)
                .setEmoji({ name: '🚪' })
                .setDisabled(!!opts.ended),
        )
    );

    return container;
}

// ── End giveaway ──────────────────────────────────────────────────────────────

export async function concludeGiveaway(
    guild: Guild,
    giveaway: any,
): Promise<string[]> {
    try {
        const winners    = await pickWinners(giveaway.id, giveaway.winnerCount);
        const entryCount = await getEntryCount(giveaway.id);

        await endGiveaway(giveaway.id);

        // Update the original message
        const channel = await guild.channels.fetch(giveaway.channelId).catch(() => null) as TextChannel | null;
        if (channel && giveaway.messageId) {
            const card = buildGiveawayCard({
                id:           giveaway.id,
                prize:        giveaway.prize,
                hostId:       giveaway.hostId,
                winnerCount:  giveaway.winnerCount,
                endsAt:       new Date(giveaway.endsAt),
                entryCount,
                requiredRole: giveaway.requiredRole,
                minLevel:     giveaway.minLevel,
                description:  giveaway.description,
                image:        giveaway.image,
                ended:        true,
                winners,
            });

            await channel.messages.edit(giveaway.messageId, {
                components: [card],
                flags:      MessageFlags.IsComponentsV2,
                allowedMentions: { parse: [] },
            } as any).catch(() => null);

            // Send winner announcement
            if (winners.length) {
                const winnerMentions = winners.map(w => `<@${w}>`).join(', ');
                const announceCard = new ContainerBuilder()
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## ${e('tada')} Giveaway Ended!\n` +
                            `Congratulations ${winnerMentions}!\n` +
                            `You won **${giveaway.prize}**!\n` +
                            `-# Hosted by <@${giveaway.hostId}>`
                        )
                    );

                await channel.send({
                    components: [announceCard],
                    flags:      MessageFlags.IsComponentsV2,
                } as any).catch((err) => {
                    logger.error("Failed to send winner announcement", err, { giveawayId: giveaway.id });
                });
            } else {
                await channel.send({
                    components: [
                        new ContainerBuilder()
                            .addTextDisplayComponents(
                                new TextDisplayBuilder().setContent(
                                    `## ${e('tada')} Giveaway Ended\n` +
                                    `No valid entries for **${giveaway.prize}**.\n` +
                                    `-# Could not pick a winner.`
                                )
                            )
                    ],
                    flags: MessageFlags.IsComponentsV2,
                } as any).catch((err) => {
                    logger.error("Failed to send no-winner announcement", err, { giveawayId: giveaway.id });
                });
            }
        }

        return winners;
    } catch (err) {
        logger.error('concludeGiveaway failed', err, { giveawayId: giveaway.id });
        return [];
    }
}