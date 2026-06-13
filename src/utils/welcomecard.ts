// src/utils/welcomeCard.ts
// Builds welcome and goodbye messages in three styles:
//   embed → Classic Discord embed, fully scripted via {key: value}$v... syntax
//   card  → Components v2 container, scripted via {key: value}$v... syntax
//   text  → Plain message with variable substitution only
import {
    type GuildMember,
    EmbedBuilder,
    MessageFlags,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
} from 'discord.js';
import { FadeContainer, thumb } from '../components/builders.js';
import { e, Colours } from '../components/emojis.js';

export type WelcomeStyle = 'card' | 'embed' | 'text';

// ── Variable resolver ─────────────────────────────────────────────────────────

function ordinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] ?? s[v] ?? s[0]);
}

export function resolveVars(template: string, member: GuildMember, executor?: any): string {
    const createdTs = Math.floor(member.user.createdTimestamp / 1000);
    const user = member.user;
    const avatarUrl = user.displayAvatarURL({ size: 256 });

    // Command executor details (fallback to the joining member if no command context)
    const execUser = executor ? (executor.user ?? executor) : member.user;
    const execMember = (executor && executor.guild) ? executor : member;
    const execMention = execMember.toString();
    const execName = execUser.username;
    const execAvatar = execUser.displayAvatarURL({ size: 256 });

    return template
        .replace(/{user}/g,             member.toString())
        .replace(/{username}/g,         user.username)
        .replace(/{server}/g,           member.guild.name)
        .replace(/{count}/g,            member.guild.memberCount.toString())
        .replace(/{ordinal}/g,          ordinal(member.guild.memberCount))
        .replace(/{id}/g,               member.id)
        .replace(/{avatar}/g,           avatarUrl)
        .replace(/{servericon}/g,       member.guild.iconURL({ size: 256 }) ?? '')
        .replace(/{created}/g,          createdTs.toString())
        
        // Command User (Executor/Author) Variables
        .replace(/{author}/g,           execMention)
        .replace(/\{author\.mention\}/g,  execMention)
        .replace(/\{author\.username\}/g, execName)
        .replace(/\{author\.name\}/g,     execName)
        .replace(/\{author\.avatar\}/g,   execAvatar)
        .replace(/\{author\.icon\}/g,     execAvatar)
        .replace(/{authoricon}/g,       execAvatar);
}

// ── Script style detector ───────────────────────────────────────────────────────
// Returns 'embed', 'card', or null (ambiguous — uses only shared keys like color/thumbnail/button)

export function detectScriptStyle(script: string): 'embed' | 'card' | null {
    const keys = parseScript(script).map(p => p.key);
    const embedOnly = ['title', 'description', 'author', 'author_name', 'author_icon', 'footer_icon', 'timestamp', 'field', 'content'];
    const cardOnly  = ['header', 'body'];
    const hasEmbed  = keys.some(k => embedOnly.includes(k));
    const hasCard   = keys.some(k => cardOnly.includes(k));
    if (hasEmbed && !hasCard) return 'embed';
    if (hasCard  && !hasEmbed) return 'card';
    return null;
}

// ── Safety helpers ─────────────────────────────────────────────────────────────

const trunc = (s: string, max: number): string =>
    s.length > max ? s.slice(0, max - 1) + '…' : s;

const validUrl = (s: string | null | undefined): string | undefined =>
    s && (s.startsWith('http://') || s.startsWith('https://')) ? s : undefined;

const validBtnUrl = (s: string): boolean =>
    s.startsWith('http://') || s.startsWith('https://') || s.startsWith('discord://');

// ── Script parser shared types ────────────────────────────────────────────────

interface ParsedParam {
    key:   string;
    value: string;
}

function parseScript(script: string): ParsedParam[] {
    return script.split('$v').map(part => {
        // Greedy [\s\S]* + backtrack to last } — correctly handles emoji surrogates and nested {}
        const match = part.trim().match(/^\{(\w+):\s*([\s\S]*)\}$/);
        if (!match) return null;
        return { key: match[1].toLowerCase(), value: match[2].trim() };
    }).filter((p): p is ParsedParam => p !== null);
}

