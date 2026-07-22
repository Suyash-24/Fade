// src/commands/utility/snipe.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import {
    FadeContainer,
    sendResponse,
    sendMessage,
} from '../../components/builders.js';
import {
    getSnipe,
    getEditSnipe,
    clearSnipe,
    clearEditSnipe,
    clearAllSnipes,
} from '../../utils/snipeCache.js';
import { e, Colours } from '../../components/emojis.js';

export const snipeCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('snipe')
        .setDescription('Show the last deleted message in this channel')
        .addChannelOption(o => o
            .setName('channel')
            .setDescription('Channel to snipe (default: current)')
            .setRequired(false)
        ),

    category:  'utility',
    prefixOnly: true,
    guildOnly: true,
    cooldown:  5,

    async execute(interaction, client) {
        const channel   = interaction.options.getChannel('channel') ?? interaction.channel;
        const channelId = channel?.id ?? interaction.channelId;
        const entry     = getSnipe(channelId);

        if (!entry) {
            const card = new FadeContainer(Colours.NONE)
                .text(`${e('search')} No recently deleted messages in <#${channelId}>.`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        const ts = Math.floor(entry.deletedAt / 1000);

        const c = new FadeContainer(Colours.FADE)
            .text(`### 🕵️ Message Sniped`)
            .text(`**Author:** <@${entry.authorId}>\n**Channel:** <#${entry.channelId}>\n**Time:** <t:${ts}:R>`)
            .separator(true)
            .text(entry.content ? `> ${entry.content.slice(0, 1000).replace(/\n/g, '\n> ')}` : '*No text content*');

        if (entry.imageUrl) {
            c.gallery([{ url: entry.imageUrl, description: 'Deleted attachment' }]);
        }

        await sendResponse(interaction, [c.build()]);
    },

    async prefixExecute(message, args, client) {
        const channelId = message.mentions.channels.first()?.id ?? message.channelId;
        const entry     = getSnipe(channelId);

        if (!entry) {
            await message.reply(`${e('search')} No recently deleted messages in <#${channelId}>.`).catch(() => (message.channel as any).send(`${e('search')} No recently deleted messages in <#${channelId}>.`).catch(() => null));
            return;
        }

        const ts   = Math.floor(entry.deletedAt / 1000);
        const card = new FadeContainer(Colours.FADE)
            .text(`### 🕵️ Message Sniped`)
            .text(`**Author:** <@${entry.authorId}>\n**Time:** <t:${ts}:R>`)
            .separator(true)
            .text(entry.content ? `> ${entry.content.slice(0, 1000).replace(/\n/g, '\n> ')}` : '*No text content*');

        if (entry.imageUrl) {
            card.gallery([{ url: entry.imageUrl, description: 'Deleted attachment' }]);
        }

        await sendMessage(message, [card.build() as any]);
    },
};

export const editSnipeCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('editsnipe')
        .setDescription('Show the last edited message in this channel')
        .addChannelOption(o => o
            .setName('channel')
            .setDescription('Channel to snipe (default: current)')
            .setRequired(false)
        ),

    category:  'utility',
    guildOnly: true,
    cooldown:  5,

    async execute(interaction, client) {
        const channel   = interaction.options.getChannel('channel') ?? interaction.channel;
        const channelId = channel?.id ?? interaction.channelId;
        const entry     = getEditSnipe(channelId);

        if (!entry) {
            const card = new FadeContainer(Colours.NONE)
                .text(`${e('search')} No recently edited messages in <#${channelId}>.`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        const ts = Math.floor(entry.editedAt / 1000);

        const card = new FadeContainer(Colours.FADE)
            .text(`### 🕵️ Edit Sniped`)
            .text(`**Author:** <@${entry.authorId}>\n**Time:** <t:${ts}:R>\n**Link:** [Jump to Message](${entry.messageUrl})`)
            .separator(true)
            .text(`**Before:**\n> ${entry.before.slice(0, 500).replace(/\n/g, '\n> ')}`)
            .separator(false)
            .text(`**After:**\n> ${entry.after.slice(0, 500).replace(/\n/g, '\n> ')}`)
            .build();

        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        const channelId = message.mentions.channels.first()?.id ?? message.channelId;
        const entry     = getEditSnipe(channelId);

        if (!entry) {
            await message.reply(`${e('search')} No recently edited messages in <#${channelId}>.`);
            return;
        }

        const ts   = Math.floor(entry.editedAt / 1000);
        const card = new FadeContainer(Colours.FADE)
            .text(`### 🕵️ Edit Sniped`)
            .text(`**Author:** <@${entry.authorId}>\n**Time:** <t:${ts}:R>`)
            .separator(true)
            .text(`**Before:**\n> ${entry.before.slice(0, 500).replace(/\n/g, '\n> ')}`)
            .separator(false)
            .text(`**After:**\n> ${entry.after.slice(0, 500).replace(/\n/g, '\n> ')}`)
            .build();

        await sendMessage(message, [card as any]);
    },
};

export const clearSnipeCommand: Command = {
    data: new SlashCommandBuilder()
        .setName('clearsnipe')
        .setDescription('Clear sniped messages from cache')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addStringOption(o => o
            .setName('scope')
            .setDescription('What to clear')
            .setRequired(false)
            .addChoices(
                { name: 'This channel only', value: 'channel' },
                { name: 'Entire server',     value: 'server'  },
            )
        ),

    category:        'utility',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageMessages],
    cooldown:        5,

    async execute(interaction, client) {
        const scope = interaction.options.getString('scope') ?? 'channel';

        if (scope === 'server') {
            clearAllSnipes(interaction.guild!.id);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Snipe cache cleared for the entire server`)
                .build();
            await sendResponse(interaction, [card]);
        } else {
            clearSnipe(interaction.channelId);
            clearEditSnipe(interaction.channelId);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Snipe cache cleared for <#${interaction.channelId}>`)
                .build();
            await sendResponse(interaction, [card]);
        }
    },

    async prefixExecute(message, args, client) {
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
            await message.reply(`${e('error')} You need Manage Messages permission.`);
            return;
        }

        if (args[0]?.toLowerCase() === 'all') {
            clearAllSnipes(message.guild!.id);
            await message.reply(`${e('success')} Snipe cache cleared for the entire server.`);
        } else {
            clearSnipe(message.channelId);
            clearEditSnipe(message.channelId);
            await message.reply(`${e('success')} Snipe cache cleared for this channel.`);
        }
    },
};

// Export all three as default array so command handler loads them all
export default [snipeCommand, editSnipeCommand, clearSnipeCommand];