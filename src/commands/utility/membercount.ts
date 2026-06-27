import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage, thumb } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';

export default {
    data: {
        name: 'membercount',
        description: 'View the total number of members, humans, and bots in the server',
    } as any,
    
    category: 'utility',
    guildOnly: true,
    aliases: ['mc'],
    cooldown: 5,

    async prefixExecute(message, args, client) {
        const guild = message.guild!;
        const total = guild.memberCount;
        const bots = guild.members.cache.filter(m => m.user.bot).size;
        const humans = total - bots;

        const card = new FadeContainer(Colours.FADE);
        const content = `## ${e('members')} Server Members\n` +
            `- ${e('roles')} **Total:** \`${total.toLocaleString()}\`\n` +
            `- ${e('owner')} **Humans:** \`${humans.toLocaleString()}\`\n` +
            `- ${e('bot')} **Bots:** \`${bots.toLocaleString()}\``;

        if (guild.iconURL()) {
            card.section([content], thumb(guild.iconURL({ size: 128 })!));
        } else {
            card.text(content);
        }

        await sendMessage(message, [card.build() as any]);
    }
} satisfies Command;
