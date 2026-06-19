import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, TextChannel } from 'discord.js';
import type { Command } from '../../types/command.js';
import { e, Colours } from '../../components/emojis.js';
import { FadeContainer, sendMessage, sendResponse } from '../../components/builders.js';
import { setScrapbookChannel, disableScrapbook } from '../../db/queries/scrapbook.js';
import { processWeeklyScrapbooks } from '../../utils/scrapbookTimer.js';

const command: Command = {
    data: new SlashCommandBuilder()
        .setName('scrapbook')
        .setDescription('Configure the Weekly Server Scrapbook')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(sub => sub
            .setName('enable')
            .setDescription('Enable the weekly scrapbook in a channel')
            .addChannelOption(opt => opt
                .setName('channel')
                .setDescription('The channel to post the scrapbook in')
                .addChannelTypes(ChannelType.GuildText, ChannelType.GuildAnnouncement)
                .setRequired(true)
            )
        )
        .addSubcommand(sub => sub
            .setName('disable')
            .setDescription('Disable the weekly scrapbook')
        )
        .addSubcommand(sub => sub
            .setName('force')
            .setDescription('Force trigger the scrapbook right now (Admin only)')
        ),

    category: 'config',
    userPermissions: [PermissionFlagsBits.ManageGuild],

    async prefixExecute(message, args) {
        const sub = args[0]?.toLowerCase();
        if (!sub || !['enable', 'disable', 'force'].includes(sub)) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`## ${e('error')} Invalid Usage\nUsage: \`f!scrapbook <enable|disable|force> [#channel]\``)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        if (sub === 'disable') {
            await disableScrapbook(message.guildId!);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} The Weekly Scrapbook has been disabled.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        if (sub === 'force') {
            await message.reply(`${e('success')} Forcing scrapbook generation... Check the configured channel!`);
            // We pass the client to processWeeklyScrapbooks
            await processWeeklyScrapbooks(message.client as any);
            return;
        }

        const channelMention = args[1];
        if (!channelMention) {
            await message.reply(`Please mention a channel to enable the scrapbook. Example: \`f!scrapbook enable #general\``);
            return;
        }

        const channelId = channelMention.replace(/\D/g, '');
        const channel = message.guild!.channels.cache.get(channelId);

        if (!channel || !channel.isTextBased()) {
            await message.reply(`Invalid channel mentioned.`);
            return;
        }

        await setScrapbookChannel(message.guildId!, channelId);
        
        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## ${e('success')} Scrapbook Enabled\nThe Weekly Server Scrapbook will now be posted every Sunday at 12:00 PM UTC in <#${channelId}>!`)
            .build();
        await sendMessage(message, [card]);
    },

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;

        if (sub === 'disable') {
            await disableScrapbook(guildId);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} The Weekly Scrapbook has been disabled.`)
                .build();
            await sendResponse(interaction, [card], false);
            return;
        }

        if (sub === 'force') {
            await interaction.reply({ content: `${e('success')} Forcing scrapbook generation... Check the configured channel!`, ephemeral: true });
            await processWeeklyScrapbooks(interaction.client as any);
            return;
        }

        if (sub === 'enable') {
            const channel = interaction.options.getChannel('channel') as TextChannel;
            await setScrapbookChannel(guildId, channel.id);
            
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`## ${e('success')} Scrapbook Enabled\nThe Weekly Server Scrapbook will now be posted every Sunday at 12:00 PM UTC in <#${channel.id}>!`)
                .build();
            await sendResponse(interaction, [card], false);
            return;
        }
    }
};

export default command;
