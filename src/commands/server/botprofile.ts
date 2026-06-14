// src/commands/server/botprofile.ts
// Per-guild bot appearance commands using GuildMemberManager#editMe
//
//  f!botprofile avatar <url|attachment>  — per-guild avatar
//  f!botprofile banner <url|attachment>  — per-guild banner
//  f!botprofile bio [text]               — per-guild bio (website always appended)
//
// Permission: Server Owner, Bot Owner, or Administrator

import { Message, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer } from '../../components/builders.js';
import { e } from '../../components/emojis.js';
import { isBotOwner } from '../../utils/owner.js';
import type { FadeClient } from '../../client.js';

const BOT_WEBSITE = 'https://fadebot.me/';
const VALID_EXTS  = ['.png', '.jpg', '.jpeg', '.gif', '.webp'];

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Reply with a components-v2 card, no ping, no allowed mentions. */
async function send(message: Message, card: ReturnType<FadeContainer['build']>, extra?: object) {
    return message.reply({
        components: [card, ...([] as any[])] as any,
        flags: 1 << 15,
        allowedMentions: { repliedUser: false },
        ...extra,
    } as any);
}

/** Build a card with: title line → separator → body text (optional gallery). */
function buildCard(title: string, body: string) {
    return new FadeContainer()
        .text(title)
        .separator()
        .text(body);
}

function resolveImageUrl(message: Message, args: string[]): string | null {
    if (message.attachments.size > 0) return message.attachments.first()!.url;
    const url = args.find(a => /^https?:\/\//i.test(a));
    return url ?? null;
}

async function isAuthorised(client: FadeClient, message: Message): Promise<boolean> {
    return (
        message.guild!.ownerId === message.author.id ||
        (await isBotOwner(client, message.author.id)) ||
        message.member!.permissions.has(PermissionFlagsBits.Administrator)
    );
}

export default {
    data: { name: 'botprofile', description: 'Customise bot appearance for this server.' },
    prefixOnly: true,
    aliases: ['bp'],
    category: 'server',
    cooldown: 5,

    async prefixExecute(message: Message, args: string[], client: FadeClient) {
        if (!message.guild || !message.member) return;

        if (!(await isAuthorised(client, message))) {
            await send(message,
                buildCard(
                    `${e('error')} **Permission Denied**`,
                    'You need **Administrator** permission, or be the **Server/Bot Owner** to use this command.'
                ).build()
            );
            return;
        }

        const sub = args[0]?.toLowerCase();

        // ── f!botprofile avatar ───────────────────────────────────────────────
        if (sub === 'avatar') {
            const imageUrl = resolveImageUrl(message, args.slice(1));

            try {
                if (!imageUrl) {
                    await message.guild.members.editMe({ avatar: null });
                    return void await send(message,
                        buildCard(`${e('success')} **Avatar Reset**`, "The bot's server avatar has been reset.").build()
                    );
                }

                const cleanUrl = imageUrl.split('?')[0].toLowerCase();
                if (!VALID_EXTS.some(ext => cleanUrl.endsWith(ext))) {
                    return void await send(message,
                        buildCard(`${e('error')} **Invalid Image**`, 'Provide a valid image URL (PNG, JPG, GIF, WebP).').build()
                    );
                }

                const res = await fetch(imageUrl);
                if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
                const buffer = Buffer.from(await res.arrayBuffer());

                await message.guild.members.editMe({ avatar: buffer });

                const card = buildCard(`${e('success')} **Avatar Updated**`, "The bot's server avatar has been updated!")
                    .gallery([{ url: imageUrl }])
                    .build();
                await send(message, card);
            } catch (err: any) {
                await send(message,
                    buildCard(`${e('error')} **Failed**`, `\`${err.message}\``).build()
                );
            }
            return;
        }

        // ── f!botprofile banner ───────────────────────────────────────────────
        if (sub === 'banner') {
            const imageUrl = resolveImageUrl(message, args.slice(1));

            try {
                if (!imageUrl) {
                    await message.guild.members.editMe({ banner: null });
                    return void await send(message,
                        buildCard(`${e('success')} **Banner Reset**`, "The bot's server banner has been reset.").build()
                    );
                }

                const cleanUrl = imageUrl.split('?')[0].toLowerCase();
                if (!VALID_EXTS.some(ext => cleanUrl.endsWith(ext))) {
                    return void await send(message,
                        buildCard(`${e('error')} **Invalid Image**`, 'Provide a valid image URL (PNG, JPG, GIF, WebP).').build()
                    );
                }

                const res = await fetch(imageUrl);
                if (!res.ok) throw new Error(`Failed to fetch image: ${res.statusText}`);
                const buffer = Buffer.from(await res.arrayBuffer());

                await message.guild.members.editMe({ banner: buffer });

                const card = buildCard(`${e('success')} **Banner Updated**`, "The bot's server banner has been updated!")
                    .gallery([{ url: imageUrl }])
                    .build();
                await send(message, card);
            } catch (err: any) {
                const detail = err.code === 50035
                    ? 'Invalid image (too large or unsupported format).'
                    : err.message;
                await send(message,
                    buildCard(`${e('error')} **Failed**`, detail).build()
                );
            }
            return;
        }

        // ── f!botprofile bio [text] ───────────────────────────────────────────
        if (sub === 'bio') {
            const customBio = args.slice(1).join(' ').trim();
            // Discord allows ~190 chars for member bio; reserve space for website link + 2 newlines
            const MAX_CUSTOM = 190 - BOT_WEBSITE.length - 2;

            try {
                if (!customBio) {
                    await message.guild.members.editMe({ bio: null } as any);
                    return void await send(message,
                        buildCard(`${e('success')} **Bio Reset**`, "The bot's server bio has been reset. Discord will now show the global bio.").build()
                    );
                }

                if (customBio.length > MAX_CUSTOM) {
                    return void await send(message,
                        buildCard(
                            `${e('error')} **Too Long**`,
                            `Bio must be under ${MAX_CUSTOM} characters (website link is always appended).`
                        ).build()
                    );
                }

                await message.guild.members.editMe({ bio: `${customBio}\n\n${BOT_WEBSITE}` } as any);

                await send(message,
                    buildCard(
                        `${e('success')} **Bio Updated**`,
                        `The bot's server bio has been updated!\n\`\`\`\n${customBio}\n\`\`\`\n*Website link always appended automatically.*`
                    ).build()
                );
            } catch (err: any) {
                const detail = err.code === 50035
                    ? 'Invalid bio (too long or unsupported format).'
                    : err.message;
                await send(message,
                    buildCard(`${e('error')} **Failed**`, detail).build()
                );
            }
            return;
        }

        // ── Usage ─────────────────────────────────────────────────────────────
        await send(message,
            buildCard(
                `## ${e('search')} Bot Profile`,
                '`f!botprofile avatar <url|attachment>` — change bot avatar for this server\n' +
                '`f!botprofile avatar` — reset bot avatar for this server\n' +
                '`f!botprofile banner <url|attachment>` — change bot banner for this server\n' +
                '`f!botprofile banner` — reset bot banner for this server\n' +
                '`f!botprofile bio <text>` — change bot bio (website always appended)\n' +
                '`f!botprofile bio` — reset bio to just the website link\n\n' +
                '*Alias: `f!bp`*'
            ).build()
        );
    },
} satisfies Command;
