// src/commands/music/lyrics.ts
// Fetches lyrics using the Genius unofficial search API (no API key needed).
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requirePlayer, musicReply } from '../../music/utils.js';
import { buildMusicErrorCard, buildMusicInfoCard } from '../../music/cards.js';
import { FadeContainer } from '../../components/builders.js';
import { Colours } from '../../components/emojis.js';
import {
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
} from 'discord.js';

// Genius public search (no auth, returns basic snippet)
async function searchLyrics(query: string): Promise<{ title: string; artist: string; url: string; snippet: string } | null> {
    try {
        const res = await fetch(
            `https://genius.com/api/search/multi?q=${encodeURIComponent(query)}`,
            { headers: { 'User-Agent': 'Mozilla/5.0' } }
        );
        const json = await res.json() as any;
        const hits = json?.response?.sections?.find((s: any) => s.type === 'song')?.hits ?? [];
        if (!hits.length) return null;

        const hit     = hits[0].result;
        const title   = hit.title;
        const artist  = hit.primary_artist?.name ?? 'Unknown';
        const url     = hit.url;
        const snippet = hit.snippet ?? 'Lyrics preview not available.';
        return { title, artist, url, snippet };
    } catch {
        return null;
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('lyrics')
        .setDescription('Show lyrics for the current or searched song'),

    category:  'music',
    guildOnly: true,
    aliases:   ['lyrics', 'ly'],
    cooldown:  5,

    async execute(interaction) {
        await interaction.reply({ content: 'Use `f!lyrics [song name]` to find lyrics.', flags: 64 });
    },

    async prefixExecute(message, args, client) {
        const IS_CV2 = 1 << 15;

        let query = args.join(' ').trim();

        // Auto-detect query from currently playing track if none given
        if (!query) {
            const player = client.music?.players.get(message.guild!.id);
            const current = player?.queue.current;
            if (!current) {
                await musicReply(message, [buildMusicErrorCard('Nothing is playing. Provide a song name or start playing one.')]);
                return;
            }
            // Clean up common YouTube suffixes
            query = current.title
                .replace(/\(official.*?\)/gi, '')
                .replace(/\[.*?\]/gi, '')
                .replace(/ft\..*$/gi, '')
                .replace(/feat\..*$/gi, '')
                .trim();
        }

        // Show searching state
        const searching = new ContainerBuilder().setAccentColor(Colours.FADE);
        searching.addTextDisplayComponents(new TextDisplayBuilder().setContent(`🔍 Searching lyrics for **${query}**...`));
        const searchMsg = await message.reply({ components: [searching], flags: IS_CV2 } as any);

        const result = await searchLyrics(query);

        if (!result) {
            const card = buildMusicErrorCard(`No lyrics found for **${query}**.\n-# Try using the exact song name and artist.`);
            await searchMsg.edit({ components: [card], flags: IS_CV2 } as any);
            return;
        }

        // Discord has a 4096 char limit per text block — truncate if needed
        const maxSnippet = 700;
        const snippet    = result.snippet.length > maxSnippet
            ? result.snippet.slice(0, maxSnippet) + '…'
            : result.snippet;

        const card = new ContainerBuilder().setAccentColor(Colours.FADE);
        card.addTextDisplayComponents(new TextDisplayBuilder().setContent(`## 🎤 ${result.title}\n-# by **${result.artist}**`));
        card.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        card.addTextDisplayComponents(new TextDisplayBuilder().setContent(snippet));
        card.addSeparatorComponents(new SeparatorBuilder().setDivider(true).setSpacing(SeparatorSpacingSize.Small));
        card.addTextDisplayComponents(new TextDisplayBuilder().setContent(`-# [View full lyrics on Genius](${result.url})`));

        await searchMsg.edit({ components: [card], flags: IS_CV2 } as any);
    },
} satisfies Command;
