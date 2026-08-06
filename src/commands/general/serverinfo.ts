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

    const boosts     = guild.premiumSubscriptionCount ?? 0;
    const boostTier  = guild.premiumTier;
    const roleCount  = guild.roles.cache.size - 1;
    const emojiCount = guild.emojis.cache.size;
    const stickerCount = guild.stickers?.cache?.size ?? 0;

    const verifyLabel =
        guild.verificationLevel === GuildVerificationLevel.None     ? 'None' :
        guild.verificationLevel === GuildVerificationLevel.Low      ? 'Low' :
        guild.verificationLevel === GuildVerificationLevel.Medium   ? 'Medium' :
        guild.verificationLevel === GuildVerificationLevel.High     ? 'High' :
        guild.verificationLevel === GuildVerificationLevel.VeryHigh ? 'Very High' : 'None';

    const verifyEmoji =
        guild.verificationLevel === GuildVerificationLevel.None     ? e('shield') :
        guild.verificationLevel === GuildVerificationLevel.Low      ? e('verificationlevellow') :
        guild.verificationLevel === GuildVerificationLevel.Medium   ? e('verificationlevelmedium') :
        guild.verificationLevel === GuildVerificationLevel.High     ? e('verificationlevelhigh') :
        guild.verificationLevel === GuildVerificationLevel.VeryHigh ? e('verificationlevelhighest') :
        e('shield');

    const boostBar = `${'▰'.repeat(Math.min(boosts, 14))}${'▱'.repeat(Math.max(0, 14 - boosts))}`;

    const iconUrl  = guild.iconURL({ size: 512 })
        ?? guild.client.user?.displayAvatarURL({ size: 512 })
        ?? 'https://cdn.discordapp.com/embed/avatars/0.png';
    const bannerUrl = guild.bannerURL({ size: 1024 });

    const c = new FadeContainer();

    // ── Banner ─────────────────────────────────────────────────────────────
    if (bannerUrl) {
        c.gallery([{ url: bannerUrl, description: `${guild.name} banner` }]);
        c.separator(false);
    }

    // ── Header: name · id · created ────────────────────────────────────────
    c.section(
        [
            `## ${guild.name}`,
            `-# ${e('id')} \`${guild.id}\``,
            `-# ${e('date')} <t:${createdAt}:D> · <t:${createdAt}:R>`,
        ],
        thumb(iconUrl),
    );

    c.separator(true);

    // ── General ────────────────────────────────────────────────────────────
    c.text(
        `${e('owner')}  **Owner** · <@${owner.id}>\n` +
        `${e('members')}  **Members** · \`${guild.memberCount.toLocaleString()}\`\n` +
        `${e('roles')}  **Roles** · \`${roleCount}\`\n` +
        `${verifyEmoji}  **Verification** · \`${verifyLabel}\``
    );

    c.separator(false);

    // ── Channels ───────────────────────────────────────────────────────────
    const channelParts = [
        `${e('channels')}  **Text** · \`${textCh}\``,
        `${e('voice')}  **Voice** · \`${voiceCh}\``,
        `${e('category')}  **Categories** · \`${categories}\``,
    ];
    if (stageCh > 0) channelParts.push(`${e('stats')}  **Stage** · \`${stageCh}\``);

    c.text(channelParts.join('\n'));

    c.separator(false);

    // ── Boost ──────────────────────────────────────────────────────────────
    c.text(
        `${e('boost')}  **Boost Tier** · \`${boostTier}\`\n` +
        `${e('boost')}  **Boosts** · \`${boosts}\`\n` +
        `-# ${boostBar} ${boosts}/14`
    );

    // ── Extras ─────────────────────────────────────────────────────────────
    if (emojiCount > 0 || stickerCount > 0) {
        c.separator(false);
        const extraParts: string[] = [];
        if (emojiCount > 0)   extraParts.push(`${e('star')}  **Emojis** · \`${emojiCount}\``);
        if (stickerCount > 0) extraParts.push(`${e('gift')}  **Stickers** · \`${stickerCount}\``);
        c.text(extraParts.join('\n'));
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