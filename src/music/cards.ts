// src/music/cards.ts
// Beautiful Component V2 cards for the music system.
import {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from 'discord.js';
import type { KazagumoPlayer, KazagumoTrack } from 'kazagumo';
import { e, Colours } from '../components/emojis.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

export function msToTimestamp(ms: number): string {
    const totalSec = Math.floor(ms / 1000);
    const h = Math.floor(totalSec / 3600);
    const m = Math.floor((totalSec % 3600) / 60);
    const s = totalSec % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    return `${m}:${String(s).padStart(2, '0')}`;
}

export function buildProgressBar(position: number, duration: number, length = 20): string {
    if (!duration) return '`──────────────────────`';
    const pct    = Math.min(position / duration, 1);
    const filled = Math.round(pct * length);
    const bar    = '▬'.repeat(filled) + '🔘' + '▬'.repeat(Math.max(0, length - filled - 1));
    return `\`${bar}\``;
}

export function sourceEmoji(uri: string | undefined | null): string {
    if (!uri) return '🎵';
    if (uri.includes('spotify'))  return '<:spotify:1> 🎧'; // fallback unicode
    if (uri.includes('youtube'))  return '▶️';
    if (uri.includes('soundcloud')) return '☁️';
    if (uri.includes('twitch'))   return '🟣';
    return '🎵';
}

// Truncate long strings
function trunc(str: string, max = 50): string {
    return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// ── Now Playing Card ──────────────────────────────────────────────────────────

export function buildNowPlayingCard(player: KazagumoPlayer, track: KazagumoTrack): ContainerBuilder {
    const duration  = track.length  ?? 0;
    const position  = player.position ?? 0;
    const isStream  = track.isStream;
    const bar       = isStream ? '`🔴 LIVE`' : buildProgressBar(position, duration);
    const timeLabel = isStream ? '🔴 LIVE' : `${msToTimestamp(position)} / ${msToTimestamp(duration)}`;
    const loopIcon  = player.loop === 'track' ? '🔂' : player.loop === 'queue' ? '🔁' : '';
    const volIcon   = player.volume <= 30 ? '🔈' : player.volume <= 70 ? '🔉' : '🔊';

    const container = new ContainerBuilder().setAccentColor(Colours.FADE);

    // Header
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${e('music')} Now Playing ${loopIcon}`
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    // Track info
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `### [${trunc(track.title, 55)}](${track.uri ?? 'https://discord.com'})\n` +
            `-# by **${trunc(track.author ?? 'Unknown Artist', 40)}**`
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );

    // Progress bar
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${bar}\n` +
            `-# ${timeLabel}`
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );

    // Stats row
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `${volIcon} \`${player.volume}%\`` +
            (track.requester ? `  ·  Requested by <@${(track.requester as any).id ?? track.requester}>` : '')
        )
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    // Control buttons
    const pauseBtn = new ButtonBuilder()
        .setCustomId('music_pause')
        .setLabel(player.paused ? '▶ Resume' : '⏸ Pause')
        .setStyle(player.paused ? ButtonStyle.Success : ButtonStyle.Secondary);

    const skipBtn = new ButtonBuilder()
        .setCustomId('music_skip')
        .setLabel('⏭ Skip')
        .setStyle(ButtonStyle.Secondary);

    const stopBtn = new ButtonBuilder()
        .setCustomId('music_stop')
        .setLabel('⏹ Stop')
        .setStyle(ButtonStyle.Danger);

    const queueBtn = new ButtonBuilder()
        .setCustomId('music_queue')
        .setLabel('📋 Queue')
        .setStyle(ButtonStyle.Primary);

    const loopBtn = new ButtonBuilder()
        .setCustomId('music_loop')
        .setLabel(player.loop === 'track' ? '🔂 Track' : player.loop === 'queue' ? '🔁 Queue' : '➡ Loop Off')
        .setStyle(player.loop !== 'none' ? ButtonStyle.Success : ButtonStyle.Secondary);

    container.addActionRowComponents(
        new ActionRowBuilder<ButtonBuilder>().addComponents(pauseBtn, skipBtn, stopBtn, queueBtn, loopBtn)
    );

    return container;
}

