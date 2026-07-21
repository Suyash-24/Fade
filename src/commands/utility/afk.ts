// src/commands/utility/afk.ts
import { SlashCommandBuilder, MessageFlags, ThumbnailBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendResponse, sendMessage, FadeContainer } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getAfk, setAfk } from '../../db/queries/afk.js';

// A pool of subtle subline phrases
const AFK_SUBLINES = [
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

// Filler lines that sit between title and separator — sassy & contextual
const AFK_FILLERS = [
    'Notifications? Silenced. Obligations? Ignored.',
    'Catching some air. Or maybe just vibes.',
    'The keyboard has been abandoned.',
    'Gone offline but the ghost stays.',
    'Every legend needs a intermission.',
    'Even the best players go AFK sometimes.',
    'Currently avoiding responsibilities.',
    'Recharging. Do not disturb.',
    'Be back when I feel like it.',
    'Away. Mentally, physically, spiritually.',
];

function pickRandom(arr: string[]): string {
    return arr[Math.floor(Math.random() * arr.length)];
}

function buildAfkSetCard(avatarUrl: string, reason: string) {
    const subline = pickRandom(AFK_SUBLINES);
    const filler  = pickRandom(AFK_FILLERS);
    const timestamp = `<t:${Math.floor(Date.now() / 1000)}:t>`;

    const thumb = new ThumbnailBuilder().setURL(avatarUrl);

    return new FadeContainer(Colours.WARNING)
        .section(
            [
                `## ${e('afkset')}  You're now AFK`,
                `-# ${subline}`,
                `*${filler}*`,
            ],
            thumb,
        )
        .separator()
        .text(
            `**Reason**\n` +
            `\`\`\`\n${reason}\n\`\`\`` +
            `\n-# AFK since ${timestamp} · Mention me to check status`
        )
        .build();
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
    prefixOnly: true,
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
        const card = buildAfkSetCard(avatarUrl, reason);
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
        const card = buildAfkSetCard(avatarUrl, reason);
        await sendMessage(message, [card]);
    },

    aliases: ['away'],
} satisfies Command;
