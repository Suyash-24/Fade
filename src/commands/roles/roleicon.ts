// src/commands/roles/roleicon.ts
// Set or remove a role's icon.
// Usage:
//   f!roleicon @Role <custom_emoji>  — set icon from a server emoji
//   f!roleicon @Role <image_url>     — set icon from an image URL
//   f!roleicon @Role 🔥              — set icon from a unicode emoji
//   f!roleicon @Role reset           — remove icon
import { Message, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { hasPermission } from '../../utils/fakePerms.js';
import { logger } from '../../utils/logger.js';
import type { FadeClient } from '../../client.js';

// Matches <:name:id> and <a:name:id>
const CUSTOM_EMOJI_RE = /^<(a?):\w+:(\d+)>$/;
// Matches a direct image URL (png, jpg, jpeg, gif, webp)
const IMAGE_URL_RE = /^https?:\/\/.+\.(png|jpe?g|gif|webp)(\?.*)?$/i;
// Unicode emoji — one or two chars (handles emoji + variation selector like ❤️)
const UNICODE_EMOJI_RE = /^\p{Emoji_Presentation}[\p{Emoji_Modifier}\uFE0F\u20E3]?$/u;

async function reply(message: Message, card: any) {
    return message.reply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);
}

export default {
    data: { name: 'roleicon', description: 'Set or remove a role icon.' },
    prefixOnly: true,
    aliases: ['roleicon', 'seticon', 'ricon'],
    category: 'roles',
    cooldown: 5,

    async prefixExecute(message: Message, args: string[], _client: FadeClient) {
        if (!message.guild || !message.member) return;

        // ── Permission check ────────────────────────────────────────────────
        const canManage = await hasPermission(message.member, 'manage_roles');
        if (!canManage) {
            await message.reply(`${e('error')} You need **Manage Roles** permission.`);
            return;
        }

        // ── Parse args: f!roleicon @Role <emoji/url/reset> ──────────────────
        const roleMention = message.mentions.roles.first()
            ?? (args[0] ? message.guild.roles.cache.get(args[0]) : null);

        if (!roleMention) {
            await message.reply(
                `${e('error')} Please mention a role or provide a role ID.\n` +
                `-# Usage: \`f!roleicon @Role <emoji | image url>\` or \`f!roleicon @Role reset\``
            );
            return;
        }

        // Bot's highest role must be above the target role
        const botMember = message.guild.members.me!;
        if (roleMention.position >= botMember.roles.highest.position) {
            await message.reply(`${e('error')} I can't edit **${roleMention.name}** — it's higher than or equal to my highest role.`);
            return;
        }

        // Collect the remaining args after the role mention/id
        const remaining = args
            .filter(a => a !== roleMention.id && !a.startsWith('<@&'))
            .join(' ')
            .trim();

        if (!remaining) {
            await message.reply(
                `${e('error')} Please provide an emoji, image URL, or \`reset\`.\n` +
                `-# Usage: \`f!roleicon @Role <emoji | image url | reset>\``
            );
            return;
        }

        // ── Reset ────────────────────────────────────────────────────────────
        if (remaining.toLowerCase() === 'reset') {
            try {
                await roleMention.setIcon(null, `Role icon cleared by ${message.author.tag}`);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')} Removed icon from **${roleMention.name}**`)
                    .build();
                await reply(message, card);
            } catch (err: any) {
                logger.error('roleicon: failed to clear icon', err, { guildId: message.guild.id, roleId: roleMention.id });
                await message.reply(
                    `${e('error')} Failed to remove icon — ${err?.message ?? 'Unknown error'}.\n` +
                    `-# Make sure the server is **Level 2+** boosted (required by Discord for role icons).`
                );
            }
            return;
        }

        // ── Custom emoji <:name:id> or <a:name:id> ───────────────────────────
        const emojiMatch = remaining.match(CUSTOM_EMOJI_RE);
        if (emojiMatch) {
            const animated = emojiMatch[1] === 'a';
            const emojiId  = emojiMatch[2];
            // Build the CDN URL — setIcon() requires a resolvable URL/Buffer, NOT an emoji string
            const cdnUrl = `https://cdn.discordapp.com/emojis/${emojiId}.${animated ? 'gif' : 'png'}`;
            try {
                await roleMention.setIcon(cdnUrl, `Role icon set by ${message.author.tag}`);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')} Icon set for **${roleMention.name}** → ${remaining}`)
                    .build();
                await reply(message, card);
            } catch (err: any) {
                logger.error('roleicon: failed to set custom emoji icon', err, { guildId: message.guild.id, roleId: roleMention.id });
                await message.reply(
                    `${e('error')} Failed to set icon — ${err?.message ?? 'Unknown error'}.\n` +
                    `-# Make sure the server is **Level 2+** boosted.`
                );
            }
            return;
        }

        // ── Unicode emoji (e.g. 🔥 ❤️) ───────────────────────────────────────
        // Discord has a separate API field for unicode emojis: unicodeEmoji
        // setIcon() cannot handle unicode emojis — must use role.edit({ unicodeEmoji })
        if (UNICODE_EMOJI_RE.test(remaining)) {
            try {
                await roleMention.edit({
                    unicodeEmoji: remaining,
                    reason: `Role icon set by ${message.author.tag}`,
                });
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')} Icon set for **${roleMention.name}** → ${remaining}`)
                    .build();
                await reply(message, card);
            } catch (err: any) {
                logger.error('roleicon: failed to set unicode emoji icon', err, { guildId: message.guild.id, roleId: roleMention.id });
                await message.reply(
                    `${e('error')} Failed to set icon — ${err?.message ?? 'Unknown error'}.\n` +
                    `-# Make sure the server is **Level 2+** boosted.`
                );
            }
            return;
        }

        // ── Image URL ────────────────────────────────────────────────────────
        if (IMAGE_URL_RE.test(remaining)) {
            try {
                await roleMention.setIcon(remaining, `Role icon set by ${message.author.tag}`);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')} Icon set for **${roleMention.name}** via image URL`)
                    .build();
                await reply(message, card);
            } catch (err: any) {
                logger.error('roleicon: failed to set image URL icon', err, { guildId: message.guild.id, roleId: roleMention.id });
                await message.reply(
                    `${e('error')} Failed to set icon — ${err?.message ?? 'Unknown error'}.\n` +
                    `-# Make sure the server is **Level 2+** boosted and the URL is a valid image.`
                );
            }
            return;
        }

        // ── Nothing matched ──────────────────────────────────────────────────
        await message.reply(
            `${e('error')} Couldn't recognize the icon. Provide a **custom emoji**, **unicode emoji**, **image URL** (png/jpg/gif/webp), or \`reset\`.\n` +
            `-# Example: \`f!roleicon @VIP 🔥\` or \`f!roleicon @VIP https://example.com/icon.png\``
        );
    },
} satisfies Command;