// ── Embed script builder ───────────────────────────────────────────────────────
// Keys: content, color, author/author_name/author_icon, title, description,
//   thumbnail, image, footer/footer_icon, timestamp, field, button (label && URL)

export interface ScriptedEmbedResult {
    embed:   EmbedBuilder;
    content: string | null;
    buttons: ActionRowBuilder<ButtonBuilder> | null;
}

export function buildScriptedEmbed(script: string, member: GuildMember, executor?: any): ScriptedEmbedResult {
    const params = parseScript(script);
    const embed  = new EmbedBuilder();
    let hasColor = false;
    let content:    string | null = null;
    let authorName: string | null = null;
    let authorIcon: string | null = null;
    let footerText: string | null = null;
    let footerIcon: string | null = null;
    const btns: { label: string; url: string }[] = [];

    for (const { key, value } of params) {
        let resolved: string;
        try { resolved = resolveVars(value, member, executor); } catch { continue; }

        try {
            switch (key) {
                case 'content':     content    = trunc(resolved, 2000); break;
                case 'author_name': authorName = trunc(resolved, 256);  break;
                case 'author_icon': authorIcon = resolved; break;
                case 'footer_icon': footerIcon = resolved; break;
                case 'color':
                    try { embed.setColor(resolved as `#${string}`); hasColor = true; } catch { /* bad colour — skip */ }
                    break;
                case 'author': {
                    const [n, i] = resolved.split('&&').map(s => s.trim());
                    if (n) authorName = trunc(n, 256);
                    if (i) authorIcon = i;
                    break;
                }
                case 'title':  case 'header': {
                    const t = trunc(resolved, 256);
                    if (t) embed.setTitle(t);
                    break;
                }
                case 'description': case 'body': {
                    const d = trunc(resolved, 4096);
                    if (d) embed.setDescription(d);
                    break;
                }
                case 'thumbnail': { const u = validUrl(resolved); if (u) try { embed.setThumbnail(u); } catch { /* bad URL */ } break; }
                case 'image':     { const u = validUrl(resolved); if (u) try { embed.setImage(u);     } catch { /* bad URL */ } break; }
                case 'footer': {
                    const [t, i] = resolved.split('&&').map(s => s.trim());
                    if (t) footerText = trunc(t, 2048);
                    if (i) footerIcon = i;
                    break;
                }
                case 'timestamp': try { embed.setTimestamp(); } catch { /* skip */ } break;
                case 'field': {
                    const [n, v] = resolved.split('&&').map(s => s.trim());
                    if (n && v) try { embed.addFields({ name: trunc(n, 256), value: trunc(v, 1024), inline: true }); } catch { /* skip */ }
                    break;
                }
                case 'button': {
                    const [label, url] = resolved.split('&&').map(s => s.trim());
                    if (label && url && validBtnUrl(url) && btns.length < 3)
                        btns.push({ label: trunc(label, 80), url });
                    break;
                }
            }
        } catch { /* swallow any unexpected field error */ }
    }

    if (!hasColor)  try { embed.setColor(Colours.FADE); } catch { /* skip */ }
    if (authorName) try { embed.setAuthor({ name: authorName, iconURL: validUrl(authorIcon) }); } catch { /* skip */ }
    if (footerText) try { embed.setFooter({ text: footerText, iconURL: validUrl(footerIcon) }); } catch { /* skip */ }

    const buttons = btns.length
        ? new ActionRowBuilder<ButtonBuilder>().addComponents(
            btns.map(b => new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(b.label).setURL(b.url))
          )
        : null;

    return { embed, content, buttons };
}

// ── Card script builder ───────────────────────────────────────────────────────
// Supported keys: header, body, thumbnail (section accessory), image (full-width
//   MediaGallery), color (#hex sidebar accent — omit for no sidebar), footer,
//   button (label && URL, up to 3)

