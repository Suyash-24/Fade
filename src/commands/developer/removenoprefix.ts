// src/commands/developer/removenoprefix.ts
import { Message } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { e } from '../../components/emojis.js';
import type { FadeClient } from '../../client.js';
import { removeNoPrefixUser } from '../../db/queries/noPrefix.js';
import { canManageNoPrefix } from '../../utils/owner.js';

export default {
    data: { name: 'removenoprefix', description: 'Remove no-prefix status from a user.' },
    prefixOnly: true,
    category: 'developer',
    
    async prefixExecute(message: Message, args: string[], client: FadeClient) {
        // Silently ignore if not authorized
        if (!(await canManageNoPrefix(client, message.author.id))) return;

        const targetArg = args[0];
        if (!targetArg) {
            const card = new FadeContainer()
                .text(`${e('error')} **Missing Argument**`)
                .separator()
                .text('Please specify a user.\nUsage: `removenoprefix @user`')
                .build();
            await sendMessage(message, [card]);
            return;
        }

        const userId = targetArg.replace(/[<@!>]/g, '');
        
        await removeNoPrefixUser(userId);

        const card = new FadeContainer()
            .text(`${e('success')} **No Prefix Removed**`)
            .separator()
            .text(`User <@${userId}> no longer has no-prefix status.`)
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;
