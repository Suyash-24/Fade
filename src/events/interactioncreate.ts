// src/events/interactionCreate.ts
import { ChatInputCommandInteraction, MessageFlags, PermissionsBitField, ModalBuilder, ActionRowBuilder, TextInputBuilder, TextInputStyle, type InteractionReplyOptions, GuildMember } from 'discord.js';
import { updateWelcomeConfig, getWelcomeConfig, updateGoodbyeConfig, getGoodbyeConfig } from '../db/queries/welcome.js';
import { getLevelConfig, updateLevelConfig } from '../db/queries/leveling.js';
import { buildScriptedEmbed, buildScriptedCard, buildEmbedBuilderPanel, buildCardBuilderPanel, updateEmbedScriptField, updateCardScriptField } from '../utils/welcomecard.js';
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { updateResponse } from '../components/builders.js';
import { checkCommandRestrictions } from '../utils/commandCheck.js';
import { logger } from '../utils/logger.js';
import { isBotOwner } from '../utils/owner.js';
import { e } from '../components/emojis.js';
import { resolveCommandError } from '../utils/commandError.js';

const event: Event<'interactionCreate'> = {
    name: 'interactionCreate',

    async execute(client: FadeClient, interaction) {

        // ── Slash commands ────────────────────────────────────────────────────
        if (interaction.isChatInputCommand()) {
            const command = client.commands.get(interaction.commandName);
            if (!command) return;

            // Guild-only guard
            if (command.guildOnly && !interaction.inGuild()) {
                await interaction.reply({
                    content: '❌ This command can only be used inside a server.',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            // ── Bot permission check ──────────────────────────────────────────
            if (command.botPermissions?.length && interaction.guild) {
                const botMember = interaction.guild.members.me;
                if (botMember) {
                    const missing = command.botPermissions.filter(
                        p => !botMember.permissions.has(p)
                    );
                    if (missing.length) {
                        const names = new PermissionsBitField(missing).toArray();
                        await interaction.reply({
                            content: `❌ I'm missing the following permissions to run this command:\n${names.map(n => `\`${n}\``).join(', ')}`,
                            flags: MessageFlags.Ephemeral,
                        });
                        return;
                    }
                }
            }

            // ── User permission check ─────────────────────────────────────────
            if (command.userPermissions?.length && interaction.inGuild()) {
                const member = interaction.member;
                const memberPerms = new PermissionsBitField(
                    BigInt(
                        typeof member.permissions === 'string'
                            ? member.permissions
                            : member.permissions.bitfield.toString()
                    )
                );
                const missing = command.userPermissions.filter(
                    p => !memberPerms.has(p)
                );
                if (missing.length) {
                    const names = new PermissionsBitField(missing).toArray();
                    await interaction.reply({
                        content: `❌ You need the following permissions to use this command:\n${names.map(n => `\`${n}\``).join(', ')}`,
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
            }

            // ── Owner-only guard ──────────────────────────────────────────────
            if (command.ownerOnly && !(await isBotOwner(client, interaction.user.id))) {
                await interaction.reply({
                    content: '❌ This command is restricted to the bot owner.',
                    flags: MessageFlags.Ephemeral,
                });
                return;
            }

            // ── Cooldown check ────────────────────────────────────────────────
            const key      = `${interaction.user.id}:${interaction.commandName}`;
            const cooldown = (command.cooldown ?? 3) * 1_000;
            const now      = Date.now();
            const expiry   = client.cooldowns.get(key);

            if (expiry && now < expiry) {
                const remaining = ((expiry - now) / 1_000).toFixed(1);
                await interaction.reply({
                    content: `⏳ Wait **${remaining}s** before using \`/${interaction.commandName}\` again.`,
                    flags: MessageFlags.Ephemeral,
                });
                setTimeout(() => interaction.deleteReply().catch(() => null), expiry - now);
                return;
            }

            client.cooldowns.set(key, now + cooldown);
            setTimeout(() => client.cooldowns.delete(key), cooldown);

            // ── Command Restrictions ──────────────────────────────────────────
            if (interaction.guild && interaction.member) {
                const blockReason = await checkCommandRestrictions(
                    interaction.guild.id,
                    interaction.channelId,
                    interaction.member as GuildMember,
                    interaction.commandName,
                    command.category
                );

                if (blockReason) {
                    await interaction.reply({
                        content: `${e('error')} ${blockReason}`,
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
            }

            // ── Execute ───────────────────────────────────────────────────────
            if (!command.execute) return;
            try {
                await command.execute(
                    interaction as ChatInputCommandInteraction,
                    client,
                );
            } catch (err) {
                const msg = resolveCommandError(err, {
                    commandName: interaction.commandName,
                    userId:      interaction.user.tag,
                    guildId:     interaction.guildId ?? 'DM',
                });

                const reply: InteractionReplyOptions = { content: msg, flags: MessageFlags.Ephemeral };
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp(reply).catch(() => null);
                } else {
                    await interaction.reply(reply).catch(() => null);
                }
            }
        }

        // ── Autocomplete ──────────────────────────────────────────────────────
        if (interaction.isAutocomplete()) {
            const command = client.commands.get(interaction.commandName);
            if (command?.autocomplete) {
                try {
                    await command.autocomplete(interaction, client);
                } catch (err) {
                    logger.error(`Autocomplete failed: /${interaction.commandName}`, err);
                }
            }
            return;
        }

        // ── Button / component interactions ───────────────────────────────────
        if (interaction.isMessageComponent()) {
            const id = interaction.customId;

            try {
                // Blackjack buttons
                if (id === 'bj_hit' || id === 'bj_stand' || id === 'bj_double') {
                    const { handleBJButton } = await import('../commands/fun/blackjack.js');
                    await handleBJButton(interaction);
                    return;
                }

                // Trivia buttons
                if (id.startsWith('trivia_')) {
                    const { handleTriviaButton } = await import('../commands/fun/trivia.js');
                    await handleTriviaButton(interaction);
                    return;
                }

                // Poll buttons
                if (id.startsWith('poll:')) {
                    if (!interaction.isButton()) return;
                    const { db } = await import('../db/index.js');
                    const { polls } = await import('../db/schema.js');
                    const { eq } = await import('drizzle-orm');
                    const { buildPollEmbed, buildPollButtons } = await import('../commands/utility/poll.js');

                    const parts = id.split(':');
                    const action = parts[1];
                    const pollId = parseInt(parts[2]);

                    const [poll] = await db.select().from(polls).where(eq(polls.id, pollId)).limit(1);
                    if (!poll || poll.guildId !== interaction.guildId) {
                        await interaction.reply({ content: `${e('error')} Poll not found.`, flags: MessageFlags.Ephemeral }); return;
                    }
                    if (poll.status === 'ended') {
                        await interaction.reply({ content: `${e('error')} This poll has ended.`, flags: MessageFlags.Ephemeral }); return;
                    }

                    if (action === 'end') {
                        if (poll.hostId !== interaction.user.id && !(interaction.member as any)?.permissions?.has?.('ManageGuild')) {
                            await interaction.reply({ content: `${e('error')} Only the poll host or admins can end this poll.`, flags: MessageFlags.Ephemeral }); return;
                        }
                        await db.update(polls).set({ status: 'ended' }).where(eq(polls.id, pollId));
                        const embed = buildPollEmbed(poll.question, poll.options, poll.votes ?? {}, 'ended', poll.endsAt);
                        const components = buildPollButtons(pollId, poll.options, 'ended');
                        await interaction.update({ embeds: [embed], components }); return;
                    }

                    if (action === 'vote') {
                        const optionIndex = parts[3];
                        const userId = interaction.user.id;
                        const currentVotes: Record<string, string[]> = { ...(poll.votes ?? {}) };

                        // Remove existing vote if any
                        for (const key of Object.keys(currentVotes)) {
                            currentVotes[key] = currentVotes[key].filter((id: string) => id !== userId);
                        }

                        // If user voted for a different option (toggle off if same)
                        const existing = Object.entries(currentVotes).find(([, v]) => (v as string[]).includes(userId));
                        if (!existing || existing[0] !== optionIndex) {
                            if (!currentVotes[optionIndex]) currentVotes[optionIndex] = [];
                            currentVotes[optionIndex].push(userId);
                        }

                        await db.update(polls).set({ votes: currentVotes }).where(eq(polls.id, pollId));
                        const embed = buildPollEmbed(poll.question, poll.options, currentVotes, 'active', poll.endsAt);
                        const components = buildPollButtons(pollId, poll.options, 'active');
                        await interaction.update({ embeds: [embed], components }); return;
                    }

                    return;
                }

                if (id === 'ping_refresh') {
                    const { buildPing } = await import('../commands/general/ping.js');
                    let ping = interaction.client.ws.ping;
                    if (ping === -1) {
                        ping = Math.abs(Date.now() - interaction.createdTimestamp);
                    }
                    const container = buildPing(
                        ping,
                        interaction.guild?.shardId ?? 0,
                        interaction.client,
                        interaction.guild,
                    );
                    await updateResponse(interaction, [container], true);
                    return;
                }

                if (id === 'serverinfo_refresh' && interaction.guild) {
                    const { buildServerInfo } = await import('../commands/general/serverinfo.js');
                    const container = await buildServerInfo(interaction.guild);
                    await updateResponse(interaction, [container]);
                    return;
                }

                // steal — Add as Emoji / Add as Sticker
                if (id.startsWith('steal_add_')) {
                    if (!interaction.guild || !interaction.member) return;
                    const { hasPermission } = await import('../utils/fakePerms.js');
                    const canManage = await hasPermission(interaction.member as any, 'manage_guild_expressions');
                    if (!canManage) {
                        await interaction.reply({ content: `${e('error')} You need **Manage Expressions** permission.`, flags: MessageFlags.Ephemeral });
                        return;
                    }

                    // customId format: steal_add_<type>|<name>|<url>
                    // (Falls back to _ for older broken buttons)
                    const withoutPrefix = id.slice('steal_add_'.length);
                    const delimiter     = withoutPrefix.includes('|') ? '|' : '_';
                    const typeEnd       = withoutPrefix.indexOf(delimiter);
                    const assetType     = withoutPrefix.slice(0, typeEnd);
                    const rest          = withoutPrefix.slice(typeEnd + 1);
                    const nameEnd       = rest.indexOf(delimiter);
                    const assetName     = rest.slice(0, nameEnd);
                    const assetUrl      = rest.slice(nameEnd + 1);

                    try {
                        await interaction.deferReply({ flags: MessageFlags.Ephemeral });
                        if (assetType === 'emoji') {
                            // Sanitize name: Discord only allows [a-zA-Z0-9_], 2–32 chars
                            const safeName = assetName
                                .replace(/[^a-zA-Z0-9_]/g, '_')
                                .replace(/^_+|_+$/g, '')
                                .slice(0, 32)
                                .padEnd(2, '_');
                            const created = await interaction.guild.emojis.create({ attachment: assetUrl, name: safeName });
                            await interaction.editReply(`${e('success')} Added emoji \`${created.name}\` ${created.toString()} to the server!`);
                        } else {
                            // Download the sticker image as a buffer
                            const res = await fetch(assetUrl);
                            if (!res.ok) throw new Error(`Failed to fetch sticker: HTTP ${res.status}`);
                            const buffer = Buffer.from(await res.arrayBuffer());

                            // Determine file extension from URL
                            const ext = assetUrl.endsWith('.gif') ? 'gif' : assetUrl.endsWith('.json') ? 'json' : 'png';
                            const fileName = `${assetName}.${ext}`;

                            // Sanitize name for sticker (2–30 chars)
                            const safeName = assetName
                                .replace(/[^a-zA-Z0-9_ ]/g, '_')
                                .trim()
                                .slice(0, 30)
                                .padEnd(2, '_');

                            const created = await interaction.guild.stickers.create({
                                file: { attachment: buffer, name: fileName },
                                name: safeName,
                                tags: '⭐', // required emoji tag
                            });
                            await interaction.editReply(`${e('success')} Added sticker \`${created.name}\` to the server!`);
                        }
                    } catch (err: any) {
                        await interaction.editReply(`${e('error')} Failed: \`${err.message}\``);
                    }
                    return;
                }




                if (id.startsWith('lb_page:')) {
                    const parts = id.split(':');
                    // format: lb_page:<guildId>:<page>
                    const guildId = parts[1];
                    const page    = Number(parts[2]);
                    if (!interaction.guild || isNaN(page) || page < 0) return;

                    await interaction.deferUpdate().catch(() => null);

                    const guild   = interaction.guild;
                    const iconURL = guild.iconURL({ size: 64 }) ?? null;

                    const { buildLeaderboardCard } = await import('../commands/leveling/leaderboard.js');
                    const card = await buildLeaderboardCard(guildId, guild.name, iconURL, page, guild);

                    if (!card) return;

                    const { fadeReply } = await import('../components/builders.js');
                    await interaction.message.edit(fadeReply([card], false, { parse: [] }) as any).catch(() => null);
                    return;
                }


                if (id.startsWith('modhistory_page:')) {
                    const match = id.match(/^modhistory_page:(\d+):(\d+)$/);
                    if (match && interaction.guild) {
                        const targetId = match[1];
                        const page = Number(match[2]);
                        const { buildModHistoryPage } = await import('../commands/moderation/modhistory.js');
                        const target = await interaction.client.users.fetch(targetId).catch(() => null);
                        if (!target) return;

                        const container = await buildModHistoryPage(interaction.guild.id, target, page);
                        await updateResponse(interaction, [container]);
                        return;
                    }
                }


                if (id.startsWith('warnings_page:')) {
                    const match = id.match(/^warnings_page:(\d+):(\d+)$/);
                    if (match && interaction.guild) {
                        const targetId = match[1];
                        const page = Number(match[2]);
                        const { buildWarningsPage } = await import('../commands/moderation/warnings.js');
                        const target = await interaction.client.users.fetch(targetId).catch(() => null);
                        if (!target) return;

                        const container = await buildWarningsPage(interaction.guild.id, target, page);
                        await updateResponse(interaction, [container]);
                        return;
                    }
                }

                // Avatar toggle buttons (avatar_server_<id> / avatar_user_<id>)
                if (id.startsWith('avatar_')) {
                    const m = id.match(/^avatar_(server|user)_(\d+)$/);
                    if (m) {
                        // Acknowledge immediately to avoid interaction timeout
                        await interaction.deferUpdate().catch(() => null);

                        const mode = m[1] as 'server' | 'user';
                        const targetId = m[2];
                        const target = await interaction.client.users.fetch(targetId).catch(() => null);
                        if (!target) {
                            return;
                        }
                        const member = interaction.guild ? await interaction.guild.members.fetch(targetId).catch(() => null) : null;
                        const { buildAvatar } = await import('../commands/general/avatar.js');
                        const container = buildAvatar(target, member, mode);

                        // Edit the original message after acknowledging
                        try {
                            if (interaction.message) {
                                const builders = await import('../components/builders.js');
                                const payload = builders.fadeReply([container], false) as any;
                                payload.allowedMentions = { parse: [] };
                                await interaction.message.edit(payload as any);
                            }
                        } catch (e) {
                            logger.error('Failed to edit avatar message', e, { id });
                        }

                        return;
                    }
                }

                // Ticket interactions — routed to ticketInteractions.ts handler
                if (
                    id.startsWith('ticket_open_') ||
                    id === 'ticket_claim'         ||
                    id === 'ticket_close'         ||
                    id === 'ticket_reopen'        ||
                    id === 'ticket_delete'
                ) {
                    // Handled by ticketInteractions.ts event listener
                    // No action needed here — both listeners fire simultaneously
                    return;
                }

                // Embed builder field buttons — each opens a single-field modal
                if (id.startsWith('wb_embed_')) {
                    const rest = id.slice(9); // strip 'wb_embed_'
                    const sep = rest.indexOf('_');
                    const wbTypeRaw = sep !== -1 ? rest.slice(0, sep) : 'welcome';
                    const wbType = (['welcome', 'goodbye', 'levelup'].includes(wbTypeRaw) ? wbTypeRaw : 'welcome') as 'welcome' | 'goodbye' | 'levelup';
                    const fieldKey = sep !== -1 ? rest.slice(sep + 1) : rest;
                    const fieldDefs: Record<string, { label: string; placeholder: string; paragraph?: boolean }> = {
                        content:     { label: 'Content (text above embed, allows pings)', placeholder: 'Welcome {user}!', paragraph: true },
                        color:       { label: 'Color (#hex)',                              placeholder: '#5865F2' },
                        author_name: { label: 'Author name',                              placeholder: '{server}' },
                        author_icon: { label: 'Author icon URL',                          placeholder: '{servericon}' },
                        title:       { label: 'Title',                                    placeholder: 'Welcome to {server}!' },
                        description: { label: 'Description (main body)',                  placeholder: 'Hey {user}! You are member #{count}.', paragraph: true },
                        thumbnail:   { label: 'Thumbnail URL (top-right image)',          placeholder: '{avatar}' },
                        image:       { label: 'Image URL (large bottom image)',           placeholder: 'https://...' },
                        footer:      { label: 'Footer text',                              placeholder: 'ID: {id}' },
                        footer_icon: { label: 'Footer icon URL',                          placeholder: '{avatar}' },
                        button:      { label: 'Buttons (one per line, max 3)',            placeholder: 'Rules && https://discord.gg/...\nGiveaways && https://...', paragraph: true },
                    };
                    const cfg = fieldDefs[fieldKey];
                    if (!cfg) { logger.debug('Unknown embed builder field', { fieldKey }); return; }

                    const modal = new ModalBuilder()
                        .setCustomId(`wbm_embed_${wbType}_${fieldKey}`)
                        .setTitle(`Embed Builder — ${fieldKey.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())}`)
                        .addComponents(
                            new ActionRowBuilder<TextInputBuilder>().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('value')
                                    .setLabel(cfg.label)
                                    .setStyle(cfg.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
                                    .setRequired(false)
                                    .setPlaceholder(cfg.placeholder)
                            )
                        );
                    await interaction.showModal(modal);
                    return;
                }

                // Card builder field buttons — each opens a single-field modal
                if (id.startsWith('wb_card_')) {
                    const rest = id.slice(8); // strip 'wb_card_'
                    const sep = rest.indexOf('_');
                    const wbTypeRaw = sep !== -1 ? rest.slice(0, sep) : 'welcome';
                    const wbType = (['welcome', 'goodbye', 'levelup'].includes(wbTypeRaw) ? wbTypeRaw : 'welcome') as 'welcome' | 'goodbye' | 'levelup';
                    const fieldKey = sep !== -1 ? rest.slice(sep + 1) : rest;
                    const fieldDefs: Record<string, { label: string; placeholder: string; paragraph?: boolean }> = {
                        header:    { label: 'Header text',              placeholder: 'Welcome to {server}!' },
                        body:      { label: 'Body (main message)',      placeholder: 'Hey {user}! You are member #{count}!', paragraph: true },
                        color:     { label: 'Sidebar color (#hex)',     placeholder: '#5865F2' },
                        thumbnail: { label: 'Thumbnail URL',            placeholder: '{avatar}' },
                        image:     { label: 'Image URL (full-width banner)', placeholder: 'https://...' },
                        footer:    { label: 'Footer text',              placeholder: 'Member #{count} · Joined <t:{created}:R>' },
                        button:    { label: 'Buttons (one per line, max 3)', placeholder: 'Rules && https://discord.gg/...\nGiveaways && https://discord.gg/...', paragraph: true },
                    };
                    const cfg = fieldDefs[fieldKey];
                    if (!cfg) { logger.debug('Unknown card builder field', { fieldKey }); return; }

                    const modal = new ModalBuilder()
                        .setCustomId(`wbm_card_${wbType}_${fieldKey}`)
                        .setTitle(`Card Builder — ${fieldKey.charAt(0).toUpperCase() + fieldKey.slice(1)}`)
                        .addComponents(
                            new ActionRowBuilder<TextInputBuilder>().addComponents(
                                new TextInputBuilder()
                                    .setCustomId('value')
                                    .setLabel(cfg.label)
                                    .setStyle(cfg.paragraph ? TextInputStyle.Paragraph : TextInputStyle.Short)
                                    .setRequired(false)
                                    .setPlaceholder(cfg.placeholder)
                            )
                        );
                    await interaction.showModal(modal);
                    return;
                }

                logger.debug('Unhandled component', { id });

            } catch (err: any) {
                if (err.code === 10062) {
                    // Ignore 'Unknown interaction' errors caused by latency
                    return;
                }
                logger.error(`Component handler failed`, err, { id });
                if (!interaction.replied) {
                    await interaction.reply({
                        content: '❌ Something went wrong.',
                        flags: MessageFlags.Ephemeral,
                    }).catch(() => null);
                }
            }
        }

        // ── Modals ────────────────────────────────────────────────────────────
        if (interaction.isModalSubmit()) {
            const id = interaction.customId;

            // Embed builder per-field modals
            if (id.startsWith('wbm_embed_') && interaction.guild) {
                const rest = id.slice(10); // strip 'wbm_embed_'
                const sep = rest.indexOf('_');
                if (sep === -1) return;
                const wbTypeRaw = rest.slice(0, sep);
                const wbType = (['welcome', 'goodbye', 'levelup'].includes(wbTypeRaw) ? wbTypeRaw : null) as 'welcome' | 'goodbye' | 'levelup' | null;
                const fieldKey = rest.slice(sep + 1);
                const allowed = ['content', 'color', 'author_name', 'author_icon', 'title', 'description', 'thumbnail', 'image', 'footer', 'footer_icon', 'button'];
                if (!allowed.includes(fieldKey) || !wbType) return;

                try {
                    const value = interaction.fields.getTextInputValue('value').trim();

                    let newScript: string;
                    if (wbType === 'levelup') {
                        const config = await getLevelConfig(interaction.guild.id);
                        newScript = updateEmbedScriptField(config.announceMessage, fieldKey, value || null);
                        await updateLevelConfig(interaction.guild.id, { announceMessage: newScript });
                    } else {
                        const getCfg    = wbType === 'goodbye' ? getGoodbyeConfig    : getWelcomeConfig;
                        const updateCfg = wbType === 'goodbye' ? updateGoodbyeConfig : updateWelcomeConfig;
                        const config = await getCfg(interaction.guild.id);
                        newScript = updateEmbedScriptField(config.embedScript, fieldKey, value || null);
                        await updateCfg(interaction.guild.id, { embedScript: newScript });
                    }

                    const panel = buildEmbedBuilderPanel(newScript, wbType as any);
                    await (interaction as any).update({
                        components: [panel],
                        flags: MessageFlags.IsComponentsV2,
                    });
                } catch (err) {
                    logger.error(`wbm_embed_${wbType}_${fieldKey} modal failed`, err);
                    if (!interaction.replied && !(interaction as any).deferred) {
                        await interaction.reply({ content: '❌ Failed to save field.', flags: MessageFlags.Ephemeral }).catch(() => null);
                    }
                }
                return;
            }

            // Card builder per-field modals
            if (id.startsWith('wbm_card_') && interaction.guild) {
                const rest = id.slice(9); // strip 'wbm_card_'
                const sep = rest.indexOf('_');
                if (sep === -1) return;
                const wbTypeRaw = rest.slice(0, sep);
                const wbType = (['welcome', 'goodbye', 'levelup'].includes(wbTypeRaw) ? wbTypeRaw : null) as 'welcome' | 'goodbye' | 'levelup' | null;
                const fieldKey = rest.slice(sep + 1);
                const allowed = ['header', 'body', 'color', 'thumbnail', 'image', 'footer', 'button'];
                if (!allowed.includes(fieldKey) || !wbType) return;

                try {
                    const value = interaction.fields.getTextInputValue('value').trim();

                    let newScript: string;
                    if (wbType === 'levelup') {
                        const config = await getLevelConfig(interaction.guild.id);
                        newScript = updateCardScriptField(config.announceMessage, fieldKey, value || null);
                        await updateLevelConfig(interaction.guild.id, { announceMessage: newScript });
                    } else {
                        const getCfg    = wbType === 'goodbye' ? getGoodbyeConfig    : getWelcomeConfig;
                        const updateCfg = wbType === 'goodbye' ? updateGoodbyeConfig : updateWelcomeConfig;
                        const config = await getCfg(interaction.guild.id);
                        newScript = updateCardScriptField(config.cardScript, fieldKey, value || null);
                        await updateCfg(interaction.guild.id, { cardScript: newScript });
                    }

                    const panel = buildCardBuilderPanel(newScript, wbType as any);
                    await (interaction as any).update({
                        components: [panel],
                        flags: MessageFlags.IsComponentsV2,
                    });
                } catch (err) {
                    logger.error(`wbm_card_${wbType}_${fieldKey} modal failed`, err);
                    if (!interaction.replied && !(interaction as any).deferred) {
                        await interaction.reply({ content: '❌ Failed to save field.', flags: MessageFlags.Ephemeral }).catch(() => null);
                    }
                }
                return;
            }

            logger.debug('Unhandled modal', { id });
        }
    },
};

export default event;