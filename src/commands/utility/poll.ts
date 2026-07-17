// src/commands/utility/poll.ts
// Create polls with up to 10 options and timed results.
import {
    SlashCommandBuilder, PermissionFlagsBits, MessageFlags,
    ActionRowBuilder, ButtonBuilder, ButtonStyle, EmbedBuilder,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, fadeReply, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { db } from '../../db/index.js';
import { polls } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { parseDuration } from '../../utils/moderation.js';
import { hasPermission } from '../../utils/fakePerms.js';

const POLL_EMOJIS = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];

export function buildPollEmbed(question: string, options: string[], votes: Record<string, string[]>, status: string, endsAt: Date | null) {
    const total = Object.values(votes).reduce((sum, v) => sum + v.length, 0);
    const desc = options.map((opt, i) => {
        const voteCount = votes[String(i)]?.length ?? 0;
        const pct = total > 0 ? Math.round((voteCount / total) * 100) : 0;
        const bar = '█'.repeat(Math.floor(pct / 10)) + '░'.repeat(10 - Math.floor(pct / 10));
        return `${POLL_EMOJIS[i]} **${opt}**\n\`${bar}\` ${pct}% (${voteCount} votes)`;
    }).join('\n\n');

    const embed = new EmbedBuilder()
        .setColor(status === 'ended' ? 0x95a5a6 : 0x8096fe)
        .setTitle(`📊 ${question}`)
        .setDescription(desc)
        .addFields({ name: 'Total Votes', value: `\`${total}\``, inline: true })
        .setFooter({ text: status === 'ended' ? '✅ Poll ended' : `Total voters: ${total}` });

    if (endsAt && status === 'active') {
        const ts = Math.floor(endsAt.getTime() / 1000);
        embed.addFields({ name: 'Ends', value: `<t:${ts}:R>`, inline: true });
    }

    return embed;
}

export function buildPollButtons(pollId: number, options: string[], status: string) {
    const rows: ActionRowBuilder<ButtonBuilder>[] = [];
    let row = new ActionRowBuilder<ButtonBuilder>();
    for (let i = 0; i < Math.min(options.length, 10); i++) {
        if (i > 0 && i % 5 === 0) {
            rows.push(row);
            row = new ActionRowBuilder<ButtonBuilder>();
        }
        row.addComponents(
            new ButtonBuilder()
                .setCustomId(`poll:vote:${pollId}:${i}`)
                .setLabel(options[i])
                .setEmoji(POLL_EMOJIS[i])
                .setStyle(ButtonStyle.Secondary)
                .setDisabled(status === 'ended')
        );
    }
    if (row.components.length > 0) rows.push(row);
    const endRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
            .setCustomId(`poll:end:${pollId}`)
            .setLabel('End Poll')
            .setStyle(ButtonStyle.Danger)
            .setDisabled(status === 'ended')
    );
    rows.push(endRow);
    return rows;
}

