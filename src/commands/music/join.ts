// src/commands/music/join.ts
import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { requireVoice, musicReply } from '../../music/utils.js';
import { e, Colours } from '../../components/emojis.js';
import { FadeContainer } from '../../components/builders.js';

export default {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Summons the bot to your voice channel'),

    category: 'music',
    guildOnly: true,
    aliases:   ['join', 'summon', 'connect'],
    cooldown:  3,

    async execute(interaction, client) {
        if (!client.music) {
            await interaction.reply({ content: `${e('error')} Music system is currently offline.`, flags: 64 });
            return;
        }

        const voiceChannel = (interaction.member as any)?.voice?.channel;
        if (!voiceChannel) {
            await interaction.reply({ content: `${e('error')} You must be in a voice channel first.`, flags: 64 });
            return;
        }

        const guildId = interaction.guild!.id;
        const player = client.music.players.get(guildId);

        if (player) {
            if (player.voiceId === voiceChannel.id) {
                await interaction.reply({ content: `${e('error')} I am already in your voice channel.`, flags: 64 });
                return;
            } else {
                const channelMention = player.voiceId ? `<#${player.voiceId}>` : 'another voice channel';
                await interaction.reply({ content: `${e('error')} I'm already playing in ${channelMention}.`, flags: 64 });
                return;
            }
        }

        // Join channel
        await client.music.createPlayer({
            guildId:    guildId,
            voiceId:    voiceChannel.id,
            textId:     interaction.channelId,
            deaf:       true,
            volume:     80,
        });

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## 🎙️ Joined Channel\n-# Successfully connected to <#${voiceChannel.id}>.`)
            .build();
            
        await interaction.reply({ components: [card] });
    },

    async prefixExecute(message, args, client) {
        if (!client.music) {
            await message.reply(`${e('error')} Music system is currently offline.`);
            return;
        }

        const voice = await requireVoice(message, client);
        if (!voice) return; // requireVoice handles the "not in VC" and "bot in different VC" edge cases

        const { channelId, player } = voice;

        if (player && player.voiceId === channelId) {
            await message.reply(`${e('error')} I am already in your voice channel.`);
            return;
        }

        // Join channel
        await client.music.createPlayer({
            guildId:    message.guild!.id,
            voiceId:    channelId,
            textId:     message.channel.id,
            deaf:       true,
            volume:     80,
        });

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## 🎙️ Joined Channel\n-# Successfully connected to <#${channelId}>.`)
            .build();
            
        await musicReply(message, [card]);
    },
} as Command;
