// src/commands/fun/quote.ts
// Turns any message into a beautiful cinematic quote card image.
// Usage: Reply to a message and type f!quote (or /quote)

import { SlashCommandBuilder, AttachmentBuilder, MessageType } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { Colours } from '../../components/emojis.js';
import { generateQuoteCard } from '../../utils/canvas/quoteCard.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('quote')
        .setDescription('Turn a replied message into a cinematic quote card')
        .addStringOption(opt => opt
            .setName('text')
            .setDescription('Or type a quote manually (without replying)')
            .setRequired(false)
            .setMaxLength(300)
        )
        .addUserOption(opt => opt
            .setName('author')
            .setDescription('Author to attribute when using manual text')
            .setRequired(false)
        ),

    category: 'fun',
    cooldown: 5,
    aliases: [],

    async prefixExecute(message, args) {
        const reference = message.reference;

        // Must be a reply OR have text in args
        if (!reference && args.length === 0) {
            const card = new FadeContainer(Colours.WARNING)
                .text('## ❌ Usage\nReply to a message and type `f!quote` to quote it.\n\nOr: `f!quote <text>` to quote text anonymously.')
                .build();
            await sendMessage(message, [card]);
            return;
        }

        let content: string;
        let authorName: string;
        let authorHandle: string;
        let avatarUrl: string;

        if (reference?.messageId) {
            // Fetch the replied-to message
            const replied = await message.channel.messages.fetch(reference.messageId).catch(() => null);
            if (!replied) {
                const card = new FadeContainer(Colours.DANGER)
                    .text('❌ Could not fetch the replied message.')
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            if (!replied.content || replied.content.trim().length === 0) {
                const card = new FadeContainer(Colours.WARNING)
                    .text("⚠️ That message doesn't have any text content to quote.")
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            content      = replied.cleanContent;
            authorName   = replied.member?.displayName ?? replied.author.username;
            authorHandle = replied.author.username;
            avatarUrl    = replied.author.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
        } else {
            // Manual quote: f!quote <text>
            content      = args.join(' ');
            authorName   = message.member?.displayName ?? message.author.username;
            authorHandle = message.author.username;
            avatarUrl    = message.author.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });
        }

        const loadingCard = new FadeContainer(Colours.FADE)
            .text('⏳ Generating quote card...')
            .build();
        const loadMsg = await sendMessage(message, [loadingCard]);

        try {
            const buffer = await generateQuoteCard({
                content,
                authorName,
                authorHandle,
                avatarUrl,
                quotedBy: message.author.username,
            });

            const attachment = new AttachmentBuilder(buffer, { name: 'quote.png' });
            await (message.channel as any).send({ files: [attachment] });
            await loadMsg.delete().catch(() => {});
        } catch (err) {
            const errCard = new FadeContainer(Colours.DANGER)
                .text(`❌ Failed to generate quote card.`)
                .build();
            await loadMsg.edit({ components: [errCard] });
        }
    },

    async execute(interaction) {
        const manualText = interaction.options.getString('text');
        const manualUser = interaction.options.getUser('author');

        // Check if the interaction is a reply (slash commands don't have a reference,
        // so manual text is the fallback for slash commands)
        if (!manualText) {
            await interaction.reply({
                content: '❌ For slash commands, please provide the `text` option. To quote by replying, use the prefix command `f!quote` while replying to a message.',
                ephemeral: true,
            });
            return;
        }

        await interaction.deferReply();

        const targetUser   = manualUser ?? interaction.user;
        const member       = interaction.guild?.members.cache.get(targetUser.id);
        const authorName   = member?.displayName ?? targetUser.username;
        const authorHandle = targetUser.username;
        const avatarUrl    = targetUser.displayAvatarURL({ extension: 'png', size: 256, forceStatic: true });

        try {
            const buffer = await generateQuoteCard({
                content: manualText,
                authorName,
                authorHandle,
                avatarUrl,
                quotedBy: interaction.user.username,
            });

            const attachment = new AttachmentBuilder(buffer, { name: 'quote.png' });
            await interaction.editReply({ files: [attachment] });
        } catch (err) {
            await interaction.editReply({ content: '❌ Failed to generate quote card.' });
        }
    },
};

export default command;
