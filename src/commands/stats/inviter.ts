// src/commands/stats/inviter.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage, thumb } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getInviter } from '../../db/queries/invites.js';

function buildInviterCard(
    user: { username: string; displayAvatarURL: (opts?: any) => string },
    inviterRecord: { inviterId: string; fake: boolean; code: string | null } | null,
    guildName: string,
    guildMembers: any // To resolve inviter name
) {
    const card = new FadeContainer(Colours.FADE)
        .section(
            [
                `## ${e('invite')} Inviter Info`,
                `-# ${user.username}`,
            ],
            thumb(user.displayAvatarURL({ size: 128 })),
        )
        .separator(true);

    if (!inviterRecord) {
        card.text(`${e('error')} **Unknown**\nI don't have a record of who invited this user.`);
    } else {
        const inviterMember = guildMembers.get(inviterRecord.inviterId);
        const name = inviterMember?.displayName ?? `<@${inviterRecord.inviterId}>`;
        
        card.text(
            `${e('pinkarrow')} **Invited By** — ${name}\n` +
            `${e('pinkarrow')} **Code Used** — \`${inviterRecord.code ?? 'Unknown'}\`\n` +
            `${e('pinkarrow')} **Fake Status** — \`${inviterRecord.fake ? 'Yes (New Account)' : 'No'}\``
        );
    }

    card.separator(true);
    card.text(`-# ${e('server')} ${guildName}`);
    return card.build();
}

export default {
    data: new SlashCommandBuilder()
        .setName('inviter')
        .setDescription('Find out who invited a user')
        .addUserOption(o => o
            .setName('user')
            .setDescription('User to check (defaults to you)')
            .setRequired(false)
        ),

    category: 'stats',
    prefixOnly: true,
    guildOnly: true,
    aliases: ['whoinvited'],
    cooldown: 5,

    async execute(interaction, client) {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const guild = interaction.guild!;

        const record = await getInviter(guild.id, target.id);
        const card = buildInviterCard(target, record, guild.name, guild.members.cache);
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const guild = message.guild!;
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        let target = targetId ? await client.users.fetch(targetId).catch(() => undefined) : undefined;
        if (!target) target = message.author;

        const record = await getInviter(guild.id, target.id);
        const card = buildInviterCard(target as any, record, guild.name, guild.members.cache);
        await sendMessage(message, [card]);
    },
} satisfies Command;
