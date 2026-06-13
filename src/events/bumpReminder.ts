// src/events/bumpReminder.ts
// Disboard's bot ID is 302050872383242240
// When it sends an interaction response containing "Bump done!" we record the bump.
// A background timer checks every minute and sends reminders when 2h has passed.
import { MessageFlags, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { getBumpReminder, recordBump, getDueBumps, updateBumpReminder } from '../db/queries/bumpReminder.js';
import { Colours, e } from '../components/emojis.js';
import { logger } from '../utils/logger.js';

const DISBOARD_ID = '302050872383242240';

// ── Detect bump via message create ───────────────────────────────────────────

export const bumpDetect: Event<'messageCreate'> = {
    name: 'messageCreate',
    async execute(client, message) {
        if (!message.guild) return;
        if (message.author.id !== DISBOARD_ID) return;

        // Disboard sends an embed with "Bump done!" in description
        const isBump = message.embeds.some(e =>
            e.description?.toLowerCase().includes('bump done') ||
            e.description?.toLowerCase().includes('bumped')
        );
        if (!isBump) return;

        const config = await getBumpReminder(message.guild.id);
        if (!config?.enabled) return;

        await recordBump(message.guild.id);

        // Send confirmation card
        const channel = message.channel;
        const nextBump = Math.floor((Date.now() + 2 * 60 * 60 * 1000) / 1000);

        const card = new ContainerBuilder()
            .setAccentColor(Colours.SUCCESS)
            .addTextDisplayComponents(
                new TextDisplayBuilder().setContent(
                    `## ${e('boost')} Server Bumped!\n` +
                    `Thanks for bumping! I'll remind you when you can bump again.\n` +
                    `${e('date')}  Next bump available — <t:${nextBump}:R>`
                )
            );

        await channel.send({
            components: [card],
            flags:      MessageFlags.IsComponentsV2,
        } as any).catch(() => null);
    },
};

// ── Background timer ──────────────────────────────────────────────────────────

export function startBumpTimer(client: FadeClient): void {
    setInterval(async () => {
        try {
            const due = await getDueBumps();
            for (const config of due) {
                const guild = client.guilds.cache.get(config.guildId);
                if (!guild) continue;

                const channel = guild.channels.cache.get(config.channelId);
                if (!channel?.isTextBased()) continue;

                const roleMention = config.roleId ? `<@&${config.roleId}> ` : '';
                const message     = config.message
                    ?? `${roleMention}It's time to bump the server! Use \`/bump\` on Disboard.`;

                const card = new ContainerBuilder()
                    .setAccentColor(Colours.FADE)
                    .addTextDisplayComponents(
                        new TextDisplayBuilder().setContent(
                            `## ${e('boost')} Time to Bump!\n${message}`
                        )
                    );

                await channel.send({
                    content:    config.roleId ? `<@&${config.roleId}>` : undefined,
                    components: [card],
                    flags:      MessageFlags.IsComponentsV2,
                } as any).catch(() => null);

                // Reset lastBump so we don't send again until next bump
                await updateBumpReminder(config.guildId, { lastBump: null });

                logger.debug('Bump reminder sent', { guildId: config.guildId });
            }
        } catch (err) {
            logger.error('Bump timer failed', err);
        }
    }, 60_000); // check every minute

    logger.info('Bump reminder timer started');
}

export default [bumpDetect];