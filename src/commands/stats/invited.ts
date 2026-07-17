// src/commands/stats/invited.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage, thumb } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getInvited } from '../../db/queries/invites.js';

function buildInvitedCard(
    user: { username: string; displayAvatarURL: (opts?: any) => string },
    invitedRecords: { invitedId: string; fake: boolean; left: boolean; code: string | null }[],
    guildName: string,
    guildMembers: any
) {
    const card = new FadeContainer(Colours.FADE)
        .section(
            [
                `## ${e('invite')} Invited Users`,
                `-# ${user.username} (Recent 20)`,
            ],
            thumb(user.displayAvatarURL({ size: 128 })),
        )
        .separator(true);

    if (invitedRecords.length === 0) {
        card.text(`${e('error')} This user hasn't invited anyone yet.`);
    } else {
        const lines = invitedRecords.map((r, i) => {
            const member = guildMembers.get(r.invitedId);
            const name = member?.displayName ?? `<@${r.invitedId}>`;
            let status = 'Regular';
            if (r.left) status = 'Left';
            if (r.fake) status = 'Fake';
            return `\`${i + 1}.\` ${name} — **${status}** (Code: ${r.code ?? 'Unknown'})`;
        });
        
        card.text(lines.join('\n'));
    }

    card.separator(true);
    card.text(`-# ${e('server')} ${guildName}`);
    return card.build();
}

export default {
    data: new SlashCommandBuilder()
        .setName('invited')
        .setDescription('View the users someone has invited')
        .addUserOption(o => o
            .setName('user')
            .setDescription('User to check (defaults to you)')
            .setRequired(false)
        ),

    category: 'stats',
    guildOnly: true,
    aliases: ['whoinvitedby'],
    cooldown: 5,

    async execute(interaction, client) {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const guild = interaction.guild!;

        const records = await getInvited(guild.id, target.id, 20);
        const card = buildInvitedCard(target, records, guild.name, guild.members.cache);
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const guild = message.guild!;
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        let target = targetId ? await client.users.fetch(targetId).catch(() => undefined) : undefined;
        if (!target) target = message.author;

        const records = await getInvited(guild.id, target.id, 20);
        const card = buildInvitedCard(target as any, records, guild.name, guild.members.cache);
        await sendMessage(message, [card]);
    },
} satisfies Command;
