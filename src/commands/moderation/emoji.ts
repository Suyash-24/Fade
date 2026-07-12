// src/commands/moderation/emoji.ts
import { Message } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { hasPermission } from '../../utils/fakePerms.js';
import type { FadeClient } from '../../client.js';

// Custom emoji regex: <:name:id> or <a:name:id>
const CUSTOM_EMOJI_REGEX = /<a?:(\w+):(\d+)>/;
// Image URL regex — direct image links OR Discord CDN emoji URLs (no extension)
const URL_REGEX = /https?:\/\/\S+(?:\.(?:png|jpg|jpeg|gif|webp)(?:\?\S*)?|cdn\.discordapp\.com\/emojis\/\d+(?:\?\S*)?)/i;

export default {
    data: { name: 'emoji', description: 'Manage server emojis.' },
    prefixOnly: true,
    aliases: ['em'],
    category: 'moderation',
    cooldown: 3,

    async prefixExecute(message: Message, args: string[], _client: FadeClient) {
        if (!message.guild || !message.member) return;

        const canManage = await hasPermission(message.member, 'manage_guild_expressions');
        if (!canManage) {
            await message.reply(`${e('error')} You need **Manage Expressions** permission.`);
            return;
        }

        const sub = args[0]?.toLowerCase();

        // ── emoji add ──────────────────────────────────────────────────────────
        if (sub === 'add') {
            // Usage: ,emoji add <name> <emoji|url>
            //    or: ,emoji add <emoji>  (name inferred from emoji)
            let name: string | undefined;
            let imageUrl: string | undefined;

            // 0. Check for an image attachment first
            const attachment = message.attachments.first();
            if (attachment && attachment.contentType?.startsWith('image/')) {
                const attachName = args[1];
                if (!attachName) {
                    await message.reply(`${e('error')} Provide a name: \`f!emoji add <name>\` then attach the image.`);
                    return;
                }
                name     = attachName.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32).padEnd(2, '_');
                // proxyURL is more stable and doesn't expire like the direct CDN URL
                imageUrl = attachment.proxyURL || attachment.url;
            } else {
                const emojiMatch = CUSTOM_EMOJI_REGEX.exec(args.slice(1).join(' '));
                const urlMatch   = URL_REGEX.exec(args.slice(1).join(' '));

                if (emojiMatch) {
                    // They passed a custom emoji — use its name and CDN url
                    const [, emojiName, emojiId] = emojiMatch;
                    const ext = args.slice(1).join(' ').startsWith('<a:') ? 'gif' : 'png';
                    if (!/^\d+$/.test(args[1]) && args[1] !== `<` && args.length > 2) {
                        name = args[1];
                    } else {
                        name = emojiName;
                    }
                    imageUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${ext}`;
                } else if (urlMatch) {
                    name     = args[1]; // name is required before the URL
                    imageUrl = urlMatch[0];
                    if (!name || URL_REGEX.test(name)) {
                        await message.reply(`${e('error')} Usage: \`${process.env.DEFAULT_PREFIX ?? 'f!'}emoji add <name> <url>\``);
                        return;
                    }
                } else {
                    await message.reply(`${e('error')} Provide a custom emoji, an image URL, or attach an image.\nUsage: \`f!emoji add <name> <emoji|url>\``);
                    return;
                }
            }

            // Sanitize name (Discord only allows alphanumeric + underscores, 2-32 chars)
            name = name!.replace(/[^a-zA-Z0-9_]/g, '_').slice(0, 32);
            if (name.length < 2) name = name.padEnd(2, '_');

            try {
                // Fetch the image as a Buffer so Discord API can process it
                let attachment: Buffer | string = imageUrl!;
                if (imageUrl!.startsWith('http')) {
                    const res = await fetch(imageUrl!, {
                        headers: { 'User-Agent': 'FadeBot/1.0 (Discord Bot)' },
                        signal: AbortSignal.timeout(10_000),
                    });
                    if (!res.ok) throw new Error(`Failed to fetch image (HTTP ${res.status})`);
                    const arrayBuf = await res.arrayBuffer();
                    if (arrayBuf.byteLength === 0) throw new Error('Image returned empty response');
                    if (arrayBuf.byteLength > 256 * 1024) throw new Error('Image is too large (max 256KB for emojis)');
                    attachment = Buffer.from(arrayBuf);
                }

                const created = await message.guild.emojis.create({ attachment, name: name! });
                const card = new FadeContainer()
                    .text(`${e('success')}  **Emoji added!**\n\`${created.name}\` ${created.toString()} has been added to the server.`)
                    .build();
                await message.reply({ components: [card] as any, flags: 1 << 15 } as any);
            } catch (err: any) {
                await message.reply(`${e('error')} Failed to add emoji: \`${err.message}\``);
            }
            return;
        }

        // ── emoji remove ───────────────────────────────────────────────────────
        if (sub === 'remove' || sub === 'delete') {
            // Usage: ,emoji remove <emoji|name|id>
            const input = args.slice(1).join(' ');
            if (!input) {
                await message.reply(`${e('error')} Provide the emoji, its name, or its ID to remove.`);
                return;
            }

            let emojiToDelete = null;
            const emojiMatch2 = CUSTOM_EMOJI_REGEX.exec(input);

            if (emojiMatch2) {
                emojiToDelete = message.guild.emojis.cache.get(emojiMatch2[2]);
            } else if (/^\d+$/.test(input.trim())) {
                emojiToDelete = message.guild.emojis.cache.get(input.trim());
            } else {
                // Search by name
                emojiToDelete = message.guild.emojis.cache.find(
                    em => em.name?.toLowerCase() === input.trim().toLowerCase()
                );
            }

            if (!emojiToDelete) {
                await message.reply(`${e('error')} Emoji not found in this server.`);
                return;
            }

            try {
                const name = emojiToDelete.name;
                await emojiToDelete.delete();
                const card = new FadeContainer()
                    .text(`${e('success')}  Emoji \`${name}\` has been removed.`)
                    .build();
                await message.reply({ components: [card] as any, flags: 1 << 15 } as any);
            } catch (err: any) {
                await message.reply(`${e('error')} Failed to remove emoji: \`${err.message}\``);
            }
            return;
        }

        // ── usage ──────────────────────────────────────────────────────────────
        await message.reply(
            `${e('error')} Unknown subcommand. Usage:\n` +
            `\`f!emoji add <name> <emoji|url>\`\n` +
            `\`f!emoji remove <emoji|name|id>\``
        );
    },
} satisfies Command;
