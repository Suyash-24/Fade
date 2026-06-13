// src/events/musicButtons.ts
// Handles the interactive buttons on the Now Playing card.
import type { Event } from '../types/event.js';
import { Events, type ButtonInteraction } from 'discord.js';
import type { FadeClient } from '../client.js';
import { buildNowPlayingCard, buildQueueCard, buildMusicErrorCard, buildMusicInfoCard } from '../music/cards.js';

const IS_CV2 = 1 << 15;

async function handleMusicButton(interaction: ButtonInteraction, client: FadeClient) {
    const player = client.music?.players.get(interaction.guild!.id);

    if (!player) {
        await interaction.reply({
            components: [buildMusicErrorCard('No active player found.')],
            flags: IS_CV2 | 64,
        } as any);
        return;
    }

    // Require user to be in the same VC
    const member  = interaction.guild!.members.cache.get(interaction.user.id);
    const userVcId = member?.voice?.channelId;
    if (userVcId !== player.voiceId) {
        await interaction.reply({
            components: [buildMusicErrorCard(`Join <#${player.voiceId}> to control the player.`)],
            flags: IS_CV2 | 64,
        } as any);
        return;
    }

    switch (interaction.customId) {
        case 'music_pause': {
            player.pause(!player.paused);
            const state = player.paused ? '⏸ Paused' : '▶ Resumed';
            // Update the now-playing card to reflect new pause state
            if (player.queue.current) {
                const card = buildNowPlayingCard(player, player.queue.current);
                await interaction.update({ components: [card], flags: IS_CV2 } as any);
            } else {
                await interaction.reply({ components: [buildMusicInfoCard(state, '')], flags: IS_CV2 | 64 } as any);
            }
            break;
        }

        case 'music_skip': {
            const skipped = player.queue.current!;
            player.skip();
            await interaction.reply({
                components: [buildMusicInfoCard('⏭ Skipped', `Skipped **${skipped.title}**.`)],
                flags: IS_CV2 | 64,
            } as any);
            break;
        }

        case 'music_stop': {
            player.queue.clear();
            player.destroy();
            await interaction.update({
                components: [buildMusicInfoCard('⏹ Stopped', 'Queue cleared and disconnected.')],
                flags: IS_CV2,
            } as any);
            break;
        }

        case 'music_queue': {
            const card = buildQueueCard(player, 1);
            await interaction.reply({ components: [card], flags: IS_CV2 | 64 } as any);
            break;
        }

        case 'music_loop': {
            // Cycle: none → track → queue → none
            let next: 'none' | 'track' | 'queue';
            if (player.loop === 'none')  next = 'track';
            else if (player.loop === 'track') next = 'queue';
            else next = 'none';
            player.setLoop(next);

            // Update the now-playing card buttons
            if (player.queue.current) {
                const card = buildNowPlayingCard(player, player.queue.current);
                await interaction.update({ components: [card], flags: IS_CV2 } as any);
            }
            break;
        }

        default:
            break;
    }
}

export default {
    name: Events.InteractionCreate,
    async execute(client: FadeClient, interaction: any) {
        if (!interaction.isButton()) return;
        const id = interaction.customId as string;
        if (!id.startsWith('music_')) return;
        await handleMusicButton(interaction as ButtonInteraction, client);
    },
} satisfies Event;
