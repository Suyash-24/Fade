// src/events/translate.ts
// Flag-react-to-translate: when a user reacts to a message with a flag emoji,
// the bot replies with the message translated into that country's language.
// Uses 3-tier fallback: unofficial Google → Lingva → MyMemory (no API keys needed).

import { MessageFlags } from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { FadeContainer } from '../components/builders.js';
import { translate, flagToLang, langToName } from '../utils/translator.js';
import { logger } from '../utils/logger.js';

// Per-message cooldown: prevent spam if many people react at once
// key = `${messageId}:${userId}:${lang}`
const cooldowns = new Map<string, number>();
const COOLDOWN_MS = 15_000;

const event: Event<'messageReactionAdd'> = {
    name: 'messageReactionAdd',

    async execute(client: FadeClient, reaction, user) {
        // Ignore bots and DMs
        if (user.bot) return;
        if (!reaction.message.guild) return;

        // Resolve partial reaction/message
        if (reaction.partial) {
            try { await reaction.fetch(); } catch { return; }
        }
        if (reaction.message.partial) {
            try { await reaction.message.fetch(); } catch { return; }
        }

        const emoji = reaction.emoji.name ?? '';

        // Check if this is a flag emoji → resolve language
        const targetLang = flagToLang(emoji);
        if (!targetLang) return;

        const message = reaction.message;
        const text    = message.content?.trim();

        // Nothing to translate (embed-only, image-only, etc.)
        if (!text || text.length < 2) return;

        // Cooldown check
        const cooldownKey = `${message.id}:${user.id}:${targetLang}`;
        const lastUsed    = cooldowns.get(cooldownKey) ?? 0;
        if (Date.now() - lastUsed < COOLDOWN_MS) return;
        cooldowns.set(cooldownKey, Date.now());

        // Clean up old cooldown entries every 500 reactions (memory safety)
        if (cooldowns.size > 500) {
            const now = Date.now();
            for (const [k, v] of cooldowns) {
                if (now - v > COOLDOWN_MS) cooldowns.delete(k);
            }
        }

        try {
            const { translated, provider } = await translate(text, targetLang);
            const langName = langToName(targetLang);

            // Don't reply if it's the same text (already in that language)
            if (translated.trim().toLowerCase() === text.toLowerCase()) {
                await message.reply({
                    content: `-# This message is already in **${langName}**!`,
                    allowedMentions: { repliedUser: false },
                }).catch(() => null);
                return;
            }

            const card = new FadeContainer()
                .text(
                    `${emoji} **Translated to ${langName}**\n` +
                    `${translated}\n\n` +
                    `-# 🌐 Translated for ${user} · powered by ${provider}`
                )
                .build();

            await message.reply({
                components: [card] as any,
                flags:      MessageFlags.IsComponentsV2,
                allowedMentions: { repliedUser: false },
            } as any).catch(() => null);

        } catch (err: any) {
            logger.warn('[Translate] All providers failed', err.message);
            await message.reply({
                content: `❌ Translation failed — all providers are currently unavailable. Try again in a moment.`,
                allowedMentions: { repliedUser: false },
            }).catch(() => null);
        }
    },
};

export default event;
