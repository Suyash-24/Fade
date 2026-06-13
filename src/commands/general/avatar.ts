// src/commands/general/avatar.ts
import { SlashCommandBuilder, ButtonStyle } from 'discord.js';
import type { ButtonBuilder, GuildMember, Message, User } from 'discord.js';
import type { Command } from '../../types/command.js';
import {
    FadeContainer,
    btn, linkBtn, sendResponse, sendMessage,
} from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';

const buildAvatar = (
    target: User,
    member?: GuildMember | null,
    mode: 'user' | 'server' = 'user',
) => {
    const displayName = member?.displayName ?? target.username;

    const hasServerAvatar = Boolean(member?.avatar);
    const showServer = mode === 'server' && hasServerAvatar;

    const userPng = target.displayAvatarURL({ size: 4096, extension: 'png' });
    const userJpg = target.displayAvatarURL({ size: 4096, extension: 'jpg' });
    const userWebp = target.displayAvatarURL({ size: 4096, extension: 'webp' });

    const serverPng = member?.avatarURL({ size: 4096, extension: 'png' }) ?? userPng;
    const serverJpg = member?.avatarURL({ size: 4096, extension: 'jpg' }) ?? userJpg;
    const serverWebp = member?.avatarURL({ size: 4096, extension: 'webp' }) ?? userWebp;

    const galleryItems = [
        {
            url: showServer ? serverPng : userPng,
            description: showServer ? 'Server avatar' : 'User avatar',
        },
    ];

    const actionRowButtons: ButtonBuilder[] = [
        linkBtn(showServer ? serverJpg : userJpg, 'JPG'),
        linkBtn(showServer ? serverPng : userPng, 'PNG'),
        linkBtn(showServer ? serverWebp : userWebp, 'WebP'),
    ];

    const container = new FadeContainer(Colours.FADE)
        .text(
            `## ${displayName}'s avatar\n` +
            `-# @${target.username}\n` +
            `-# · ${e('id')} ${target.id}`
        )
        .separator(true)
        .gallery(galleryItems)
        .separator(true)
        .actionRow(...actionRowButtons);

    if (hasServerAvatar) {
        const toggleLabel = showServer ? 'User Avatar' : 'Server Avatar';
        const toggleId = showServer
            ? `avatar_user_${target.id}`
            : `avatar_server_${target.id}`;
        container.actionRow(btn(toggleId, toggleLabel, ButtonStyle.Primary));
    }

    return container.build();
};

const resolveTargetUser = async (message: Message, args: string[]) => {
    const mentions = message.mentions.users;
    const repliedUserId = message.reference
        ? (await message.fetchReference().catch(() => null))?.author?.id
        : null;

    const explicitMention = mentions.find(u => u.id !== repliedUserId)
        || (mentions.size > 0 && !repliedUserId ? mentions.first() : null);

    if (explicitMention) {
        return explicitMention;
    }

    if (args.length > 0) {
        const idCandidate = args[0].replace(/[^0-9]/g, '');

        if (idCandidate.length) {
            try {
                return await message.client.users.fetch(idCandidate, { force: true });
            } catch {
                return null;
            }
        }
    }

    if (message.reference) {
        const repliedMessage = await message.fetchReference().catch(() => null);
        if (repliedMessage?.author) {
            return repliedMessage.author;
        }
    }

    return message.author;
};

export default {
    data: new SlashCommandBuilder()
        .setName('avatar')
        .setDescription('Display a user\'s avatar in full resolution')
        .addUserOption(o => o
            .setName('user')
            .setDescription('The user whose avatar to show (defaults to you)')
            .setRequired(false)
        ),

    category: 'general',
    cooldown: 5,

    async execute(interaction, client) {
        const target = interaction.options.getUser('user') ?? interaction.user;
        const member = interaction.guild
            ? await interaction.guild.members.fetch(target.id).catch(() => null)
            : null;
        const container = buildAvatar(target, member, 'user');

        await sendResponse(interaction, [container]);
    },

    async prefixExecute(message, args, client) {
        const target = await resolveTargetUser(message, args);

        if (!target) {
            await message.reply({
                content: 'Unable to find that user.',
                allowedMentions: { repliedUser: false },
            });
            return;
        }

        const member = message.guild
            ? await message.guild.members.fetch(target.id).catch(() => null)
            : null;
        const container = buildAvatar(target, member, 'user');

        await sendMessage(message, [container]);
    },
} satisfies Command;

export { buildAvatar };