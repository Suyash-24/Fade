import {
    SlashCommandBuilder, PermissionFlagsBits, MessageFlags,
    ChannelType, TextChannel, type GuildTextBasedChannel,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, fadeReply, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { hasPermission } from '../../utils/fakePerms.js';

const LOCKABLE_TYPES = [ChannelType.GuildText, ChannelType.GuildNews, ChannelType.GuildAnnouncement];

async function lockChannel(channel: TextChannel, reason: string) {
    const everyoneRole = channel.guild.roles.everyone;
    await channel.permissionOverwrites.edit(everyoneRole, {
        SendMessages: false,
        SendMessagesInThreads: false,
    }, { reason: `[Fade Lock] ${reason}` });
}

export default {
    data: new SlashCommandBuilder()
        .setName('lock')
        .setDescription('Lock a channel or the entire server')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addStringOption(o => o
            .setName('target')
            .setDescription('What to lock')
            .setRequired(false)
            .addChoices(
                { name: 'This Channel', value: 'channel' },
                { name: 'Entire Server', value: 'server' },
            )
        )
        .addChannelOption(o => o
            .setName('channel')
            .setDescription('Specific channel to lock (defaults to current channel)')
            .setRequired(false)
        )
        .addStringOption(o => o.setName('reason').setDescription('Reason for locking').setRequired(false)),

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
            let locked = 0;
            for (const [, ch] of channels) {
                try {
                    await lockChannel(ch as TextChannel, reason);
                    locked++;
                } catch {}
            }
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('lock')}  Server Locked\n-# Locked \`${locked}\` channels · ${reason}`)
                .build();
            await interaction.editReply({ ...(fadeReply([card], false) as any) });
            return;
        }

        if (!channel || !LOCKABLE_TYPES.includes(channel.type as any)) {
            await interaction.editReply(`${e('error')} Please select a valid text channel.`); return;
        }

        await lockChannel(channel as TextChannel, reason);
        const card = new FadeContainer(Colours.DANGER)
            .text(`${e('lock')}  ${channel} is now locked\n-# ${reason}`)
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
            let locked = 0;
            for (const [, ch] of channels) {
                try { await lockChannel(ch as TextChannel, reason); locked++; } catch {}
            }
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('lock')}  Server Locked\n-# Locked \`${locked}\` channels`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const targetChannel = (message.mentions.channels.first() ?? message.channel) as TextChannel;
        await lockChannel(targetChannel, reason);
        const card = new FadeContainer(Colours.DANGER)
            .text(`${e('lock')}  ${targetChannel} is now locked\n-# ${reason}`)
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;