export function buildScriptedCard(
    script: string,
    member: GuildMember,
    executor?: any,
): { container: ReturnType<FadeContainer['build']>; buttons: ActionRowBuilder<ButtonBuilder> | null } {
    const params: ParsedParam[] = parseScript(script);

    let header:    string | null = null;
    let body:      string | null = null;
    let thumbnail: string | null = null;
    let image:     string | null = null;
    let color:     number | null = null;
    let footer:    string | null = null;
    const btns:    { label: string; url: string }[] = [];

    for (const { key, value } of params) {
        let resolved: string;
        try { resolved = resolveVars(value, member, executor); } catch { continue; }

        try {
            switch (key) {
                case 'header': case 'title':       header = trunc(resolved, 256);  break;
                case 'body':   case 'description':  body   = trunc(resolved, 2000); break;
                case 'thumbnail': thumbnail = validUrl(resolved) ?? null; break;
                case 'image':     image     = validUrl(resolved) ?? null; break;
                case 'color': {
                    const hex = resolved.replace('#', '');
                    if (/^[0-9a-fA-F]{3,6}$/.test(hex)) {
                        const c = parseInt(hex, 16);
                        if (!isNaN(c)) color = c;
                    }
                    break;
                }
                case 'footer':    footer    = trunc(resolved, 256); break;
                case 'button': {
                    const [label, url] = resolved.split('&&').map(s => s.trim());
                    if (label && url && validBtnUrl(url) && btns.length < 3)
                        btns.push({ label: trunc(label, 80), url });
                    break;
                }
            }
        } catch { /* swallow any unexpected field error */ }
    }

    const accentColor = color !== null ? color : undefined;
    const card = new FadeContainer(accentColor as any);

    // Always ensure at least some visible content so the container isn't rejected
    const hasContent = header || body || thumbnail || image || footer;
    if (!hasContent) {
        card.text('\u200b'); // zero-width space fallback
    } else {
        if (header) card.text(`## ${header}`);
        if (header && (body || thumbnail || image)) card.separator(true);

        if (body && thumbnail) {
            card.section([body], thumb(thumbnail));
        } else if (body) {
            card.text(body);
        } else if (thumbnail) {
            card.section(['\u200b'], thumb(thumbnail));
        }

        if (image) card.gallery([{ url: image }]);

        if (footer) {
            card.separator(true);
            card.text(`-# ${footer}`);
        }
    }

    if (btns.length) {
        card.separator(false);
        card.actionRow(...btns.map(b =>
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(b.label).setURL(b.url)
        ));
    }

    return { container: card.build(), buttons: null };
}

// ── Embed builder panel (interactive wizard) ──────────────────────────────────

