// src/commands/server/translator.ts
import { Message, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer } from '../../components/builders.js';
import { e } from '../../components/emojis.js';
import { getGuild, updateGuild } from '../../db/queries/guilds.js';
import { hasPermission } from '../../utils/fakePerms.js';
import type { FadeClient } from '../../client.js';

export default {
    data: { name: 'translator', description: 'Enable or disable the flag emoji translator.' },
    prefixOnly: true,
    aliases: ['translate'],
    category: 'server',
    cooldown: 5,

    async prefixExecute(message: Message, args: string[], client: FadeClient) {
        if (!message.guild || !message.member) return;

        // Require administrator permission
        const canManage = await hasPermission(message.member, 'administrator');
        if (!canManage) {
            await message.reply(`${e('error')} You need **Administrator** permission to use this command.`);
            return;
        }

        const sub = args[0]?.toLowerCase();

        if (sub === 'on' || sub === 'enable') {
            await updateGuild(message.guild.id, { translator: true });
            const card = new FadeContainer()
                .text(`${e('success')} **Translator Enabled**\nMembers can now translate messages by reacting with flag emojis (e.g. 🇪🇸).`)
                .build();
            await message.reply({ components: [card] as any, flags: 1 << 15 } as any);
            return;
        }

        if (sub === 'off' || sub === 'disable') {
            await updateGuild(message.guild.id, { translator: false });
            const card = new FadeContainer()
                .text(`${e('success')} **Translator Disabled**\nThe bot will now ignore flag emoji reactions.`)
                .build();
            await message.reply({ components: [card] as any, flags: 1 << 15 } as any);
            return;
        }

        // Usage
        const guild = await getGuild(message.guild.id);
        const state = guild.translator ? `${e('success')} **Enabled**` : `${e('error')} **Disabled**`;

        const card = new FadeContainer()
            .text(`## 🌐 Translator Settings\n\nCurrent Status: ${state}\n\n**Usage:**\n\`${process.env.DEFAULT_PREFIX ?? 'f!'}translator on\` — enable flag reactions\n\`${process.env.DEFAULT_PREFIX ?? 'f!'}translator off\` — disable flag reactions`)
            .build();
        await message.reply({ components: [card] as any, flags: 1 << 15 } as any);
    },
} satisfies Command;
