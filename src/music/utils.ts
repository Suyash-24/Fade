// src/music/utils.ts
// Shared helper for all music prefix commands.
import type { Message } from 'discord.js';
import { PermissionFlagsBits } from 'discord.js';
import type { FadeClient } from '../client.js';
import type { KazagumoPlayer } from 'kazagumo';
import { buildMusicErrorCard } from './cards.js';
import { getDjRole } from './djrole-store.js';

const IS_CV2 = 1 << 15; // MessageFlags.IsComponentsV2

// Send a Component V2 music response
export async function musicReply(message: Message, containers: any[]): Promise<Message> {
    return message.reply({
        components:     containers,
        flags:          IS_CV2,
        allowedMentions: { repliedUser: false },
    } as any);
}

// Validate the user is in a voice channel and the bot is allowed to join
export async function requireVoice(
    message: Message,
    client: FadeClient,
): Promise<{ channelId: string; player?: KazagumoPlayer } | null> {
    const member  = message.member;
    const vcId    = member?.voice?.channelId;

    if (!vcId) {
        const card = buildMusicErrorCard('You need to be in a voice channel first.');
        await musicReply(message, [card]);
        return null;
    }

    const player = client.music?.players.get(message.guild!.id);

    // If there's already a player in a different channel, block
    if (player && player.voiceId !== vcId) {
        const channelMention = player.voiceId ? `<#${player.voiceId}>` : 'another voice channel';
        const card = buildMusicErrorCard(`I'm already playing in ${channelMention}. Join that channel or stop the player.`);
        await musicReply(message, [card]);
        return null;
    }

    return { channelId: vcId, player };
}

// Require an existing active player
export async function requirePlayer(
    message: Message,
    client: FadeClient,
): Promise<KazagumoPlayer | null> {
    const player = client.music?.players.get(message.guild!.id);
    if (!player || !player.queue.current) {
        const card = buildMusicErrorCard('Nothing is playing right now. Use `f!play` to start a session.');
        await musicReply(message, [card]);
        return null;
    }
    return player;
}

// Check whether the user is allowed to control music (DJ role check).
// Returns true if allowed, false if denied (error card already sent).
export async function requireDj(message: Message, _client: FadeClient): Promise<boolean> {
    const guildId = message.guild!.id;
    const member  = message.member!;

    // 1. Admins (ManageGuild) always bypass
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;

    // 2. Check if a DJ role is configured
    const djRoleId = await getDjRole(guildId);
    if (!djRoleId) return true; // no restriction set

    // 3. User must have the DJ role
    if (member.roles.cache.has(djRoleId)) return true;

    const card = buildMusicErrorCard(
        `You need the <@&${djRoleId}> role to control music.\n-# Server admins always bypass this restriction.`,
    );
    await musicReply(message, [card]);
    return false;
}
