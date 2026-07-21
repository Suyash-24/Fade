// src/commands/general/serverinfo.ts
import { SlashCommandBuilder, ChannelType, GuildVerificationLevel } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, btn, thumb, fadeReply, sendResponse, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';

const buildServerInfo = async (guild: any) => {
    await guild.fetch();
    const owner       = await guild.fetchOwner();
    const createdAt   = Math.floor(guild.createdTimestamp / 1000);
    const textCh      = guild.channels.cache.filter((c: any) => c.type === ChannelType.GuildText).size;
    const voiceCh     = guild.channels.cache.filter((c: any) => c.type === ChannelType.GuildVoice).size;
    const categories  = guild.channels.cache.filter((c: any) => c.type === ChannelType.GuildCategory).size;
    const boosts      = guild.premiumSubscriptionCount ?? 0;
    const boostTier   = guild.premiumTier;
    const verifyLevel = ['None', 'Low', 'Medium', 'High', 'Highest'][guild.verificationLevel] ?? 'Unknown';
    const verificationEmoji = guild.verified
        ? e('verificationlevelverified')
        : guild.verificationLevel === GuildVerificationLevel.Low
            ? e('verificationlevellow')
            : guild.verificationLevel === GuildVerificationLevel.Medium
                ? e('verificationlevelmedium')
                : guild.verificationLevel === GuildVerificationLevel.High
                    ? e('verificationlevelhigh')
                    : guild.verificationLevel === GuildVerificationLevel.VeryHigh
                        ? e('verificationlevelhighest')
                        : e('shield');
    const iconUrl     = guild.iconURL({ size: 512 })
        ?? guild.client.user?.displayAvatarURL({ size: 512 })
        ?? 'https://cdn.discordapp.com/embed/avatars/0.png';
    const bannerUrl   = guild.bannerURL({ size: 1024 });

    const c = new FadeContainer(Colours.FADE);

    // Header with icon thumbnail
    c.section(
        [
            `## ${e('server')} ${guild.name}\n`,
            `-# · ${e('id')} ${guild.id}`,
        ],
        thumb(iconUrl),
    );

    c.separator(true);

    c.text(
        `${e('owner')}  **Owner** — <@${owner.id}>\n` +
        `${e('date')}  **Created** — <t:${createdAt}:D> (<t:${createdAt}:R>)\n` +
        `${e('members')}  **Members** — \`${guild.memberCount.toLocaleString()}\`\n` +
        `${e('boost')}  **Boosts** — \`${boosts}\` · Tier \`${boostTier}\``
    );

    c.separator(false);

    c.text(
        `${e('channels')}  **Text** \`${textCh}\`\n` +
        `${e('voice')} **Voice** \`${voiceCh}\`\n` + 
        `${e('category')}**Categories** \`${categories}\`\n` +
        `${e('roles')}  **Roles** — \`${guild.roles.cache.size - 1}\`\n` +
        `${verificationEmoji}  **Verification** — \`${verifyLevel}\``
    );

    if (bannerUrl) {
        c.separator(false);
        c.gallery([{ url: bannerUrl, description: `${guild.name} banner` }]);
    }

    c.separator(true);

    return c.build();
};

export default {
    data: new SlashCommandBuilder()
        .setName('serverinfo')
        .setDescription('Display detailed information about this server'),

    category: 'general',
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
        await sendMessage(message, [container]);
    },
} satisfies Command;

export { buildServerInfo };