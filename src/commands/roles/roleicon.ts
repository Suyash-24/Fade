// src/commands/roles/roleicon.ts
// Set or remove a role's icon.
// Usage:
//   f!roleicon @Role <emoji | image_url>  — set icon
//   f!roleicon @Role reset                — remove icon
import { Message, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { hasPermission } from '../../utils/fakePerms.js';
import type { FadeClient } from '../../client.js';

// Matches <:name:id> and <a:name:id>
const CUSTOM_EMOJI_RE = /^<a?:\w+:(\d+)>$/;
// Matches a direct image URL (png, jpg, jpeg, gif, webp)
const IMAGE_URL_RE = /^https?:\/\/.+\.(png|jpe?g|gif|webp)(\?.*)?$/i;

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
                await message.reply({ components: [card] as any, flags: MessageFlags.IsComponentsV2 });
            } catch (err: any) {
                await message.reply(
                    `${e('error')} Failed to remove icon — ${err?.message ?? 'Unknown error'}.\n` +
                    `-# Make sure the server is **Level 2+** boosted (required by Discord for role icons).`
                );
            }
            return;
        }

        // ── Custom emoji ─────────────────────────────────────────────────────
        const emojiMatch = remaining.match(CUSTOM_EMOJI_RE);
        if (emojiMatch) {
            try {
                // Pass the emoji string directly — Discord.js resolves it to the correct format
                await roleMention.setIcon(remaining, `Role icon set by ${message.author.tag}`);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')} Icon set for **${roleMention.name}** → ${remaining}`)
                    .build();
                await message.reply({ components: [card] as any, flags: MessageFlags.IsComponentsV2 });
            } catch (err: any) {
                await message.reply(
                    `${e('error')} Failed to set icon — ${err?.message ?? 'Unknown error'}.\n` +
                    `-# Make sure the server is **Level 2+** boosted.`
                );
            }
            return;
        }

        // ── Unicode emoji ─────────────────────────────────────────────────────
        // Single Unicode emoji (e.g. 🔥 ❤️)
        const unicodeEmojiRe = /^\p{Emoji}/u;
        if (unicodeEmojiRe.test(remaining) && remaining.length <= 8) {
            try {
                await roleMention.setIcon(remaining, `Role icon set by ${message.author.tag}`);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')} Icon set for **${roleMention.name}** → ${remaining}`)
                    .build();
                await message.reply({ components: [card] as any, flags: MessageFlags.IsComponentsV2 });
            } catch (err: any) {
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
                await message.reply({ components: [card] as any, flags: MessageFlags.IsComponentsV2 });
            } catch (err: any) {
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
