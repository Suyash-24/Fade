// src/commands/stats/invites.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage, thumb, btn, ButtonStyle } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getInviteStats, getTotalInvites, getInviter, getInvited, getInviteLeaderboard } from '../../db/queries/invites.js';

// ── /invites ─────────────────────────────────────────────────────────────────

function buildInvitesCard(
    user: { username: string; displayAvatarURL: (opts?: any) => string },
    stats: { regular: number; left: number; fake: number; bonus: number },
    guildName: string,
) {
    const total = getTotalInvites(stats);

    return new FadeContainer(Colours.FADE)
        .section(
            [
                `## ${e('invite')} Invite Stats`,
                `-# ${user.username}`,
            ],
            thumb(user.displayAvatarURL({ size: 128 })),
        )
        .separator(true)
        .text(
            `${e('pinkarrow')} **Total Invites** — \`${total}\`\n` +
            `${e('pinkarrow')} **Regular** — \`${stats.regular}\`\n` +
            `${e('pinkarrow')} **Left** — \`${stats.left}\`\n` +
            `${e('pinkarrow')} **Fake** — \`${stats.fake}\`\n` +
            `${e('pinkarrow')} **Bonus** — \`${stats.bonus}\``
        )
        .separator(true)
        .text(`-# ${e('server')} ${guildName}`)
        .build();
}

export default {
    data: new SlashCommandBuilder()
        .setName('invites')
        .setDescription('Check invite stats for yourself or another user')
        .addUserOption(o => o
            .setName('user')
            .setDescription('User to check (defaults to you)')
            .setRequired(false)
        ),

    category: 'stats',
    prefixOnly: true,
    guildOnly: true,
    aliases: ['inv'],
    cooldown: 5,

    async execute(interaction, client) {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const guild = interaction.guild!;

        const stats = await getInviteStats(guild.id, target.id);
        const card = buildInvitesCard(target, stats, guild.name);
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const guild = message.guild!;
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        let target = targetId ? await client.users.fetch(targetId).catch(() => undefined) : undefined;
        if (!target) target = message.author;

        const stats = await getInviteStats(guild.id, target.id);
        const card = buildInvitesCard(target as any, stats, guild.name);
        await sendMessage(message, [card]);
    },
} satisfies Command;