export function buildEmbedBuilderPanel(script: string | null | undefined, type: 'welcome' | 'goodbye' | 'levelup' = 'welcome'): ReturnType<FadeContainer['build']> {
    const get = (key: string) => {
        if (!script) return '`Not set`';
        const p = parseScript(script).find(x => x.key === key);
        return p ? `\`${p.value.slice(0, 35)}${p.value.length > 35 ? '\u2026' : ''}\`` : '`Not set`';
    };
    const getButtons = () => {
        if (!script) return '`Not set`';
        const bs = parseScript(script).filter(x => x.key === 'button');
        if (!bs.length) return '`Not set`';
        return bs.map((b, i) => `\`${i + 1}. ${b.value.slice(0, 28)}${b.value.length > 28 ? '\u2026' : ''}\``).join(', ');
    };
    const getAuthorName = () => {
        if (!script) return '`Not set`';
        const sep = parseScript(script).find(x => x.key === 'author_name');
        if (sep) return `\`${sep.value.slice(0, 35)}\``;
        const combined = parseScript(script).find(x => x.key === 'author');
        const name = combined?.value.split('&&')[0]?.trim();
        return name ? `\`${name.slice(0, 35)}\`` : '`Not set`';
    };
    const getAuthorIcon = () => {
        if (!script) return '`Not set`';
        const sep = parseScript(script).find(x => x.key === 'author_icon');
        if (sep) return `\`${sep.value.slice(0, 35)}\``;
        const combined = parseScript(script).find(x => x.key === 'author');
        const icon = combined?.value.split('&&')[1]?.trim();
        return icon ? `\`${icon.slice(0, 35)}\`` : '`Not set`';
    };

    const isLevelup = type === 'levelup';
    const title = isLevelup ? 'Level-Up Embed Builder' : type === 'goodbye' ? 'Goodbye Embed Builder' : 'Welcome Embed Builder';
    const vars  = isLevelup
        ? '`{user}` `{user.mention}` `{user.username}` `{user.name}` `{user.avatar}` `{user.icon}` `{usericon}` `{server}` `{level}` `{id}` `{servericon}`'
        : '`{user}` `{user.mention}` `{user.username}` `{user.name}` `{user.avatar}` `{user.icon}` `{usericon}` `{server}` `{count}` `{ordinal}` `{id}` `{servericon}` `{created}`';
    const example = isLevelup
        ? '-# **Example:** `{title: 🎉 Level Up!}$v{description: {user} reached **Level {level}**!}$v{color: #7B8CDE}$v{thumbnail: {avatar}}`'
        : null;

    const builder = new FadeContainer(Colours.FADE)
        .text(`## ${e('channels')} ${title}`)
        .separator(true)
        .text([
            `**Content**     — ${get('content')}`,
            `**Color**       — ${get('color')}`,
            `**Author**      — ${getAuthorName()}`,
            `**Author Icon** — ${getAuthorIcon()}`,
            `**Title**       — ${get('title')}`,
            `**Description** — ${get('description')}`,
            `**Thumbnail**   — ${get('thumbnail')}`,
            `**Image**       — ${get('image')}`,
            `**Footer**      — ${get('footer')}`,
            `**Footer Icon** — ${get('footer_icon')}`,
            `**Buttons**     — ${getButtons()}`,
        ].join('\n'))
        .separator(false)
        .text('-# Click a button below to edit any field · Changes are saved instantly')
        .text(`-# **Variables:** ${vars}`);
    
    if (example) builder.text(example);

    return builder
        .actionRow(
            new ButtonBuilder().setCustomId(`wb_embed_${type}_content`).setLabel('Content').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`wb_embed_${type}_color`).setLabel('Color').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`wb_embed_${type}_author_name`).setLabel('Author Name').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`wb_embed_${type}_author_icon`).setLabel('Author Icon').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`wb_embed_${type}_title`).setLabel('Title').setStyle(ButtonStyle.Secondary),
        )
        .actionRow(
            new ButtonBuilder().setCustomId(`wb_embed_${type}_description`).setLabel('Description').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`wb_embed_${type}_thumbnail`).setLabel('Thumbnail').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`wb_embed_${type}_image`).setLabel('Image').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`wb_embed_${type}_footer`).setLabel('Footer').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`wb_embed_${type}_footer_icon`).setLabel('Footer Icon').setStyle(ButtonStyle.Secondary),
        )
        .actionRow(
            new ButtonBuilder().setCustomId(`wb_embed_${type}_button`).setLabel('Buttons').setStyle(ButtonStyle.Secondary),
        )
        .build();
}

export function updateEmbedScriptField(
    script: string | null | undefined,
    key: string,
    value: string | null,
): string {
    const params = script ? parseScript(script) : [];
    const filtered = params.filter(p => p.key !== key);
    if (value) {
        if (key === 'button') {
            const lines = value.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3);
            for (const line of lines) filtered.push({ key, value: line });
        } else {
            filtered.push({ key, value });
        }
    }
    return filtered.map(p => `{${p.key}: ${p.value}}`).join('$v');
}

// ── Card builder panel (interactive wizard) ───────────────────────────────────

