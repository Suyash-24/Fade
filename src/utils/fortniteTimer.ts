// src/utils/fortniteTimer.ts
// Posts the daily Fortnite shop at 00:05 UTC (5 min after reset).
// Also DMs users watching cosmetics that appear in the shop.
import { MessageFlags, ContainerBuilder, TextDisplayBuilder } from 'discord.js';
import type { FadeClient } from '../client.js';
import { getAllShopConfigs, upsertFortniteShopConfig, getWatchersForCosmetics } from '../db/queries/fortnite.js';
import { getShop } from './fortnite.js';
import { logger } from './logger.js';

function msUntilNextShop(): number {
    const now  = new Date();
    const next = new Date(now);
    next.setUTCHours(0, 5, 0, 0); // 00:05 UTC
    if (next <= now) next.setUTCDate(next.getUTCDate() + 1);
    return next.getTime() - now.getTime();
}

async function postShop(client: FadeClient) {
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    try {
        const items   = await getShop();
        if (!items.length) return;

        const configs = await getAllShopConfigs();

        for (const config of configs) {
            if (!config.channelId) continue;
            if (config.lastShopDate === today) continue; // already posted today

            const guild = client.guilds.cache.get(config.guildId);
            if (!guild) continue;

            const channel = guild.channels.cache.get(config.channelId) as any;
            if (!channel?.isTextBased()) continue;

            const lines = items.slice(0, 20).map(i =>
                `**${i.name}** · ${i.type} · ${i.rarity} · 🎮 ${i.price} V-Bucks`
            ).join('\n');

            const card = new ContainerBuilder()
                .setAccentColor(0x00D4FF)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## 🛒 Fortnite Item Shop · ${today}\n-# ${items.length} items\n\n${lines}`
                    )
                );

            const roleMention = config.roleId ? `<@&${config.roleId}>` : undefined;

            const msg = await channel.send({
                content:    roleMention,
                components: [card],
                flags:      MessageFlags.IsComponentsV2,
                allowedMentions: config.roleId ? { roles: [config.roleId] } : { parse: [] },
            } as any).catch(() => null);

            // Add voting reactions if enabled
            if (msg && config.voting) {
                await msg.react('👍').catch(() => null);
                await msg.react('👎').catch(() => null);
            }

            await upsertFortniteShopConfig(config.guildId, {
                lastShopDate: today,
                messageId:    msg?.id ?? null,
            });
        }

        // ── Notify watchers ───────────────────────────────────────────────────
        const shopNames = items.map(i => i.name);
        const watchers  = await getWatchersForCosmetics(shopNames);

        // Group by userId to send one DM per user
        const byUser = new Map<string, string[]>();
        for (const w of watchers) {
            if (!byUser.has(w.userId)) byUser.set(w.userId, []);
            byUser.get(w.userId)!.push(w.cosmetic);
        }

        for (const [userId, cosmetics] of byUser) {
            const user = await client.users.fetch(userId).catch(() => null);
            if (!user) continue;

            const matched = items.filter(i => cosmetics.includes(i.name.toLowerCase()));
            const lines   = matched.map(i => `**${i.name}** · ${i.price} V-Bucks`).join('\n');

            const dmCard = new ContainerBuilder()
                .setAccentColor(0x00D4FF)
                .addTextDisplayComponents(
                    new TextDisplayBuilder().setContent(
                        `## 🛒 Fortnite Watch Alert!\nThe following cosmetics you're watching are in today's shop:\n\n${lines}`
                    )
                );

            await user.send({
                components: [dmCard],
                flags:      MessageFlags.IsComponentsV2,
            } as any).catch(() => null);
        }

    } catch (err) {
        logger.error('Fortnite shop timer failed', err);
    }
}

export function startFortniteTimer(client: FadeClient): void {
    const delay = msUntilNextShop();
    logger.info(`Fortnite shop timer: next post in ${Math.round(delay / 60000)}m`);

    setTimeout(async () => {
        await postShop(client);
        // Then repeat every 24h
        setInterval(() => postShop(client), 24 * 60 * 60 * 1000);
    }, delay);
}
