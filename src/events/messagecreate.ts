// src/events/messageCreate.ts
import { MessageFlags, PermissionsBitField } from 'discord.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { logger } from '../utils/logger.js';
import { isBotOwner } from '../utils/owner.js';
import { getAlias } from '../db/queries/commandAliases.js';
import { checkCommandRestrictions } from '../utils/commandCheck.js';
import { handleStickyMessage } from '../utils/stickyMessages.js';
import { e } from '../components/emojis.js';
import { getPrefix } from '../db/queries/guilds.js';
import { getNoPrefixUser } from '../db/queries/noPrefix.js';
import { FadeContainer, sendMessage, thumb } from '../components/builders.js';
import { getGuildRoleAliases, getReqRole } from '../db/queries/roleAliases.js';
import { incrementScrapbookMessageCount } from '../db/queries/scrapbook.js';
import { askBrain, isAiEnabled } from '../utils/aiMemory.js';

// Per-user AI cooldown (10 seconds)
const aiCooldowns = new Map<string, number>();

// Per-guild alias cache: guildId → Map<alias, command>
const aliasCache = new Map<string, { data: Map<string, string>; expiresAt: number }>();
const TTL = 5 * 60 * 1_000;

async function resolveGuildAlias(guildId: string, name: string): Promise<string | null> {
    let cached = aliasCache.get(guildId);
    if (!cached || cached.expiresAt < Date.now()) {
        // Lazy per-key lookup — only fetch the specific alias hit
        cached = { data: new Map(), expiresAt: Date.now() + TTL };
        aliasCache.set(guildId, cached);
    }
    if (cached.data.has(name)) return cached.data.get(name)!;
    const row = await getAlias(guildId, name);
    if (row) cached.data.set(name, row.command);
    return row?.command ?? null;
}

export function invalidateAliasCache(guildId: string) {
    aliasCache.delete(guildId);
}