export function buildCardBuilderPanel(script: string | null | undefined, type: 'welcome' | 'goodbye' | 'levelup' = 'welcome'): ReturnType<FadeContainer['build']> {
    const get = (key: string) => {
        if (!script) return '`Not set`';
        const p = parseScript(script).find(x => x.key === key);
        return p ? `\`${p.value.slice(0, 35)}${p.value.length > 35 ? '\u2026' : ''}\`` : '`Not set`';
    };
    const getButtons = () => {
        if (!script) return '`Not set`';
        const btns = parseScript(script).filter(x => x.key === 'button');
        if (!btns.length) return '`Not set`';
        return btns.map((b, i) => `\`${i + 1}. ${b.value.slice(0, 30)}${b.value.length > 30 ? '\u2026' : ''}\``).join(', ');
    };

    const isLevelup = type === 'levelup';
    const title = isLevelup ? 'Level-Up Card Builder' : type === 'goodbye' ? 'Goodbye Card Builder' : 'Welcome Card Builder';
    const vars  = isLevelup
        ? '`{user}` `{user.mention}` `{user.username}` `{user.name}` `{user.avatar}` `{user.icon}` `{usericon}` `{server}` `{level}` `{id}` `{servericon}`'
        : '`{user}` `{user.mention}` `{user.username}` `{user.name}` `{user.avatar}` `{user.icon}` `{usericon}` `{server}` `{count}` `{ordinal}` `{id}` `{servericon}` `{created}`';
    const example = isLevelup
        ? '-# **Example:** `{header: Level Up!}$v{body: {user} reached **Level {level}**!}$v{color: #7B8CDE}$v{thumbnail: {avatar}}`'
        : null;
    const rawDisplay = isLevelup && script
        ? `-# **Stored:** \`${script.slice(0, 100)}${script.length > 100 ? '\u2026' : ''}\``
        : null;

    const card = new FadeContainer(Colours.FADE)
        .text(`## ${e('members')} ${title}`)
        .separator(true)
        .text([
            `**Header**    — ${get('header')}`,
            `**Body**      — ${get('body')}`,
            `**Thumbnail** — ${get('thumbnail')}`,
            `**Image**     — ${get('image')}`,
            `**Color**     — ${get('color')}`,
            `**Footer**    — ${get('footer')}`,
            `**Buttons**   — ${getButtons()}`,
        ].join('\n'))
        .separator(false)
        .text('-# Click a button below to edit a field · Changes are saved instantly')
        .text(`-# **Variables:** ${vars}`);

    if (rawDisplay) card.text(rawDisplay);
    if (example) card.text(example);

    return card
        .actionRow(
            new ButtonBuilder().setCustomId(`wb_card_${type}_header`).setLabel('Header').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`wb_card_${type}_body`).setLabel('Body').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`wb_card_${type}_color`).setLabel('Color').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`wb_card_${type}_thumbnail`).setLabel('Thumbnail').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`wb_card_${type}_image`).setLabel('Image').setStyle(ButtonStyle.Secondary),
        )
        .actionRow(
            new ButtonBuilder().setCustomId(`wb_card_${type}_footer`).setLabel('Footer').setStyle(ButtonStyle.Secondary),
            new ButtonBuilder().setCustomId(`wb_card_${type}_button`).setLabel('Button').setStyle(ButtonStyle.Secondary),
        )
        .build();
}

export function updateCardScriptField(
    script: string | null | undefined,
    key: string,
    value: string | null,
): string {
    const params = script ? parseScript(script) : [];
    const filtered = params.filter(p => p.key !== key);
    if (value) {
        if (key === 'button') {
            // Each non-empty line is a separate button (max 3)
            const lines = value.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3);
            for (const line of lines) filtered.push({ key, value: line });
        } else {
            filtered.push({ key, value });
        }
    }
    return filtered.map(p => `{${p.key}: ${p.value}}`).join('$v');
}

// ── Default messages ──────────────────────────────────────────────────────────

const defaultWelcome = (member: GuildMember) =>
    `Welcome to **${member.guild.name}**, ${member.toString()}!\nYou are our **${ordinal(member.guild.memberCount)}** member.`;

const defaultGoodbye = (member: GuildMember) =>
    `**${member.user.username}** has left the server.\n${member.guild.memberCount.toLocaleString()} members remaining.`;

// ── Default embed fallback (no script set) ────────────────────────────────────

function buildDefaultWelcomeEmbed(member: GuildMember): EmbedBuilder {
    const createdAt = Math.floor(member.user.createdTimestamp / 1000);
    return new EmbedBuilder()
        .setColor(Colours.FADE)
        .setAuthor({ name: `Welcome to ${member.guild.name}!`, iconURL: member.guild.iconURL() ?? undefined })
        .setDescription(defaultWelcome(member))
        .setThumbnail(member.user.displayAvatarURL({ size: 256 }))
        .addFields(
            { name: 'Account Created', value: `<t:${createdAt}:R>`, inline: true },
            { name: 'Member Count',    value: `#${member.guild.memberCount.toLocaleString()}`, inline: true },
        )
        .setFooter({ text: `ID: ${member.id}` })
        .setTimestamp();
}

