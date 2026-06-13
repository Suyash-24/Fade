// src/commands/general/fortnite.ts
import { SlashCommandBuilder, PermissionFlagsBits, ChannelType, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { searchCosmetic, getShop, getNews, rarityColor } from '../../utils/fortnite.js';
import {
    getFortniteShopConfig, upsertFortniteShopConfig,
    getUserWatches, toggleWatch,
} from '../../db/queries/fortnite.js';

export default {
    data: new SlashCommandBuilder()
        .setName('fortnite')
        .setDescription('Fortnite cosmetics, shop, and notifications')

        // ── Item lookup ───────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('item')
            .setDescription('Look up a Fortnite cosmetic')
            .addStringOption(o => o.setName('name').setDescription('Cosmetic name').setRequired(true))
        )

        // ── Shop ──────────────────────────────────────────────────────────────
        .addSubcommandGroup(g => g
            .setName('shop')
            .setDescription('Daily item shop notifications')
            .addSubcommand(s => s
                .setName('set')
                .setDescription('Set channel for daily shop updates')
                .addChannelOption(o => o
                    .setName('channel')
                    .setDescription('Channel to post shop in')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)
                )
            )
            .addSubcommand(s => s
                .setName('ping')
                .setDescription('Set role to ping on shop update')
                .addRoleOption(o => o.setName('role').setDescription('Role to ping').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('voting')
                .setDescription('Toggle upvote/downvote reactions on shop message')
                .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
            )
            .addSubcommand(s => s
                .setName('view')
                .setDescription('View today\'s item shop right now')
            )
        )

        // ── Watch ─────────────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('watch')
            .setDescription('Get DM\'d when a cosmetic appears in the shop')
            .addStringOption(o => o.setName('cosmetic').setDescription('Cosmetic name to watch').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('watchlist')
            .setDescription('View your cosmetic watch list')
        )

        // ── News ──────────────────────────────────────────────────────────────
        .addSubcommand(s => s
            .setName('news')
            .setDescription('View current Fortnite BR news')
        ),

    category: 'general',
    cooldown: 5,

    async execute(interaction) {
        const group = interaction.options.getSubcommandGroup(false);
        const sub   = interaction.options.getSubcommand();

        // ── Item ──────────────────────────────────────────────────────────────
        if (sub === 'item') {
            await interaction.deferReply();
            const name = interaction.options.getString('name', true);
            const item = await searchCosmetic(name).catch(() => null);

            if (!item) {
                await interaction.editReply(`${e('error')} Cosmetic \`${name}\` not found.`);
                return;
            }

            const card = new FadeContainer(rarityColor(item.rarity))
                .text(
                    `## ${item.name}\n` +
                    `-# ${item.type} · ${item.rarity}\n\n` +
                    (item.description ? `${item.description}\n\n` : '') +
                    (item.set ? `**Set:** ${item.set}\n` : '') +
                    (item.introduced ? `**Introduced:** ${item.introduced}` : '')
                );
            if (item.image) card.gallery([{ url: item.image }]);
            await interaction.editReply({ components: [card.build()], flags: MessageFlags.IsComponentsV2 } as any);
            return;
        }

        // ── Shop config ───────────────────────────────────────────────────────
        if (group === 'shop') {
            if (!interaction.memberPermissions?.has(PermissionFlagsBits.ManageGuild) && sub !== 'view') {
                await interaction.reply({ content: `${e('error')} You need **Manage Server**.`, flags: MessageFlags.Ephemeral });
                return;
            }

            if (sub === 'set') {
                const channel = interaction.options.getChannel('channel', true);
                await upsertFortniteShopConfig(interaction.guild!.id, { channelId: channel.id });
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Daily shop updates → <#${channel.id}>\n-# Shop resets at 00:00 UTC`)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            if (sub === 'ping') {
                const role = interaction.options.getRole('role', true);
                await upsertFortniteShopConfig(interaction.guild!.id, { roleId: role.id });
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Shop ping set to <@&${role.id}>`)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            if (sub === 'voting') {
                const enabled = interaction.options.getBoolean('enabled', true);
                await upsertFortniteShopConfig(interaction.guild!.id, { voting: enabled });
                const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                    .text(`${e('success')}  Shop voting **${enabled ? 'enabled' : 'disabled'}**`)
                    .build();
                await sendResponse(interaction, [card]);
                return;
            }

            if (sub === 'view') {
                await interaction.deferReply();
                const items = await getShop().catch(() => null);
                if (!items?.length) {
                    await interaction.editReply(`${e('error')} Could not fetch shop. Try again later.`);
                    return;
                }
                const lines = items.slice(0, 20).map(i =>
                    `**${i.name}** · ${i.type} · ${i.rarity} · 🎮 ${i.price} V-Bucks`
                ).join('\n');
                const topImage = items.find(i => i.image)?.image;
                const card = new FadeContainer(0x00D4FF)
                    .text(`## 🛒 Fortnite Item Shop\n-# ${items.length} items today\n\n${lines}`);
                if (topImage) card.gallery([{ url: topImage }]);
                await interaction.editReply({ components: [card.build()], flags: MessageFlags.IsComponentsV2 } as any);
                return;
            }
        }

        // ── Watch ─────────────────────────────────────────────────────────────
        if (sub === 'watch') {
            const cosmetic = interaction.options.getString('cosmetic', true);
            const result   = await toggleWatch(interaction.user.id, cosmetic);
            const card = new FadeContainer(result === 'added' ? Colours.SUCCESS : Colours.DANGER)
                .text(
                    result === 'added'
                        ? `${e('success')}  Watching **${cosmetic}**\n-# You'll get a DM when it appears in the shop`
                        : `${e('success')}  Removed **${cosmetic}** from your watch list`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'watchlist') {
            const watches = await getUserWatches(interaction.user.id);
            if (!watches.length) {
                await interaction.reply({ content: `${e('error')} Your watch list is empty. Use \`/fortnite watch\` to add cosmetics.`, flags: MessageFlags.Ephemeral });
                return;
            }
            const card = new FadeContainer(Colours.FADE)
                .text(`## 👀 Watch List\n${watches.map(w => `• **${w.cosmetic}**`).join('\n')}`)
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        // ── News ──────────────────────────────────────────────────────────────
        if (sub === 'news') {
            await interaction.deferReply();
            const news = await getNews().catch(() => null);
            if (!news?.length) {
                await interaction.editReply(`${e('error')} Could not fetch news.`);
                return;
            }
            const lines = news.slice(0, 5).map(n => `**${n.title}**\n${n.body}`).join('\n\n');
            const card  = new FadeContainer(0x00D4FF)
                .text(`## 📰 Fortnite News\n\n${lines}`);
            if (news[0]?.image) card.gallery([{ url: news[0].image }]);
            await interaction.editReply({ components: [card.build()], flags: MessageFlags.IsComponentsV2 } as any);
        }
    },

    async prefixExecute(message, args) {
        const sub = args[0]?.toLowerCase();

        if (!sub || sub === 'shop') {
            const items = await getShop().catch(() => null);
            if (!items?.length) { await message.reply(`${e('error')} Could not fetch shop.`); return; }
            const lines = items.slice(0, 15).map(i => `**${i.name}** · ${i.price} V-Bucks`).join('\n');
            const card  = new FadeContainer(0x00D4FF).text(`## 🛒 Fortnite Item Shop\n${lines}`).build();
            await sendMessage(message, [card]);
        } else if (sub === 'item') {
            const name = args.slice(1).join(' ');
            if (!name) { await message.reply(`${e('error')} Usage: \`f!fortnite item <name>\``); return; }
            const item = await searchCosmetic(name).catch(() => null);
            if (!item) { await message.reply(`${e('error')} Cosmetic not found.`); return; }
            const card = new FadeContainer(rarityColor(item.rarity))
                .text(`## ${item.name}\n-# ${item.type} · ${item.rarity}\n\n${item.description}`);
            if (item.image) card.gallery([{ url: item.image }]);
            await sendMessage(message, [card.build()]);
        } else if (sub === 'watch') {
            const cosmetic = args.slice(1).join(' ');
            if (!cosmetic) { await message.reply(`${e('error')} Usage: \`f!fortnite watch <cosmetic>\``); return; }
            const result = await toggleWatch(message.author.id, cosmetic);
            const card   = new FadeContainer(result === 'added' ? Colours.SUCCESS : Colours.DANGER)
                .text(result === 'added' ? `${e('success')}  Watching **${cosmetic}**` : `${e('success')}  Removed **${cosmetic}**`)
                .build();
            await sendMessage(message, [card]);
        } else if (sub === 'news') {
            const news = await getNews().catch(() => null);
            if (!news?.length) { await message.reply(`${e('error')} Could not fetch news.`); return; }
            const lines = news.slice(0, 3).map(n => `**${n.title}**\n${n.body}`).join('\n\n');
            const card  = new FadeContainer(0x00D4FF).text(`## 📰 Fortnite News\n\n${lines}`).build();
            await sendMessage(message, [card]);
        }
    },

    aliases: ['fn'],
} satisfies Command;
