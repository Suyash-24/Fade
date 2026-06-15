// src/commands/utility/ce.ts
// Custom embed/card builder — prefix only, no slash (preserves slash command slots).
//
// Usage:
//   f!ce [#channel] <embed script>   — post an embed
//   f!ce [#channel] {card}$v...      — post a Components v2 card
//   f!ce edit <message_url> <script> — edit an existing bot message
//
// Embed script syntax (same as welcome/webhook):
//   {embed}$v{title: Hello}$v{description: World}$v{color: #5865F2}
//   {card}$v{header: Hello}$v{body: World}$v{color: #5865F2}
//
// Variables: {user} {username} {server} {channel} {count} {id} {avatar} {servericon}

import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, thumb } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';

// ── Variable resolver ─────────────────────────────────────────────────────────

function resolveVars(text: string, msg: any): string {
    const author = msg.author;
    const avatarUrl = author.displayAvatarURL({ size: 256 });
    return text
        .replace(/{user}/g,             author.toString())
        .replace(/{username}/g,         author.username)
        .replace(/{id}/g,               author.id)
        .replace(/{avatar}/g,           avatarUrl)
        .replace(/{server}/g,           msg.guild?.name ?? '')
        .replace(/{channel}/g,          msg.channel.toString())
        .replace(/{count}/g,            msg.guild?.memberCount?.toString() ?? '')
        .replace(/{servericon}/g,       msg.guild?.iconURL({ size: 256 }) ?? '');
}

// ── Script parser ─────────────────────────────────────────────────────────────

function parseScript(script: string) {
    return script.split('$v').map(part => {
        const m = part.trim().match(/^\{(\w+):([\s\S]*?)\}$/);
        if (!m) return null;
        let value = m[2];
        if (value.startsWith(' ')) value = value.slice(1);
        value = value.replace(/\\n/g, '\n').replace(/\s+$/, '');
        value = value.replace(/^[ ]+/gm, (spaces) => '\u2800'.repeat(spaces.length));
        return { key: m[1].toLowerCase(), value };
    }).filter(Boolean) as { key: string; value: string }[];
}

const trunc    = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s;
const validUrl = (s: string)            => s.startsWith('http://') || s.startsWith('https://') ? s : undefined;

// ── Embed builder ─────────────────────────────────────────────────────────────

function buildEmbed(script: string, msg: any) {
    const params = parseScript(script);
    const embed  = new EmbedBuilder().setColor(Colours.FADE);
    let content: string | null = null;
    let authorName: string | null = null, authorIcon: string | null = null;
    let footerText: string | null = null, footerIcon: string | null = null;
    const btns: { label: string; url: string }[] = [];

    for (const { key, value } of params) {
        const v = resolveVars(value, msg);
        switch (key) {
            case 'content':                          content    = trunc(v, 2000); break;
            case 'color':    try { embed.setColor(v as any); } catch {} break;
            case 'url':      try { embed.setURL(v); } catch {} break;
            case 'title': case 'header':             embed.setTitle(trunc(v, 256)); break;
            case 'description': case 'body':         embed.setDescription(trunc(v, 4096)); break;
            case 'thumbnail': { const u = validUrl(v); if (u) embed.setThumbnail(u); break; }
            case 'image':     { const u = validUrl(v); if (u) embed.setImage(u); break; }
            case 'author_name': authorName = trunc(v, 256); break;
            case 'author_icon': authorIcon = v; break;
            case 'author': {
                const [n, i, u] = v.split('&&').map(s => s.trim());
                if (n) authorName = trunc(n, 256);
                if (i) authorIcon = i;
                if (u && validUrl(u)) try { embed.setURL(u); } catch {}
                break;
            }
            case 'footer': {
                const [t, i] = v.split('&&').map(s => s.trim());
                if (t) footerText = trunc(t, 2048);
                if (i) footerIcon = i;
                break;
            }
            case 'footer_icon': footerIcon = v; break;
            case 'timestamp':   embed.setTimestamp(); break;
            case 'field': {
                const parts = v.split('&&').map(s => s.trim());
                const [n, fv, inline] = parts;
                if (n && fv) embed.addFields({ name: trunc(n, 256), value: trunc(fv, 1024), inline: inline === 'inline' });
                break;
            }
            case 'button': {
                // {button: type && label && url} or {button: url && label}
                const parts = v.split('&&').map(s => s.trim());
                if (parts.length >= 2) {
                    const url   = parts.find(p => validUrl(p));
                    const label = parts.find(p => !validUrl(p) && !['link','blurple','green','grey','red'].includes(p.toLowerCase()));
                    if (url && label && btns.length < 5) btns.push({ label: trunc(label, 80), url });
                }
                break;
            }
        }
    }

    if (authorName) embed.setAuthor({ name: authorName, ...(validUrl(authorIcon ?? '') ? { iconURL: validUrl(authorIcon ?? '') } : {}) });
    if (footerText) embed.setFooter({ text: footerText, ...(validUrl(footerIcon ?? '') ? { iconURL: validUrl(footerIcon ?? '') } : {}) });

    const row = btns.length
        ? new ActionRowBuilder<ButtonBuilder>().addComponents(
            btns.map(b => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(b.label).setURL(b.url))
          )
        : null;

    return { embed, content, row };
}

