// src/commands/moderation/massban.ts
// Ban multiple users by ID in a single command.
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, fadeReply, sendMessage } from '../../components/builders.js';
import { canModerate } from '../../utils/moderation.js';
import { createCase } from '../../db/queries/moderation.js';
import { e, Colours } from '../../components/emojis.js';
import { sendLog, LogColour } from '../../utils/logsender.js';
import { hasPermission } from '../../utils/fakePerms.js';

export default {
    data: new SlashCommandBuilder()
        .setName('massban')
        .setDescription('Ban multiple users by ID at once')
        .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
        .addStringOption(o => o
            .setName('user_ids')
            .setDescription('Space-separated list of user IDs to ban')
            .setRequired(true)
        )
        .addStringOption(o => o
            .setName('reason')
            .setDescription('Reason for all bans')
            .setRequired(false)
        )
        .addIntegerOption(o => o
            .setName('delete_messages')
            .setDescription('Delete message history (days, 0-7)')
            .setMinValue(0).setMaxValue(7)
            .setRequired(false)
        ),

    category: 'moderation', guildOnly: true,
    userPermissions: [PermissionFlagsBits.BanMembers],
    botPermissions:  [PermissionFlagsBits.BanMembers],
    cooldown: 15,

    async execute(interaction, client) {
        await interaction.deferReply();

        const idsRaw    = interaction.options.getString('user_ids', true);
        const reason    = interaction.options.getString('reason') ?? 'No reason provided';
        const deleteDays = interaction.options.getInteger('delete_messages') ?? 0;
        const guild     = interaction.guild!;

        const ids = [...new Set(idsRaw.split(/[\s,]+/).filter(id => /^\d{17,20}$/.test(id)))];

        if (ids.length === 0) {
            await interaction.editReply(`${e('error')} No valid user IDs found.`); return;
        }
        if (ids.length > 20) {
            await interaction.editReply(`${e('error')} Maximum 20 users per mass ban.`); return;
        }

        const banned: string[] = [];
        const failed:  string[] = [];

        for (const id of ids) {
            try {
                const user = await client.users.fetch(id).catch(() => null);
                const targetMember = await guild.members.fetch(id).catch(() => null);

                if (targetMember) {
                    const check = canModerate(interaction.member as any, targetMember, 'ban');
                    if (!check.ok) {
                        failed.push(id);
                        continue;
                    }
                }

                await guild.bans.create(id, {
                    reason: `[Fade Massban] ${reason} | Moderator: ${interaction.user.tag}`,
                    deleteMessageSeconds: deleteDays * 86400,
                });
                banned.push(id);
                if (user) {
                    await createCase({
                        guildId: guild.id, type: 'ban',
                        userId: id, userTag: user.tag,
                        moderatorId: interaction.user.id, moderatorTag: interaction.user.tag,
                        reason: `[Massban] ${reason}`,
                    });
                }
            } catch {
                failed.push(id);
            }
        }

        await sendLog({
            guild, category: 'mod', event: 'memberBan', color: LogColour.DELETE,
            title: `${e('ban')} Mass Ban`,
            fields: [
                { name: 'Moderator', value: `<@${interaction.user.id}>` },
                { name: 'Banned',    value: `\`${banned.length}\` users` },
                { name: 'Failed',    value: `\`${failed.length}\` users` },
                { name: 'Reason',    value: reason },
                { name: 'User IDs',  value: banned.map(id => `\`${id}\``).join(', ') || 'None' },
            ],
            footer: `Requested by ${interaction.user.tag}`,
        });

        const card = new FadeContainer(Colours.DANGER)
            .text(
                `${e('ban')}  Mass Ban Complete\n` +
                `-# Banned \`${banned.length}\` user${banned.length !== 1 ? 's' : ''}` +
                (failed.length > 0 ? ` · Failed \`${failed.length}\`` : '')
            )
            .build();

        await interaction.editReply({ ...(fadeReply([card], false) as any) });
    },

    async prefixExecute(message, args, client) {
        if (!await hasPermission(message.member!, 'ban_members')) {
            await message.reply(`${e('error')} You don't have permission to ban members.`); return;
        }

        const ids = [...new Set(args.filter(a => /^\d{17,20}$/.test(a)))];
        const textArgs = args.filter(a => !/^\d{17,20}$/.test(a));
        const reason = textArgs.join(' ') || 'No reason provided';

        if (ids.length === 0) {
            await message.reply(`${e('error')} Usage: \`f!massban <id1> <id2> ... [reason]\``); return;
        }
        if (ids.length > 20) {
            await message.reply(`${e('error')} Maximum 20 users per mass ban.`); return;
        }

        const banned: string[] = [];
        const failed:  string[] = [];

        for (const id of ids) {
            try {
                const user = await client.users.fetch(id).catch(() => null);
                const targetMember = await message.guild!.members.fetch(id).catch(() => null);

                if (targetMember) {
                    const check = canModerate(message.member!, targetMember, 'ban');
                    if (!check.ok) {
                        failed.push(id);
                        continue;
                    }
                }

                await message.guild!.bans.create(id, {
                    reason: `[Fade Massban] ${reason} | Moderator: ${message.author.tag}`,
                });
                banned.push(id);
                if (user) {
                    await createCase({
                        guildId: message.guild!.id, type: 'ban',
                        userId: id, userTag: user.tag,
                        moderatorId: message.author.id, moderatorTag: message.author.tag,
                        reason: `[Massban] ${reason}`,
                    });
                }
            } catch {
                failed.push(id);
            }
        }

        await sendLog({
            guild: message.guild!, category: 'mod', event: 'memberBan', color: LogColour.DELETE,
            title: `${e('ban')} Mass Ban`,
            fields: [
                { name: 'Moderator', value: `<@${message.author.id}>` },
                { name: 'Banned',    value: `\`${banned.length}\` users` },
                { name: 'Reason',    value: reason },
            ],
            footer: `Requested by ${message.author.tag}`,
        });

        const card = new FadeContainer(Colours.DANGER)
            .text(
                `${e('ban')}  Mass Banned \`${banned.length}\` user${banned.length !== 1 ? 's' : ''}` +
                (failed.length > 0 ? ` · Failed \`${failed.length}\`` : '')
            )
            .build();
        await sendMessage(message, [card]);
    },
} satisfies Command;
