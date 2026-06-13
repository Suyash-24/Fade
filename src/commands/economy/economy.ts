// src/commands/economy/economy.ts
// Admin economy management: setup, additem, removeitem, give, take, reset
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendMessage } from '../../components/builders.js';
import {
    getEconomyConfig,
    updateEconomyConfig,
    addShopItem,
    removeShopItem,
    getShopItems,
    adminGive,
    adminTake,
    adminReset,
} from '../../db/queries/economy.js';
import { e, Colours } from '../../components/emojis.js';

// ── Helpers ───────────────────────────────────────────────────────────────────

function usageCard(text: string) {
    return new FadeContainer(Colours.FADE).text(text).build();
}

function errorCard(text: string) {
    return new FadeContainer(Colours.DANGER).text(`${e('error')}  ${text}`).build();
}

function successCard(text: string) {
    return new FadeContainer(Colours.SUCCESS).text(`${e('success')}  ${text}`).build();
}

// ── Subcommand handlers ───────────────────────────────────────────────────────

async function handleSetup(message: any, args: string[], guildId: string) {
    // f!economy setup
    const config = await getEconomyConfig(guildId);
    const cur    = config.currencyEmoji;
    const name   = config.currencyName;

    const card = new FadeContainer(Colours.FADE)
        .text(`## ${e('settings')} Economy Configuration`)
        .separator(true)
        .text([
            `**Status** — \`${config.enabled ? 'Enabled' : 'Disabled'}\``,
            `**Currency** — ${cur} \`${name}\``,
            `**Daily** — \`${config.dailyAmount}\` ${cur} (streak bonus: ${config.streakBonus ? 'on' : 'off'})`,
            `**Work** — \`${config.workMin}–${config.workMax}\` ${cur}`,
            `**Rob** — \`${config.robEnabled ? 'Enabled' : 'Disabled'}\` · success rate: \`${config.robSuccessRate}%\` · min target balance: \`${config.robMinBalance}\` · fail penalty: \`${config.robFailPenalty}\``,
            `**Max Bet** — \`${config.maxBet === 0 ? 'Unlimited' : config.maxBet.toLocaleString()}\``,
        ].join('\n'))
        .separator(false)
        .text(
            `-# Subcommands: \`f!economy toggle\`, \`f!economy currency <name> <emoji>\`,\n` +
            `-# \`f!economy daily <amount>\`, \`f!economy work <min> <max>\`,\n` +
            `-# \`f!economy rob <on|off>\`, \`f!economy robrate <0-100>\`,\n` +
            `-# \`f!economy maxbet <amount|0>\`, \`f!economy streak <on|off>\``
        )
        .build();

    await sendMessage(message, [card]);
}

async function handleToggle(message: any, args: string[], guildId: string) {
    const val = args[0]?.toLowerCase();
    if (val !== 'on' && val !== 'off') {
        await sendMessage(message, [errorCard('Usage: `f!economy toggle <on|off>`')]); return;
    }
    const enabled = val === 'on';
    await updateEconomyConfig(guildId, { enabled });
    await sendMessage(message, [successCard(`Economy **${enabled ? 'enabled' : 'disabled'}**.`)]);
}

async function handleCurrency(message: any, args: string[], guildId: string) {
    // f!economy currency <name> <emoji>
    const [, ...rest] = args; // args[0] = 'currency'
    const parts = rest;
    if (parts.length < 2) {
        await sendMessage(message, [errorCard('Usage: `f!economy currency <name> <emoji>`\nExample: `f!economy currency dollars 💵`')]); return;
    }
    const emoji = parts[parts.length - 1];
    const name  = parts.slice(0, -1).join(' ');
    await updateEconomyConfig(guildId, { currencyName: name, currencyEmoji: emoji });
    await sendMessage(message, [successCard(`Currency set to **${emoji} ${name}**.`)]);
}

async function handleDaily(message: any, args: string[], guildId: string) {
    const amount = parseInt(args[0] ?? '', 10);
    if (isNaN(amount) || amount < 1) {
        await sendMessage(message, [errorCard('Usage: `f!economy daily <amount>`')]); return;
    }
    await updateEconomyConfig(guildId, { dailyAmount: amount });
    await sendMessage(message, [successCard(`Daily reward set to **${amount}**.`)]);
}

