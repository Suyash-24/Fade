// src/commands/general/help.ts
import { SlashCommandBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, btn, sendResponse, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';

const CATEGORIES: Record<string, { emoji: string; description: string }> = {
    general:    { emoji: e('server'),   description: 'General information commands' },
    moderation: { emoji: e('shield'),   description: 'Server moderation tools' },
    leveling:   { emoji: e('level'),    description: 'XP and leveling system' },
    music:      { emoji: e('music'),    description: 'Music playback commands' },
    fun:        { emoji: e('star'),     description: 'Fun and entertainment' },
    utility:    { emoji: e('settings'), description: 'Utility and configuration' },
    tickets:    { emoji: e('ticket'),   description: 'Ticket system management' },
    antinuke:   { emoji: e('shield'),   description: 'Server protection' },
};

const buildOverview = (client: any) => {
    const grouped = new Map<string, string[]>();
    for (const cmd of client.commands.values()) {
        const cat = (cmd as any).category ?? 'general';
        if (cat === 'developer') continue; // Hide developer commands
        if (!grouped.has(cat)) grouped.set(cat, []);
        grouped.get(cat)!.push(cmd.data.name);
    }

    const total = client.commands.size;

    const lines = [...grouped.entries()].map(([cat, cmds]) => {
        const meta = CATEGORIES[cat] ?? { emoji: e('star') };
        return `${meta.emoji}  **${cat.charAt(0).toUpperCase() + cat.slice(1)}** — \`${cmds.length} command${cmds.length === 1 ? '' : 's'}\``;
    });

    return new FadeContainer(Colours.FADE)
        .text(`## ${e('star')} Fade Help`)
        .text(`-# ${total} commands · Use \`/help command:<name>\` for details`)
        .separator(true)
        .text(lines.join('\n'))
        .separator(true)
        .text(`-# Prefix: \`f!\` · Slash: \`/\``)
        .build();
};

const buildCommandInfo = (cmd: any) => {
    const lines = [
        `## ${e('search')} \`/${cmd.data.name}\``,
        `${cmd.data.description}`,
        '',
        cmd.cooldown    ? `${e('uptime')}  **Cooldown** — \`${cmd.cooldown}s\`` : '',
        cmd.aliases?.length ? `**Aliases** — ${cmd.aliases.map((a: string) => `\`${a}\``).join(', ')}` : '',
        cmd.guildOnly   ? `${e('server')}  Server only` : '',
        cmd.ownerOnly   ? `${e('crown')}  Owner only` : '',
    ].filter(Boolean);

    return new FadeContainer(Colours.FADE)
        .text(lines.join('\n'))
        .build();
};

export default {
    data: new SlashCommandBuilder()
        .setName('help')
        .setDescription("Browse all of Fade's commands")
        .addStringOption(o => o
            .setName('command')
            .setDescription('Get detailed info about a specific command')
            .setRequired(false)
        ),

    category: 'general',
    cooldown: 5,

    async execute(interaction, client) {
        const specific = interaction.options.getString('command');

        if (specific) {
            const cmd = client.commands.get(specific.toLowerCase())
                     ?? client.commands.get(client.aliases.get(specific.toLowerCase()) ?? '');

            if (!cmd) {
                await interaction.reply({
                    content: `${e('error')} No command named \`${specific}\` found.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await sendResponse(interaction, [buildCommandInfo(cmd)], true);
            return;
        }

        await sendResponse(interaction, [buildOverview(client)], true);
    },

    async prefixExecute(message, args, client) {
        if (args[0]) {
            const cmd = client.commands.get(args[0].toLowerCase())
                     ?? client.commands.get(client.aliases.get(args[0].toLowerCase()) ?? '');

            if (!cmd) {
                await message.reply(`${e('error')} No command named \`${args[0]}\` found.`);
                return;
            }

            await sendMessage(message, [buildCommandInfo(cmd)]);
            return;
        }

        await sendMessage(message, [buildOverview(client)]);
    },
} satisfies Command;