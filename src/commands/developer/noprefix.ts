// src/commands/developer/noprefix.ts
import { Message } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { e } from '../../components/emojis.js';
import type { FadeClient } from '../../client.js';
import { setNoPrefixUser } from '../../db/queries/noPrefix.js';
import { canManageNoPrefix } from '../../utils/owner.js';

export default {
    data: { name: 'noprefix', description: 'Grant a user no-prefix status.' },
    prefixOnly: true,
    category: 'developer',
    
    async prefixExecute(message: Message, args: string[], client: FadeClient) {
        // Silently ignore if not authorized
        if (!(await canManageNoPrefix(client, message.author.id))) return;

        const targetArg = args[0];
        const timeArg = args[1]?.toLowerCase() || '60d';

        if (!targetArg) {
            const card = new FadeContainer()
                .text(`${e('error')} **Missing Argument**`)
                .separator()
                .text('Please specify a user.\nUsage: `noprefix @user [duration|lifetime]`')
                .build();
            await sendMessage(message, [card]);
            return;
        }

        const userId = targetArg.replace(/[<@!>]/g, '');
        
        let expiresAt: Date | null = null;
        
        if (timeArg === 'lifetime') {
            expiresAt = null;
        } else {
            const match = timeArg.match(/^(\d+)([d|h|m|s])$/);
            if (!match) {
                const card = new FadeContainer()
                    .text(`${e('error')} **Invalid Duration**`)
                    .separator()
                    .text('Invalid duration format. Example: `30d`, `12h`, or `lifetime`.')
                    .build();
                await sendMessage(message, [card]);
                return;
            }
            const amount = parseInt(match[1]);
            const unit = match[2];
            let multiplier = 1000; // default s
            if (unit === 'm') multiplier = 60 * 1000;
            if (unit === 'h') multiplier = 60 * 60 * 1000;
            if (unit === 'd') multiplier = 24 * 60 * 60 * 1000;
            
            expiresAt = new Date(Date.now() + amount * multiplier);
        }

        await setNoPrefixUser(userId, expiresAt);

        const card = new FadeContainer()
            .text(`${e('success')} **No Prefix Granted**`)
            .separator()
            .text(`User <@${userId}> can now use commands without a prefix.\n**Expires:** ${expiresAt ? `<t:${Math.floor(expiresAt.getTime() / 1000)}:R>` : 'Lifetime'}`)
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;