function buildDefaultGoodbyeEmbed(member: GuildMember): EmbedBuilder {
    const joinedAt = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
    const embed = new EmbedBuilder()
        .setColor(Colours.VOID)
        .setAuthor({ name: `${member.user.username} left the server`, iconURL: member.user.displayAvatarURL({ size: 256 }) })
        .setDescription(defaultGoodbye(member))
        .setFooter({ text: `ID: ${member.id}` })
        .setTimestamp();
    if (joinedAt) embed.addFields({ name: 'Was here since', value: `<t:${joinedAt}:D>`, inline: true });
    return embed;
}

// ── Default card fallback (no script set) ─────────────────────────────────────

function buildDefaultWelcomeCard(member: GuildMember) {
    const createdAt   = Math.floor(member.user.createdTimestamp / 1000);
    const memberCount = member.guild.memberCount;
    const avatarUrl   = member.user.displayAvatarURL({ size: 256 });
    return new FadeContainer(Colours.FADE)
        .section([`## Welcome, **${member.user.username}**!`, defaultWelcome(member)], thumb(avatarUrl))
        .separator(true)
        .text(`-# ${e('date')} Account created <t:${createdAt}:R>  ·  Member #${memberCount.toLocaleString()}`)
        .build();
}

function buildDefaultGoodbyeCard(member: GuildMember) {
    const joinedAt = member.joinedTimestamp ? Math.floor(member.joinedTimestamp / 1000) : null;
    const c = new FadeContainer(Colours.VOID)
        .text(`## ${e('offline')} Goodbye, **${member.user.username}**`)
        .text(defaultGoodbye(member));
    if (joinedAt) { c.separator(true); c.text(`-# ${e('date')} Was here since <t:${joinedAt}:D>`); }
    return c.build();
}

// ── Unified senders ───────────────────────────────────────────────────────────

export async function sendWelcome(
    channel: any,
    member: GuildMember,
    style: WelcomeStyle,
    message?: string | null,
    embedScript?: string | null,
    cardScript?: string | null,
    deleteAfter?: number | null,
) {
    const scheduleDelete = (msg: any) => {
        if (deleteAfter && deleteAfter > 0) {
            setTimeout(() => msg.delete().catch(() => {}), deleteAfter * 1000);
        }
    };
    try {
        if (style === 'embed') {
            if (embedScript) {
                const { embed, content, buttons } = buildScriptedEmbed(embedScript, member);
                const payload: any = { embeds: [embed] };
                if (content) payload.content = content;
                if (buttons) payload.components = [buttons];
                scheduleDelete(await channel.send(payload));
            } else {
                scheduleDelete(await channel.send({ embeds: [buildDefaultWelcomeEmbed(member)] }));
            }

        } else if (style === 'card') {
            if (cardScript) {
                const { container, buttons } = buildScriptedCard(cardScript, member);
                const payload: any = { components: [container], flags: MessageFlags.IsComponentsV2 };
                if (buttons) payload.components = [container, buttons];
                scheduleDelete(await channel.send(payload));
            } else {
                scheduleDelete(await channel.send({ components: [buildDefaultWelcomeCard(member)], flags: MessageFlags.IsComponentsV2 } as any));
            }

        } else {
            const text = message ? resolveVars(message, member) : defaultWelcome(member);
            scheduleDelete(await channel.send(text));
        }
    } catch {
        try { scheduleDelete(await channel.send({ embeds: [buildDefaultWelcomeEmbed(member)] })); } catch { /* channel inaccessible */ }
    }
}

