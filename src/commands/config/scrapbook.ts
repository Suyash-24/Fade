import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, TextChannel } from 'discord.js';
import type { Command } from '../../types/command.js';
import { e, Colours } from '../../components/emojis.js';
import { FadeContainer } from '../../components/builders.js';
import { setScrapbookChannel, disableScrapbook } from '../../db/queries/scrapbook.js';

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
        ),

    category: 'config',
    userPermissions: [PermissionFlagsBits.ManageGuild],

    async prefixExecute(message, args) {
        const sub = args[0]?.toLowerCase();
        if (!sub || !['enable', 'disable'].includes(sub)) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`## ${e('error')} Invalid Usage\nUsage: \`f!scrapbook <enable|disable> [#channel]\``)
                .build();
            await message.reply({ components: [card] });
            return;
        }

        if (sub === 'disable') {
            await disableScrapbook(message.guildId!);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} The Weekly Scrapbook has been disabled.`)
                .build();
            await message.reply({ components: [card] });
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
        await message.reply({ components: [card] });
    },

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        const guildId = interaction.guildId!;

        if (sub === 'disable') {
            await disableScrapbook(guildId);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} The Weekly Scrapbook has been disabled.`)
                .build();
            await interaction.reply({ components: [card] });
            return;
        }

        if (sub === 'enable') {
            const channel = interaction.options.getChannel('channel') as TextChannel;
            await setScrapbookChannel(guildId, channel.id);
            
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`## ${e('success')} Scrapbook Enabled\nThe Weekly Server Scrapbook will now be posted every Sunday at 12:00 PM UTC in <#${channel.id}>!`)
                .build();
            await interaction.reply({ components: [card] });
            return;
        }
    }
};

export default command;
