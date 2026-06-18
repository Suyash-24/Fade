// src/commands/general/help.ts
import { SlashCommandBuilder, ButtonStyle, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, linkBtn, sendResponse, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';

const buildOverview = (client: any) => {
    const grouped = new Map<string, { cmds: string[]; count: number }>();
    let totalSubcommands = 0;

    for (const cmd of client.commands.values()) {
        const cat = (cmd as any).category ?? 'general';
        if (cat === 'developer') continue; // Hide developer commands
        if (!grouped.has(cat)) grouped.set(cat, { cmds: [], count: 0 });
        
        const group = grouped.get(cat)!;
        group.cmds.push(cmd.data.name);
        group.count += 1;

        if (cmd.subcommands) {
            totalSubcommands += cmd.subcommands.length;
            group.count += cmd.subcommands.length;
        } else if (cmd.data.options) {
            // Count slash command subcommands
            const subs = cmd.data.options.filter((o: any) => o.toJSON().type === 1 || o.toJSON().type === 2);
            totalSubcommands += subs.length;
            group.count += subs.length;
        }
    }

    const total = client.commands.size + totalSubcommands;

    const lines = [...grouped.entries()].map(([cat, data]) => {
        return `${e('heartdot')}  **${cat.charAt(0).toUpperCase() + cat.slice(1)}** — \`${data.count} command${data.count === 1 ? '' : 's'}\``;
    });

    return new FadeContainer(Colours.FADE)
        .text(`## ${e('logs')} Fade Help`)
        .text(`-# ${total} commands · Use \`/help command:<name>\` for details`)
        .separator(true)
        .text(lines.join('\n'))
        .separator(true)
        .text(`-# Prefix: \`f!\` · Slash: \`/\``)
        .actionRow(
            linkBtn('https://fadebot.me/', 'Website'),
            linkBtn('https://discord.gg/SmdUGNXjYv', 'Support Server'),
            linkBtn(`https://discord.com/oauth2/authorize?client_id=${client.user?.id || ''}&permissions=8&integration_type=0&scope=bot`, 'Invite Bot')
        )
        .build();
};

const buildCategoryInfo = (client: any, category: string) => {
    const cmds: any[] = [];
    for (const cmd of client.commands.values()) {
        if (((cmd as any).category ?? 'general') === category) {
            cmds.push(cmd);
        }
    }
    
    const title = `## ${e('heartdot')} ${category.charAt(0).toUpperCase() + category.slice(1)} Commands`;
    
    const lines = cmds.map(cmd => `**/${cmd.data.name}** — ${cmd.data.description}`);

    return new FadeContainer(Colours.FADE)
        .text(title)
        .separator(true)
        .text(lines.join('\n'))
        .separator(true)
        .text(`-# Use \`/help command:<name>\` to see detailed subcommands and usage.`)
        .build();
};

const buildCommandInfo = (cmd: any, subName?: string) => {
    let title = `## ${e('search')} \`/${cmd.data.name}\``;
    let desc = cmd.data.description;
    
    // Subcommand matching
    if (subName) {
        let foundSub = false;
        if (cmd.subcommands) {
            const sub = cmd.subcommands.find((s: any) => s.name.toLowerCase() === subName);
            if (sub) {
                title = `## ${e('search')} \`/${cmd.data.name} ${sub.name}\``;
                desc = sub.description;
                foundSub = true;
            }
        }
        if (!foundSub && cmd.data.options) {
            const subOpt = cmd.data.options.find((o: any) => (o.toJSON().type === 1 || o.toJSON().type === 2) && o.toJSON().name === subName);
            if (subOpt) {
                const subJson = subOpt.toJSON();
                title = `## ${e('search')} \`/${cmd.data.name} ${subJson.name}\``;
                desc = subJson.description;
                foundSub = true;
            }
        }
        if (!foundSub) {
            desc += `\n\n*(Subcommand \`${subName}\` not found, showing base command)*`;
        }
    }

    const lines = [
        title,
        desc,
        '',
    ];

    if (!subName) {
        if (cmd.subcommands && cmd.subcommands.length > 0) {
            lines.push(`**Subcommands:**`);
            cmd.subcommands.forEach((s: any) => lines.push(`✦ \`${s.name}\` — ${s.description}`));
            lines.push('');
        } else if (cmd.data.options) {
            const subs = cmd.data.options.filter((o: any) => o.toJSON().type === 1 || o.toJSON().type === 2);
            if (subs.length > 0) {
                lines.push(`**Subcommands:**`);
                subs.forEach((s: any) => lines.push(`✦ \`${s.toJSON().name}\` — ${s.toJSON().description}`));
                lines.push('');
            }
        }
    }

    lines.push(cmd.cooldown ? `${e('uptime')}  **Cooldown** — \`${cmd.cooldown}s\`` : '');
    lines.push(cmd.aliases?.length ? `**Aliases** — ${cmd.aliases.map((a: string) => `\`${a}\``).join(', ')}` : '');
    lines.push(cmd.guildOnly ? `${e('server')}  Server only` : '');
    lines.push(cmd.ownerOnly ? `${e('crown')}  Owner only` : '');

    return new FadeContainer(Colours.FADE)
        .text(lines.filter(Boolean).join('\n'))
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
            const [cmdName, subName] = specific.split(' ');

            const cmd = client.commands.get(cmdName.toLowerCase())
                     ?? client.commands.get(client.aliases.get(cmdName.toLowerCase()) ?? '');

            if (!cmd) {
                // Check if it's a category dynamically
                const isCategory = Array.from(client.commands.values()).some((c: any) => (c.category ?? 'general') === cmdName.toLowerCase());
                if (isCategory) {
                    await sendResponse(interaction, [buildCategoryInfo(client, cmdName.toLowerCase())], true);
                    return;
                }

                await interaction.reply({
                    content: `${e('error')} No command or module named \`${cmdName}\` found.`,
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            await sendResponse(interaction, [buildCommandInfo(cmd, subName?.toLowerCase())], true);
            return;
        }

        await sendResponse(interaction, [buildOverview(client)], true);
    },

    async prefixExecute(message, args, client) {
        if (args[0]) {
            const cmdName = args[0].toLowerCase();
            const subName = args[1]?.toLowerCase();

            const cmd = client.commands.get(cmdName)
                     ?? client.commands.get(client.aliases.get(cmdName) ?? '');

            if (!cmd) {
                // Check if it's a category dynamically
                const isCategory = Array.from(client.commands.values()).some((c: any) => (c.category ?? 'general') === cmdName.toLowerCase());
                if (isCategory) {
                    await sendMessage(message, [buildCategoryInfo(client, cmdName)]);
                    return;
                }

                await message.reply(`${e('error')} No command or module named \`${cmdName}\` found.`);
                return;
            }

            await sendMessage(message, [buildCommandInfo(cmd, subName)]);
            return;
        }

        await sendMessage(message, [buildOverview(client)]);
    },
} satisfies Command;