// src/commands/roles/servertag.ts
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { getServerTagConfig, upsertServerTagConfig } from '../../db/queries/serverTag.js';
import { invalidateServerTagCache } from '../../events/serverTagRoles.js';

export default {
    data: new SlashCommandBuilder()
        .setName('servertag')
        .setDescription('Reward members who equip your native Discord Server Tag')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)

        .addSubcommand(s => s
            .setName('role')
            .setDescription('Set the role to award when a member equips the native server tag')
            .addRoleOption(o => o.setName('role').setDescription('Role to award').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('channel')
            .setDescription('Set the channel where award messages are sent')
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel to send award messages in')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('message')
            .setDescription('Set a custom message to send when a member equips the tag')
            .addStringOption(o => o
                .setName('message')
                .setDescription('Custom message text. Variables: {user}, {username}, {server}, {tag}')
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('image')
            .setDescription('Set a banner image to include in the award message')
            .addStringOption(o => o
                .setName('url')
                .setDescription('URL of the image (e.g. https://imgur.com/...)')
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('config')
            .setDescription('View current server tag configuration')
        )
        .addSubcommand(s => s
            .setName('disable')
            .setDescription('Disable the server tag role system')
        ),

    category:        'roles',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        3,

    async execute(interaction) {
        const sub     = interaction.options.getSubcommand();
        const guildId = interaction.guild!.id;

        if (sub === 'role') {
            const role = interaction.options.getRole('role', true);
            await upsertServerTagConfig(guildId, { roleId: role.id, enabled: true });
            
            // We use a try-catch for invalidating cache, as the event might not have loaded it yet
            try { invalidateServerTagCache(guildId); } catch {}
            
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  <@&${role.id}> will now be awarded to members who equip the Server Tag.`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'channel') {
            const channel = interaction.options.getChannel('channel', true);
            await upsertServerTagConfig(guildId, { channelId: channel.id });
            try { invalidateServerTagCache(guildId); } catch {}
            
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Award messages will be sent in <#${channel.id}>`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'message') {
            const message = interaction.options.getString('message', true);
            await upsertServerTagConfig(guildId, { message });
            try { invalidateServerTagCache(guildId); } catch {}
            
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Award message text updated.`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'image') {
            const url = interaction.options.getString('url', true);
            if (!url.startsWith('http://') && !url.startsWith('https://')) {
                await interaction.reply({ content: `${e('error')} Please provide a valid HTTP/HTTPS URL.`, flags: MessageFlags.Ephemeral });
                return;
            }
            await upsertServerTagConfig(guildId, { image: url });
            try { invalidateServerTagCache(guildId); } catch {}
            
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Award message banner image updated.`)
                .gallery([{ url }])
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'config') {
            const config = await getServerTagConfig(guildId);
            if (!config) {
                await interaction.reply({ content: `${e('error')} Server Tag roles not configured. Use \`/servertag role\` to start.`, flags: MessageFlags.Ephemeral });
                return;
            }
            
            const card = new FadeContainer(Colours.FADE)
                .text(
                    `## ${e('settings')} Server Tag Config\n` +
                    `**Status:** ${config.enabled ? `${e('online')} Enabled` : `${e('offline')} Disabled`}\n` +
                    `**Role:** ${config.roleId ? `<@&${config.roleId}>` : 'None'}\n` +
                    `**Channel:** ${config.channelId ? `<#${config.channelId}>` : 'Not set'}\n` +
                    `**Message:** ${config.message ?? 'Default'}\n` +
                    `**Image:** ${config.image ? '[Set]' : 'Not set'}`
                );

            if (config.image) {
                card.gallery([{ url: config.image }]);
            }

            await sendResponse(interaction, [card.build()], true);
            return;
        }

        if (sub === 'disable') {
            await upsertServerTagConfig(guildId, { enabled: false });
            try { invalidateServerTagCache(guildId); } catch {}
            
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('success')}  Server Tag role system disabled.`)
                .build();
            await sendResponse(interaction, [card]);
        }
    },
} satisfies Command;
