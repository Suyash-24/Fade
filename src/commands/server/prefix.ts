// src/commands/server/prefix.ts
// Set or reset a custom prefix for this server.
// The default f! always works regardless of the custom prefix.
//
// Usage:
//   f!prefix <new_prefix>  — set custom prefix
//   f!prefix reset         — reset back to f!
//
// Permission: Administrator or Server Owner

import { Message, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer } from '../../components/builders.js';
import { e } from '../../components/emojis.js';
import type { FadeClient } from '../../client.js';
import { updateGuild, getPrefix } from '../../db/queries/guilds.js';

const DEFAULT_PREFIX = process.env.DEFAULT_PREFIX ?? 'f!';
const MAX_PREFIX_LEN = 10;

async function send(message: Message, card: ReturnType<FadeContainer['build']>) {
    return message.reply({
        components: [card] as any,
        flags: 1 << 15,
        allowedMentions: { repliedUser: false },
    } as any);
}

function buildCard(title: string, body: string) {
    return new FadeContainer()
        .text(title)
        .separator()
        .text(body)
        .build();
}

export default {
    data: { name: 'prefix', description: 'Set a custom prefix for this server.' },
    prefixOnly: true,
    aliases: ['setprefix'],
    category: 'server',
    cooldown: 5,

    async prefixExecute(message: Message, args: string[], _client: FadeClient) {
        if (!message.guild || !message.member) return;

        // Permission: admin or guild owner
        const isAdmin = message.member.permissions.has(PermissionFlagsBits.Administrator);
        const isOwner = message.guild.ownerId === message.author.id;
        if (!isAdmin && !isOwner) {
            await send(message, buildCard(
                `${e('error')} **Permission Denied**`,
                'You need **Administrator** permission or be the **Server Owner** to change the prefix.'
            ));
            return;
        }

        const input = args[0]?.trim();

        // ── No arg: show current prefix ───────────────────────────────────────
        if (!input) {
            const current = await getPrefix(message.guild.id);
            const isCustom = current !== DEFAULT_PREFIX;
            await send(message, buildCard(
                `${e('search')} **Server Prefix**`,
                `Current prefix: \`${current}\`\n` +
                (isCustom ? `Default prefix \`${DEFAULT_PREFIX}\` also always works.\n\n` : '') +
                `**Usage:**\n` +
                `\`${current}prefix <new_prefix>\` — set a custom prefix\n` +
                `\`${current}prefix reset\` — reset back to \`${DEFAULT_PREFIX}\``
            ));
            return;
        }

        // ── Reset ─────────────────────────────────────────────────────────────
        if (input.toLowerCase() === 'reset') {
            await updateGuild(message.guild.id, { prefix: DEFAULT_PREFIX });
            await send(message, buildCard(
                `${e('success')} **Prefix Reset**`,
                `The server prefix has been reset to \`${DEFAULT_PREFIX}\`.`
            ));
            return;
        }

        // ── Validate ──────────────────────────────────────────────────────────
        if (input.length > MAX_PREFIX_LEN) {
            await send(message, buildCard(
                `${e('error')} **Too Long**`,
                `Prefix must be ${MAX_PREFIX_LEN} characters or fewer. You provided ${input.length}.`
            ));
            return;
        }

        if (/\s/.test(input)) {
            await send(message, buildCard(
                `${e('error')} **Invalid Prefix**`,
                'The prefix cannot contain spaces.'
            ));
            return;
        }

        // ── Save ──────────────────────────────────────────────────────────────
        await updateGuild(message.guild.id, { prefix: input });

        await send(message, buildCard(
            `${e('success')} **Prefix Updated**`,
            `Custom prefix set to \`${input}\`\n\n` +
            `Both \`${input}\` and \`${DEFAULT_PREFIX}\` will work in this server.\n` +
            `To reset: \`${input}prefix reset\``
        ));
    },
} satisfies Command;
