// src/music/manager.ts
// Fade's Kazagumo music manager initializer.
// Called once from index.ts after the client is ready.
import { Kazagumo, KazagumoTrack } from 'kazagumo';
import { Connectors } from 'shoukaku';
import type { FadeClient } from '../client.js';
import type { TextChannel } from 'discord.js';
import { logger } from '../utils/logger.js';
import { buildNowPlayingCard } from './cards.js';

// ── Lavalink node config (from .env) ─────────────────────────────────────────
// Set these in your .env:
//   LAVALINK_HOST=node.jigsromeo.site
//   LAVALINK_PORT=3040
//   LAVALINK_AUTH=Ronlly
//   LAVALINK_SECURE=false   (true if using wss/https)

function getLavalinkNodes() {
    return [
        {
            name:   process.env.LAVALINK_NAME   ?? 'Fade-Node',
            url:    `${process.env.LAVALINK_HOST ?? 'node.jigsromeo.site'}:${process.env.LAVALINK_PORT ?? '3040'}`,
            auth:   process.env.LAVALINK_AUTH   ?? 'Ronlly',
            secure: process.env.LAVALINK_SECURE === 'true' ? true : false,
        },
    ];
}

// ── Autoplay state ────────────────────────────────────────────────────────────
// Per-guild autoplay toggle — resets on restart (intentional, lightweight).

const autoplayGuilds = new Set<string>();

export function toggleAutoplay(guildId: string): boolean {
    if (autoplayGuilds.has(guildId)) {
        autoplayGuilds.delete(guildId);
        return false;
    }
    autoplayGuilds.add(guildId);
    return true;
}

export function isAutoplay(guildId: string): boolean {
    return autoplayGuilds.has(guildId);
}

// ── Setup ─────────────────────────────────────────────────────────────────────

export function setupMusic(client: FadeClient): void {
    const manager = new Kazagumo(
        {
            defaultSearchEngine: 'youtube',
            // Shard-safe voice state sending
            send: (guildId, payload) => {
                const guild = client.guilds.cache.get(guildId);
                if (guild) guild.shard.send(payload);
            },
        },
        new Connectors.DiscordJS(client),
        getLavalinkNodes(),
        {
            resume:                 true,
            reconnectTries:         5,
            reconnectInterval:      5000,
            voiceConnectionTimeout: 15000,
        },
    );

    // ── Shoukaku / node events ────────────────────────────────────────────────

    manager.shoukaku.on('ready',       (name) => logger.info(`[Music] Lavalink node "${name}" connected`));
    manager.shoukaku.on('disconnect',  (name) => logger.warn(`[Music] Lavalink node "${name}" disconnected`));
    manager.shoukaku.on('error',       (name, err) => logger.error(`[Music] Node "${name}" error`, err));

    // ── Kazagumo player events ────────────────────────────────────────────────

    manager.on('playerStart', async (player, track) => {
        if (player.voiceId) {
            client.rest.put(`/channels/${player.voiceId}/voice-status`, {
                body: { status: `🎵 ${track.title.substring(0, 115)}` }
            }).catch(() => {});
        }

        const channel = client.channels.cache.get(player.textId!) as TextChannel | undefined;
        if (!channel) return;
        try {
            const card = buildNowPlayingCard(player, track);
            const msg  = await channel.send({
                components:      [card],
                flags:           (1 << 15), // IsComponentsV2
                allowedMentions: { parse: [] },
            } as any);
            // Store the now-playing message ID so we can delete it when the track ends
            (player as any).nowPlayingMsgId = msg.id;
        } catch (err) {
            logger.error('[Music] Failed to send now-playing card', err);
        }
    });

    manager.on('playerEnd', async (player) => {
        const channel  = client.channels.cache.get(player.textId!) as TextChannel | undefined;
        const msgId    = (player as any).nowPlayingMsgId as string | undefined;
        if (channel && msgId) {
            try { await channel.messages.delete(msgId); } catch { /* ignore */ }
            (player as any).nowPlayingMsgId = undefined;
        }
    });

    manager.on('playerEmpty', async (player) => {
        const guildId = player.guildId;

        // ── Autoplay: queue a related track ──────────────────────────────────
        if (isAutoplay(guildId)) {
            try {
                const previous = (player.queue as any).previous as KazagumoTrack[] | undefined;
                const lastTrack = previous?.[0] ?? null;

                if (lastTrack && client.music) {
                    const query  = `${lastTrack.author ?? ''} ${lastTrack.title} mix`.trim();
                    const result = await client.music.search(query, {
                        requester: null as any,
                        engine:    'youtube' as any,
                    });

                    if (result?.tracks?.length) {
                        // Pick a random track that isn't the same as the last one
                        const candidates = result.tracks.filter(
                            (t: KazagumoTrack) => t.identifier !== lastTrack.identifier,
                        );
                        const pick = candidates.length
                            ? candidates[Math.floor(Math.random() * candidates.length)]
                            : result.tracks[0];

                        player.queue.add(pick);
                        if (!player.playing && !player.paused) {
                            await player.play();
                        }
                        logger.info(`[Music] Autoplay queued: ${pick.title} for guild ${guildId}`);
                        return; // Don't show "queue finished" message
                    }
                }
            } catch (err) {
                logger.error('[Music] Autoplay search failed', err);
            }
        }

        // ── Default: show "queue finished" message ────────────────────────────
        if (player.voiceId) {
            client.rest.put(`/channels/${player.voiceId}/voice-status`, {
                body: { status: `f!play <song name / url> to play song` }
            }).catch(() => {});
        }

        const channel = client.channels.cache.get(player.textId!) as TextChannel | undefined;
        if (channel) {
            try {
                const { FadeContainer } = await import('../components/builders.js');
                const { Colours }       = await import('../components/emojis.js');
                const card = new FadeContainer(Colours.VOID)
                    .text(`## 🎵 Queue Finished\n-# No more tracks — use \`f!play\` to add more.`)
                    .build();
                await channel.send({ components: [card], flags: (1 << 15) } as any);
            } catch { /* ignore */ }
        }
        // Auto-disconnect after 3 minutes of inactivity
        setTimeout(() => {
            if (!player.queue.current) player.destroy();
        }, 3 * 60 * 1000);
    });

    manager.on('playerDestroy', (player) => {
        logger.info(`[Music] Player destroyed for guild ${player.guildId}`);
        // Clean up autoplay state when player is destroyed
        autoplayGuilds.delete(player.guildId);
    });

    manager.on('playerException', async (player, data) => {
        logger.error(`[Music] Player exception: ${data.exception?.message}`);
        const channel = client.channels.cache.get(player.textId!) as TextChannel | undefined;
        if (channel) {
            try {
                const { FadeContainer } = await import('../components/builders.js');
                const { Colours }       = await import('../components/emojis.js');
                const card = new FadeContainer(Colours.DANGER)
                    .text(`## ⚠ Playback Error\n-# ${data.exception?.message ?? 'Unknown error occurred'}`)
                    .build();
                await channel.send({ components: [card], flags: (1 << 15) } as any);
            } catch { /* ignore */ }
        }
    });

    client.on('voiceStateUpdate', (oldState, newState) => {
        // If the bot itself gets disconnected (channel deleted, kicked by admin, etc)
        if (newState.id === client.user?.id && !newState.channelId && oldState.channelId) {
            const player = client.music?.players.get(newState.guild.id);
            if (player) {
                logger.info(`[Music] Bot was disconnected from voice in guild ${newState.guild.id}, destroying player`);
                player.destroy();
            }
        }
    });

    client.music = manager;
    logger.info('[Music] Kazagumo manager initialized');
}
