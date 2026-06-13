// src/commands/music/seek.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requirePlayer, musicReply } from '../../music/utils.js';
import { buildMusicInfoCard, buildMusicErrorCard, msToTimestamp } from '../../music/cards.js';

// Parses "1:30", "1m30s", "90" (seconds) → milliseconds
function parseSeekTime(input: string): number | null {
    // Format: mm:ss or hh:mm:ss
    if (/^\d+:\d{2}(:\d{2})?$/.test(input)) {
        const parts = input.split(':').map(Number);
        if (parts.length === 2) return (parts[0] * 60 + parts[1]) * 1000;
        if (parts.length === 3) return (parts[0] * 3600 + parts[1] * 60 + parts[2]) * 1000;
    }
    // Format: Xs, Xm, Xm Ys
    const matchMixed = input.match(/^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/i);
    if (matchMixed) {
        const h = parseInt(matchMixed[1] ?? '0', 10) || 0;
        const m = parseInt(matchMixed[2] ?? '0', 10) || 0;
        const s = parseInt(matchMixed[3] ?? '0', 10) || 0;
        const total = h * 3600 + m * 60 + s;
        if (total > 0) return total * 1000;
    }
    // Raw seconds
    const secs = parseInt(input, 10);
    if (!isNaN(secs) && secs >= 0) return secs * 1000;
    return null;
}

export default {
    data: new SlashCommandBuilder()
        .setName('seek')
        .setDescription('Seek to a position in the track'),

    category:  'music',
    guildOnly: true,
    aliases:   ['seek'],
    cooldown:  2,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!seek <time>` e.g. `f!seek 1:30`.', flags: 64 });
    },

    async prefixExecute(message, args, client) {
        const player = await requirePlayer(message, client);
        if (!player) return;

        if (message.member?.voice?.channelId !== player.voiceId) {
            await musicReply(message, [buildMusicErrorCard(`Join <#${player.voiceId}> to control the player.`)]);
            return;
        }

        if (player.queue.current?.isStream) {
            await musicReply(message, [buildMusicErrorCard('Cannot seek in a live stream.')]);
            return;
        }

        const timeArg = args.join('');
        if (!timeArg) {
            await musicReply(message, [buildMusicErrorCard('Provide a time to seek to.\n-# Examples: `1:30`, `90`, `1m30s`')]);
            return;
        }

        const ms = parseSeekTime(timeArg);
        if (ms === null) {
            await musicReply(message, [buildMusicErrorCard('Invalid time format. Try `1:30`, `90s`, or `1m30s`.')]);
            return;
        }

        const duration = player.queue.current?.length ?? 0;
        if (ms > duration) {
            await musicReply(message, [buildMusicErrorCard(`Cannot seek past the track duration (\`${msToTimestamp(duration)}\`).`)]);
            return;
        }

        await player.seek(ms);
        await musicReply(message, [buildMusicInfoCard('⏩ Seeked', `Jumped to \`${msToTimestamp(ms)}\`.`)]);
    },
} satisfies Command;
