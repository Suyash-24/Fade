// src/commands/general/serverstats.ts
// View server activity statistics: joins, leaves, mod actions, top members.
import { SlashCommandBuilder, MessageFlags, AttachmentBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { buildServerStatsCard, type ServerStatsData } from '../../utils/canvas/serverStatsCard.js';

async function fetchStatsData(guild: any, client: any): Promise<ServerStatsData> {
    const owner = await client.users.fetch(guild.ownerId).catch(() => null);

    const memberCount = guild.memberCount;
    const botCount    = guild.members.cache.filter((m: any) => m.user.bot).size;
    const humanCount  = memberCount - botCount;
    const onlineCount = guild.members.cache.filter((m: any) => m.presence?.status === 'online' || m.presence?.status === 'dnd' || m.presence?.status === 'idle').size;

    return {
        guildName: guild.name,
        guildIcon: guild.iconURL({ extension: 'png', size: 512 }),
        memberCount,
        humanCount,
        botCount,
        onlineCount,
        overview: {
            owner: owner?.username ?? 'Unknown',
            createdFormatted: new Date(guild.createdTimestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
            boosts: guild.premiumSubscriptionCount ?? 0,
            boostTier: guild.premiumTier ?? 0,
            roles: guild.roles.cache.size
        },
        infrastructure: {
            textChannels: guild.channels.cache.filter((c: any) => c.type === 0).size,
            voiceChannels: guild.channels.cache.filter((c: any) => c.type === 2).size,
            categories: guild.channels.cache.filter((c: any) => c.type === 4).size,
            emojis: guild.emojis.cache.size,
            stickers: guild.stickers?.cache?.size ?? 0
        }
    };
}

export default {
    data: new SlashCommandBuilder()
        .setName('serverstats')
        .setDescription('View activity statistics for this server'),

    category: 'general', guildOnly: true,
    cooldown: 15,

    async execute(interaction, client) {
        await interaction.deferReply();
        const data = await fetchStatsData(interaction.guild!, client);
        const buffer = await buildServerStatsCard(data);
        const attachment = new AttachmentBuilder(buffer, { name: 'serverstats.png' });
        await interaction.editReply({ files: [attachment] });
    },

    async prefixExecute(message, args, client) {
        const data = await fetchStatsData(message.guild!, client);
        const buffer = await buildServerStatsCard(data);
        const attachment = new AttachmentBuilder(buffer, { name: 'serverstats.png' });
        await message.reply({ files: [attachment] });
    },
} satisfies Command;
