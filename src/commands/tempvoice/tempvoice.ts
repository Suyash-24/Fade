// src/commands/tempvoice/tempvoice.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import { getTempVoiceConfig, updateTempVoiceConfig } from '../../db/queries/tempvoice.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: new SlashCommandBuilder()
        .setName('tempvoice')
        .setDescription('Configure the TempVoice system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(s => s
            .setName('view')
            .setDescription('View current TempVoice settings')
        )
        .addSubcommand(s => s
            .setName('setup')
            .setDescription('Set the join-to-create voice channel')
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('The voice channel users join to create their own')
                .addChannelTypes(ChannelType.GuildVoice)
                .setRequired(true)
            )
            .addChannelOption(o => o
                .setName('category')
                .setDescription('Category where temp channels are created')
                .addChannelTypes(ChannelType.GuildCategory)
                .setRequired(false)
            )
        )
        .addSubcommand(s => s
            .setName('toggle')
            .setDescription('Enable or disable TempVoice')
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('defaultname')
            .setDescription('Set the default name for new channels. Use {user} for the owner\'s name')
            .addStringOption(o => o.setName('name').setDescription('Channel name template').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('defaultlimit')
            .setDescription('Set the default user limit for new channels (0 = unlimited)')
            .addIntegerOption(o => o
                .setName('limit')
                .setDescription('User limit (0–99)')
                .setMinValue(0).setMaxValue(99)
                .setRequired(true)
            )
        ),

    category: 'tempvoice',
    guildOnly: true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown: 5,

    async execute(interaction, client) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        if (sub === 'view') {
            const config = await getTempVoiceConfig(guild.id);
            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('voice')} TempVoice Config`)
                .separator(true)
                .text([
                    `**Enabled** — \`${config.enabled ? 'Yes' : 'No'}\``,
                    `**Join channel** — ${config.joinChannelId ? `<#${config.joinChannelId}>` : '`Not set`'}`,
                    `**Category** — ${config.categoryId ? `<#${config.categoryId}>` : '`Same as join channel`'}`,
                    `**Default name** — \`${config.defaultName ?? "{user}'s channel"}\``,
                    `**Default limit** — \`${config.defaultLimit === 0 ? 'Unlimited' : config.defaultLimit}\``,
                ].join('\n'))
                .separator(false)
                .text(`-# Users control their channel with \`/vc\` commands`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        if (sub === 'setup') {
            const channel  = interaction.options.getChannel('channel', true);
            const category = interaction.options.getChannel('category');
            await updateTempVoiceConfig(guild.id, {
                joinChannelId: channel.id,
                categoryId:    category?.id ?? null,
                enabled:       true,
            });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `## ${e('voice')} TempVoice Enabled\n` +
                    `Join channel → <#${channel.id}>\n` +
                    (category ? `Category → <#${category.id}>\n` : '') +
                    `-# Users join <#${channel.id}> to create their own voice channel`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateTempVoiceConfig(guild.id, { enabled });
            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(`${e('success')}  TempVoice **${enabled ? 'enabled' : 'disabled'}**`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'defaultname') {
            const name = interaction.options.getString('name', true);
            await updateTempVoiceConfig(guild.id, { defaultName: name });
            const preview = name.replace('{user}', interaction.user.displayName);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Default name set to \`${name}\`\n-# Preview: \`${preview}\``)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'defaultlimit') {
            const limit = interaction.options.getInteger('limit', true);
            await updateTempVoiceConfig(guild.id, { defaultLimit: limit });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Default limit set to \`${limit === 0 ? 'Unlimited' : limit}\``)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }
    },
} satisfies Command;