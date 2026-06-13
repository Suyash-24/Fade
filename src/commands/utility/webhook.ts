// src/commands/utility/webhook.ts
// Prefix-only — kept off slash to avoid hitting the 100 command limit.
// Usage:
//   f!webhook create <name> [#channel] [username] [avatar_url]
//   f!webhook send <name> <message or {embed}$v... or {card}$v...>
//   f!webhook edit <message_url> <new content>
//   f!webhook delete <name>
//   f!webhook list
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    WebhookClient,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage, thumb } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getWebhook, getGuildWebhooks, createWebhook, deleteWebhook } from '../../db/queries/webhooks.js';

// ── Script helpers (no GuildMember needed) ────────────────────────────────────

function resolveVars(text: string, message: any): string {
    return text
        .replace(/{user}/g,    message.author.toString())
        .replace(/{username}/g,message.author.username)
        .replace(/{server}/g,  message.guild?.name ?? '')
        .replace(/{channel}/g, message.channel.toString());
}

const trunc = (s: string, n: number) => s.length > n ? s.slice(0, n - 1) + '…' : s;
const validUrl = (s: string) => s.startsWith('http://') || s.startsWith('https://') ? s : undefined;

function parseScript(script: string) {
    return script.split('$v').map(part => {
        const m = part.trim().match(/^\{(\w+):\s*([\s\S]*?)\}$/);
        return m ? { key: m[1].toLowerCase(), value: m[2].trim() } : null;
    }).filter(Boolean) as { key: string; value: string }[];
}

