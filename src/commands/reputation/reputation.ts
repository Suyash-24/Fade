import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/command.js';
import { getRepCooldown, setRepCooldown, addReputation } from '../../db/queries/reputation.js';
import { e, Colours } from '../../components/emojis.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';

export default {
    data: new SlashCommandBuilder()
        .setName('reputation')
        .setDescription('Award reputation to a user')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to award reputation to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('category')
                .setDescription('The type of reputation to award')
                .setRequired(true)
                .addChoices(
                    { name: 'Helper', value: 'helper' },
                    { name: 'Developer', value: 'developer' },
                    { name: 'Artist', value: 'artist' },
                    { name: 'Trusted', value: 'trusted' }
                )),
    
    aliases: ['rep'],
    category: 'Reputation',
    
    async execute(interaction, client) {
        const user = interaction.options.getUser('user', true);
        const category = interaction.options.getString('category', true) as 'helper' | 'developer' | 'artist' | 'trusted';

        if (user.bot) {
            await interaction.reply({ content: 'You cannot give reputation to bots!', flags: 'Ephemeral' });
            return;
        }
        if (user.id === interaction.user.id) {
            await interaction.reply({ content: 'You cannot give reputation to yourself!', flags: 'Ephemeral' });
            return;
        }

        const guildId = interaction.guild!.id;
        const giverId = interaction.user.id;

        const lastThank = await getRepCooldown(guildId, giverId);
        if (lastThank) {
            const timePassed = Date.now() - lastThank.getTime();
            const cooldown = 24 * 60 * 60 * 1000;
            if (timePassed < cooldown) {
                const timeLeft = cooldown - timePassed;
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                await interaction.reply({ content: `You can only award reputation once every 24 hours. Please wait **${hours}h ${minutes}m**.`, flags: 'Ephemeral' });
                return;
            }
        }

        await addReputation(guildId, user.id, category, 1);
        await setRepCooldown(guildId, giverId);

        const cardName = category.charAt(0).toUpperCase() + category.slice(1);
        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## ${e('success')} Reputation Awarded!`)
            .text(`You gave ${user} **+1 ${cardName}** Reputation.`)
            .build();

        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        if (args.length === 0) {
            await message.reply('Usage: `f!reputation <@user> [category: helper|developer|artist|trusted]`');
            return;
        }
        const targetId = args[0].replace(/[<@!>]/g, '');
        const user = await client.users.fetch(targetId).catch(() => null);

        if (!user) {
            await message.reply('User not found.');
            return;
        }
        if (user.bot) {
            await message.reply('You cannot give reputation to bots!');
            return;
        }
        if (user.id === message.author.id) {
            await message.reply('You cannot give reputation to yourself!');
            return;
        }

        let category: 'helper' | 'developer' | 'artist' | 'trusted' = 'helper';
        if (args.length > 1) {
            const parsed = args[1].toLowerCase();
            if (['helper', 'developer', 'artist', 'trusted'].includes(parsed)) {
                category = parsed as any;
            } else {
                await message.reply('Invalid category. Must be `helper`, `developer`, `artist`, or `trusted`.');
                return;
            }
        }

        const guildId = message.guild!.id;
        const giverId = message.author.id;

        const lastThank = await getRepCooldown(guildId, giverId);
        if (lastThank) {
            const timePassed = Date.now() - lastThank.getTime();
            const cooldown = 24 * 60 * 60 * 1000;
            if (timePassed < cooldown) {
                const timeLeft = cooldown - timePassed;
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                await message.reply(`You can only award reputation once every 24 hours. Please wait **${hours}h ${minutes}m**.`);
                return;
            }
        }

        await addReputation(guildId, user.id, category, 1);
        await setRepCooldown(guildId, giverId);

        const cardName = category.charAt(0).toUpperCase() + category.slice(1);
        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## ${e('success')} Reputation Awarded!`)
            .text(`You gave ${user} **+1 ${cardName}** Reputation.`)
            .build();

        await sendMessage(message, [card]);
    }
} satisfies Command;
