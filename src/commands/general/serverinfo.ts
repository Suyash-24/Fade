// src/commands/general/serverinfo.ts
import { SlashCommandBuilder, ChannelType, GuildVerificationLevel } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, thumb, fadeReply, sendMessage } from '../../components/builders.js';
import { e } from '../../components/emojis.js';

const buildServerInfo = async (guild: any) => {
    await guild.fetch();
    const owner      = await guild.fetchOwner();
    const createdAt  = Math.floor(guild.createdTimestamp / 1000);

    const textCh     = guild.channels.cache.filter((c: any) => c.type === ChannelType.GuildText).size;
    const voiceCh    = guild.channels.cache.filter((c: any) => c.type === ChannelType.GuildVoice).size;
    const stageCh    = guild.channels.cache.filter((c: any) => c.type === ChannelType.GuildStageVoice).size;
    const categories = guild.channels.cache.filter((c: any) => c.type === ChannelType.GuildCategory).size;
    const afkCh      = guild.afkChannel;
    const sysCh      = guild.systemChannel;

    const boosts      = guild.premiumSubscriptionCount ?? 0;
    const boostTier   = guild.premiumTier;
    const roleCount   = guild.roles.cache.size - 1;
    const emojiCount  = guild.emojis.cache.size;
    const stickerCount = guild.stickers?.cache?.size ?? 0;

    // Fetch members to get accurate human/bot split
    const totalMembers = guild.memberCount;
    const cachedMembers = guild.members.cache;
    const humans = cachedMembers.filter((m: any) => !m.user.bot).size;
    const bots   = cachedMembers.filter((m: any) => m.user.bot).size;

    const verifyLabel =
        guild.verificationLevel === GuildVerificationLevel.None     ? 'None' :
        guild.verificationLevel === GuildVerificationLevel.Low      ? 'Low' :
        guild.verificationLevel === GuildVerificationLevel.Medium   ? 'Medium' :
        guild.verificationLevel === GuildVerificationLevel.High     ? 'High' :
        guild.verificationLevel === GuildVerificationLevel.VeryHigh ? 'Very High' : 'None';

    const boostBar = `${'▰'.repeat(Math.min(boosts, 14))}${'▱'.repeat(Math.max(0, 14 - boosts))}`;

    const iconUrl  = guild.iconURL({ size: 512 })
        ?? guild.client.user?.displayAvatarURL({ size: 512 })
        ?? 'https://cdn.discordapp.com/embed/avatars/0.png';
    const bannerUrl = guild.bannerURL({ size: 1024 });

    const hd = e('heartdot'); // single emoji used only on section headers

    const c = new FadeContainer();

    // ── Banner ─────────────────────────────────────────────────────────────
    if (bannerUrl) {
        c.gallery([{ url: bannerUrl, description: `${guild.name} banner` }]);
        c.separator(false);
    }

    // ── Header ─────────────────────────────────────────────────────────────
    c.section(
        [
            `## ${guild.name}`,
            `-# ${e('id')} \`${guild.id}\``,
            `-# ${e('date')} <t:${createdAt}:D> · <t:${createdAt}:R>`,
        ],
        thumb(iconUrl),
    );

    c.separator(true);

    // ── Overview ───────────────────────────────────────────────────────────
    c.text(
        `${hd} **Overview**\n` +
        `**Owner** · <@${owner.id}>\n` +
        `**Verification** · \`${verifyLabel}\``
    );

    c.separator(false);

    // ── Community ──────────────────────────────────────────────────────────
    c.text(
        `${hd} **Community**\n` +
        `**Total:** \`${totalMembers.toLocaleString()}\`\n` +
        `**Humans:** \`${humans}\` · **Bots:** \`${bots}\`\n` +
        `**Roles:** \`${roleCount}\``
    );

    c.separator(false);

    // ── Channels ───────────────────────────────────────────────────────────
    let channelLine =
        `**Text** \`${textCh}\`  ·  **Voice** \`${voiceCh}\`  ·  **Categories** \`${categories}\``;
    if (stageCh > 0) channelLine += `  ·  **Stage** \`${stageCh}\``;
    if (afkCh) channelLine += `\n**AFK Channel** · ${afkCh.toString()}`;
    if (sysCh) channelLine += `\n**System Channel** · ${sysCh.toString()}`;

    c.text(`${hd} **Channels**\n${channelLine}`);

    c.separator(false);

    // ── Boost Status ───────────────────────────────────────────────────────
    c.text(
        `${hd} **Boost Status**\n` +
        `**Tier** \`${boostTier}\`  ·  **Boosts** \`${boosts}\`\n` +
        `-# ${boostBar} ${boosts}/14`
    );

    // ── Extras ─────────────────────────────────────────────────────────────
    if (emojiCount > 0 || stickerCount > 0) {
        c.separator(false);
        const parts: string[] = [];
        if (emojiCount > 0)    parts.push(`**Emojis** \`${emojiCount}\``);
        if (stickerCount > 0)  parts.push(`**Stickers** \`${stickerCount}\``);
        c.text(`${hd} **Extras**\n${parts.join('  ·  ')}`);
    }

    c.separator(true);

    return c.build();
};

export default {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Display detailed information about this server'),

    category: 'general',
    aliases: ['si'],
    prefixOnly: true,
    guildOnly: true,
    cooldown:  10,

    async execute(interaction, client) {
        const container = await buildServerInfo(interaction.guild!);
        await interaction.reply({
            ...(fadeReply([container], false) as any),
            allowedMentions: { parse: [] },
        } as any);
    },

    async prefixExecute(message, args, client) {
        const container = await buildServerInfo(message.guild!);
        await sendMessage(message, [container], { parse: [] });
    },
    syntax: 'f!serverinfo',
    example: 'f!si',
} satisfies Command;

export { buildServerInfo };