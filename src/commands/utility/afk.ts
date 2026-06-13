// src/commands/utility/afk.ts
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendResponse, sendMessage, FadeContainer } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getAfk, setAfk } from '../../db/queries/afk.js';

export default {
    data: new SlashCommandBuilder()
        .setName('afk')
        .setDescription('Set your AFK status — bot will reply when you are mentioned')
        .addStringOption(o => o
            .setName('reason')
            .setDescription('Why you are AFK')
            .setRequired(false)
            .setMaxLength(200)
        ),

    category: 'utility',
    guildOnly: true,
    cooldown:  5,

    async execute(interaction) {
        const guildId = interaction.guild!.id;
        const userId  = interaction.user.id;
        const reason  = interaction.options.getString('reason') ?? 'AFK';

        const existing = await getAfk(guildId, userId);
        if (existing) {
            await interaction.reply({
                content: `${e('error')} You are already AFK.`,
                flags: MessageFlags.Ephemeral,
            });
            return;
        }

        await setAfk(guildId, userId, reason);

        const card = new FadeContainer(Colours.WARNING)
            .text(`${e('idle')}  You are now AFK\n-# ${reason}`)
            .build();
        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args) {
        const guildId = message.guild!.id;
        const userId  = message.author.id;
        const reason  = args.join(' ') || 'AFK';

        const existing = await getAfk(guildId, userId);
        if (existing) {
            await message.reply(`${e('error')} You are already AFK.`);
            return;
        }

        await setAfk(guildId, userId, reason);

        const card = new FadeContainer(Colours.WARNING)
            .text(`${e('idle')}  You are now AFK\n-# ${reason}`)
            .build();
        await sendMessage(message, [card]);
    },

    aliases: ['away'],
} satisfies Command;
