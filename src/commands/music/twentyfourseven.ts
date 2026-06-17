// src/commands/music/twentyfourseven.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags, TextChannel } from 'discord.js';
import type { Command } from '../../types/command.js';
import { e, Colours } from '../../components/emojis.js';
import { FadeContainer } from '../../components/builders.js';
import { get247, set247, delete247 } from '../../db/queries/twentyFourSeven.js';
import { requireVoice, musicReply } from '../../music/utils.js';

export default {
    data: new SlashCommandBuilder()
        .setName('247')
        .setDescription('Toggles 24/7 mode in the current voice channel')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

    category: 'music',
    guildOnly: true,
    aliases:   ['247', '24/7', '24-7'],
    cooldown:  3,

    async execute(interaction, client) {
        if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
            await interaction.reply({ content: `${e('error')} You need the **Manage Server** permission to use this command.`, flags: MessageFlags.Ephemeral });
            return;
        }

        const guildId = interaction.guild!.id;
        const currentData = await get247(guildId);

        if (currentData) {
            await delete247(guildId);
            
            const card = new FadeContainer(Colours.FADE)
                .text(`## 🌙 24/7 Mode Disabled\n-# The bot will now disconnect when inactive.`)
                .build();
            await interaction.reply({ components: [card] });
            return;
        }

        const voiceChannel = (interaction.member as any)?.voice?.channel;
        if (!voiceChannel) {
            await interaction.reply({ content: `${e('error')} You must be in a voice channel to enable 24/7 mode.`, flags: MessageFlags.Ephemeral });
            return;
        }

        if (!client.music) {
            await interaction.reply({ content: `${e('error')} Music system is currently offline.`, flags: MessageFlags.Ephemeral });
            return;
        }

        // Enable
        await set247(guildId, voiceChannel.id, interaction.channelId);

        // Join channel
        const player = await client.music.createPlayer({
            guildId:    guildId,
            voiceId:    voiceChannel.id,
            textId:     interaction.channelId,
            deaf:       true,
            volume:     80,
        });

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## ☀️ 24/7 Mode Enabled\n-# I will now stay in <#${voiceChannel.id}> permanently.`)
            .build();
            
        await interaction.reply({ components: [card] });
    },

    async prefixExecute(message, args, client) {
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            await message.reply(`${e('error')} You need the **Manage Server** permission to use this command.`);
            return;
        }

        const guildId = message.guild!.id;
        const currentData = await get247(guildId);

        if (currentData) {
            await delete247(guildId);
            
            const card = new FadeContainer(Colours.FADE)
                .text(`## 🌙 24/7 Mode Disabled\n-# The bot will now disconnect when inactive.`)
                .build();
            await musicReply(message, [card]);
            return;
        }

        const voiceChannel = message.member?.voice?.channel;
        if (!voiceChannel) {
            await message.reply(`${e('error')} You must be in a voice channel to enable 24/7 mode.`);
            return;
        }

        if (!client.music) {
            await message.reply(`${e('error')} Music system is currently offline.`);
            return;
        }

        // Enable
        await set247(guildId, voiceChannel.id, message.channel.id);

        // Join channel
        const player = await client.music.createPlayer({
            guildId:    guildId,
            voiceId:    voiceChannel.id,
            textId:     message.channel.id,
            deaf:       true,
            volume:     80,
        });

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## ☀️ 24/7 Mode Enabled\n-# I will now stay in <#${voiceChannel.id}> permanently.`)
            .build();
            
        await musicReply(message, [card]);
    },
} as Command;
