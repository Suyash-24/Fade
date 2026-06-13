// src/commands/welcome/welcome.ts
import {
    SlashCommandBuilder,
    PermissionFlagsBits,
    ChannelType,
    MessageFlags,
    ModalBuilder,
    ActionRowBuilder,
    TextInputBuilder,
    TextInputStyle,
} from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import { getWelcomeConfig, updateWelcomeConfig } from '../../db/queries/welcome.js';
import {
    buildScriptedEmbed,
    buildScriptedCard,
    buildEmbedBuilderPanel,
    buildCardBuilderPanel,
    defaultWelcomeEmbed,
    defaultWelcomeCard,
    resolveVars,
    detectScriptStyle,
    type WelcomeStyle,
} from '../../utils/welcomecard.js';
import { e, Colours } from '../../components/emojis.js';

const STYLE_LABELS: Record<WelcomeStyle, string> = {
    embed: 'Classic Embed (default)',
    card:  'Components v2 Card',
    text:  'Plain Text',
};

export default {
    data: new SlashCommandBuilder()
        .setName('welcome')
        .setDescription('Configure the welcome system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s
            .setName('view')
            .setDescription('View current welcome settings')
        )
        .addSubcommand(s => s
            .setName('toggle')
            .setDescription('Enable or disable welcome messages')
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('channel')
            .setDescription('Set the welcome channel')
            .addChannelOption(o => o
                .setName('channel')
                .setDescription('Channel to send welcome messages in')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)
            )
        )
        .addSubcommand(s => s
            .setName('style')
            .setDescription('Set the message style')
            .addStringOption(o => o
                .setName('type')
                .setDescription('Style to use')
                .setRequired(true)
                .addChoices(
                    { name: 'Card (Components v2)',  value: 'card'  },
                    { name: 'Embed (Classic)',        value: 'embed' },
                    { name: 'Text (Plain message)',   value: 'text'  },
                )
            )
        )
        .addSubcommand(s => s
            .setName('message')
            .setDescription('Set the plain-text welcome message (text style only)')
            .addStringOption(o => o.setName('message').setDescription('Custom message').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('script')
            .setDescription('Paste a raw embed/card script. Syntax: {key: value}$v{key: value}')
            .addStringOption(o => o.setName('script').setDescription('Script string').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('build')
            .setDescription('Open the interactive wizard to build your welcome message')
        )
        .addSubcommand(s => s
            .setName('dm')
            .setDescription('Set a DM message sent to new members (leave empty to disable)')
            .addStringOption(o => o.setName('message').setDescription('DM message').setRequired(false))
        )
        .addSubcommand(s => s
            .setName('autorole')
            .setDescription('Toggle an auto-role given on join (run again to remove)')
            .addRoleOption(o => o.setName('role').setDescription('Role to toggle').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('destruct')
            .setDescription('Auto-delete the welcome message after a set time (0 to disable)')
            .addIntegerOption(o => o
                .setName('seconds')
                .setDescription('Seconds before auto-delete (0 = disabled, max 3600)')
                .setRequired(true)
                .setMinValue(0)
                .setMaxValue(3600)
            )
        )
        .addSubcommand(s => s
            .setName('test')
            .setDescription('Preview the welcome message')
        ),

    category:        'welcome',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        5,

    async execute(interaction, client) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        // ── View ──────────────────────────────────────────────────────────────
        if (sub === 'view') {
            const config    = await getWelcomeConfig(guild.id);
            const style     = (config.style as WelcomeStyle) ?? 'embed';
            const autoRoles = (config.autoRoles as string[] ?? [])
                .map(id => `<@&${id}>`).join(', ') || '`None`';

            const scriptPreview = (s: string | null | undefined) =>
                s ? `\`${s.slice(0, 50)}${s.length > 50 ? '…' : ''}\`` : '`Default`';

            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('members')} Welcome Config`)
                .separator(true)
                .text([
                    `**Enabled**      — \`${config.enabled ? 'Yes' : 'No'}\``,
                    `**Style**        — \`${STYLE_LABELS[style]}\``,
                    `**Channel**      — ${config.channelId ? `<#${config.channelId}>` : '`Not set`'}`,
                    `**Embed script** — ${scriptPreview(config.embedScript)}`,
                    `**Card script**  — ${scriptPreview(config.cardScript)}`,
                    `**Text message** — ${scriptPreview(config.message)}`,
                    `**DM Message**   — ${config.dmMessage ? '`Set`' : '`Disabled`'}`,
                    `**Auto-roles**   — ${autoRoles}`,
                    `**Auto-delete**  — ${config.deleteAfter ? `\`${config.deleteAfter}s\`` : '`Disabled`'}`,
                ].join('\n'))
                .separator(false)
                .text(`-# Use \`/welcome build\` to configure · \`/welcome test\` to preview`)
                .build();

            await sendResponse(interaction, [card], true);
            return;
        }

        // ── Toggle ────────────────────────────────────────────────────────────
        if (sub === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateWelcomeConfig(guild.id, { enabled });
            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(`${e('success')}  Welcome messages **${enabled ? 'enabled' : 'disabled'}**`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Channel ───────────────────────────────────────────────────────────
        if (sub === 'channel') {
            const channel = interaction.options.getChannel('channel', true);
            await updateWelcomeConfig(guild.id, { channelId: channel.id });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Welcome channel → <#${channel.id}>`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Style ─────────────────────────────────────────────────────────────
        if (sub === 'style') {
            const style = interaction.options.getString('type', true) as WelcomeStyle;
            await updateWelcomeConfig(guild.id, { style });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(
                    `${e('success')}  Welcome style set to **${STYLE_LABELS[style]}**\n` +
                    `-# Use \`/welcome test\` to preview`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Message (text style only) ─────────────────────────────────────────
        if (sub === 'message') {
            const message = interaction.options.getString('message', true);
            await updateWelcomeConfig(guild.id, { message });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Text message updated\n-# Switch to text style with \`/welcome style type:text\` · Preview with \`/welcome test\``)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Script (direct embed/card script input) ───────────────────────────
        if (sub === 'script') {
            const script = interaction.options.getString('script', true);
            const style  = (await getWelcomeConfig(guild.id)).style as WelcomeStyle;
            if (style === 'embed') {
                await updateWelcomeConfig(guild.id, { embedScript: script });
            } else if (style === 'card') {
                await updateWelcomeConfig(guild.id, { cardScript: script });
            } else {
                await updateWelcomeConfig(guild.id, { message: script });
            }
            const detected = style !== 'text' ? detectScriptStyle(script) : null;
            const mismatch  = detected !== null && detected !== style;
            const card = new FadeContainer(mismatch ? Colours.WARNING : Colours.SUCCESS)
                .text(
                    mismatch
                        ? `${e('warn')}  Script saved, but it looks like an **${STYLE_LABELS[detected!]}** script while your style is **${STYLE_LABELS[style]}**.\n` +
                          `-# Keys like \`title\`/\`description\` work as card aliases, but switch style with \`/welcome style\` for best results. Preview with \`/welcome test\`.`
                        : `${e('success')}  ${STYLE_LABELS[style]} script updated\n-# Use \`/welcome test\` to preview`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── DM ────────────────────────────────────────────────────────────────
        if (sub === 'dm') {
            const message = interaction.options.getString('message');
            await updateWelcomeConfig(guild.id, { dmMessage: message ?? null });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(message
                    ? `${e('success')}  DM welcome message set`
                    : `${e('success')}  DM welcome message disabled`
                )
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Auto-role ─────────────────────────────────────────────────────────
        if (sub === 'autorole') {
            const role    = interaction.options.getRole('role', true);
            const config  = await getWelcomeConfig(guild.id);
            const current = config.autoRoles as string[] ?? [];
            let updated: string[];
            let action: string;

            if (current.includes(role.id)) {
                updated = current.filter(id => id !== role.id);
                action  = 'removed from';
            } else {
                if (current.length >= 5) {
                    await interaction.reply({
                        content: `${e('error')} Maximum 5 auto-roles allowed.`,
                        flags: MessageFlags.Ephemeral,
                    });
                    return;
                }
                updated = [...current, role.id];
                action  = 'added to';
            }

            await updateWelcomeConfig(guild.id, { autoRoles: updated });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  <@&${role.id}> **${action}** auto-roles`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Build wizard ──────────────────────────────────────────────────────
        if (sub === 'build') {
            const config = await getWelcomeConfig(guild.id);
            const style  = (config.style as WelcomeStyle) ?? 'embed';

            if (style === 'text') {
                const card = new FadeContainer(Colours.FADE)
                    .text(`${e('warn')}  Text style is active — use \`/welcome message\` to set your message.`)
                    .text(`-# Variables: \`{user}\` \`{user.mention}\` \`{user.username}\` \`{user.name}\` \`{user.avatar}\` \`{user.icon}\` \`{usericon}\` \`{server}\` \`{count}\` \`{ordinal}\` \`{id}\` \`{servericon}\` \`{created}\``)
                    .build();
                await sendResponse(interaction, [card], true);
                return;
            }

            if (style === 'embed') {
                const panel = buildEmbedBuilderPanel(config.embedScript, 'welcome');
                await interaction.reply({
                    components: [panel],
                    flags: (MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral) as any,
                });
                return;
            }

            if (style === 'card') {
                const panel = buildCardBuilderPanel(config.cardScript, 'welcome');
                await interaction.reply({
                    components: [panel],
                    flags: (MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral) as any,
                });
                return;
            }
        }

        // ── Destruct ──────────────────────────────────────────────────────────
        if (sub === 'destruct') {
            const seconds = interaction.options.getInteger('seconds', true);
            await updateWelcomeConfig(guild.id, { deleteAfter: seconds > 0 ? seconds : null });
            const label = seconds > 0 ? `\`${seconds}s\`` : '`Disabled`';
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Auto-delete set to ${label}`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        // ── Test ──────────────────────────────────────────────────────────────
        if (sub === 'test') {
            await interaction.deferReply({ ephemeral: true });
            const config = await getWelcomeConfig(guild.id);
            const member = interaction.member as any;
            const style  = (config.style as WelcomeStyle) ?? 'embed';

            if (style === 'card') {
                const container = config.cardScript
                    ? buildScriptedCard(config.cardScript, member).container
                    : defaultWelcomeCard(member);
                await interaction.deleteReply();
                await interaction.followUp({
                    components: [container],
                    flags: (MessageFlags.IsComponentsV2 | MessageFlags.Ephemeral) as any,
                });
            } else if (style === 'embed') {
                if (config.embedScript) {
                    const { embed, content, buttons } = buildScriptedEmbed(config.embedScript, member);
                    const payload: any = { embeds: [embed] };
                    if (content) payload.content = content;
                    if (buttons) payload.components = [buttons];
                    await interaction.editReply(payload);
                } else {
                    await interaction.editReply({ embeds: [defaultWelcomeEmbed(member)] });
                }
            } else {
                const text = config.message ? resolveVars(config.message, member) : `Welcome to **${guild.name}**, ${interaction.user}!`;
                await interaction.editReply({ content: text });
            }
            return;
        }
    },
} satisfies Command;