async function handleWork(message: any, args: string[], guildId: string) {
    const min = parseInt(args[0] ?? '', 10);
    const max = parseInt(args[1] ?? '', 10);
    if (isNaN(min) || isNaN(max) || min < 1 || max < min) {
        await sendMessage(message, [errorCard('Usage: `f!economy work <min> <max>` (min must be ≤ max)')]); return;
    }
    await updateEconomyConfig(guildId, { workMin: min, workMax: max });
    await sendMessage(message, [successCard(`Work range set to **${min}–${max}**.`)]);
}

async function handleRob(message: any, args: string[], guildId: string) {
    const val = args[0]?.toLowerCase();
    if (val !== 'on' && val !== 'off') {
        await sendMessage(message, [errorCard('Usage: `f!economy rob <on|off>`')]); return;
    }
    await updateEconomyConfig(guildId, { robEnabled: val === 'on' });
    await sendMessage(message, [successCard(`Rob is now **${val}**.`)]);
}

async function handleRobRate(message: any, args: string[], guildId: string) {
    const rate = parseInt(args[0] ?? '', 10);
    if (isNaN(rate) || rate < 0 || rate > 100) {
        await sendMessage(message, [errorCard('Usage: `f!economy robrate <0-100>`')]); return;
    }
    await updateEconomyConfig(guildId, { robSuccessRate: rate });
    await sendMessage(message, [successCard(`Rob success rate set to **${rate}%**.`)]);
}

async function handleMaxBet(message: any, args: string[], guildId: string) {
    const amount = parseInt(args[0] ?? '', 10);
    if (isNaN(amount) || amount < 0) {
        await sendMessage(message, [errorCard('Usage: `f!economy maxbet <amount>` (0 = unlimited)')]); return;
    }
    await updateEconomyConfig(guildId, { maxBet: amount });
    await sendMessage(message, [successCard(`Max bet set to **${amount === 0 ? 'unlimited' : amount}**.`)]);
}

async function handleStreak(message: any, args: string[], guildId: string) {
    const val = args[0]?.toLowerCase();
    if (val !== 'on' && val !== 'off') {
        await sendMessage(message, [errorCard('Usage: `f!economy streak <on|off>`')]); return;
    }
    await updateEconomyConfig(guildId, { streakBonus: val === 'on' });
    await sendMessage(message, [successCard(`Daily streak bonus is now **${val}**.`)]);
}

async function handleAddItem(message: any, args: string[], guildId: string) {
    // f!economy additem <name> | <price> [role @role] [stock <n>] [desc <text>]
    // Simplest usage: f!economy additem VIP Role 500 role @RoleMention
    // Or: f!economy additem Cool Hat 200
    const config = await getEconomyConfig(guildId);
    const cur    = config.currencyEmoji;

    // Parse: name, price, optional role mention, optional stock, optional desc
    // Format: f!economy additem <name (can be multi-word)> <price> [role] [stock N] [desc ...]
    // We find price as the first all-numeric arg
    let priceIdx = -1;
    for (let i = 0; i < args.length; i++) {
        if (/^\d+$/.test(args[i])) { priceIdx = i; break; }
    }

    if (priceIdx <= 0) {
        await sendMessage(message, [usageCard(
            `**Usage:** \`f!economy additem <name> <price> [role] [stock N] [desc text]\`\n\n` +
            `**Examples:**\n` +
            `\`f!economy additem VIP 500\`\n` +
            `\`f!economy additem VIP Role 1000 @RoleMention\`\n` +
            `\`f!economy additem Lucky Box 200 stock 5 desc A mystery prize!\``
        )]); return;
    }

    const name  = args.slice(0, priceIdx).join(' ');
    const price = parseInt(args[priceIdx], 10);

    if (!name || isNaN(price) || price < 1) {
        await sendMessage(message, [errorCard('Name must be non-empty and price must be ≥ 1.')]); return;
    }

    const rest = args.slice(priceIdx + 1);

    // Find role mention
    const roleId = message.mentions.roles.first()?.id ?? null;
    const type   = roleId ? 'role' : 'custom';

    // Parse stock
    let stock = -1;
    const stockIdx = rest.findIndex(r => r.toLowerCase() === 'stock');
    if (stockIdx !== -1 && rest[stockIdx + 1]) {
        const s = parseInt(rest[stockIdx + 1], 10);
        if (!isNaN(s) && s >= 0) stock = s;
    }

    // Parse desc
    let description: string | undefined;
    const descIdx = rest.findIndex(r => r.toLowerCase() === 'desc');
    if (descIdx !== -1) {
        description = rest.slice(descIdx + 1).filter(w => !/^\d+$/.test(w)).join(' ');
    }

    const item = await addShopItem(guildId, { name, price, type, roleId, stock, description: description ?? null, enabled: true });

    const card = new FadeContainer(Colours.SUCCESS)
        .text(`## ✅ Item Added to Shop`)
        .separator(true)
        .text(
            `**Name** — ${name}\n` +
            `${cur}  **Price** — \`${price.toLocaleString()}\`\n` +
            `**Type** — ${type}${roleId ? ` (<@&${roleId}>)` : ''}\n` +
            `**Stock** — ${stock === -1 ? 'Unlimited' : stock}\n` +
            (description ? `**Description** — ${description}\n` : '') +
            `-# Item ID: \`${item.id}\``
        )
        .build();

    await sendMessage(message, [card]);
}

