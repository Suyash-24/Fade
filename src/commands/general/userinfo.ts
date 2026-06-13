// src/commands/general/userinfo.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, btn, thumb, sendResponse, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';

const buildUserInfo = async (target: any, member: any, client: any) => {
    const fullUser  = await client.users.fetch(target.id, { force: true });
    const avatarUrl = target.displayAvatarURL({ size: 512 });
    const bannerUrl = fullUser.bannerURL({ size: 1024 });

    const createdAt = Math.floor(target.createdTimestamp / 1000);
    const joinedAt  = member?.joinedTimestamp
        ? Math.floor(member.joinedTimestamp / 1000)
        : null;

    const topRoles = member?.roles.cache
        .filter((r: any) => r.id !== member.guild.id)
        .sort((a: any, b: any) => b.position - a.position)
        .first(5)
        .map((r: any) => `<@&${r.id}>`)
        .join(' ') || '`None`';

    const presence    = member?.presence?.status;
    const statusEmoji = presence === 'online' ? e('online')
                      : presence === 'idle'   ? e('idle')
                      : presence === 'dnd'    ? e('dnd')
                      : e('offline');

    const displayName = member?.displayName ?? target.username;
    const accentColor = member?.displayColor || Colours.FADE;

    const c = new FadeContainer(accentColor);

    c.section(
        [
            `## ${statusEmoji} ${displayName}`,
            `-# @${target.username} \n`+
            `-# · ${e('id')} ${target.id}`
        ],
        thumb(avatarUrl),
    );

    c.separator(true);

    c.text(
        `${e('date')}  **Created** — <t:${createdAt}:D> (<t:${createdAt}:R>)\n` +
        (joinedAt ? `${e('members')}  **Joined** — <t:${joinedAt}:D> (<t:${joinedAt}:R>)\n` : '') +
        `${e('bot')}  **Bot** — \`${target.bot ? 'Yes' : 'No'}\``
    );

    if (member) {
        c.separator(false);
        c.text(`${e('roles')}  **Top roles** — ${topRoles}`);
    }

    if (bannerUrl) {
        c.separator(false);
        c.gallery([{ url: bannerUrl, description: `${target.username}'s banner` }]);
    }

    c.separator(true);

    return c.build();
};

export default {
    data: new SlashCommandBuilder()
        .setName('userinfo')
        .setDescription('Display information about a user')
        .addUserOption(o => o
            .setName('user')
            .setDescription('The user to look up (defaults to you)')
            .setRequired(false)
        ),

    category: 'general',
    guildOnly: true,
    cooldown:  8,

    async execute(interaction, client) {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const member = interaction.guild?.members.cache.get(target.id);
        const container = await buildUserInfo(target, member, client);
        await sendResponse(interaction, [container]);
    },

    async prefixExecute(message, args, client) {
        const targetId = args[0]?.replace(/[<@!>]/g, '');
        let target = targetId ? await client.users.fetch(targetId).catch(() => undefined) : undefined;

        if (!target) target = message.author;

        let member = message.guild?.members.cache.get(target.id);
        if (!member && message.guild) {
            member = await message.guild.members.fetch(target.id).catch(() => undefined);
        }

        const container = await buildUserInfo(target, member, client);
        await sendMessage(message, [container]);
    },
} satisfies Command;

export { buildUserInfo };