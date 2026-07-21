import { SlashCommandBuilder, MessageFlags, EmbedBuilder } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { db } from '../../db/index.js';
import { confessionConfig, confessions } from '../../db/schema.js';
import { and, eq, desc } from 'drizzle-orm';

export default {
    data: new SlashCommandBuilder()
        .setName('confess')
        .setDescription('Submit an anonymous confession')
        .addStringOption(o => o.setName('message').setDescription('Your anonymous confession (no one will know it\'s you)').setRequired(true)),
    category: 'utility', guildOnly: true,
    cooldown: 10,
    async execute(interaction) {
        const guild = interaction.guild!;
        const messageText = interaction.options.getString('message', true);
        await handleConfession(interaction as any, guild, interaction.user, messageText, true);
    },
    async prefixExecute(message, args) {
        const guild = message.guild!;
        if (!args.length) {
            await sendMessage(message, [new FadeContainer(Colours.DANGER).text(`${e('error')} Please provide a confession message! Usage: \`f!confess <message>\``).build()]);
            return;
        }
        
        // Immediately delete their message so no one sees it
        await message.delete().catch(() => null);

        const messageText = args.join(' ');
        await handleConfession(message as any, guild, message.author, messageText, false);
    }
} as Command;

async function handleConfession(ctx: any, guild: any, user: any, messageText: string, isSlash: boolean) {
    const replyFn = async (card: any) => {
        if (isSlash) {
            await ctx.reply({ components: [card], flags: MessageFlags.Ephemeral });
        } else {
            const msg = await sendMessage(ctx, [card]);
            // Delete error messages after 5 seconds to keep chat clean
            setTimeout(() => msg.delete().catch(() => null), 5000);
        }
    };

    const [cfg] = await db.select().from(confessionConfig).where(eq(confessionConfig.guildId, guild.id)).limit(1);
    if (!cfg || !cfg.enabled) {
        return replyFn(new FadeContainer(Colours.DANGER).text(`${e('error')} Confessions are not enabled in this server.`).build());
    }

    const [existingBan] = await db.select().from(confessions)
        .where(and(eq(confessions.guildId, guild.id), eq(confessions.userId, user.id), eq(confessions.banned, true)))
        .limit(1);
    if (existingBan) {
        return replyFn(new FadeContainer(Colours.DANGER).text(`${e('error')} You are banned from submitting confessions in this server.`).build());
    }

    // 6 Hour Cooldown Check
    const [lastConfession] = await db.select().from(confessions)
        .where(and(eq(confessions.guildId, guild.id), eq(confessions.userId, user.id)))
        .orderBy(desc(confessions.createdAt))
        .limit(1);

    if (lastConfession && lastConfession.createdAt) {
        const sixHours = 6 * 60 * 60 * 1000;
        const timeSince = Date.now() - new Date(lastConfession.createdAt).getTime();
        if (timeSince < sixHours) {
            const remaining = Math.floor((Date.now() + (sixHours - timeSince)) / 1000);
            return replyFn(new FadeContainer(Colours.DANGER).text(`${e('error')} You can only submit one confession every 6 hours. Please wait <t:${remaining}:R>.`).build());
        }
    }

    if (messageText.length > 2000) {
        return replyFn(new FadeContainer(Colours.DANGER).text(`${e('error')} Confession must be under 2000 characters.`).build());
    }

    const [confession] = await db.insert(confessions).values({
        guildId: guild.id, userId: user.id, content: messageText, banned: false
    }).returning();

    const confessionChannel = guild.channels.cache.get(cfg.channelId) as any;
    if (!confessionChannel?.isTextBased()) {
        return replyFn(new FadeContainer(Colours.DANGER).text(`${e('error')} The confession channel seems to be missing. Please ask an admin to re-configure it.`).build());
    }

    const publicCard = new FadeContainer(Colours.FADE)
        .text(`## 💬 Confession #${confession.id}\n\n${messageText}`)
        .build();
    
    // Extract user mentions so they actually get pinged (since embeds don't trigger push notifications)
    const userMentions = messageText.match(/<@!?\d+>/g) || [];
    const uniqueMentions = [...new Set(userMentions)].join(' ');
    
    const msg = await confessionChannel.send({ 
        content: uniqueMentions || undefined,
        components: [publicCard],
        flags: MessageFlags.IsComponentsV2,
        allowedMentions: { parse: ['users'] } // STRICTLY only allow user pings, block @everyone and roles
    });
    await db.update(confessions).set({ messageId: msg.id }).where(eq(confessions.id, confession.id));

    if (cfg.modChannelId) {
        const modChannel = guild.channels.cache.get(cfg.modChannelId) as any;
        if (modChannel?.isTextBased()) {
            const modEmbed = new EmbedBuilder()
                .setColor(Colours.WARNING)
                .setTitle(`🔍 Confession #${confession.id} (Mod View)`)
                .setDescription(messageText)
                .addFields(
                    { name: 'Author', value: `${user} (\`${user.id}\`)` },
                    { name: 'ID', value: `\`${confession.id}\`` },
                    { name: 'Message', value: `[Jump](${msg.url})` }
                )
                .setTimestamp();
            await modChannel.send({ embeds: [modEmbed] });
        }
    }

    if (isSlash) {
        await ctx.reply({ content: `${e('success')} Your confession has been sent anonymously!`, flags: MessageFlags.Ephemeral });
    } else {
        // Since we deleted their command message, we can DM them success!
        await user.send({ components: [new FadeContainer(Colours.SUCCESS).text(`${e('success')} Your confession #${confession.id} has been securely posted to **${guild.name}**!`).build()] }).catch(() => null);
    }
}
