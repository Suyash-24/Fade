import { SlashCommandBuilder, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { Colours } from '../../components/emojis.js';
import { FadeContainer, sendMessage, sendResponse } from '../../components/builders.js';
import {
    ingestMemory,
    listMemories,
    deleteMemory,
    clearAllMemories,
} from '../../utils/aiMemory.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('memory')
        .setDescription('Manage Fade\'s server memory AI brain')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub
            .setName('add')
            .setDescription('Teach Fade a new fact about this server')
            .addStringOption(opt => opt
                .setName('fact')
                .setDescription('The fact to remember (e.g. "The Minecraft IP is play.fade.gg")')
                .setRequired(true)
                .setMaxLength(500)
            )
        )
        .addSubcommand(sub => sub
            .setName('list')
            .setDescription('Show all stored memories for this server')
        )
        .addSubcommand(sub => sub
            .setName('delete')
            .setDescription('Forget a specific memory by ID')
            .addIntegerOption(opt => opt
                .setName('id')
                .setDescription('The memory ID (use /memory list to find it)')
                .setRequired(true)
            )
        )
        .addSubcommand(sub => sub
            .setName('scrape')
            .setDescription('Auto-learn from messages in a channel')
            .addChannelOption(opt => opt
                .setName('channel')
                .setDescription('The channel to scrape (e.g. #announcements, #rules)')
                .setRequired(true)
            )
        )
        .addSubcommand(sub => sub
            .setName('clear')
            .setDescription('⚠️ Wipe ALL memories from this server')
        )
        .addSubcommand(sub => sub
            .setName('status')
            .setDescription('See how many memories Fade has stored')
        ),

    category: 'utility',
    cooldown: 5,

    async prefixExecute(message, args) {
        const sub = args[0]?.toLowerCase();
        const guildId = message.guildId!;

        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            const card = new FadeContainer(Colours.DANGER)
                .text('## ❌ No Permission\nYou need **Manage Server** permission to manage memories.')
                .build();
            await sendMessage(message, [card]);
            return;
        }

        if (!sub || sub === 'status') {
            const memories = await listMemories(guildId);
            const card = new FadeContainer(Colours.INFO)
                .text(`## 🧠 Fade Memory Status\n**${memories.length}** memories stored for this server.\n\nUse \`f!memory add <fact>\` to teach me something!`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        if (sub === 'add') {
            const fact = args.slice(1).join(' ');
            if (!fact) {
                const card = new FadeContainer(Colours.WARNING)
                    .text('## ⚠️ Missing Fact\nUsage: `f!memory add <the fact to remember>`')
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            const loadingCard = new FadeContainer(Colours.FADE)
                .text('⏳ Processing and embedding memory...')
                .build();
            const msg = await sendMessage(message, [loadingCard]);

            try {
                const id = await ingestMemory(guildId, fact, message.author.id);
                const successCard = new FadeContainer(Colours.SUCCESS)
                    .text(`## ✅ Memory Stored (ID: \`${id}\`)\n> ${fact}\n\nFade will now use this to answer questions!`)
                    .build();
                await msg.edit({ components: [successCard] });
            } catch (err) {
                const errCard = new FadeContainer(Colours.DANGER)
                    .text(`## ❌ Failed\nCouldn't store memory: ${err}`)
                    .build();
                await msg.edit({ components: [errCard] });
            }
            return;
        }

        if (sub === 'list') {
            const memories = await listMemories(guildId);
            if (memories.length === 0) {
                const card = new FadeContainer(Colours.INFO)
                    .text('## 🧠 No Memories Yet\nUse `f!memory add <fact>` to teach me something!')
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            const items = memories.slice(0, 20).map(m =>
                `**[${m.id}]** ${m.content.length > 80 ? m.content.slice(0, 80) + '...' : m.content}`
            ).join('\n');

            const card = new FadeContainer(Colours.INFO)
                .text(`## 🧠 Server Memories (${memories.length} total)\n\n${items}${memories.length > 20 ? '\n\n*...and more. Use \`f!memory list\` in slash commands to see all.*' : ''}`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        if (sub === 'delete') {
            const id = parseInt(args[1]);
            if (isNaN(id)) {
                const card = new FadeContainer(Colours.WARNING)
                    .text('Usage: `f!memory delete <id>` — get IDs from `f!memory list`')
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            const deleted = await deleteMemory(id, guildId);
            const card = new FadeContainer(deleted ? Colours.SUCCESS : Colours.WARNING)
                .text(deleted
                    ? `## ✅ Memory Deleted\nMemory \`${id}\` has been forgotten.`
                    : `## ⚠️ Not Found\nNo memory with ID \`${id}\` found in this server.`
                )
                .build();
            await sendMessage(message, [card]);
            return;
        }

        if (sub === 'scrape') {
            const channelMention = args[1];
            const channelId = channelMention?.replace(/[<#>]/g, '');
            const channel = message.guild?.channels.cache.get(channelId ?? '') as any;

            if (!channel?.isTextBased()) {
                const card = new FadeContainer(Colours.WARNING)
                    .text('## ⚠️ Invalid Channel\nUsage: `f!memory scrape #channel`')
                    .build();
                await sendMessage(message, [card]);
                return;
            }

            const loadingCard = new FadeContainer(Colours.FADE)
                .text(`⏳ Scraping last 100 messages from <#${channel.id}>...`)
                .build();
            const msg = await sendMessage(message, [loadingCard]);

            try {
                const fetched = await channel.messages.fetch({ limit: 100 });
                const texts = fetched
                    .filter((m: any) => !m.author.bot && m.content.length > 20)
                    .map((m: any) => m.cleanContent as string)
                    .slice(0, 50); // Max 50 unique messages

                let ingested = 0;
                for (const text of texts) {
                    await ingestMemory(guildId, text, message.author.id);
                    ingested++;
                }

                const doneCard = new FadeContainer(Colours.SUCCESS)
                    .text(`## ✅ Scrape Complete\nIngested **${ingested}** messages from <#${channel.id}> into Fade's memory!`)
                    .build();
                await msg.edit({ components: [doneCard] });
            } catch (err) {
                const errCard = new FadeContainer(Colours.DANGER)
                    .text(`## ❌ Scrape Failed\n${err}`)
                    .build();
                await msg.edit({ components: [errCard] });
            }
            return;
        }

        if (sub === 'clear') {
            const count = await clearAllMemories(guildId);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`## 🗑️ Memories Cleared\nDeleted **${count}** memories from this server.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }
    },

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;

        if (sub === 'status') {
            const memories = await listMemories(guildId);
            const card = new FadeContainer(Colours.INFO)
                .text(`## 🧠 Fade Memory Status\n**${memories.length}** memories stored for this server.\n\nUse \`/memory add\` to teach me something!`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        if (sub === 'add') {
            const fact = interaction.options.getString('fact', true);
            await interaction.deferReply({ ephemeral: true });

            try {
                const id = await ingestMemory(guildId, fact, interaction.user.id);
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`## ✅ Memory Stored (ID: \`${id}\`)\n> ${fact}\n\nFade will now use this to answer questions!`)
                    .build();
                await interaction.editReply({ components: [card] });
            } catch (err) {
                await interaction.editReply({ content: `❌ Failed to store memory: ${err}` });
            }
            return;
        }

        if (sub === 'list') {
            const memories = await listMemories(guildId);
            if (memories.length === 0) {
                await interaction.reply({ content: '🧠 No memories stored yet. Use `/memory add` to teach me!', ephemeral: true });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle('🧠 Server Memory Bank')
                .setColor(0x6C63FF)
                .setDescription(
                    memories.slice(0, 25).map(m =>
                        `**[${m.id}]** ${m.content.length > 80 ? m.content.slice(0, 80) + '...' : m.content}`
                    ).join('\n')
                )
                .setFooter({ text: `${memories.length} total memories` });

            await interaction.reply({ embeds: [embed], ephemeral: true });
            return;
        }

        if (sub === 'delete') {
            const id = interaction.options.getInteger('id', true);
            const deleted = await deleteMemory(id, guildId);
            await interaction.reply({
                content: deleted
                    ? `✅ Memory \`${id}\` forgotten.`
                    : `⚠️ No memory with ID \`${id}\` found.`,
                ephemeral: true,
            });
            return;
        }

        if (sub === 'scrape') {
            const channel = interaction.options.getChannel('channel', true) as any;
            await interaction.deferReply({ ephemeral: true });

            try {
                const fetched = await channel.messages.fetch({ limit: 100 });
                const texts = fetched
                    .filter((m: any) => !m.author.bot && m.content.length > 20)
                    .map((m: any) => m.cleanContent as string)
                    .slice(0, 50);

                let ingested = 0;
                for (const text of texts) {
                    await ingestMemory(guildId, text, interaction.user.id);
                    ingested++;
                }

                await interaction.editReply({ content: `✅ Ingested **${ingested}** messages from <#${channel.id}>.` });
            } catch (err) {
                await interaction.editReply({ content: `❌ Failed: ${err}` });
            }
            return;
        }

        if (sub === 'clear') {
            const count = await clearAllMemories(guildId);
            await interaction.reply({ content: `🗑️ Cleared **${count}** memories.`, ephemeral: true });
            return;
        }
    },
};

export default command;
