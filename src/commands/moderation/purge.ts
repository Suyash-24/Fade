import { Message, PermissionFlagsBits, TextChannel, Collection } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { hasPermission } from '../../utils/fakePerms.js';
import type { FadeClient } from '../../client.js';

export default {
    data: { name: 'purge', description: 'Advanced message purging.' },
    prefixOnly: true,
    aliases: ['clear', 'c'],
    category: 'moderation',
    cooldown: 5,

    async prefixExecute(message: Message, args: string[], client: FadeClient) {
        if (!message.guild || !message.member) return;
        const channel = message.channel as TextChannel;

        // Permission check (Discord native or FakePerms)
        const canManage = await hasPermission(message.member, 'manage_messages');
        if (!canManage) {
            await message.reply(`${e('error')} You lack the \`manage_messages\` permission.`);
            return;
        }

        if (!message.guild.members.me?.permissions.has(PermissionFlagsBits.ManageMessages)) {
            await message.reply(`${e('error')} I lack the \`manage_messages\` permission.`);
            return;
        }

        if (args.length === 0) {
            await message.reply(`${e('error')} Please specify an amount or filter. Example: \`,purge 50\` or \`,purge bots 100\``);
            return;
        }

        let amount = 0;
        let fetchLimit = 0;
        let filter: ((m: Message) => boolean) | null = null;

        const sub = args[0].toLowerCase();
        
        // Parse subcommands
        if (sub === 'bots') {
            amount = parseInt(args[1] || '50');
            filter = (m) => m.author.bot;
        } else if (sub === 'humans') {
            amount = parseInt(args[1] || '50');
            filter = (m) => !m.author.bot;
        } else if (sub === 'links') {
            amount = parseInt(args[1] || '50');
            filter = (m) => /https?:\/\//i.test(m.content);
        } else if (sub === 'embeds' || sub === 'images') {
            amount = parseInt(args[1] || '50');
            filter = (m) => m.embeds.length > 0 || m.attachments.size > 0 || m.components.length > 0 || m.flags.has(1 << 15 as any);
        } else if (sub === 'contains') {
            // Support multi-word strings in quotes
            const match = message.content.match(/["']([^"']+)["']/);
            let word = '';
            if (match) {
                word = match[1];
                amount = parseInt(args[args.length - 1]);
                if (isNaN(amount)) amount = 50;
            } else {
                word = args[1];
                amount = parseInt(args[2] || '50');
            }

            if (!word) {
                await message.reply(`${e('error')} You must specify a word to search for.`);
                return;
            }
            filter = (m) => m.content.toLowerCase().includes(word.toLowerCase());
        } else if (/^<@!?\d{17,19}>$/.test(sub) || sub === 'user' || /^\d{17,19}$/.test(sub)) {
            const target = sub === 'user' ? args[1] : sub;
            amount = parseInt(sub === 'user' ? args[2] : args[1]) || 50;
            
            if (!target) {
                await message.reply(`${e('error')} You must mention a user or provide their ID.`);
                return;
            }
            // Ensure ID is digits only (in case it's a mention string)
            const cleanId = target.replace(/[^0-9]/g, '');
            filter = (m) => m.author.id === cleanId;
        } else {
            // Standard purge
            amount = parseInt(args[0]);
        }

        if (isNaN(amount) || amount <= 0) {
            await message.reply(`${e('error')} Invalid amount provided.`);
            return;
        }

        // Cap at 1000 like Bleed
        if (amount > 1000) amount = 1000;
        
        // We will fetch until we find `amount` matching messages, OR we hit a hard 1000 fetched limit.
        const HARD_FETCH_LIMIT = 1000;
        let fetchedMessages: Message[] = [];
        let matchingMessages: Message[] = [];
        let lastId: string | undefined;
        let fetchedTotal = 0;

        // Delete the trigger message immediately so it doesn't get swept into the filter
        await message.delete().catch(() => null);

        while (matchingMessages.length < amount && fetchedTotal < HARD_FETCH_LIMIT) {
            const limit = Math.min(100, HARD_FETCH_LIMIT - fetchedTotal);
            const batch = await channel.messages.fetch({ limit, before: lastId }).catch(() => null);
            
            if (!batch || batch.size === 0) break;
            
            fetchedTotal += batch.size;
            lastId = batch.last()?.id;

            // Apply filter to this batch
            const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
            const valid = batch.filter(m => {
                if (m.createdTimestamp <= twoWeeksAgo) return false;
                if (filter && !filter(m)) return false;
                return true;
            });

            for (const m of valid.values()) {
                if (matchingMessages.length < amount) {
                    matchingMessages.push(m);
                } else {
                    break;
                }
            }
        }

        if (matchingMessages.length === 0) {
            const msg = await channel.send(`${e('warn')} No matching messages found (or all matching messages were older than 14 days).`);
            setTimeout(() => msg.delete().catch(() => null), 5000);
            return;
        }

        // Delete in chunks of 100
        let deletedCount = 0;
        for (let i = 0; i < matchingMessages.length; i += 100) {
            const chunk = matchingMessages.slice(i, i + 100);
            const deleted = await channel.bulkDelete(chunk, true).catch(() => new Collection<string, Message>());
            deletedCount += deleted.size;
        }

        // Success message
        const card = new FadeContainer(Colours.SUCCESS)
            .text(`${e('success')} Successfully purged **${deletedCount}** message(s).`)
            .build();
        
        const successMsg = await channel.send({ components: [card] as any, flags: 1 << 15 } as any);
        setTimeout(() => successMsg.delete().catch(() => null), 4000);
    }
} satisfies Command;
