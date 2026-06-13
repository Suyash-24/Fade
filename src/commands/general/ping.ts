// src/commands/general/ping.ts
import { SlashCommandBuilder, ButtonStyle } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, btn, sendResponse, sendMessage, updateResponse } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';

const buildPing = (wsping: number, shardId: number, client?: any, guild?: any) => {
    const latency = wsping === -1 ? 'Establishing...' : `${wsping}ms`;
    const now     = Math.floor(Date.now() / 1000);

    const emoji = (() => {
        if (wsping === -1) return e('ping');
        if (wsping <= 100) return e('goodping');
        if (wsping <= 250) return e('mediumping');
        return e('badping');
    })();

    const accentColor = (() => {
        if (wsping === -1) return Colours.INFO;
        if (wsping <= 100) return Colours.SUCCESS;
        if (wsping <= 250) return Colours.WARNING;
        return Colours.DANGER;
    })();



    return new FadeContainer(accentColor)
        .text(`## ${emoji} Pong!`)
        .separator(false)
        .text(
            `${e('latency')}  **Latency** — \`${latency}\`\n` +
            `${e('shard')}  **Shard** — \`#${shardId}\`\n` +
            `${e('date')}  **Checked** — <t:${now}:R>`
        )
        .separator(true)
        .actionRow(
            btn('ping_refresh', 'Refresh', ButtonStyle.Secondary)
        )
        .build();
};

export default {
    data: new SlashCommandBuilder()
        .setName('ping')
        .setDescription("Check Fade's latency and connection status"),

    category: 'general',
    cooldown: 5,

    async execute(interaction, client) {
        let ping = interaction.client.ws.ping;
        if (ping === -1) {
            ping = Math.abs(Date.now() - interaction.createdTimestamp);
        }
        const container = buildPing(
            ping,
            interaction.guild?.shardId ?? 0,
            interaction.client,
            interaction.guild,
        );
        await sendResponse(interaction, [container], true);
    },

    async prefixExecute(message, args, client) {
        let ping = message.client.ws.ping;
        if (ping === -1) {
            ping = Math.abs(Date.now() - message.createdTimestamp);
        }
        const container = buildPing(
            ping,
            message.guild?.shardId ?? 0,
            message.client,
            message.guild,
        );
        await sendMessage(message, [container]);
    },
} satisfies Command;

// Export builder for refresh button handler
export { buildPing };