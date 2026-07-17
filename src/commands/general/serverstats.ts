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

    const now = Date.now();
    const joined24h = guild.members.cache.filter((m: any) => now - m.joinedTimestamp < 24 * 60 * 60 * 1000).size;
    const joined7d  = guild.members.cache.filter((m: any) => now - m.joinedTimestamp < 7 * 24 * 60 * 60 * 1000).size;
    const voiceActive = guild.voiceStates.cache.size;

    const vLevelMap = ['None', 'Low', 'Medium', 'High', 'Highest'];
    const ecfMap = ['Disabled', 'Members w/o roles', 'All members'];
    const mfaMap = ['None', 'Elevated'];

    return {
        guildName: guild.name,
        guildIcon: guild.iconURL({ extension: 'png', size: 512 }),
        memberCount,
        humanCount,
        botCount,
        onlineCount,
        joined24h,
        joined7d,
        overview: {
            owner: owner?.username ?? 'Unknown',
            createdFormatted: new Date(guild.createdTimestamp).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }),
            roles: guild.roles.cache.size
        },
        security: {
            verificationLevel: vLevelMap[guild.verificationLevel] ?? 'Unknown',
            explicitContent: ecfMap[guild.explicitContentFilter] ?? 'Unknown',
            mfaLevel: mfaMap[guild.mfaLevel] ?? 'Unknown'
        },
        engagement: {
            voiceActive,
            boosts: guild.premiumSubscriptionCount ?? 0,
            boostTier: guild.premiumTier ?? 0
        },
        infrastructure: {
            textChannels: guild.channels.cache.filter((c: any) => c.type === 0).size,
            voiceChannels: guild.channels.cache.filter((c: any) => c.type === 2).size,
            categories: guild.channels.cache.filter((c: any) => c.type === 4).size,
            emojis: guild.emojis.cache.size
        }
    };
}

export default {
    data: new SlashCommandBuilder()
        .setName('serverstats')
        .setDescription('View detailed analytics and activity statistics for this server'),

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
