import { SlashCommandBuilder, AttachmentBuilder } from 'discord.js';
import { Command } from '../../types/command.js';
import { getReputation } from '../../db/queries/reputation.js';
import { generateReputationCard } from '../../utils/canvas/reputationCard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('rep')
        .setDescription('View your or another user\'s reputation profile')
        .addUserOption(option => 
            option.setName('user')
                .setDescription('The user to view')),
    
    async execute(interaction, client) {
        let user = interaction.options.getUser('user') ?? interaction.user;
        if (user.bot) {
            await interaction.reply({ content: 'Bots do not have reputation profiles.', flags: 'Ephemeral' });
            return;
        }

        await interaction.deferReply();

        const rep = await getReputation(interaction.guild!.id, user.id);

        const buffer = await generateReputationCard({
            username: user.username,
            avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }),
            helper: rep.helperRep,
            developer: rep.developerRep,
            artist: rep.artistRep,
            trusted: rep.trustedRep,
        });

        const attachment = new AttachmentBuilder(buffer, { name: 'reputation.png' });
        await interaction.editReply({ content: '', files: [attachment] });
    },

    async prefixExecute(message, args, client) {
        let user = message.author;
        if (args.length > 0) {
            const targetId = args[0].replace(/[<@!>]/g, '');
            const target = await client.users.fetch(targetId).catch(() => null);
            if (target) user = target;
        }

        if (user.bot) {
            await message.reply('Bots do not have reputation profiles.');
            return;
        }

        const reply = await message.reply('Generating reputation profile...');

        const rep = await getReputation(message.guild!.id, user.id);

        const buffer = await generateReputationCard({
            username: user.username,
            avatarUrl: user.displayAvatarURL({ extension: 'png', size: 256 }),
            helper: rep.helperRep,
            developer: rep.developerRep,
            artist: rep.artistRep,
            trusted: rep.trustedRep,
        });

        const attachment = new AttachmentBuilder(buffer, { name: 'reputation.png' });
        await reply.edit({ content: '', files: [attachment] });
    }
} satisfies Command;
