// src/commands/music/play.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requireVoice, musicReply } from '../../music/utils.js';
import {
    buildTrackAddedCard,
    buildPlaylistAddedCard,
    buildMusicErrorCard,
} from '../../music/cards.js';


export default {
    data: new SlashCommandBuilder()
        .setName('play')
        .setDescription('Play a song or playlist'),

    category: 'music',
    guildOnly: true,
    aliases:   ['play'],
    cooldown:  3,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!play <song>` to play music.', flags: 64 });
    },

    async prefixExecute(message, args, client) {
        if (!client.music) {
            await musicReply(message, [buildMusicErrorCard('Music system is not connected. Make sure Lavalink is running.')]);
            return;
        }

        const query = args.join(' ').trim();
        if (!query) {
            await musicReply(message, [buildMusicErrorCard('Provide a song name, URL, or playlist link.\n-# Example: `f!play blinding lights` or `f!play <YouTube URL>`')]);
            return;
        }

        const voice = await requireVoice(message, client);
        if (!voice) return;

        // Create or fetch player
        let player = voice.player;
        if (!player) {
            player = await client.music.createPlayer({
                guildId:    message.guild!.id,
                voiceId:    voice.channelId,
                textId:     message.channel.id,
                deaf:       true,
                volume:     80,
            });
        }

        // Determine search engine from the query
        let searchEngine = 'youtube';
        if (query.includes('spotify.com'))    searchEngine = 'spotify';
        if (query.includes('soundcloud.com')) searchEngine = 'soundcloud';

        // Search
        const result = await client.music.search(query, {
            requester: message.author,
            engine:    searchEngine as any,
        });

        if (!result || !result.tracks.length) {
            await musicReply(message, [buildMusicErrorCard(`No results found for **${query}**.\n-# Try a different search term or paste a direct URL.`)]);
            return;
        }

        if (result.type === 'PLAYLIST') {
            // Add entire playlist
            player.queue.add(result.tracks);
            const totalMs = result.tracks.reduce((a, t) => a + (t.length ?? 0), 0);
            const card    = buildPlaylistAddedCard(result.playlistName ?? 'Playlist', result.tracks.length, totalMs);
            await musicReply(message, [card]);
        } else {
            // Add single track
            const track    = result.tracks[0];
            const position = player.queue.length;
            player.queue.add(track);
            const card = buildTrackAddedCard(track, position);
            await musicReply(message, [card]);
        }

        // Start playback if not already playing
        if (!player.playing && !player.paused) {
            await player.play();
        }
    },
} satisfies Command;
