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
    const threads    = guild.channels.cache.filter((c: any) =>
        c.type === ChannelType.PublicThread ||
        c.type === ChannelType.PrivateThread ||
        c.type === ChannelType.AnnouncementThread
    ).size;

    const boosts     = guild.premiumSubscriptionCount ?? 0;
    const boostTier  = guild.premiumTier;
    const roleCount  = guild.roles.cache.size - 1;
    const emojiCount = guild.emojis.cache.size;
    const stickerCount = guild.stickers.cache.size;

    const verifyLabel = ['None', 'Low', 'Medium', 'High', 'Very High'][guild.verificationLevel] ?? 'Unknown';
    const verifyEmoji =
        guild.verificationLevel === GuildVerificationLevel.None     ? '🔓' :
        guild.verificationLevel === GuildVerificationLevel.Low      ? '🔒' :
        guild.verificationLevel === GuildVerificationLevel.Medium   ? '🔐' :
        guild.verificationLevel === GuildVerificationLevel.High     ? '🛡️' :
        guild.verificationLevel === GuildVerificationLevel.VeryHigh ? '🔏' : '🔒';

    const boostBar = boosts > 0
        ? `${'▰'.repeat(Math.min(boosts, 14))}${'▱'.repeat(Math.max(0, 14 - boosts))}`
        : '▱▱▱▱▱▱▱▱▱▱▱▱▱▱';

    const iconUrl = guild.iconURL({ size: 512 })
        ?? guild.client.user?.displayAvatarURL({ size: 512 })
        ?? 'https://cdn.discordapp.com/embed/avatars/0.png';
    const bannerUrl = guild.bannerURL({ size: 1024 });

    // No accent color — clean look as requested
    const c = new FadeContainer();

    // ── Banner (hero image at top if present) ──────────────────────────────
    if (bannerUrl) {
        c.gallery([{ url: bannerUrl, description: `${guild.name} banner` }]);
        c.separator(false);
    }

    // ── Header: server name + icon thumbnail ───────────────────────────────
    c.section(
        [
            `## ${guild.name}`,
            `-# ${e('id')} \`${guild.id}\`  ·  ${e('date')} Created <t:${createdAt}:D>`,
        ],
        thumb(iconUrl),
    );

    c.separator(true);

    // ── Overview ───────────────────────────────────────────────────────────
    c.text(
        `### 👑 Overview\n` +
        `${e('owner')} **Owner** · <@${owner.id}>\n` +
        `${e('members')} **Members** · \`${guild.memberCount.toLocaleString()}\`  ·  ${e('roles')} **Roles** · \`${roleCount}\`\n` +
        `${verifyEmoji} **Verification** · \`${verifyLabel}\``
    );

    c.separator(false);

    // ── Channels ───────────────────────────────────────────────────────────
    c.text(
        `### 💬 Channels\n` +
        `${e('channels')} **Text** \`${textCh}\`  ·  ${e('voice')} **Voice** \`${voiceCh}\`  ·  ${e('category')} **Categories** \`${categories}\`` +
        (stageCh > 0 ? `  ·  🎙️ **Stage** \`${stageCh}\`` : '') +
        (threads > 0 ? `  ·  🧵 **Threads** \`${threads}\`` : '')
    );

    c.separator(false);

    // ── Boost Status ───────────────────────────────────────────────────────
    c.text(
        `### ${e('boost')} Boost Status · Tier ${boostTier}\n` +
        `-# ${boostBar} ${boosts}/14\n` +
        `${e('boost')} **${boosts}** boost${boosts !== 1 ? 's' : ''} active`
    );

    // ── Extras ─────────────────────────────────────────────────────────────
    if (emojiCount > 0 || stickerCount > 0) {
        c.separator(false);
        c.text(
            `### 🎨 Extras\n` +
            (emojiCount > 0 ? `😄 **Emojis** · \`${emojiCount}\`` : '') +
            (emojiCount > 0 && stickerCount > 0 ? `  ·  ` : '') +
            (stickerCount > 0 ? `🎭 **Stickers** · \`${stickerCount}\`` : '')
        );
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