// ── Card builder ──────────────────────────────────────────────────────────────

function buildCard(script: string, msg: any) {
    const params = parseScript(script);
    let header: string | null = null, body: string | null = null;
    let thumbnail: string | null = null, image: string | null = null;
    let color: number | undefined, footer: string | null = null;
    const btns: { label: string; url: string }[] = [];

    for (const { key, value } of params) {
        const v = resolveVars(value, msg);
        switch (key) {
            case 'header': case 'title':       header    = trunc(v, 256); break;
            case 'body':   case 'description': body      = trunc(v, 2000); break;
            case 'thumbnail': thumbnail = validUrl(v) ?? null; break;
            case 'image':     image     = validUrl(v) ?? null; break;
            case 'color': { const c = parseInt(v.replace('#', ''), 16); if (!isNaN(c)) color = c; break; }
            case 'footer':    footer    = trunc(v, 256); break;
            case 'button': {
                const parts = v.split('&&').map(s => s.trim());
                const url   = parts.find(p => validUrl(p));
                const label = parts.find(p => !validUrl(p));
                if (url && label && btns.length < 5) btns.push({ label: trunc(label, 80), url });
                break;
            }
        }
    }

    const card = new FadeContainer(color as any);
    if (header) card.text(`## ${header}`);
    if (header && (body || thumbnail)) card.separator(true);
    if (body && thumbnail)  card.section([body], thumb(thumbnail));
    else if (body)          card.text(body);
    else if (thumbnail)     card.section(['\u200b'], thumb(thumbnail));
    if (image)  card.gallery([{ url: image }]);
    if (footer) { card.separator(true); card.text(`-# ${footer}`); }
    if (btns.length) {
        card.separator(false);
        card.actionRow(...btns.map(b =>
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(b.label).setURL(b.url)
        ));
    }
    return card.build();
}

// ── Send helper ───────────────────────────────────────────────────────────────

async function sendScript(channel: any, script: string, msg: any): Promise<any> {
    const isCard  = script.startsWith('{card}');
    const isEmbed = script.startsWith('{embed}');

    if (isCard) {
        const container = buildCard(script.slice(6).trim(), msg);
        return channel.send({ components: [container], flags: MessageFlags.IsComponentsV2 } as any);
    }

    if (isEmbed) {
        const { embed, content, row } = buildEmbed(script.slice(7).trim(), msg);
        const payload: any = { embeds: [embed] };
        if (content) payload.content = content;
        if (row)     payload.components = [row];
        return channel.send(payload);
    }

    // Plain text with variable resolution
    return channel.send({ content: resolveVars(script, msg) });
}

// ── Command ───────────────────────────────────────────────────────────────────