export async function sendGoodbye(
    channel: any,
    member: GuildMember,
    style: WelcomeStyle,
    message?: string | null,
    embedScript?: string | null,
    cardScript?: string | null,
    deleteAfter?: number | null,
) {
    const scheduleDelete = (msg: any) => {
        if (deleteAfter && deleteAfter > 0) {
            setTimeout(() => msg.delete().catch(() => {}), deleteAfter * 1000);
        }
    };
    try {
        if (style === 'embed') {
            if (embedScript) {
                const { embed, content, buttons } = buildScriptedEmbed(embedScript, member);
                const payload: any = { embeds: [embed] };
                if (content) payload.content = content;
                if (buttons) payload.components = [buttons];
                scheduleDelete(await channel.send(payload));
            } else {
                scheduleDelete(await channel.send({ embeds: [buildDefaultGoodbyeEmbed(member)] }));
            }

        } else if (style === 'card') {
            if (cardScript) {
                const { container, buttons } = buildScriptedCard(cardScript, member);
                const payload: any = { components: [container], flags: MessageFlags.IsComponentsV2 };
                if (buttons) payload.components = [container, buttons];
                scheduleDelete(await channel.send(payload));
            } else {
                scheduleDelete(await channel.send({ components: [buildDefaultGoodbyeCard(member)], flags: MessageFlags.IsComponentsV2 } as any));
            }

        } else {
            const text = message ? resolveVars(message, member) : defaultGoodbye(member);
            scheduleDelete(await channel.send(text));
        }
    } catch {
        try { scheduleDelete(await channel.send({ embeds: [buildDefaultGoodbyeEmbed(member)] })); } catch { /* channel inaccessible */ }
    }
}

// ── DM welcome ────────────────────────────────────────────────────────────────

export async function sendDmWelcome(
    member: GuildMember,
    dmMessage: string,
    style: WelcomeStyle = 'embed',
): Promise<boolean> {
    try {
        const resolved = resolveVars(dmMessage, member);

        if (style === 'card') {
            const card = new FadeContainer(Colours.FADE)
                .text(`## Welcome to ${member.guild.name}!`)
                .separator(false)
                .text(resolved)
                .build();
            await member.send({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);
        } else if (style === 'embed') {
            await member.send({ embeds: [
                new EmbedBuilder()
                    .setColor(Colours.FADE)
                    .setTitle(`Welcome to ${member.guild.name}!`)
                    .setDescription(resolved)
                    .setThumbnail(member.guild.iconURL() ?? null)
                    .setTimestamp(),
            ]});
        } else {
            await member.send(resolved);
        }

        return true;
    } catch {
        return false;
    }
}

// ── Preview helpers (used by /welcome test and build wizard) ──────────────────

export { buildScriptedEmbed as previewEmbed, buildScriptedCard as previewCard };
export { buildDefaultWelcomeEmbed as defaultWelcomeEmbed, buildDefaultWelcomeCard as defaultWelcomeCard };
export { buildDefaultGoodbyeEmbed as defaultGoodbyeEmbed, buildDefaultGoodbyeCard as defaultGoodbyeCard };

// ── Script generator (used by /welcome build wizard) ─────────────────────────

export function generateEmbedScript(opts: {
    description: string;
    color?:      string;
    author?:     string;
    thumbnail?:  string;
    footer?:     string;
    timestamp?:  boolean;
}): string {
    const parts: string[] = [];
    if (opts.color)       parts.push(`{color: ${opts.color.trim()}}`);
    if (opts.author)      parts.push(`{author: ${opts.author.trim()}}`);
    if (opts.description) parts.push(`{description: ${opts.description.trim()}}`);
    if (opts.thumbnail)   parts.push(`{thumbnail: ${opts.thumbnail.trim()}}`);
    if (opts.footer)      parts.push(`{footer: ${opts.footer.trim()}}`);
    if (opts.timestamp !== false) parts.push(`{timestamp:}`);
    return parts.join('$v');
}

export function generateCardScript(opts: {
    body:       string;
    header?:    string;
    color?:     string;
    thumbnail?: string;
    image?:     string;
    footer?:    string;
    button?:    string;
}): string {
    const parts: string[] = [];
    if (opts.color)     parts.push(`{color: ${opts.color.trim()}}`);
    if (opts.image)     parts.push(`{image: ${opts.image.trim()}}`);
    if (opts.header)    parts.push(`{header: ${opts.header.trim()}}`);
    if (opts.thumbnail) parts.push(`{thumbnail: ${opts.thumbnail.trim()}}`);
    if (opts.body)      parts.push(`{body: ${opts.body.trim()}}`);
    if (opts.footer)    parts.push(`{footer: ${opts.footer.trim()}}`);
    if (opts.button)    parts.push(`{button: ${opts.button.trim()}}`);
    return parts.join('$v');
}