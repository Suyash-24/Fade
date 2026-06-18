import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/command.js';
import { getRepCooldown, setRepCooldown, addReputation } from '../../db/queries/reputation.js';
import { e, Colours } from '../../components/emojis.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';

export default {
    data: new SlashCommandBuilder()
        .setName('thank')
        .setDescription('Thank a user for helping out, giving them Reputation!')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to thank')
                .setRequired(true)),
    
    aliases: ['thx', 'thanks'],
    category: 'Reputation',
    
    async execute(interaction, client) {
        const user = interaction.options.getUser('user', true);
        if (user.bot) {
            await interaction.reply({ content: 'You cannot thank bots!', flags: 'Ephemeral' });
            return;
        }
        if (user.id === interaction.user.id) {
            await interaction.reply({ content: 'You cannot thank yourself!', flags: 'Ephemeral' });
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
                await interaction.reply({ content: `You can only thank someone once every 24 hours. Please wait **${hours}h ${minutes}m**.`, flags: 'Ephemeral' });
                return;
            }
        }

        await addReputation(guildId, user.id, 'helper', 1);
        await addReputation(guildId, user.id, 'trusted', 1);
        await setRepCooldown(guildId, giverId);

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## ${e('success')} Reputation Awarded!`)
            .text(`You thanked ${user}! They received **+1 Helper** and **+1 Trusted** Reputation.`)
            .build();

        await sendResponse(interaction, [card]);
    },

    async prefixExecute(message, args, client) {
        if (args.length === 0) {
            await message.reply('Please mention a user to thank.');
            return;
        }
        const targetId = args[0].replace(/[<@!>]/g, '');
        const user = await client.users.fetch(targetId).catch(() => null);

        if (!user) {
            await message.reply('User not found.');
            return;
        }
        if (user.bot) {
            await message.reply('You cannot thank bots!');
            return;
        }
        if (user.id === message.author.id) {
            await message.reply('You cannot thank yourself!');
            return;
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
                await message.reply(`You can only thank someone once every 24 hours. Please wait **${hours}h ${minutes}m**.`);
                return;
            }
        }

        await addReputation(guildId, user.id, 'helper', 1);
        await addReputation(guildId, user.id, 'trusted', 1);
        await setRepCooldown(guildId, giverId);

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## ${e('success')} Reputation Awarded!`)
            .text(`You thanked ${user}! They received **+1 Helper** and **+1 Trusted** Reputation.`)
            .build();

        await sendMessage(message, [card]);
    }
} satisfies Command;
