// src/commands/fun/action.ts
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import type { Command } from '../../types/command.js';
import { e, Colours } from '../../components/emojis.js';

// The actions we support
const ACTIONS = ['hug', 'kiss', 'pat', 'slap', 'bite', 'cuddle', 'bully', 'lick', 'yeet', 'highfive', 'handhold', 'nom', 'kill', 'kick', 'poke'] as const;
type ActionType = typeof ACTIONS[number];

// Config for each action (messages)
const ACTION_CONFIG: Record<ActionType, { text: string }> = {
    hug:      { text: 'hugs' },
    kiss:     { text: 'kisses' },
    pat:      { text: 'pats' },
    slap:     { text: 'slaps' },
    bite:     { text: 'bites' },
    cuddle:   { text: 'cuddles with' },
    bully:    { text: 'bullies' },
    lick:     { text: 'licks' },
    yeet:     { text: 'yeets' },
    highfive: { text: 'high-fives' },
    handhold: { text: 'holds hands with' },
    nom:      { text: 'noms on' },
    kill:     { text: 'kills' },
    kick:     { text: 'kicks' },
    poke:     { text: 'pokes' },
};

// Fetch GIF using multiple fallback APIs to ensure it never fails
async function fetchGif(action: ActionType): Promise<string | null> {
    const headers = { 'User-Agent': 'FadeDiscordBot/1.0' };
    
    // 1. Try nekos.best
    try {
        const res = await fetch(`https://nekos.best/api/v2/${action}`, { headers });
        if (res.ok) {
            const data = await res.json();
            if (data.results?.[0]?.url) return data.results[0].url;
        }
    } catch {}

    // 2. Try otakugifs
    try {
        const res = await fetch(`https://api.otakugifs.xyz/gif?reaction=${action}`, { headers });
        if (res.ok) {
            const data = await res.json();
            if (data.url) return data.url;
        }
    } catch {}

    // 3. Try nekos.life
    try {
        const res = await fetch(`https://nekos.life/api/v2/img/${action}`, { headers });
        if (res.ok) {
            const data = await res.json();
            if (data.url) return data.url;
        }
    } catch {}
    
    // 4. Try waifu.pics
    try {
        const res = await fetch(`https://api.waifu.pics/sfw/${action}`, { headers });
        if (res.ok) {
            const data = await res.json();
            if (data.url) return data.url;
        }
    } catch {}

    return null;
}

export default {
    // Slash command is grouped under /action <type> <user>
    data: new SlashCommandBuilder()
        .setName('action')
        .setDescription('Roleplay actions (hug, kiss, pat, etc)')
        .addStringOption(o => o
            .setName('type')
            .setDescription('The action to perform')
            .setRequired(true)
            .addChoices(...ACTIONS.map(a => ({ name: a, value: a })))
        )
        .addUserOption(o => o
            .setName('user')
            .setDescription('The user to target')
            .setRequired(true)
        ),

    category:  'roleplay',
    guildOnly: true,
    cooldown:  3,

    // Prefix aliases so users can type `!hug @user` directly instead of `!action hug @user`
    aliases: [...ACTIONS],

    async execute(interaction) {
        const action = interaction.options.getString('type', true) as ActionType;
        const target = interaction.options.getUser('user', true);
        const author = interaction.user;

        if (target.id === author.id) {
            await interaction.reply({ content: `${e('error')} You can't ${action} yourself!`, flags: MessageFlags.Ephemeral });
            return;
        }

        if (target.id === interaction.client.user?.id) {
            await interaction.reply({ content: `${e('error')} I'm a bot! I don't feel physical touch!`, flags: MessageFlags.Ephemeral });
            return;
        }

        await interaction.deferReply();

        const url = await fetchGif(action);
        if (!url) {
            await interaction.editReply(`${e('error')} Failed to fetch a GIF right now. Try again later!`);
            return;
        }

        const config = ACTION_CONFIG[action];
        const card = new FadeContainer()
            .text(`**${author.username}** ${config.text} **${target.username}**!`)
            .gallery([{ url }])
            .build();

        await sendResponse(interaction as any, [card]);
    },

    async prefixExecute(message, args) {
        // Figure out the action based on the command used
        let action: ActionType | null = null;
        
        const words = message.content.toLowerCase().split(/\W+/);
        for (const word of words) {
            if (ACTIONS.includes(word as ActionType)) {
                action = word as ActionType;
                break;
            }
        }

        if (!action) {
            await message.reply(`${e('error')} Invalid action.`);
            return;
        }

        const target = message.mentions.users.first();
        if (!target) {
            await message.reply(`${e('error')} You need to mention someone to ${action}!`);
            return;
        }

        if (target.id === message.author.id) {
            await message.reply(`${e('error')} You can't ${action} yourself!`);
            return;
        }

        if (target.id === message.client.user?.id) {
            await message.reply(`${e('error')} I'm a bot! I don't feel physical touch!`);
            return;
        }

        const url = await fetchGif(action);
        if (!url) {
            await message.reply(`${e('error')} Failed to fetch a GIF right now. Try again later!`);
            return;
        }

        const config = ACTION_CONFIG[action];
        const card = new FadeContainer()
            .text(`**${message.author.username}** ${config.text} **${target.username}**!`)
            .gallery([{ url }])
            .build();

        await sendMessage(message, [card]);
    }
} as Command;
