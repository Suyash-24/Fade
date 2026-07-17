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
            .setName('send')
            .setDescription('Send an anonymous confession to this server')
            .addStringOption(o => o.setName('message').setDescription('Your anonymous confession (no one will know it\'s you)').setRequired(true))
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

        // send
        const cfg = await getConfig(guild.id);
        if (!cfg || !cfg.enabled) {
            await interaction.reply({ content: `${e('error')} Confessions are not enabled in this server.`, flags: MessageFlags.Ephemeral }); return;
        }

        // Check if user is banned
        const [existingBan] = await db.select().from(confessions)
            .where(and(eq(confessions.guildId, guild.id), eq(confessions.userId, interaction.user.id), eq(confessions.banned, true)))
            .limit(1);
        if (existingBan) {
            await interaction.reply({ content: `${e('error')} You are banned from submitting confessions in this server.`, flags: MessageFlags.Ephemeral }); return;
        }

        const content = interaction.options.getString('message', true);
        if (content.length > 2000) {
            await interaction.reply({ content: `${e('error')} Confession must be under 2000 characters.`, flags: MessageFlags.Ephemeral }); return;
        }

        const [confession] = await db.insert(confessions).values({
            guildId: guild.id, userId: interaction.user.id, content,
        }).returning();

        const confessionChannel = guild.channels.cache.get(cfg.channelId) as any;
        if (!confessionChannel?.isTextBased()) {
            await interaction.reply({ content: `${e('error')} The confession channel seems to be missing. Please ask an admin to re-configure it.`, flags: MessageFlags.Ephemeral }); return;
        }

        const publicEmbed = new EmbedBuilder()
            .setColor(0x8096fe)
            .setTitle(`💬 Confession #${confession.id}`)
            .setDescription(content)
            .setFooter({ text: `Use /confession ban to ban a user from confessing.` })
            .setTimestamp();

        const msg = await confessionChannel.send({ embeds: [publicEmbed] });

        // Store messageId
        await db.update(confessions).set({ messageId: msg.id }).where(eq(confessions.id, confession.id));

        // Mod channel: show author
        if (cfg.modChannelId) {
            const modChannel = guild.channels.cache.get(cfg.modChannelId) as any;
            if (modChannel?.isTextBased()) {
                const modEmbed = new EmbedBuilder()
                    .setColor(0xff6b6b)
                    .setTitle(`🔍 Confession #${confession.id} (Mod View)`)
                    .setDescription(content)
                    .addFields(
                        { name: 'Author', value: `<@${interaction.user.id}> (${interaction.user.tag})` },
                        { name: 'ID', value: `\`${confession.id}\`` },
                    )
                    .setTimestamp();
                await modChannel.send({ embeds: [modEmbed] });
            }
        }

        await interaction.reply({ content: `${e('success')} Your confession has been sent anonymously!`, flags: MessageFlags.Ephemeral });
    },

    async prefixExecute(message, args, client) {
        if (!await hasPermission(message.member!, 'manage_messages')) {
            await message.reply(`${e('error')} You need Manage Messages permission to use prefix commands for confessions.`); return;
        }
        await message.reply(`${e('error')} Please use the slash command \`/confession\` for this feature.`);
    },
} satisfies Command;