async function handleRemoveItem(message: any, args: string[], guildId: string) {
    const config = await getEconomyConfig(guildId);
    const cur    = config.currencyEmoji;

    // Support removal by position (from f!shop list) or by ID
    const input = args[0];
    if (!input) {
        await sendMessage(message, [errorCard('Usage: `f!economy removeitem <id|position>`')]); return;
    }

    let itemId: number | null = null;
    const n = parseInt(input, 10);

    if (!isNaN(n) && n > 0) {
        const items = await getShopItems(guildId);
        // Try by position first
        if (n <= items.length) {
            itemId = items[n - 1].id;
        } else {
            itemId = n; // fallback: treat as raw ID
        }
    }

    if (itemId === null) {
        await sendMessage(message, [errorCard('Provide a valid item number from `f!shop`.')]); return;
    }

    const removed = await removeShopItem(guildId, itemId);
    if (!removed) {
        await sendMessage(message, [errorCard(`Item #${itemId} not found.`)]); return;
    }
    await sendMessage(message, [successCard(`Item #${itemId} removed from the shop.`)]);
}

async function handleGive(message: any, args: string[], guildId: string) {
    const config = await getEconomyConfig(guildId);
    const cur    = config.currencyEmoji;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    const target = targetId ? await message.client.users.fetch(targetId).catch(() => null) : null;
    const amount = parseInt(args.find((a: string) => /^\d+$/.test(a)) ?? '', 10);

    if (!target || isNaN(amount) || amount < 1) {
        await sendMessage(message, [errorCard('Usage: `f!economy give @user <amount>`')]); return;
    }

    const wallet = await adminGive(guildId, target.id, amount);
    const member = message.guild?.members.cache.get(target.id);
    const name   = member?.displayName ?? target.username;

    const card = new FadeContainer(Colours.SUCCESS)
        .text(`## ${e('success')} Coins Granted`)
        .separator(true)
        .text(
            `${cur}  **Given to ${name}** — \`+${amount.toLocaleString()}\`\n` +
            `💰  **Their Wallet** — \`${wallet.balance.toLocaleString()}\``
        )
        .build();
    await sendMessage(message, [card]);
}

async function handleTake(message: any, args: string[], guildId: string) {
    const config = await getEconomyConfig(guildId);
    const cur    = config.currencyEmoji;
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    const target = targetId ? await message.client.users.fetch(targetId).catch(() => null) : null;
    const amount = parseInt(args.find((a: string) => /^\d+$/.test(a)) ?? '', 10);

    if (!target || isNaN(amount) || amount < 1) {
        await sendMessage(message, [errorCard('Usage: `f!economy take @user <amount>`')]); return;
    }

    const wallet = await adminTake(guildId, target.id, amount);
    const member = message.guild?.members.cache.get(target.id);
    const name   = member?.displayName ?? target.username;

    const card = new FadeContainer(Colours.WARNING)
        .text(`## ${e('warn')} Coins Deducted`)
        .separator(true)
        .text(
            `${cur}  **Taken from ${name}** — \`-${amount.toLocaleString()}\`\n` +
            `💰  **Their Wallet** — \`${wallet.balance.toLocaleString()}\``
        )
        .build();
    await sendMessage(message, [card]);
}

