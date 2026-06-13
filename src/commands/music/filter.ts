// src/commands/music/filter.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requirePlayer, musicReply } from '../../music/utils.js';
import { buildMusicInfoCard, buildMusicErrorCard } from '../../music/cards.js';

// ── Filter presets ────────────────────────────────────────────────────────────

const PRESETS: Record<string, { label: string; emoji: string; options: object }> = {
    bassboost: {
        label: 'Bass Boost',
        emoji: '🔊',
        options: {
            equalizer: [
                { band: 0, gain: 0.6 },
                { band: 1, gain: 0.6 },
                { band: 2, gain: 0.6 },
                { band: 3, gain: 0.25 },
                { band: 4, gain: 0.25 },
                { band: 5, gain: 0.1 },
                { band: 6, gain: 0.1 },
            ],
        },
    },
    nightcore: {
        label: 'Nightcore',
        emoji: '🌙',
        options: {
            timescale: { speed: 1.2, pitch: 1.25, rate: 1.0 },
        },
    },
    vaporwave: {
        label: 'Vaporwave',
        emoji: '🌊',
        options: {
            timescale: { speed: 0.85, pitch: 0.85, rate: 1.0 },
        },
    },
    '8d': {
        label: '8D Audio',
        emoji: '🎧',
        options: {
            rotation: { rotationHz: 0.2 },
        },
    },
    karaoke: {
        label: 'Karaoke',
        emoji: '🎤',
        options: {
            karaoke: { level: 1.0, monoLevel: 1.0, filterBand: 220.0, filterWidth: 100.0 },
        },
    },
    tremolo: {
        label: 'Tremolo',
        emoji: '〰️',
        options: {
            tremolo: { frequency: 4.0, depth: 0.75 },
        },
    },
    vibrato: {
        label: 'Vibrato',
        emoji: '🎻',
        options: {
            vibrato: { frequency: 14.0, depth: 1.0 },
        },
    },
};

const PRESET_NAMES = Object.keys(PRESETS);

// ── Command ───────────────────────────────────────────────────────────────────

export default {
    data: new SlashCommandBuilder()
        .setName('filter')
        .setDescription('Apply audio filters to the player'),

    category:  'music',
    guildOnly: true,
    aliases:   ['filter', 'filters', 'fx'],
    cooldown:  2,

    async execute(interaction) {
        await interaction.reply({
            content: 'Use `f!filter <preset>` to apply audio filters.\n-# Example: `f!filter bassboost` or `f!filter clear`',
            flags: 64,
        });
    },

    async prefixExecute(message, args, client) {
        const player = await requirePlayer(message, client);
        if (!player) return;

        // Require user in same VC
        if (message.member?.voice?.channelId !== player.voiceId) {
            await musicReply(message, [buildMusicErrorCard(`Join <#${player.voiceId}> to control the player.`)]);
            return;
        }

        const sub = args[0]?.toLowerCase();

        // Show filter list
        if (!sub || sub === 'list') {
            const lines = PRESET_NAMES.map(k => {
                const p = PRESETS[k];
                return `${p.emoji} \`${k}\` — ${p.label}`;
            });
            lines.push('🗑 `clear` / `off` — Remove all filters');

            await musicReply(message, [
                buildMusicInfoCard(
                    '🎛 Audio Filters',
                    `Available presets:\n${lines.join('\n')}\n\n-# Usage: \`f!filter <preset>\``,
                ),
            ]);
            return;
        }

        // Clear filters
        if (sub === 'clear' || sub === 'off') {
            await player.shoukaku.clearFilters();
            await musicReply(message, [
                buildMusicInfoCard('🎛 Filters Cleared', 'All audio filters have been removed.'),
            ]);
            return;
        }

        // Apply preset
        const preset = PRESETS[sub];
        if (!preset) {
            const names = [...PRESET_NAMES, 'clear'].join(', ');
            await musicReply(message, [
                buildMusicErrorCard(
                    `Unknown filter \`${sub}\`.\n-# Available: ${names}\n-# Use \`f!filter list\` to see all filters.`,
                ),
            ]);
            return;
        }

        await player.shoukaku.setFilters(preset.options as any);
        await musicReply(message, [
            buildMusicInfoCard(
                `${preset.emoji} Filter Applied — ${preset.label}`,
                `**${preset.label}** filter is now active.\n-# Use \`f!filter clear\` to remove it.`,
            ),
        ]);
    },
} satisfies Command;
