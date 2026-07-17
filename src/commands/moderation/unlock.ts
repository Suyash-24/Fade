// src/commands/moderation/unlock.ts
import {
    SlashCommandBuilder, PermissionFlagsBits,
    ChannelType, TextChannel,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, fadeReply, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { hasPermission } from '../../utils/fakePerms.js';

const LOCKABLE_TYPES = [ChannelType.GuildText, ChannelType.GuildNews, ChannelType.GuildAnnouncement];

async function unlockChannel(channel: TextChannel, reason: string) {
    const everyoneRole = channel.guild.roles.everyone;
    await channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: null,       // null = inherit from category / default
        SendMessagesInThreads: null,
    }, { reason: `[Fade Unlock] ${reason}` });
}

export default {
    data: new SlashCommandBuilder()
        .setName('unlock')
        .setDescription('Unlock a locked channel or the entire server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(o => o
            .setName('target')
            .setDescription('What to unlock')
            .setRequired(false)
            .addChoices(
                { name: 'This Channel', value: 'channel' },
                { name: 'Entire Server', value: 'server' },
            )
        )
        .addChannelOption(o => o
            .setName('channel')
            .setDescription('Specific channel to unlock (defaults to current channel)')
            .setRequired(false)
        )
        .addStringOption(o => o.setName('reason').setDescription('Reason for unlocking').setRequired(false)),

    category: 'moderation', guildOnly: true,
    userPermissions: [PermissionFlagsBits.ManageChannels],
    botPermissions:  [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles],
    cooldown: 5,

    async execute(interaction, client) {
        await interaction.deferReply();

        const target  = interaction.options.getString('target') ?? 'channel';
        const channel = interaction.options.getChannel('channel') ?? interaction.channel;
        const reason  = interaction.options.getString('reason') ?? 'No reason provided';
        const guild   = interaction.guild!;

        if (target === 'server') {
            const channels = guild.channels.cache.filter(ch => LOCKABLE_TYPES.includes(ch.type as any));
            let unlocked = 0;
            for (const [, ch] of channels) {
                try {
                    await unlockChannel(ch as TextChannel, reason);
                    unlocked++;
                } catch {}
            }
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('unlock')}  Server Unlocked\n-# Unlocked \`${unlocked}\` channels · ${reason}`)
                .build();
            await interaction.editReply({ ...(fadeReply([card], false) as any) });
            return;
        }

        if (!channel || !LOCKABLE_TYPES.includes(channel.type as any)) {
            await interaction.editReply(`${e('error')} Please select a valid text channel.`); return;
        }

        await unlockChannel(channel as TextChannel, reason);
        const card = new FadeContainer(Colours.SUCCESS)
            .text(`${e('unlock')}  ${channel} is now unlocked\n-# ${reason}`)
            .build();
        await interaction.editReply({ ...(fadeReply([card], false) as any), allowedMentions: { parse: [] } });
    },

    async prefixExecute(message, args, client) {
        if (!await hasPermission(message.member!, 'manage_channels')) {
            await message.reply(`${e('error')} You need Manage Channels permission.`); return;
        }

        const isServer = args[0]?.toLowerCase() === 'server' || args[0]?.toLowerCase() === 'all';
        const reason   = isServer ? args.slice(1).join(' ') || 'No reason provided' : args.join(' ') || 'No reason provided';
        const guild    = message.guild!;

        if (isServer) {
            const channels = guild.channels.cache.filter(ch => LOCKABLE_TYPES.includes(ch.type as any));
            let unlocked = 0;
            for (const [, ch] of channels) {
                try { await unlockChannel(ch as TextChannel, reason); unlocked++; } catch {}
            }
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('unlock')}  Server Unlocked\n-# Unlocked \`${unlocked}\` channels`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const targetChannel = (message.mentions.channels.first() ?? message.channel) as TextChannel;
        await unlockChannel(targetChannel, reason);
        const card = new FadeContainer(Colours.SUCCESS)
            .text(`${e('unlock')}  ${targetChannel} is now unlocked\n-# ${reason}`)
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;
