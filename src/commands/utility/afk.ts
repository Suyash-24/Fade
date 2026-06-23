// src/commands/utility/afk.ts
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendResponse, sendMessage, FadeContainer, FadeReplyOptions, fadeReply } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getAfk, setAfk } from '../../db/queries/afk.js';
import { ThumbnailBuilder } from 'discord.js';

// A pool of flavour phrases to keep it fresh
const AFK_PHRASES = [
    'Gone quiet for a bit.',
    'Stepped away from the screen.',
    'Offline in spirit, online in bot.',
    'Currently not available.',
    'Taking a well-deserved break.',
    'Out of office. Sort of.',
    'Wandering away for a bit.',
    'Away from keyboard.',
    'Do not disturb — for real.',
    'Unavailable until further notice.',
];

function randomPhrase(): string {
    return AFK_PHRASES[Math.floor(Math.random() * AFK_PHRASES.length)];
}

function buildAfkSetCard(avatarUrl: string | null, username: string, reason: string) {
    const phrase = randomPhrase();
    const timestamp = `<t:${Math.floor(Date.now() / 1000)}:t>`;

    const thumb = avatarUrl ? new ThumbnailBuilder().setURL(avatarUrl) : null;

    const card = new FadeContainer(Colours.NONE);

    if (thumb) {
        card.section(
            [
                `## ${e('idle')}  You're now AFK`,
                `-# ${phrase}`,
            ],
            thumb,
        );
    } else {
        card.text(`## ${e('idle')}  You're now AFK\n-# ${phrase}`);
    }

    card
        .separator()
        .text(
            `**Reason**\n` +
            `\`\`\`\n${reason}\n\`\`\`` +
            `\n-# AFK since ${timestamp} · Mention me to check status`
        );

    return card.build();
}

export default {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Set your AFK status — bot will reply when you are mentioned')
        .addStringOption(o => o
            .setName('reason')
            .setDescription('Why you are AFK')
            .setRequired(false)
            .setMaxLength(200)
        ),

    category: 'utility',
    guildOnly: true,
    cooldown:  5,

    async execute(interaction) {
        const guildId = interaction.guild!.id;
        const userId  = interaction.user.id;
        const reason  = interaction.options.getString('reason') || 'No reason provided.';

        const existing = await getAfk(guildId, userId);
        if (existing) {
            await interaction.reply({
                content: `${e('error')} You are already AFK — send any message to clear it first.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await setAfk(guildId, userId, reason);

        const avatarUrl = interaction.user.displayAvatarURL({ size: 128, forceStatic: false });
        const card = buildAfkSetCard(avatarUrl, interaction.user.username, reason);
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args) {
        const guildId = message.guild!.id;
        const userId  = message.author.id;
        const reason  = args.join(' ') || 'No reason provided.';

        const existing = await getAfk(guildId, userId);
        if (existing) {
            await message.reply(`${e('error')} You are already AFK — send any message to clear it first.`);
            return;
        }

        await setAfk(guildId, userId, reason);

        const avatarUrl = message.author.displayAvatarURL({ size: 128, forceStatic: false });
        const card = buildAfkSetCard(avatarUrl, message.author.username, reason);
        await sendMessage(message, [card]);
    },

    aliases: ['away'],
} satisfies Command;