export default {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Create a poll')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
        .addSubcommand(s => s
            .setName('create')
            .setDescription('Create a new poll')
            .addStringOption(o => o.setName('question').setDescription('The poll question').setRequired(true))
            .addStringOption(o => o.setName('option1').setDescription('Option 1').setRequired(true))
            .addStringOption(o => o.setName('option2').setDescription('Option 2').setRequired(true))
            .addStringOption(o => o.setName('option3').setDescription('Option 3').setRequired(false))
            .addStringOption(o => o.setName('option4').setDescription('Option 4').setRequired(false))
            .addStringOption(o => o.setName('option5').setDescription('Option 5').setRequired(false))
            .addStringOption(o => o.setName('option6').setDescription('Option 6').setRequired(false))
            .addStringOption(o => o.setName('option7').setDescription('Option 7').setRequired(false))
            .addStringOption(o => o.setName('option8').setDescription('Option 8').setRequired(false))
            .addStringOption(o => o.setName('option9').setDescription('Option 9').setRequired(false))
            .addStringOption(o => o.setName('option10').setDescription('Option 10').setRequired(false))
            .addStringOption(o => o.setName('duration').setDescription('Poll duration (e.g. 1h, 1d). Default: no auto-end').setRequired(false))
        )
        .addSubcommand(s => s
            .setName('end')
            .setDescription('End a poll early')
            .addIntegerOption(o => o.setName('id').setDescription('Poll ID').setRequired(true))
        ),

    category: 'utility', guildOnly: true,
    userPermissions: [PermissionFlagsBits.ManageMessages],
    cooldown: 5,

    async execute(interaction, client) {
        const sub = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        if (sub === 'create') {
            await interaction.deferReply();

            const question = interaction.options.getString('question', true);
            const options: string[] = [];
            for (let i = 1; i <= 10; i++) {
                const opt = interaction.options.getString(`option${i}`);
                if (opt) options.push(opt);
            }
            const durStr  = interaction.options.getString('duration');
            const duration = durStr ? parseDuration(durStr) : null;
            const endsAt   = duration ? new Date(Date.now() + duration * 1000) : null;

            const [poll] = await db.insert(polls).values({
                guildId:   guild.id,
                channelId: interaction.channelId,
                hostId:    interaction.user.id,
                question,
                options,
                votes:     {},
                endsAt,
            }).returning();

            const embed = buildPollEmbed(question, options, {}, 'active', endsAt);
            const components = buildPollButtons(poll.id, options, 'active');

            const msg = await interaction.editReply({ embeds: [embed], components });

            await db.update(polls).set({ messageId: msg.id }).where(eq(polls.id, poll.id));
            return;
        }

        if (sub === 'end') {
            const pollId = interaction.options.getInteger('id', true);
            const [poll] = await db.select().from(polls).where(eq(polls.id, pollId)).limit(1);
            if (!poll || poll.guildId !== guild.id) {
                await interaction.reply({ content: `${e('error')} Poll not found.`, flags: MessageFlags.Ephemeral }); return;
            }
            if (poll.hostId !== interaction.user.id && !interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild)) {
                await interaction.reply({ content: `${e('error')} Only the poll host or admins can end this poll.`, flags: MessageFlags.Ephemeral }); return;
            }

            await db.update(polls).set({ status: 'ended' }).where(eq(polls.id, pollId));

            const embed = buildPollEmbed(poll.question, poll.options, poll.votes ?? {}, 'ended', poll.endsAt);
            const components = buildPollButtons(pollId, poll.options, 'ended');

            if (poll.messageId) {
                const channel = guild.channels.cache.get(poll.channelId) as any;
                if (channel?.isTextBased()) {
                    const msg = await channel.messages.fetch(poll.messageId).catch(() => null);
                    if (msg) await msg.edit({ embeds: [embed], components });
                }
            }

            await interaction.reply({ content: `${e('success')} Poll ended!`, flags: MessageFlags.Ephemeral });
        }
    },

    async prefixExecute(message, args, client) {
        if (!await hasPermission(message.member!, 'manage_messages')) {
            await message.reply(`${e('error')} You need Manage Messages permission.`); return;
        }

        // f!poll "Question" option1 option2 option3 [duration]
        // Parse quoted question
        const raw = message.content.slice(message.content.indexOf(args[0] ?? '') - 0).trim();
        // Try to grab quoted question
        const quotedMatch = raw.match(/^"(.+?)"\s+([\s\S]+)/);
        if (!quotedMatch) {
            await message.reply(`${e('error')} Usage: \`f!poll "Question" Option1 Option2 [Option3...] [1h]\``); return;
        }
        const question  = quotedMatch[1];
        const rest      = quotedMatch[2].trim().split(/\s+/);
        const durStr    = rest[rest.length - 1];
        const hasDur    = /^\d+[smhd]/.test(durStr);
        const opts      = hasDur ? rest.slice(0, -1) : rest;
        const duration  = hasDur ? parseDuration(durStr) : null;
        const endsAt    = duration ? new Date(Date.now() + duration * 1000) : null;

        if (opts.length < 2) {
            await message.reply(`${e('error')} Please provide at least 2 options.`); return;
        }

        const [poll] = await db.insert(polls).values({
            guildId: message.guild!.id, channelId: message.channelId,
            hostId: message.author.id, question, options: opts, votes: {}, endsAt,
        }).returning();

        const embed = buildPollEmbed(question, opts, {}, 'active', endsAt);
        const components = buildPollButtons(poll.id, opts, 'active');
        const msg = await (message.channel as any).send({ embeds: [embed], components });
        await db.update(polls).set({ messageId: msg.id }).where(eq(polls.id, poll.id));
    },
} satisfies Command;