// ── Queue Card ────────────────────────────────────────────────────────────────

export function buildQueueCard(player: KazagumoPlayer, page = 1): ContainerBuilder {
    const queue    = player.queue;
    const current  = queue.current;
    const tracks   = [...queue];
    const perPage  = 10;
    const pages    = Math.max(1, Math.ceil(tracks.length / perPage));
    const safePage = Math.min(Math.max(1, page), pages);
    const start    = (safePage - 1) * perPage;
    const slice    = tracks.slice(start, start + perPage);

    const container = new ContainerBuilder().setAccentColor(Colours.FADE);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## 📋 Music Queue`)
    );

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    // Currently playing
    if (current) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(
                `**Now Playing**\n` +
                `▶  [${trunc(current.title, 50)}](${current.uri ?? 'https://discord.com'}) — \`${msToTimestamp(current.length ?? 0)}\``
            )
        );
    }

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(false).setSpacing(SeparatorSpacingSize.Small)
    );

    if (!slice.length) {
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(`-# The queue is empty. Use \`f!play\` to add tracks.`)
        );
    } else {
        const lines = slice.map((t, i) => {
            const num = start + i + 1;
            const dur = msToTimestamp(t.length ?? 0);
            return `\`${num}.\` [${trunc(t.title, 42)}](${t.uri ?? 'https://discord.com'}) — \`${dur}\``;
        });
        container.addTextDisplayComponents(
            new TextDisplayBuilder().setContent(lines.join('\n'))
        );
    }

    container.addSeparatorComponents(
        new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small)
    );

    // Total duration
    const totalMs  = queue.durationLength;
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `-# ${tracks.length} track${tracks.length !== 1 ? 's' : ''} in queue · Total: \`${msToTimestamp(totalMs)}\` · Page ${safePage}/${pages}`
        )
    );

    return container;
}

// ── Track Added Card ──────────────────────────────────────────────────────────

export function buildTrackAddedCard(track: KazagumoTrack, position: number): ContainerBuilder {
    const container = new ContainerBuilder().setAccentColor(Colours.SUCCESS);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${e('success')} Track Added\n` +
            `[${trunc(track.title, 55)}](${track.uri ?? 'https://discord.com'})\n` +
            `-# by **${trunc(track.author ?? 'Unknown', 40)}** · \`${msToTimestamp(track.length ?? 0)}\`` +
            (position > 0 ? ` · Position **#${position}** in queue` : ` · Playing now`)
        )
    );

    return container;
}

// ── Playlist Added Card ───────────────────────────────────────────────────────

export function buildPlaylistAddedCard(name: string, count: number, totalMs: number): ContainerBuilder {
    const container = new ContainerBuilder().setAccentColor(Colours.SUCCESS);

    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(
            `## ${e('success')} Playlist Added\n` +
            `**${trunc(name, 55)}**\n` +
            `-# ${count} tracks added · Total duration: \`${msToTimestamp(totalMs)}\``
        )
    );

    return container;
}

// ── Error Card ────────────────────────────────────────────────────────────────

export function buildMusicErrorCard(msg: string): ContainerBuilder {
    const container = new ContainerBuilder().setAccentColor(Colours.DANGER);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ⚠ ${msg}`)
    );
    return container;
}

// ── Info Card ─────────────────────────────────────────────────────────────────

export function buildMusicInfoCard(title: string, body: string): ContainerBuilder {
    const container = new ContainerBuilder().setAccentColor(Colours.INFO);
    container.addTextDisplayComponents(
        new TextDisplayBuilder().setContent(`## ${title}\n${body}`)
    );
    return container;
}
