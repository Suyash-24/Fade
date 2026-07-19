// src/commands/fun/action.ts
import { SlashCommandBuilder, MessageFlags, EmbedBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { e, Colours } from '../../components/emojis.js';

// The actions we support
const ACTIONS = ['hug', 'kiss', 'pat', 'slap', 'bite', 'cuddle', 'bully', 'lick', 'yeet', 'highfive', 'handhold', 'nom', 'kill', 'kick', 'poke'] as const;
type ActionType = typeof ACTIONS[number];

// Config for each action (messages and colors)
const ACTION_CONFIG: Record<ActionType, { text: string; color: number }> = {
    hug:      { text: 'hugs', color: 0xffb6c1 }, // Light pink
    kiss:     { text: 'kisses', color: 0xff69b4 }, // Hot pink
    pat:      { text: 'pats', color: 0x87cefa }, // Light sky blue
    slap:     { text: 'slaps', color: 0xff4500 }, // Orange red
    bite:     { text: 'bites', color: 0xdc143c }, // Crimson
    cuddle:   { text: 'cuddles with', color: 0xffd700 }, // Gold
    bully:    { text: 'bullies', color: 0x800080 }, // Purple
    lick:     { text: 'licks', color: 0xffa07a }, // Light salmon
    yeet:     { text: 'yeets', color: 0x00fa9a }, // Medium spring green
    highfive: { text: 'high-fives', color: 0x00bfff }, // Deep sky blue
    handhold: { text: 'holds hands with', color: 0xffa500 }, // Orange
    nom:      { text: 'noms on', color: 0xff6347 }, // Tomato
    kill:     { text: 'kills', color: 0x000000 }, // Black
    kick:     { text: 'kicks', color: 0x8b0000 }, // Dark red
    poke:     { text: 'pokes', color: 0x00ced1 }, // Dark turquoise
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
        const embed = new EmbedBuilder()
            .setColor(config.color)
            .setDescription(`**${author.username}** ${config.text} **${target.username}**!`)
            .setImage(url);

        await interaction.editReply({ embeds: [embed] });
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
        const embed = new EmbedBuilder()
            .setColor(config.color)
            .setDescription(`**${message.author.username}** ${config.text} **${target.username}**!`)
            .setImage(url);

        await message.reply({ embeds: [embed] });
    }
} as Command;
