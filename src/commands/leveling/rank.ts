// src/commands/leveling/rank.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { getUserLevel, getUserRank, xpProgress } from '../../db/queries/leveling.js';
import { e, Colours } from '../../components/emojis.js';

// ASCII progress bar
function progressBar(current: number, needed: number, length = 20): string {
    const pct    = Math.min(current / needed, 1);
    const filled = Math.round(pct * length);
    const empty  = length - filled;
    return `${'█'.repeat(filled)}${'░'.repeat(empty)} ${Math.round(pct * 100)}%`;
}

export const buildRankCard = async (
    targetUser: any,
    guildId: string,
    displayName: string,
    guild?: any, // Guild object for member filtering
) => {
    const row      = await getUserLevel(guildId, targetUser.id);
    // Build set of current member IDs to filter rank correctly
    const memberIds = guild?.members?.cache
        ? new Set<string>(guild.members.cache.keys())
        : undefined;
    const rank     = await getUserRank(guildId, targetUser.id, memberIds);
    const progress = xpProgress(row.xp);
    const bar      = progressBar(progress.current, progress.needed);

    return new FadeContainer(Colours.FADE)
        .text(`## ${e('level')} ${displayName}`)
        .text(`-# Rank #${rank} in this server`)
        .separator(true)
        .text(
            `${e('level')}  **Level** — \`${progress.level}\`\n` +
            `${e('stats')}  **XP** — \`${row.xp.toLocaleString()} total\`\n` +
            `**Progress** — \`${progress.current.toLocaleString()} / ${progress.needed.toLocaleString()} XP\`\n` +
            `\`${bar}\``
        )
        .build();
};

export default {
    data: new SlashCommandBuilder()
        .setName('rank')
        .setDescription("Check a user's level and XP")
        .addUserOption(o => o
            .setName('user')
            .setDescription('The user to check (defaults to you)')
            .setRequired(false)
        ),

    category: 'leveling',
    guildOnly: true,
    cooldown:  5,

    async execute(interaction, client) {
        const target      = interaction.options.getUser('user') ?? interaction.user;
        const member      = interaction.guild?.members.cache.get(target.id);
        const displayName = member?.displayName ?? target.username;

        const card = await buildRankCard(target, interaction.guild!.id, displayName, interaction.guild);
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        // Try mention first, then fetch by raw user ID from args
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        const explicitTarget = targetId ? await client.users.fetch(targetId).catch(() => null) : null;
        let target = explicitTarget || message.author;

        const member      = message.guild?.members.cache.get(target.id)
                         ?? await message.guild?.members.fetch(target.id).catch(() => null)
                         ?? null;
        const displayName = member?.displayName ?? target.username;

        const card = await buildRankCard(target, message.guild!.id, displayName, message.guild);
        await sendMessage(message, [card]);
    },
} satisfies Command;