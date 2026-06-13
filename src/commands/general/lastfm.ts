// src/commands/general/lastfm.ts
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getLastfmUser, setLastfmUser, removeLastfmUser, updateLastfmCache, updateNpMode, updateNpReactions, getLastfmUsersByIds, getCrown, upsertCrown, getUserCrowns, getGuildCrowns } from '../../db/queries/lastfm.js';
import {
    getRecentTracks, getTopArtists, getTopAlbums, getTopTracks, getUserInfo,
    getImage, isNowPlaying, formatPlays,
    type Period, PERIOD_LABELS,
} from '../../utils/lastfm.js';

const PERIOD_CHOICES = Object.entries(PERIOD_LABELS).map(([v, n]) => ({ name: n, value: v }));

// ── Resolve target user ───────────────────────────────────────────────────────

async function resolveUsername(
    userId: string,
    provided?: string | null,
): Promise<string | null> {
    if (provided) return provided;
    const entry = await getLastfmUser(userId);
    return entry?.username ?? null;
}

// ── Error helper ──────────────────────────────────────────────────────────────

function noAccount(mention = false) {
    return mention
        ? `${e('error')} That user hasn't linked their Last.fm account.`
        : `${e('error')} You haven't linked your Last.fm account. Use \`/lastfm login <username>\` first.`;
}

// ── Command ───────────────────────────────────────────────────────────────────

