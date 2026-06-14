// src/commands/developer/servers.ts
import { Message, ComponentType } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage, btn, updateResponse, ButtonStyle } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import type { FadeClient } from '../../client.js';
import { isBotOwner } from '../../utils/owner.js';

export default {
    data: { name: 'servers', description: 'List all servers the bot is in.' },
    prefixOnly: true,
    category: 'developer',
    
    async prefixExecute(message: Message, args: string[], client: FadeClient) {
        // Silently ignore if not bot owner
        if (!(await isBotOwner(client, message.author.id))) return;

        const guilds = [...client.guilds.cache.values()]
            .sort((a, b) => b.joinedTimestamp - a.joinedTimestamp);

        if (guilds.length === 0) {
            const card = new FadeContainer(Colours.FADE)
                .text(`${e('error')} The bot is not in any servers.`)
                .build();
            await sendMessage(message, [card]);
            return;
        }

        const ITEMS_PER_PAGE = 10;
        const totalPages = Math.ceil(guilds.length / ITEMS_PER_PAGE);
        let currentPage = 1;

        const generatePage = (page: number) => {
            const start = (page - 1) * ITEMS_PER_PAGE;
            const end = start + ITEMS_PER_PAGE;
            const currentGuilds = guilds.slice(start, end);

            const lines = currentGuilds.map((g, i) => {
                const index = start + i + 1;
                return `**${index}.** \`${g.name}\` — \`${g.memberCount} members\` (${g.id})`;
            });

            const container = new FadeContainer(Colours.FADE)
                .text(`## ${e('server')} Bot Servers`)
                .separator(true)
                .text(lines.join('\n'))
                .separator(true)
                .text(`-# Page ${page} of ${totalPages} · Total Servers: ${guilds.length}`);

            if (totalPages > 1) {
                container.actionRow(
                    btn('prev_page', 'Previous', ButtonStyle.Secondary, page === 1),
                    btn('next_page', 'Next', ButtonStyle.Secondary, page === totalPages)
                );
            }

            return container.build();
        };

        const responseMsg = await sendMessage(message, [generatePage(currentPage)]);

        if (totalPages === 1) return;

        const collector = responseMsg.createMessageComponentCollector({
            componentType: ComponentType.Button,
            time: 5 * 60 * 1000,
        });

        collector.on('collect', async (i) => {
            if (i.user.id !== message.author.id) {
                await i.reply({ content: `${e('error')} You cannot use these buttons.`, ephemeral: true });
                return;
            }

            if (i.customId === 'prev_page') {
                currentPage--;
            } else if (i.customId === 'next_page') {
                currentPage++;
            }

            await updateResponse(i, [generatePage(currentPage)]);
        });

        collector.on('end', async () => {
            const expiredContainer = new FadeContainer(Colours.FADE)
                .text(`## ${e('server')} Bot Servers`)
                .separator(true)
                .text(guilds.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE).map((g, idx) => `**${(currentPage - 1) * ITEMS_PER_PAGE + idx + 1}.** \`${g.name}\` — \`${g.memberCount} members\` (${g.id})`).join('\n'))
                .separator(true)
                .text(`-# Page ${currentPage} of ${totalPages} · Total Servers: ${guilds.length}`);
            await responseMsg.edit({ components: [expiredContainer.build()], flags: 1 << 13 /* IsComponentsV2 */ } as any).catch(() => null);
        });
    },
} satisfies Command;