const event: Event<'messageCreate'> = {
    name: 'messageCreate',

    async execute(client: FadeClient, message) {
        if (message.author.bot || !message.guild) return;

        const guild = message.guild;

        const DEFAULT_PREFIX = process.env.DEFAULT_PREFIX ?? 'f!';
        const guildPrefix    = await getPrefix(guild.id); // cached, fast

        // ── Bot Mention Handler ───────────────────────────────────────────
        if (client.user?.id && (message.content === `<@${client.user.id}>` || message.content === `<@!${client.user.id}>`)) {
            const lines = [
                `Hello! I'm **${client.user.username}**, an all-in-one community bot.`,
                '',
                `✦ **Default Prefix:** \`${DEFAULT_PREFIX}\``
            ];
            
            if (guildPrefix && guildPrefix !== DEFAULT_PREFIX) {
                lines.push(`✦ **Server Prefix:** \`${guildPrefix}\``);
                lines.push(`*(You can use either prefix in this server!)*`);
            }
            
            lines.push('');
            lines.push('Need help? Use the `help` command to see everything I can do!');
            lines.push('🌐 **[Website](https://fadebot.me/)**');

            const card = new FadeContainer()
                .section(
                    [`**Hey there! ✨**\n${lines.join('\n')}`],
                    thumb(client.user.displayAvatarURL({ size: 256 }))
                )
                .build();
                
            await sendMessage(message, [card]);
            return;
        }

        // ── AI Brain Handler (mention with a question) ─────────────────────
        const mentionRegex = new RegExp(`^<@!?${client.user?.id}>\\s+`);
        if (client.user?.id && mentionRegex.test(message.content)) {
            const question = message.content.replace(mentionRegex, '').trim();

            if (question.length > 3 && await isAiEnabled(guild.id)) {
                const cooldownKey = `${guild.id}:${message.author.id}`;
                const now = Date.now();
                const lastUsed = aiCooldowns.get(cooldownKey) ?? 0;

                if (now - lastUsed < 10_000) {
                    await message.react('⏳').catch(() => {});
                    return;
                }
                aiCooldowns.set(cooldownKey, now);

                // Show typing while we compute
                await message.channel.sendTyping().catch(() => {});

                try {
                    const result = await askBrain(guild.id, question);

                    if (!result) {
                        // No relevant memory found
                        const card = new FadeContainer()
                            .text(`🧠 I don't have any information about that yet. Ask an admin to use \`f!memory add\` to teach me!`)
                            .build();
                        await sendMessage(message, [card]);
                        return;
                    }

                    const card = new FadeContainer()
                        .text(`${result.answer}\n\n-# 🧠 Fade remembers · Powered by ${result.provider}`)
                        .build();
                    await sendMessage(message, [card]);
                } catch (err) {
                    logger.error('[AI] Brain error', err);
                    await message.reply('❌ Something went wrong searching my memory.').catch(() => {});
                }
                return;
            }
        }

        // Resolve which prefix was used — custom prefix OR always-on default
        let prefix: string | null = null;
        let isNoPrefix = false;

        if (message.content.startsWith(guildPrefix)) {
            prefix = guildPrefix;
        } else if (guildPrefix !== DEFAULT_PREFIX && message.content.startsWith(DEFAULT_PREFIX)) {
            prefix = DEFAULT_PREFIX;
        } else {
            const noPrefixData = await getNoPrefixUser(message.author.id);
            if (noPrefixData) {
                // If the user has no-prefix, we treat empty string as prefix
                prefix = '';
                isNoPrefix = true;
            }
        }

        const handlePrefixCommand = async () => {
            if (prefix === null) return;

            const args        = message.content.slice(prefix.length).trim().split(/\s+/);
            const commandName = args.shift()?.toLowerCase();
            if (!commandName) return;

            // 1. Built-in command aliases (from command files)
            // 2. Guild-specific aliases (from DB)
            const builtIn  = client.aliases.get(commandName) ?? commandName;
            const guildCmd = client.commands.has(builtIn)
                ? builtIn
                : await resolveGuildAlias(guild.id, commandName) ?? builtIn;
            
            const command  = client.commands.get(guildCmd);
            if (!command?.prefixExecute) {
                // Check custom role aliases
                const roleAliasesMap = await getGuildRoleAliases(guild.id);
                if (roleAliasesMap.has(commandName)) {
                    const roleId = roleAliasesMap.get(commandName)!;
                    const targetId = args[0]?.replace(/\D/g, '');
                    if (!targetId) return; // Silent if no explicit mention

                    // Check permissions
                    const reqroleId = await getReqRole(guild.id);
                    let hasPerm = message.member!.permissions.has(PermissionsBitField.Flags.ManageRoles) || 
                                  message.member!.permissions.has(PermissionsBitField.Flags.ManageGuild) || 
                                  message.member!.permissions.has(PermissionsBitField.Flags.Administrator);
                    if (!hasPerm && reqroleId) {
                        hasPerm = message.member!.roles.cache.has(reqroleId);
                    }

                    if (!hasPerm) {
                        const reqRoleName = reqroleId ? `<@&${reqroleId}>` : '`Manage Roles`';
                        const card = new FadeContainer()
                            .text(`${e('error')} **Permission Denied**`)
                            .separator()
                            .text(`You need ${reqRoleName} to use this command.`)
                            .build();
                        await sendMessage(message, [card]);
                        return;
                    }

                    const role = guild.roles.cache.get(roleId);
                    if (!role) return; // Role might have been deleted

                    if (role.position >= guild.members.me!.roles.highest.position) {
                        const card = new FadeContainer()
                            .text(`${e('error')} **Hierarchy Error**`)
                            .separator()
                            .text(`I cannot manage this role as it is higher than my highest role.`)
                            .build();
                        await sendMessage(message, [card]);
                        return;
                    }

                    let targetMember = null;
                    try {
                        targetMember = await guild.members.fetch(targetId);
                    } catch {}
                    if (!targetMember) return;

                    const card = new FadeContainer();
                    if (targetMember.roles.cache.has(role.id)) {
                        await targetMember.roles.remove(role);
                        card.text(`${e('success')} Removed **${role.name}** from ${targetMember.user.tag}`);
                    } else {
                        await targetMember.roles.add(role);
                        card.text(`${e('success')} Added **${role.name}** to ${targetMember.user.tag}`);
                    }
                    await sendMessage(message, [card.build()]);
                }
                return;
            }

            // ── Bot permission check ──────────────────────────────────────────
            if (command.botPermissions?.length) {
                const botMember = guild.members.me;
                if (botMember) {
                    const missing = command.botPermissions.filter(
                        p => !botMember.permissions.has(p)
                    );
                    if (missing.length) {
                        const names = new PermissionsBitField(missing).toArray();
                        await message.reply(
                            `❌ I'm missing permissions: ${names.map(n => `\`${n}\``).join(', ')}`
                        );
                        return;
                    }
                }
            }

            // ── User permission check ─────────────────────────────────────────
            if (command.userPermissions?.length) {
                const missing = command.userPermissions.filter(
                    p => !message.member!.permissions.has(p)
                );
                if (missing.length) {
                    const names = new PermissionsBitField(missing).toArray();
                    await message.reply(
                        `❌ You need: ${names.map(n => `\`${n}\``).join(', ')}`
                    );
                    return;
                }
            }

            // ── Owner-only guard ──────────────────────────────────────────────
            if (command.ownerOnly) {
                if (!(await isBotOwner(client, message.author.id))) {
                    await message.reply('❌ This command is restricted to the bot owner.');
                    return;
                }
            }

            // ── Cooldown check ────────────────────────────────────────────────
            const key      = `${message.author.id}:${guildCmd}`;
            const cooldown = (command.cooldown ?? 3) * 1_000;
            const now      = Date.now();
            const expiry   = client.cooldowns.get(key);

            if (expiry && now < expiry) {
                const remaining = ((expiry - now) / 1_000).toFixed(1);
                await message.reply(`⏳ Wait **${remaining}s** before using this command again.`);
                return;
            }

            client.cooldowns.set(key, now + cooldown);
            setTimeout(() => client.cooldowns.delete(key), cooldown);

            // ── Command Restrictions ──────────────────────────────────────────
            const blockReason = await checkCommandRestrictions(
                guild.id,
                message.channelId,
                message.member!,
                guildCmd,
                command.category
            );

            if (blockReason) {
                await message.reply(`${e('error')} ${blockReason}`);
                return;
            }

            // ── Execute ───────────────────────────────────────────────────────
            try {
                await command.prefixExecute(message, args, client);
            } catch (err) {
                logger.error(`Prefix command failed: ${commandName}`, err, {
                    user:  message.author.tag,
                    guild: guild.id,
                });
                await message.reply('❌ Something went wrong. Please try again.').catch(() => null);
            }
        };

        await handlePrefixCommand();
        await handleStickyMessage(message);

        // Track for Weekly Scrapbook
        await incrementScrapbookMessageCount(guild.id, message.author.id).catch(() => null);
    },
};

export default event;