async function handleReset(message: any, args: string[], guildId: string) {
    const targetId = args[0]?.replace(/[<@!>]/g, '');
    const target = targetId ? await message.client.users.fetch(targetId).catch(() => null) : null;
    if (!target) {
        await sendMessage(message, [errorCard('Usage: `f!economy reset @user`')]); return;
    }

    await adminReset(guildId, target.id);
    const member = message.guild?.members.cache.get(target.id);
    const name   = member?.displayName ?? target.username;
    await sendMessage(message, [successCard(`**${name}**'s wallet has been reset to zero.`)]);
}

// ── Command export ────────────────────────────────────────────────────────────

export default {
    data: new SlashCommandBuilder()
        .setName('economy')
        .setDescription('Economy administration'),

    category:        'economy',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    aliases:         ['economy', 'eco'],
    cooldown:        3,

    async execute(interaction) {
        await interaction.reply({ content: 'Economy admin commands are prefix-only. Use `f!economy`.', flags: 64 });
    },

    async prefixExecute(message, args) {
        // Check Manage Guild permission
        if (!message.member?.permissions.has(PermissionFlagsBits.ManageGuild)) {
            const card = new FadeContainer(Colours.DANGER)
                .text(`${e('error')}  You need **Manage Guild** permission to use economy admin commands.`)
                .build();
            await sendMessage(message, [card]); return;
        }

        const sub     = args[0]?.toLowerCase();
        const subArgs = args.slice(1);
        const guildId = message.guild!.id;

        switch (sub) {
            case 'setup':        await handleSetup(message, subArgs, guildId); return;
            case 'toggle':       await handleToggle(message, subArgs, guildId); return;
            case 'currency':     await handleCurrency(message, [sub, ...subArgs], guildId); return;
            case 'daily':        await handleDaily(message, subArgs, guildId); return;
            case 'work':         await handleWork(message, subArgs, guildId); return;
            case 'rob':          await handleRob(message, subArgs, guildId); return;
            case 'robrate':      await handleRobRate(message, subArgs, guildId); return;
            case 'maxbet':       await handleMaxBet(message, subArgs, guildId); return;
            case 'streak':       await handleStreak(message, subArgs, guildId); return;
            case 'additem':      await handleAddItem(message, subArgs, guildId); return;
            case 'removeitem':   await handleRemoveItem(message, subArgs, guildId); return;
            case 'give':         await handleGive(message, subArgs, guildId); return;
            case 'take':         await handleTake(message, subArgs, guildId); return;
            case 'reset':        await handleReset(message, subArgs, guildId); return;
            default: {
                const card = new FadeContainer(Colours.FADE)
                    .text(`## ${e('settings')} Economy Admin Commands`)
                    .separator(true)
                    .text([
                        '`f!economy setup` — View current config',
                        '`f!economy toggle <on|off>` — Enable/disable',
                        '`f!economy currency <name> <emoji>` — Set currency',
                        '`f!economy daily <amount>` — Set daily reward',
                        '`f!economy streak <on|off>` — Toggle streak bonus',
                        '`f!economy work <min> <max>` — Set work range',
                        '`f!economy rob <on|off>` — Toggle rob',
                        '`f!economy robrate <0-100>` — Rob success rate',
                        '`f!economy maxbet <amount|0>` — Max gambling bet',
                        '`f!economy additem <name> <price> [role] [stock N] [desc ...]`',
                        '`f!economy removeitem <id>` — Remove shop item',
                        '`f!economy give @user <amount>` — Grant coins',
                        '`f!economy take @user <amount>` — Deduct coins',
                        '`f!economy reset @user` — Reset wallet',
                    ].join('\n'))
                    .build();
                await sendMessage(message, [card]); return;
            }
        }
    },
} satisfies Command;
