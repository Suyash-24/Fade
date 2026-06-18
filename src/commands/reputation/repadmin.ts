import { SlashCommandBuilder } from 'discord.js';
import { Command } from '../../types/command.js';
import { addReputation } from '../../db/queries/reputation.js';
import { e, Colours } from '../../components/emojis.js';
import { FadeContainer } from '../../components/builders.js';
import { hasPermission } from '../../utils/fakePerms.js';

export default {
    data: new SlashCommandBuilder()
        .setName('repadmin')
        .setDescription('Admin tool to manually award reputation')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to award reputation to')
                .setRequired(true))
        .addStringOption(option =>
            option.setName('type')
                .setDescription('The type of reputation')
                .setRequired(true)
                .addChoices(
                    { name: 'Helper', value: 'helper' },
                    { name: 'Developer', value: 'developer' },
                    { name: 'Artist', value: 'artist' },
                    { name: 'Trusted', value: 'trusted' }
                ))
        .addIntegerOption(option =>
            option.setName('amount')
                .setDescription('Amount of reputation to add (can be negative)')
                .setRequired(true)),
    
    aliases: ['ra'],
    category: 'Reputation',
    
    async execute(interaction, client) {
        if (!await hasPermission(interaction.member as any, 'administrator')) {
            await interaction.reply({ content: 'You need Administrator permission to use this.', flags: 'Ephemeral' });
            return;
        }

        const user = interaction.options.getUser('user', true);
        const type = interaction.options.getString('type', true);
        const amount = interaction.options.getInteger('amount', true);

        if (user.bot) {
            await interaction.reply({ content: 'Bots do not have reputation profiles.', flags: 'Ephemeral' });
            return;
        }

        await addReputation(interaction.guild!.id, user.id, type as any, amount);

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## ${e('success')} Reputation Updated`)
            .text(`Successfully added **${amount} ${type}** reputation to ${user}.`)
            .build();

        await interaction.reply({ components: [card] });
    },

    async prefixExecute(message, args, client) {
        if (!await hasPermission(message.member!, 'administrator')) {
            await message.reply('You need Administrator permission to use this.');
            return;
        }

        if (args.length < 3) {
            await message.reply('Usage: `f!repadmin <@user> <type> <amount>`');
            return;
        }
        
        const targetId = args[0].replace(/[<@!>]/g, '');
        const user = await client.users.fetch(targetId).catch(() => null);
        
        const type = args[1].toLowerCase();
        if (!['helper', 'developer', 'artist', 'trusted'].includes(type)) {
            await message.reply('Invalid type. Must be `helper`, `developer`, `artist`, or `trusted`.');
            return;
        }
        
        const amount = parseInt(args[2]);
        if (isNaN(amount)) {
            await message.reply('Amount must be a number.');
            return;
        }

        if (!user) {
            await message.reply('User not found.');
            return;
        }
        if (user.bot) {
            await message.reply('Bots do not have reputation profiles.');
            return;
        }

        await addReputation(message.guild!.id, user.id, type as any, amount);

        const card = new FadeContainer(Colours.SUCCESS)
            .text(`## ${e('success')} Reputation Updated`)
            .text(`Successfully added **${amount} ${type}** reputation to ${user}.`)
            .build();

        await message.reply({ components: [card] });
    }
} satisfies Command;
