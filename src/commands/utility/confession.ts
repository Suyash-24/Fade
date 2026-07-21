// src/commands/utility/confession.ts
// Anonymous confession system. Users submit confessions via DM to the bot,
// and they are posted anonymously to a configured channel.
import {
    SlashCommandBuilder, PermissionFlagsBits, MessageFlags, EmbedBuilder,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, fadeReply, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { db } from '../../db/index.js';
import { confessionConfig, confessions } from '../../db/schema.js';
import { and, eq } from 'drizzle-orm';
import { hasPermission } from '../../utils/fakePerms.js';

async function getConfig(guildId: string) {
    const [cfg] = await db.select().from(confessionConfig).where(eq(confessionConfig.guildId, guildId)).limit(1);
    return cfg ?? null;
}

export default {
    data: new SlashCommandBuilder()
        .setName('confession')
        .setDescription('Manage the anonymous confession system')
        .addSubcommand(s => s
            .setName('setup')
            .setDescription('Set up the confession channel')
            .addChannelOption(o => o.setName('channel').setDescription('Channel for public confessions').setRequired(true))
            .addChannelOption(o => o.setName('mod_channel').setDescription('Channel for mods to see the confession + author').setRequired(false))
        )
        .addSubcommand(s => s
            .setName('disable')
            .setDescription('Disable confessions')
        )
        .addSubcommand(s => s
            .setName('ban')
            .setDescription('Ban a user from confessing (mods only, requires the confession ID)')
            .addIntegerOption(o => o.setName('confession_id').setDescription('The confession ID (visible in mod channel)').setRequired(true))
        ),

    category: 'utility', guildOnly: true,
    cooldown: 10,

    async execute(interaction, client) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        if (sub === 'setup') {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: `${e('error')} Administrator permission required.`, flags: MessageFlags.Ephemeral }); return;
            }
            const channel    = interaction.options.getChannel('channel', true);
            const modChannel = interaction.options.getChannel('mod_channel');

            await db.insert(confessionConfig)
                .values({ guildId: guild.id, channelId: channel.id, modChannelId: modChannel?.id ?? null, enabled: true })
                .onConflictDoUpdate({
                    target: confessionConfig.guildId,
                    set: { channelId: channel.id, modChannelId: modChannel?.id ?? null, enabled: true },
                });

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Confession system enabled!\n${channel}${modChannel ? ` · Mod channel: ${modChannel}` : ''}`)
                .build();
            await interaction.reply({ ...(fadeReply([card], true) as any), allowedMentions: { parse: [] } });
            return;
        }

        if (sub === 'disable') {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
                await interaction.reply({ content: `${e('error')} Administrator permission required.`, flags: MessageFlags.Ephemeral }); return;
            }
            await db.update(confessionConfig).set({ enabled: false }).where(eq(confessionConfig.guildId, guild.id));
            await interaction.reply({ content: `${e('success')} Confessions disabled.`, flags: MessageFlags.Ephemeral });
            return;
        }

        if (sub === 'ban') {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageMessages)) {
                await interaction.reply({ content: `${e('error')} Manage Messages permission required.`, flags: MessageFlags.Ephemeral }); return;
            }
            const confessionId = interaction.options.getInteger('confession_id', true);
            const [confession] = await db.select().from(confessions).where(and(eq(confessions.id, confessionId), eq(confessions.guildId, guild.id))).limit(1);
            if (!confession) {
                await interaction.reply({ content: `${e('error')} Confession #${confessionId} not found in this server.`, flags: MessageFlags.Ephemeral }); return;
            }
            await db.update(confessions).set({ banned: true }).where(eq(confessions.userId, confession.userId));
            await interaction.reply({ content: `${e('success')} User banned from confessing in this server.`, flags: MessageFlags.Ephemeral });
            return;
        }
    },

    async prefixExecute(message, args, client) {
        const sub = args[0]?.toLowerCase();
        
        if (sub === 'setup') {
            if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
                await sendMessage(message, [new FadeContainer(Colours.DANGER).text(`${e('error')} Administrator permission required.`).build()]);
                return;
            }
            const channel = message.mentions.channels.first();
            if (!channel) {
                await sendMessage(message, [new FadeContainer(Colours.DANGER).text(`${e('error')} You must mention a channel. Usage: \`f!confession setup #channel\``).build()]);
                return;
            }
            const modChannel = message.mentions.channels.at(1);
            
            await db.insert(confessionConfig)
                .values({ guildId: message.guild!.id, channelId: channel.id, modChannelId: modChannel?.id ?? null, enabled: true })
                .onConflictDoUpdate({
                    target: confessionConfig.guildId,
                    set: { channelId: channel.id, modChannelId: modChannel?.id ?? null, enabled: true },
                });

            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')} Confession system enabled!\n${channel}${modChannel ? ` · Mod channel: ${modChannel}` : ''}`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        if (sub === 'disable') {
            if (!message.member?.permissions.has(PermissionFlagsBits.Administrator)) {
                await sendMessage(message, [new FadeContainer(Colours.DANGER).text(`${e('error')} Administrator permission required.`).build()]);
                return;
            }
            await db.update(confessionConfig).set({ enabled: false }).where(eq(confessionConfig.guildId, message.guild!.id));
            await sendMessage(message, [new FadeContainer(Colours.SUCCESS).text(`${e('success')} Confessions disabled.`).build()]);
            return;
        }
        
        if (sub === 'ban') {
            if (!message.member?.permissions.has(PermissionFlagsBits.ManageMessages)) {
                await sendMessage(message, [new FadeContainer(Colours.DANGER).text(`${e('error')} Manage Messages permission required.`).build()]);
                return;
            }
            const confessionId = parseInt(args[1]);
            if (isNaN(confessionId)) {
                await sendMessage(message, [new FadeContainer(Colours.DANGER).text(`${e('error')} Please provide a valid confession ID.`).build()]);
                return;
            }
            const [confession] = await db.select().from(confessions).where(and(eq(confessions.id, confessionId), eq(confessions.guildId, message.guild!.id))).limit(1);
            if (!confession) {
                await sendMessage(message, [new FadeContainer(Colours.DANGER).text(`${e('error')} Confession #${confessionId} not found in this server.`).build()]);
                return;
            }
            await db.update(confessions).set({ banned: true }).where(eq(confessions.userId, confession.userId));
            await sendMessage(message, [new FadeContainer(Colours.SUCCESS).text(`${e('success')} User banned from confessing in this server.`).build()]);
            return;
        }
        
        // Help text
        const helpCard = new FadeContainer()
            .text(`**Confession System**\n\n\`f!confession setup #channel\` - Set up the system\n\`f!confession disable\` - Disable confessions\n\`f!confession ban <id>\` - Ban a user\n\`f!confess <message>\` - Send an anonymous confession`)
            .build();
        await sendMessage(message, [helpCard]);
    },
} satisfies Command;