export default {
    // Minimal slash stub — prefix only in practice
    data: new SlashCommandBuilder()
        .setName('ce')
        .setDescription('Custom embed builder (prefix only — use f!ce)'),

    category:  'utility',
    guildOnly: true,

    async execute(interaction) {
        const card = new FadeContainer(Colours.FADE)
            .text(
                `## ${e('settings')} Custom Embed Builder\n` +
                `This command is prefix-only.\n\n` +
                `**Post embed:** \`f!ce [#channel] {embed}$v{title: Hello}$v{description: World}\`\n` +
                `**Post card:** \`f!ce [#channel] {card}$v{header: Hello}$v{body: World}\`\n` +
                `**Edit message:** \`f!ce edit <message_url> <script>\`\n\n` +
                `-# Supports: title, description, color, image, thumbnail, author, footer, field, button, timestamp\n` +
                `-# Variables: \`{user}\` \`{username}\` \`{avatar}\` \`{server}\` \`{channel}\` \`{count}\` \`{servericon}\``
            )
            .build();
        await interaction.reply({ components: [card] as any, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral } as any);
    },

    async prefixExecute(message, args) {
        if (!message.member!.permissions.has(PermissionFlagsBits.ManageMessages)) {
            await message.reply(`${e('error')} You need **Manage Messages** to use this command.`);
            return;
        }

        // ── edit subcommand ───────────────────────────────────────────────────
        if (args[0]?.toLowerCase() === 'edit') {
            const msgUrl = args[1];
            const script = args.slice(2).join(' ');
            if (!msgUrl || !script) {
                await message.reply(`${e('error')} Usage: \`f!ce edit <message_url> <script>\``);
                return;
            }

            const match = msgUrl.match(/channels\/\d+\/(\d+)\/(\d+)/);
            if (!match) { await message.reply(`${e('error')} Invalid message URL.`); return; }

            const [, channelId, messageId] = match;
            const targetChannel = message.guild!.channels.cache.get(channelId) as any;
            if (!targetChannel?.isTextBased()) { await message.reply(`${e('error')} Channel not found.`); return; }

            const targetMsg = await targetChannel.messages.fetch(messageId).catch(() => null);
            if (!targetMsg) { await message.reply(`${e('error')} Message not found.`); return; }
            if (targetMsg.author.id !== message.client.user!.id) {
                await message.reply(`${e('error')} I can only edit my own messages.`); return;
            }

            const isCard  = script.startsWith('{card}');
            const isEmbed = script.startsWith('{embed}');

            if (isCard) {
                const container = buildCard(script.slice(6).trim(), message);
                await targetMsg.edit({ components: [container], flags: MessageFlags.IsComponentsV2 } as any);
            } else if (isEmbed) {
                const { embed, content, row } = buildEmbed(script.slice(7).trim(), message);
                const payload: any = { embeds: [embed], components: row ? [row] : [] };
                if (content) payload.content = content;
                await targetMsg.edit(payload);
            } else {
                await targetMsg.edit({ content: resolveVars(script, message) });
            }

            await message.react('✅').catch(() => null);
            return;
        }

        // ── optional target channel ───────────────────────────────────────────
        const mentionedChannel = message.mentions.channels.first() as any;
        let targetChannel: any;
        let scriptStart: number;

        if (mentionedChannel?.isTextBased()) {
            targetChannel = mentionedChannel;
            scriptStart   = 1; // skip the channel mention arg
        } else {
            targetChannel = message.channel;
            scriptStart   = 0;
        }

        const script = args.slice(scriptStart).join(' ').trim();
        if (!script) {
            await message.reply(
                `${e('error')} Usage:\n` +
                `\`f!ce [#channel] {embed}$v{title: Hello}$v{description: World}\`\n` +
                `\`f!ce [#channel] {card}$v{header: Hello}$v{body: World}\`\n` +
                `\`f!ce edit <message_url> <script>\``
            );
            return;
        }

        const sent = await sendScript(targetChannel, script, message).catch(() => null);
        if (!sent) {
            await message.reply(`${e('error')} Failed to send. Check the script syntax and my permissions.`);
            return;
        }

        // React to confirm if posting to a different channel
        if (targetChannel.id !== message.channelId) {
            await message.react('✅').catch(() => null);
        }
    },

    aliases: ['embed', 'createembed'],
} satisfies Command;
