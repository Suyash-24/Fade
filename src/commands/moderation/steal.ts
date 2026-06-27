// src/commands/moderation/steal.ts
// Steal an emoji or sticker — works via:
//   1) Reply to a message containing a custom emoji or sticker
//   2) f!steal <emoji>
import {
    Message,
    ButtonStyle,
    ActionRowBuilder,
    ButtonBuilder,
    MessageFlags,
    TextChannel,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { hasPermission } from '../../utils/fakePerms.js';
import type { FadeClient } from '../../client.js';

const CUSTOM_EMOJI_REGEX = /<(a?):(\w+):(\d+)>/g;

export default {
    data: { name: 'steal', description: 'Steal an emoji or sticker from a message.' },
    prefixOnly: true,
    aliases: ['steal'],
    category: 'moderation',
    cooldown: 3,

    async prefixExecute(message: Message, args: string[], _client: FadeClient) {
        if (!message.guild || !message.member) return;

        const canManage = await hasPermission(message.member, 'manage_guild_expressions');
        if (!canManage) {
            await message.reply(`${e('error')} You need **Manage Expressions** permission.`);
            return;
        }

        const replied = message.reference
            ? await message.channel.messages.fetch(message.reference.messageId!).catch(() => null)
            : null;

        // ── Determine source: reply or inline emoji arg ───────────────────────
        type AssetInfo = { name: string; url: string; animated: boolean; type: 'emoji' | 'sticker' };
        const assets: AssetInfo[] = [];

        if (replied) {
            // Check for stickers first
            for (const sticker of replied.stickers.values()) {
                assets.push({
                    name: sticker.name,
                    url: sticker.url,
                    animated: sticker.url.endsWith('.gif'),
                    type: 'sticker',
                });
            }
            // Then custom emojis in message content
            const emojiMatches = [...replied.content.matchAll(CUSTOM_EMOJI_REGEX)];
            for (const [, animated, name, id] of emojiMatches) {
                const ext = animated ? 'gif' : 'png';
                assets.push({
                    name,
                    url: `https://cdn.discordapp.com/emojis/${id}.${ext}`,
                    animated: !!animated,
                    type: 'emoji',
                });
            }
        }

        // Also check args for inline emoji(s) (e.g., f!steal <emoji>)
        const inlineContent = args.join(' ');
        const inlineMatches = [...inlineContent.matchAll(CUSTOM_EMOJI_REGEX)];
        for (const [, animated, name, id] of inlineMatches) {
            const ext = animated ? 'gif' : 'png';
            if (!assets.find(a => a.url.includes(id))) {
                assets.push({
                    name,
                    url: `https://cdn.discordapp.com/emojis/${id}.${ext}`,
                    animated: !!animated,
                    type: 'emoji',
                });
            }
        }

        if (assets.length === 0) {
            await message.reply(`${e('error')} No custom emoji or sticker found. Reply to a message with one, or pass an emoji directly.`);
            return;
        }

        // ── Show preview with Add buttons for each asset ──────────────────────
        for (const asset of assets) {
            const typeLabel = asset.type === 'sticker' ? 'Sticker' : 'Emoji';
            const card = new FadeContainer()
                .text(`## ${e('search')}  ${typeLabel}: \`${asset.name}\``)
                .gallery([{ url: asset.url }])
                .build();

            // Always show both buttons for any asset type
            const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
                new ButtonBuilder()
                    .setCustomId(`steal_add_emoji|${asset.name}|${asset.url}`)
                    .setLabel(`Add as Emoji`)
                    .setStyle(ButtonStyle.Primary),
                new ButtonBuilder()
                    .setCustomId(`steal_add_sticker|${asset.name}|${asset.url}`)
                    .setLabel(`Add as Sticker`)
                    .setStyle(ButtonStyle.Secondary),
            );

            await (message.channel as TextChannel).send({
                components: [card, row] as any,
                flags: 1 << 15,
            } as any);
        }
    },
} satisfies Command;