function buildEmbed(script: string, message: any) {
    const params = parseScript(script);
    const embed  = new EmbedBuilder().setColor(Colours.FADE);
    let content: string | null = null;
    let authorName: string | null = null, authorIcon: string | null = null;
    let footerText: string | null = null, footerIcon: string | null = null;
    const btns: { label: string; url: string }[] = [];

    for (const { key, value } of params) {
        const v = resolveVars(value, message);
        switch (key) {
            case 'content':     content    = trunc(v, 2000); break;
            case 'color':       try { embed.setColor(v as any); } catch {} break;
            case 'title': case 'header':       embed.setTitle(trunc(v, 256)); break;
            case 'description': case 'body':   embed.setDescription(trunc(v, 4096)); break;
            case 'thumbnail':   { const u = validUrl(v); if (u) embed.setThumbnail(u); break; }
            case 'image':       { const u = validUrl(v); if (u) embed.setImage(u); break; }
            case 'author_name': authorName = trunc(v, 256); break;
            case 'author_icon': authorIcon = v; break;
            case 'author': {
                const [n, i] = v.split('&&').map(s => s.trim());
                if (n) authorName = trunc(n, 256);
                if (i) authorIcon = i;
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
                const [n, fv] = v.split('&&').map(s => s.trim());
                if (n && fv) embed.addFields({ name: trunc(n, 256), value: trunc(fv, 1024), inline: true });
                break;
            }
            case 'button': {
                const [label, url] = v.split('&&').map(s => s.trim());
                if (label && url && validUrl(url) && btns.length < 3) btns.push({ label, url });
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

function buildCard(script: string, message: any) {
    const params = parseScript(script);
    let header: string | null = null, body: string | null = null;
    let thumbnail: string | null = null, image: string | null = null;
    let color: number | undefined, footer: string | null = null;
    const btns: { label: string; url: string }[] = [];

    for (const { key, value } of params) {
        const v = resolveVars(value, message);
        switch (key) {
            case 'header': case 'title':       header    = trunc(v, 256); break;
            case 'body':   case 'description': body      = trunc(v, 2000); break;
            case 'thumbnail': thumbnail = validUrl(v) ?? null; break;
            case 'image':     image     = validUrl(v) ?? null; break;
            case 'color': { const c = parseInt(v.replace('#', ''), 16); if (!isNaN(c)) color = c; break; }
            case 'footer':    footer    = trunc(v, 256); break;
            case 'button': {
                const [label, url] = v.split('&&').map(s => s.trim());
                if (label && url && validUrl(url) && btns.length < 3) btns.push({ label, url });
                break;
            }
        }
    }

    const card = new FadeContainer(color as any);
    if (header) card.text(`## ${header}`);
    if (header && (body || thumbnail)) card.separator(true);
    if (body && thumbnail) {
        card.section([body], thumb(thumbnail));
    } else if (body) {
        card.text(body);
    }
    if (image) card.gallery([{ url: image }]);
    if (footer) { card.separator(true); card.text(`-# ${footer}`); }
    if (btns.length) {
        card.separator(false);
        card.actionRow(...btns.map(b =>
            new ButtonBuilder().setStyle(ButtonStyle.Link).setLabel(b.label).setURL(b.url)
        ));
    }
    return card.build();
}

// ── Command ───────────────────────────────────────────────────────────────────

export default {
    data: new SlashCommandBuilder()
        .setName('webhook')
        .setDescription('Webhook relay (prefix only — use f!webhook)'),

    category:  'utility',
    guildOnly: true,
    cooldown:  3,

    // Slash just shows a help card
    async execute(interaction) {
        const card = new FadeContainer(Colours.FADE)
            .text(
                `## ${e('link')} Webhook Relay\n` +
                `This command is prefix-only to save slash command slots.\n\n` +
                `\`f!webhook create <name> [#channel] [username] [avatar_url]\`\n` +
                `\`f!webhook send <name> <message>\`\n` +
                `\`f!webhook edit <message_url> <new content>\`\n` +
                `\`f!webhook delete <name>\`\n` +
                `\`f!webhook list\`\n\n` +
                `-# Messages support embed scripting: \`{embed}$v{title: hello}$v{description: world}\`\n` +
                `-# And card scripting: \`{card}$v{header: hello}$v{body: world}\``
            )
            .build();
        await interaction.reply({ components: [card] as any, flags: MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral } as any);
    },

    async prefixExecute(message, args) {
        const guild  = message.guild!;
        const member = message.member as any;

        if (!member.permissions.has(PermissionFlagsBits.ManageWebhooks)) {
            await message.reply(`${e('error')} You need **Manage Webhooks** to use this command.`);
            return;
        }

        const sub = args[0]?.toLowerCase();

        // ── create ────────────────────────────────────────────────────────────
        if (sub === 'create') {
            const name = args[1]?.toLowerCase();
            if (!name) { await message.reply(`${e('error')} Usage: \`f!webhook create <name> [#channel] [username] [avatar_url]\``); return; }

            const existing = await getWebhook(guild.id, name);
            if (existing) { await message.reply(`${e('error')} A webhook named \`${name}\` already exists.`); return; }

            // Channel: mentioned or current
            const channel = (message.mentions.channels.first() ?? message.channel) as any;
            if (!channel?.isTextBased()) { await message.reply(`${e('error')} Invalid channel.`); return; }

            const username  = args[2] && !args[2].startsWith('http') ? args[2] : undefined;
            const avatarUrl = args.find(a => a.startsWith('http'));

            const discordWebhook = await channel.createWebhook({
                name:   username ?? name,
                avatar: avatarUrl,
                reason: `[Fade] Webhook relay created by ${message.author.tag}`,
            }).catch(() => null);

            if (!discordWebhook) { await message.reply(`${e('error')} Failed to create webhook. Check my permissions.`); return; }

            await createWebhook({
                guildId:    guild.id,
                name,
                channelId:  channel.id,
                webhookId:  discordWebhook.id,
                webhookUrl: discordWebhook.url,
                username,
                avatarUrl,
                createdBy:  message.author.id,
            });

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Webhook \`${name}\` created in <#${channel.id}>\n-# Use \`f!webhook send ${name} <message>\` to send messages.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        // ── send ──────────────────────────────────────────────────────────────
        if (sub === 'send') {
            const name    = args[1]?.toLowerCase();
            const content = args.slice(2).join(' ');
            if (!name || !content) { await message.reply(`${e('error')} Usage: \`f!webhook send <name> <message>\``); return; }

            const entry = await getWebhook(guild.id, name);
            if (!entry) { await message.reply(`${e('error')} No webhook named \`${name}\` found.`); return; }

            const client = new WebhookClient({ url: entry.webhookUrl });
            const payload: any = {
                username:  entry.username ?? name,
                avatarURL: entry.avatarUrl ?? undefined,
            };

            if (content.startsWith('{embed}')) {
                const { embed, content: msgContent, row } = buildEmbed(content.slice(7), message);
                payload.embeds    = [embed];
                payload.content   = msgContent ?? undefined;
                if (row) payload.components = [row];
            } else if (content.startsWith('{card}')) {
                const container = buildCard(content.slice(6), message);
                payload.components = [container];
                payload.flags      = MessageFlags.IsComponentsV2;
            } else {
                payload.content = resolveVars(content, message);
            }

            const sent = await client.send(payload).catch(() => null);
            if (!sent) { await message.reply(`${e('error')} Failed to send message.`); return; }

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Message sent via \`${name}\``)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        // ── edit ──────────────────────────────────────────────────────────────
        if (sub === 'edit') {
            // f!webhook edit <message_url> <new content>
            const msgUrl    = args[1];
            const newContent = args.slice(2).join(' ');
            if (!msgUrl || !newContent) { await message.reply(`${e('error')} Usage: \`f!webhook edit <message_url> <new content>\``); return; }

            // Parse message URL: https://discord.com/channels/guildId/channelId/messageId
            const match = msgUrl.match(/channels\/\d+\/(\d+)\/(\d+)/);
            if (!match) { await message.reply(`${e('error')} Invalid message URL.`); return; }

            const [, channelId, messageId] = match;

            // Find webhook for this channel
            const all    = await getGuildWebhooks(guild.id);
            const entry  = all.find(w => w.channelId === channelId);
            if (!entry) { await message.reply(`${e('error')} No webhook found for that channel.`); return; }

            const client  = new WebhookClient({ url: entry.webhookUrl });
            const payload: any = {};

            if (newContent.startsWith('{embed}')) {
                const { embed, content, row } = buildEmbed(newContent.slice(7), message);
                payload.embeds  = [embed];
                payload.content = content ?? undefined;
                if (row) payload.components = [row];
            } else if (newContent.startsWith('{card}')) {
                payload.components = [buildCard(newContent.slice(6), message)];
                payload.flags      = MessageFlags.IsComponentsV2;
            } else {
                payload.content = resolveVars(newContent, message);
            }

            const ok = await client.editMessage(messageId, payload).catch(() => null);
            if (!ok) { await message.reply(`${e('error')} Failed to edit message.`); return; }

            const card = new FadeContainer(Colours.SUCCESS).text(`${e('success')}  Message edited.`).build();
            await sendMessage(message, [card]);
            return;
        }

        // ── delete ────────────────────────────────────────────────────────────
        if (sub === 'delete') {
            const name  = args[1]?.toLowerCase();
            if (!name) { await message.reply(`${e('error')} Usage: \`f!webhook delete <name>\``); return; }

            const entry = await getWebhook(guild.id, name);
            if (!entry) { await message.reply(`${e('error')} No webhook named \`${name}\` found.`); return; }

            // Delete from Discord
            const client = new WebhookClient({ url: entry.webhookUrl });
            await client.delete().catch(() => null);
            await deleteWebhook(guild.id, name);

            const card = new FadeContainer(Colours.DANGER).text(`${e('success')}  Webhook \`${name}\` deleted.`).build();
            await sendMessage(message, [card]);
            return;
        }

        // ── list ──────────────────────────────────────────────────────────────
        if (sub === 'list') {
            const all = await getGuildWebhooks(guild.id);
            if (!all.length) { await message.reply(`${e('error')} No webhooks configured. Use \`f!webhook create\`.`); return; }

            const lines = all.map(w => `\`${w.name}\` → <#${w.channelId}>${w.username ? ` (${w.username})` : ''}`).join('\n');
            const card  = new FadeContainer(Colours.FADE)
                .text(`## ${e('link')} Webhooks\n${lines}`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        // ── help ──────────────────────────────────────────────────────────────
        await message.reply(
            `**Webhook commands:**\n` +
            `\`f!webhook create <name> [#channel] [username] [avatar_url]\`\n` +
            `\`f!webhook send <name> <message>\`\n` +
            `\`f!webhook edit <message_url> <new content>\`\n` +
            `\`f!webhook delete <name>\`\n` +
            `\`f!webhook list\``
        );
    },

    aliases: ['wh'],
} satisfies Command;