export default {
    data: new SlashCommandBuilder()
        .setName('lastfm')
        .setDescription('Last.fm music stats and now playing')

        .addSubcommand(s => s
            .setName('login')
            .setDescription('Link your Last.fm account')
            .addStringOption(o => o.setName('username').setDescription('Your Last.fm username').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('logout')
            .setDescription('Unlink your Last.fm account')
        )
        .addSubcommand(s => s
            .setName('nowplaying')
            .setDescription('Show what you or someone else is listening to')
            .addUserOption(o => o.setName('user').setDescription('Discord user (optional)'))
            .addStringOption(o => o.setName('username').setDescription('Last.fm username (optional)'))
        )
        .addSubcommand(s => s
            .setName('topartists')
            .setDescription('Show top artists')
            .addStringOption(o => o.setName('period').setDescription('Time period').addChoices(...PERIOD_CHOICES))
            .addUserOption(o => o.setName('user').setDescription('Discord user (optional)'))
        )
        .addSubcommand(s => s
            .setName('topalbums')
            .setDescription('Show top albums')
            .addStringOption(o => o.setName('period').setDescription('Time period').addChoices(...PERIOD_CHOICES))
            .addUserOption(o => o.setName('user').setDescription('Discord user (optional)'))
        )
        .addSubcommand(s => s
            .setName('toptracks')
            .setDescription('Show top tracks')
            .addStringOption(o => o.setName('period').setDescription('Time period').addChoices(...PERIOD_CHOICES))
            .addUserOption(o => o.setName('user').setDescription('Discord user (optional)'))
        )
        .addSubcommand(s => s
            .setName('profile')
            .setDescription('Show Last.fm profile stats')
            .addUserOption(o => o.setName('user').setDescription('Discord user (optional)'))
            .addStringOption(o => o.setName('username').setDescription('Last.fm username (optional)'))
        )
        .addSubcommand(s => s
            .setName('recent')
            .setDescription('Show recent tracks')
            .addUserOption(o => o.setName('user').setDescription('Discord user (optional)'))
        )
        .addSubcommand(s => s
            .setName('whoknows')
            .setDescription('Who in this server knows an artist the most')
            .addStringOption(o => o.setName('artist').setDescription('Artist name').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('globalwhoknows')
            .setDescription('Who across all servers knows an artist the most')
            .addStringOption(o => o.setName('artist').setDescription('Artist name').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('crowns')
            .setDescription('View artist crowns for a user in this server')
            .addUserOption(o => o.setName('user').setDescription('Discord user (optional)'))
        )
        .addSubcommand(s => s
            .setName('refresh')
            .setDescription('Refresh your cached Last.fm library')
        )
        .addSubcommand(s => s
            .setName('mode')
            .setDescription('Customize your nowplaying card layout')
            .addStringOption(o => o
                .setName('script')
                .setDescription('Embed script. Variables: {track} {artist} {album} {cover} {plays} {username}. Use "reset" to clear.')
                .setRequired(true)
                .setMaxLength(500)
            )
        )
        .addSubcommand(s => s
            .setName('cr')
            .setDescription('Set custom reactions on your nowplaying message')
            .addStringOption(o => o.setName('upvote').setDescription('Upvote emoji').setRequired(true))
            .addStringOption(o => o.setName('downvote').setDescription('Downvote emoji').setRequired(true))
        ),

    category: 'general',
    cooldown: 5,

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();

        // ── Login ─────────────────────────────────────────────────────────────
        if (sub === 'login') {
            const username = interaction.options.getString('username', true).trim();
            try {
                await getUserInfo(username); // validate username exists
                await setLastfmUser(interaction.user.id, username);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('music')}  Last.fm account linked\n-# **${username}** · Use \`/lastfm nowplaying\` to show what you're listening to`)
                    .build();
                await sendResponse(interaction, [card]);
            } catch {
                await interaction.reply({ content: `${e('error')} Last.fm user \`${username}\` not found.`, flags: MessageFlags.Ephemeral });
            }
            return;
        }

        // ── Logout ────────────────────────────────────────────────────────────
        if (sub === 'logout') {
            await removeLastfmUser(interaction.user.id);
            const card = new FadeContainer(Colours.DANGER).text(`${e('success')}  Last.fm account unlinked`).build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Mode ──────────────────────────────────────────────────────────────
        if (sub === 'mode') {
            const script = interaction.options.getString('script', true).trim();
            if (script.toLowerCase() === 'reset') {
                await updateNpMode(interaction.user.id, null);
                const card = new FadeContainer(Colours.DANGER).text(`${e('success')}  Nowplaying layout reset to default`).build();
                await sendResponse(interaction, [card]);
            } else {
                await updateNpMode(interaction.user.id, script);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Nowplaying layout set\n-# Variables: \`{track}\` \`{artist}\` \`{album}\` \`{cover}\` \`{plays}\` \`{username}\``)
                    .build();
                await sendResponse(interaction, [card]);
            }
            return;
        }

        // ── CR (custom reactions) ─────────────────────────────────────────────
        if (sub === 'cr') {
            const upvote   = interaction.options.getString('upvote', true).trim();
            const downvote = interaction.options.getString('downvote', true).trim();
            await updateNpReactions(interaction.user.id, { upvote, downvote });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Nowplaying reactions set to ${upvote} / ${downvote}`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        await interaction.deferReply();

        try {
            // ── Now Playing ───────────────────────────────────────────────────
            if (sub === 'nowplaying') {
                const targetUser = interaction.options.getUser('user');
                const provided   = interaction.options.getString('username');
                const lookupId   = targetUser?.id ?? interaction.user.id;
                const username   = await resolveUsername(lookupId, provided);
                if (!username) { await interaction.editReply(noAccount(!targetUser)); return; }

                const data   = await getRecentTracks(username, 1);
                const tracks = data.track;
                const track  = Array.isArray(tracks) ? tracks[0] : tracks;
                if (!track) { await interaction.editReply(`${e('error')} No recent tracks found.`); return; }

                const playing = isNowPlaying(track);
                const image   = getImage(track.image);
                const displayUser = targetUser ?? interaction.user;

                // Get user's custom mode/reactions (only for the command caller's own np)
                const callerEntry = !targetUser ? await getLastfmUser(interaction.user.id) : null;
                const npMode      = callerEntry?.npMode ?? null;
                const npReactions = callerEntry?.npReactions as { upvote: string; downvote: string } | null;

                let card: any;
                if (npMode) {
                    // Custom mode — resolve variables
                    const resolved = npMode
                        .replace(/{track}/g,    track.name)
                        .replace(/{artist}/g,   track.artist?.['#text'] ?? track.artist?.name ?? '')
                        .replace(/{album}/g,    track.album?.['#text'] ?? '')
                        .replace(/{cover}/g,    image ?? '')
                        .replace(/{plays}/g,    track.userplaycount ?? '')
                        .replace(/{username}/g, username);
                    card = new FadeContainer(Colours.FADE).text(resolved);
                    if (image) card.gallery([{ url: image }]);
                    card = card.build();
                } else {
                    const c = new FadeContainer(Colours.FADE)
                        .text(
                            `${playing ? '🎵' : '⏹️'}  **${playing ? 'Now Playing' : 'Last Played'}** · [${username}](https://www.last.fm/user/${username})\n` +
                            `\n**${track.name}**\n` +
                            `${track.artist?.['#text'] ?? track.artist?.name ?? 'Unknown Artist'}` +
                            (track.album?.['#text'] ? ` · *${track.album['#text']}*` : '') +
                            `\n-# ${displayUser.username}`
                        );
                    if (image) c.gallery([{ url: image }]);
                    card = c.build();
                }

                const sent = await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any) as any;

                // Add custom reactions if set
                if (npReactions && sent?.react) {
                    await sent.react(npReactions.upvote).catch(() => null);
                    await sent.react(npReactions.downvote).catch(() => null);
                }
                return;
            }

            // ── Top Artists ───────────────────────────────────────────────────
            if (sub === 'topartists') {
                const targetUser = interaction.options.getUser('user');
                const period     = (interaction.options.getString('period') ?? 'overall') as Period;
                const lookupId   = targetUser?.id ?? interaction.user.id;
                const username   = await resolveUsername(lookupId);
                if (!username) { await interaction.editReply(noAccount(!!targetUser)); return; }

                const data    = await getTopArtists(username, period, 10);
                const artists = data.artist as any[];
                if (!artists?.length) { await interaction.editReply(`${e('error')} No data found.`); return; }

                const lines = artists.map((a, i) =>
                    `\`${String(i + 1).padStart(2)}\` **${a.name}** · ${formatPlays(a.playcount)} plays`
                ).join('\n');

                const card = new FadeContainer(Colours.FADE)
                    .text(`## 🎤 Top Artists · ${PERIOD_LABELS[period]}\n[${username}](https://www.last.fm/user/${username})\n\n${lines}`)
                    .build();
                await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);
                return;
            }

            // ── Top Albums ────────────────────────────────────────────────────
            if (sub === 'topalbums') {
                const targetUser = interaction.options.getUser('user');
                const period     = (interaction.options.getString('period') ?? 'overall') as Period;
                const lookupId   = targetUser?.id ?? interaction.user.id;
                const username   = await resolveUsername(lookupId);
                if (!username) { await interaction.editReply(noAccount(!!targetUser)); return; }

                const data   = await getTopAlbums(username, period, 10);
                const albums = data.album as any[];
                if (!albums?.length) { await interaction.editReply(`${e('error')} No data found.`); return; }

                const topImage = getImage(albums[0]?.image);
                const lines = albums.map((a, i) =>
                    `\`${String(i + 1).padStart(2)}\` **${a.name}** · ${a.artist.name} · ${formatPlays(a.playcount)} plays`
                ).join('\n');

                const card = new FadeContainer(Colours.FADE)
                    .text(`## 💿 Top Albums · ${PERIOD_LABELS[period]}\n[${username}](https://www.last.fm/user/${username})\n\n${lines}`);
                if (topImage) card.gallery([{ url: topImage }]);
                await interaction.editReply({ components: [card.build()], flags: MessageFlags.IsComponentsV2 } as any);
                return;
            }

            // ── Top Tracks ────────────────────────────────────────────────────
            if (sub === 'toptracks') {
                const targetUser = interaction.options.getUser('user');
                const period     = (interaction.options.getString('period') ?? 'overall') as Period;
                const lookupId   = targetUser?.id ?? interaction.user.id;
                const username   = await resolveUsername(lookupId);
                if (!username) { await interaction.editReply(noAccount(!!targetUser)); return; }

                const data   = await getTopTracks(username, period, 10);
                const tracks = data.track as any[];
                if (!tracks?.length) { await interaction.editReply(`${e('error')} No data found.`); return; }

                const lines = tracks.map((t, i) =>
                    `\`${String(i + 1).padStart(2)}\` **${t.name}** · ${t.artist.name} · ${formatPlays(t.playcount)} plays`
                ).join('\n');

                const card = new FadeContainer(Colours.FADE)
                    .text(`## 🎵 Top Tracks · ${PERIOD_LABELS[period]}\n[${username}](https://www.last.fm/user/${username})\n\n${lines}`)
                    .build();
                await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);
                return;
            }

            // ── Profile ───────────────────────────────────────────────────────
            if (sub === 'profile') {
                const targetUser = interaction.options.getUser('user');
                const provided   = interaction.options.getString('username');
                const lookupId   = targetUser?.id ?? interaction.user.id;
                const username   = await resolveUsername(lookupId, provided);
                if (!username) { await interaction.editReply(noAccount(!!targetUser)); return; }

                const user = await getUserInfo(username);
                const registered = new Date(parseInt(user.registered?.unixtime ?? '0') * 1000);
                const regTs = Math.floor(registered.getTime() / 1000);
                const avatar = user.image ? getImage(user.image, 'extralarge') : null;

                const card = new FadeContainer(Colours.FADE)
                    .text(
                        `## 🎵 [${user.name}](${user.url})\n` +
                        `${e('star')}  **Scrobbles** — ${parseInt(user.playcount).toLocaleString()}\n` +
                        `${e('members')}  **Artists** — ${parseInt(user.artist_count ?? '0').toLocaleString()}\n` +
                        `${e('date')}  **Member since** — <t:${regTs}:D>\n` +
                        (user.country ? `🌍  **Country** — ${user.country}\n` : '') +
                        `-# ${user.realname ? user.realname + ' · ' : ''}last.fm/${user.name}`
                    );
                if (avatar) card.gallery([{ url: avatar }]);
                await interaction.editReply({ components: [card.build()], flags: MessageFlags.IsComponentsV2 } as any);
                return;
            }

            // ── Recent ────────────────────────────────────────────────────────
            if (sub === 'recent') {
                const targetUser = interaction.options.getUser('user');
                const lookupId   = targetUser?.id ?? interaction.user.id;
                const username   = await resolveUsername(lookupId);
                if (!username) { await interaction.editReply(noAccount(!!targetUser)); return; }

                const data   = await getRecentTracks(username, 10);
                const tracks = (data.track as any[]) ?? [];
                if (!tracks.length) { await interaction.editReply(`${e('error')} No recent tracks found.`); return; }

                const lines = tracks.map((t, i) => {
                    const playing = isNowPlaying(t);
                    const prefix  = playing ? '🎵' : `\`${String(i + 1).padStart(2)}\``;
                    return `${prefix} **${t.name}** · ${t.artist?.['#text'] ?? t.artist?.name}`;
                }).join('\n');

                const card = new FadeContainer(Colours.FADE)
                    .text(`## 🕐 Recent Tracks\n[${username}](https://www.last.fm/user/${username})\n\n${lines}`)
                    .build();
                await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);
                return;
            }

            // ── Refresh ───────────────────────────────────────────────────────
            if (sub === 'refresh') {
                const username = await resolveUsername(interaction.user.id);
                if (!username) { await interaction.editReply(noAccount()); return; }

                const data    = await getTopArtists(username, 'overall', 1000);
                const artists = (data.artist as any[]).map((a: any) => ({
                    name:  a.name as string,
                    plays: parseInt(a.playcount),
                }));
                await updateLastfmCache(interaction.user.id, artists);

                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Library refreshed — **${artists.length}** artists cached`)
                    .build();
                await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);
                return;
            }

            // ── Who Knows ─────────────────────────────────────────────────────
            if (sub === 'whoknows' || sub === 'globalwhoknows') {
                const artist  = interaction.options.getString('artist', true).trim();
                const isGlobal = sub === 'globalwhoknows';
                const guild   = interaction.guild!;

                // Get all linked users in this guild (or globally)
                let userIds: string[] = [];
                if (!isGlobal) {
                    const members = await guild.members.fetch();
                    userIds = members.map(m => m.id);
                }

                const linked = isGlobal
                    ? await (async () => {
                        const { db } = await import('../../db/index.js');
                        const { lastfmUsers: lfu } = await import('../../db/schema.js');
                        return db.query.lastfmUsers.findMany();
                      })()
                    : await getLastfmUsersByIds(userIds);

                if (!linked.length) {
                    await interaction.editReply(`${e('error')} No linked Last.fm users found.`);
                    return;
                }

                // Check cache, fetch if stale (>24h)
                const now      = Date.now();
                const staleMs  = 24 * 60 * 60 * 1000;
                const results: { userId: string; username: string; plays: number }[] = [];

                for (const user of linked) {
                    const cached = user.cachedArtists as { name: string; plays: number }[] ?? [];
                    const isStale = !user.lastCached || now - new Date(user.lastCached).getTime() > staleMs;

                    let artists = cached;
                    if (isStale || !cached.length) {
                        try {
                            const data = await getTopArtists(user.username, 'overall', 1000);
                            artists = (data.artist as any[]).map((a: any) => ({
                                name:  a.name as string,
                                plays: parseInt(a.playcount),
                            }));
                            await updateLastfmCache(user.userId, artists);
                        } catch { continue; }
                    }

                    const match = artists.find(a => a.name.toLowerCase() === artist.toLowerCase());
                    if (match) results.push({ userId: user.userId, username: user.username, plays: match.plays });
                }

                results.sort((a, b) => b.plays - a.plays);

                // Update crown for top listener in this guild
                if (!isGlobal && results.length > 0) {
                    await upsertCrown(guild.id, results[0].userId, artist, results[0].plays);
                }

                if (!results.length) {
                    await interaction.editReply(`${e('error')} Nobody ${isGlobal ? 'globally' : 'in this server'} has listened to **${artist}**.`);
                    return;
                }

                const lines = results.slice(0, 10).map((r, i) =>
                    `${i === 0 ? '👑' : `\`${String(i + 1).padStart(2)}\``} <@${r.userId}> · **${formatPlays(r.plays)}** plays`
                ).join('\n');

                const card = new FadeContainer(Colours.FADE)
                    .text(
                        `## 🎤 Who Knows **${artist}**${isGlobal ? ' (Global)' : ''}\n` +
                        `-# ${results.length} listener${results.length !== 1 ? 's' : ''}\n\n${lines}`
                    )
                    .build();
                await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);
                return;
            }

            // ── Crowns ────────────────────────────────────────────────────────
            if (sub === 'crowns') {
                const targetUser = interaction.options.getUser('user');
                const lookupId   = targetUser?.id ?? interaction.user.id;
                const guild      = interaction.guild!;
                const crowns     = await getUserCrowns(guild.id, lookupId);

                if (!crowns.length) {
                    await interaction.editReply(`${e('error')} ${targetUser ? `<@${lookupId}> has` : 'You have'} no crowns in this server.`);
                    return;
                }

                const lines = crowns.slice(0, 15).map((c, i) =>
                    `\`${String(i + 1).padStart(2)}\` **${c.artist}** · ${formatPlays(c.plays)} plays`
                ).join('\n');

                const card = new FadeContainer(Colours.FADE)
                    .text(
                        `## 👑 Crowns · <@${lookupId}>\n` +
                        `-# ${crowns.length} crown${crowns.length !== 1 ? 's' : ''} in ${guild.name}\n\n${lines}`
                    )
                    .build();
                await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);
                return;
            }

        } catch (err: any) {
            await interaction.editReply(`${e('error')} ${err.message ?? 'Last.fm request failed.'}`);
        }
    },

    async prefixExecute(message, args) {
        const sub      = args[0]?.toLowerCase();
        const userId   = message.author.id;

        // ── Login ─────────────────────────────────────────────────────────────
        if (sub === 'login' || sub === 'set') {
            const username = args[1];
            if (!username) { await message.reply(`${e('error')} Usage: \`f!lastfm login <username>\``); return; }
            try {
                await getUserInfo(username);
                await setLastfmUser(userId, username);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('music')}  Last.fm linked to **${username}**`)
                    .build();
                await sendMessage(message, [card]);
            } catch {
                await message.reply(`${e('error')} Last.fm user \`${username}\` not found.`);
            }
            return;
        }

        if (sub === 'logout') {
            await removeLastfmUser(userId);
            const card = new FadeContainer(Colours.DANGER).text(`${e('success')}  Last.fm unlinked`).build();
            await sendMessage(message, [card]);
            return;
        }

        // For all other subcommands, resolve username
        const username = await resolveUsername(userId, args[1]?.startsWith('@') ? undefined : args[1]);
        if (!username) { await message.reply(noAccount()); return; }

        try {
            if (!sub || sub === 'np' || sub === 'nowplaying') {
                const data   = await getRecentTracks(username, 1);
                const tracks = data.track;
                const track  = Array.isArray(tracks) ? tracks[0] : tracks;
                if (!track) { await message.reply(`${e('error')} No recent tracks.`); return; }

                const playing = isNowPlaying(track);
                const image   = getImage(track.image);
                const card = new FadeContainer(Colours.FADE)
                    .text(
                        `${playing ? '🎵' : '⏹️'}  **${playing ? 'Now Playing' : 'Last Played'}** · [${username}](https://www.last.fm/user/${username})\n\n` +
                        `**${track.name}**\n${track.artist?.['#text'] ?? track.artist?.name ?? 'Unknown'}` +
                        (track.album?.['#text'] ? ` · *${track.album['#text']}*` : '')
                    );
                if (image) card.gallery([{ url: image }]);
                await sendMessage(message, [card.build()]);

            } else if (sub === 'topartists' || sub === 'ta') {
                const period = (args[2] ?? 'overall') as Period;
                const data   = await getTopArtists(username, period, 10);
                const artists = data.artist as any[];
                const lines  = artists.map((a, i) => `\`${String(i+1).padStart(2)}\` **${a.name}** · ${formatPlays(a.playcount)} plays`).join('\n');
                const card   = new FadeContainer(Colours.FADE).text(`## 🎤 Top Artists · ${PERIOD_LABELS[period] ?? period}\n${lines}`).build();
                await sendMessage(message, [card]);

            } else if (sub === 'topalbums' || sub === 'tab') {
                const period = (args[2] ?? 'overall') as Period;
                const data   = await getTopAlbums(username, period, 10);
                const albums = data.album as any[];
                const lines  = albums.map((a, i) => `\`${String(i+1).padStart(2)}\` **${a.name}** · ${a.artist.name} · ${formatPlays(a.playcount)} plays`).join('\n');
                const card   = new FadeContainer(Colours.FADE).text(`## 💿 Top Albums · ${PERIOD_LABELS[period] ?? period}\n${lines}`).build();
                await sendMessage(message, [card]);

            } else if (sub === 'toptracks' || sub === 'tt') {
                const period = (args[2] ?? 'overall') as Period;
                const data   = await getTopTracks(username, period, 10);
                const tracks = data.track as any[];
                const lines  = tracks.map((t, i) => `\`${String(i+1).padStart(2)}\` **${t.name}** · ${t.artist.name} · ${formatPlays(t.playcount)} plays`).join('\n');
                const card   = new FadeContainer(Colours.FADE).text(`## 🎵 Top Tracks · ${PERIOD_LABELS[period] ?? period}\n${lines}`).build();
                await sendMessage(message, [card]);

            } else if (sub === 'profile' || sub === 'p') {
                const user    = await getUserInfo(username);
                const regTs   = Math.floor(parseInt(user.registered?.unixtime ?? '0'));
                const avatar  = user.image ? getImage(user.image, 'extralarge') : null;
                const card    = new FadeContainer(Colours.FADE)
                    .text(
                        `## 🎵 [${user.name}](${user.url})\n` +
                        `${e('star')}  **Scrobbles** — ${parseInt(user.playcount).toLocaleString()}\n` +
                        `${e('date')}  **Since** — <t:${regTs}:D>`
                    );
                if (avatar) card.gallery([{ url: avatar }]);
                await sendMessage(message, [card.build()]);

            } else if (sub === 'recent' || sub === 'r') {
                const data   = await getRecentTracks(username, 10);
                const tracks = (data.track as any[]) ?? [];
                const lines  = tracks.map((t, i) => {
                    const playing = isNowPlaying(t);
                    return `${playing ? '🎵' : `\`${String(i+1).padStart(2)}\``} **${t.name}** · ${t.artist?.['#text'] ?? t.artist?.name}`;
                }).join('\n');
                const card = new FadeContainer(Colours.FADE).text(`## 🕐 Recent Tracks\n${lines}`).build();
                await sendMessage(message, [card]);

            } else if (sub === 'refresh') {
                const data    = await getTopArtists(username, 'overall', 1000);
                const artists = (data.artist as any[]).map((a: any) => ({ name: a.name as string, plays: parseInt(a.playcount) }));
                await updateLastfmCache(userId, artists);
                const card = new FadeContainer(Colours.SUCCESS).text(`${e('success')}  Library refreshed — **${artists.length}** artists cached`).build();
                await sendMessage(message, [card]);

            } else if (sub === 'wk' || sub === 'whoknows') {
                const artist  = args.slice(1).join(' ');
                if (!artist) { await message.reply(`${e('error')} Usage: \`f!fm wk <artist>\``); return; }
                const guild   = message.guild!;
                const members = await guild.members.fetch();
                const userIds = members.map(m => m.id);
                const linked  = await getLastfmUsersByIds(userIds);
                const now     = Date.now();
                const staleMs = 24 * 60 * 60 * 1000;
                const results: { userId: string; plays: number }[] = [];

                for (const user of linked) {
                    const cached  = user.cachedArtists as { name: string; plays: number }[] ?? [];
                    const isStale = !user.lastCached || now - new Date(user.lastCached).getTime() > staleMs;
                    let artists   = cached;
                    if (isStale || !cached.length) {
                        try {
                            const data = await getTopArtists(user.username, 'overall', 1000);
                            artists = (data.artist as any[]).map((a: any) => ({ name: a.name as string, plays: parseInt(a.playcount) }));
                            await updateLastfmCache(user.userId, artists);
                        } catch { continue; }
                    }
                    const match = artists.find(a => a.name.toLowerCase() === artist.toLowerCase());
                    if (match) results.push({ userId: user.userId, plays: match.plays });
                }
                results.sort((a, b) => b.plays - a.plays);
                if (results.length > 0) await upsertCrown(guild.id, results[0].userId, artist, results[0].plays);
                if (!results.length) { await message.reply(`${e('error')} Nobody in this server has listened to **${artist}**.`); return; }
                const lines = results.slice(0, 10).map((r, i) => `${i === 0 ? '👑' : `\`${String(i+1).padStart(2)}\``} <@${r.userId}> · **${formatPlays(r.plays)}** plays`).join('\n');
                const card  = new FadeContainer(Colours.FADE).text(`## 🎤 Who Knows **${artist}**\n-# ${results.length} listeners\n\n${lines}`).build();
                await sendMessage(message, [card]);

            } else if (sub === 'crowns') {
                const targetId = args[1]?.replace(/[<@!>]/g, '');
                const target = targetId ? await message.client.users.fetch(targetId).catch(() => null) : null;
                const lookupId = target?.id ?? userId;
                const crowns  = await getUserCrowns(message.guild!.id, lookupId);
                if (!crowns.length) { await message.reply(`${e('error')} No crowns found.`); return; }
                const lines   = crowns.slice(0, 15).map((c, i) => `\`${String(i+1).padStart(2)}\` **${c.artist}** · ${formatPlays(c.plays)} plays`).join('\n');
                const card    = new FadeContainer(Colours.FADE).text(`## 👑 Crowns · <@${lookupId}>\n-# ${crowns.length} crowns\n\n${lines}`).build();
                await sendMessage(message, [card]);

            } else {
                await message.reply(
                    `**Last.fm commands:**\n` +
                    `\`f!lastfm login <username>\` · \`f!lastfm np\` · \`f!lastfm topartists [period]\`\n` +
                    `\`f!lastfm topalbums [period]\` · \`f!lastfm toptracks [period]\` · \`f!lastfm profile\` · \`f!lastfm recent\`\n` +
                    `-# Periods: overall, 7day, 1month, 3month, 6month, 12month`
                );
            }
        } catch (err: any) {
            await message.reply(`${e('error')} ${err.message ?? 'Last.fm request failed.'}`);
        }
    },

    aliases: ['fm', 'lfm'],
} satisfies Command;
