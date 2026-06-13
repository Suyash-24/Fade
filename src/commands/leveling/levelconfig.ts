// src/commands/leveling/levelconfig.ts
import { SlashCommandBuilder, PermissionFlagsBits, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse } from '../../components/builders.js';
import { getLevelConfig, updateLevelConfig } from '../../db/queries/leveling.js';
import { e, Colours } from '../../components/emojis.js';
import { buildCardBuilderPanel, buildEmbedBuilderPanel } from '../../utils/welcomecard.js';

export default {
    data: new SlashCommandBuilder()
        .setName('levelconfig')
        .setDescription('Configure the leveling system')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand(s => s
            .setName('view')
            .setDescription('View current leveling settings')
        )
        .addSubcommand(s => s
            .setName('toggle')
            .setDescription('Enable or disable leveling')
            .addBooleanOption(o => o.setName('enabled').setDescription('On or off').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('channel')
            .setDescription('Set the level-up announcement channel')
            .addChannelOption(o => o.setName('channel').setDescription('Channel to announce level-ups in').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('xprate')
            .setDescription('Set XP gain range per message')
            .addIntegerOption(o => o.setName('min').setDescription('Min XP per message').setMinValue(1).setMaxValue(100).setRequired(true))
            .addIntegerOption(o => o.setName('max').setDescription('Max XP per message').setMinValue(1).setMaxValue(100).setRequired(true))
        )
        .addSubcommand(s => s
            .setName('cooldown')
            .setDescription('Set XP gain cooldown in seconds')
            .addIntegerOption(o => o.setName('seconds').setDescription('Cooldown in seconds (0 = no cooldown)').setMinValue(0).setMaxValue(300).setRequired(true))
        )
        .addSubcommand(s => s
            .setName('message')
            .setDescription('Set level-up card message. Paste a script or leave blank to open the builder')
            .addStringOption(o => o
                .setName('script')
                .setDescription('Paste your card script here, e.g. {header: Level Up!}$v{body: {user} hit Level {level}!}')
                .setRequired(false)
            )
        )
        .addSubcommand(s => s
            .setName('messageembed')
            .setDescription('Set level-up embed message. Paste a script or leave blank to open the builder')
            .addStringOption(o => o
                .setName('script')
                .setDescription('Paste your embed script here, e.g. {title: Level Up!}$v{description: {user} hit Level {level}!}')
                .setRequired(false)
            )
        )
        .addSubcommand(s => s
            .setName('messageplain')
            .setDescription('Set a plain text level-up message')
            .addStringOption(o => o
                .setName('text')
                .setDescription('Plain message. Use {user}, {level}, {server}')
                .setRequired(true)
            )
        ),

    category:        'leveling',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageGuild],
    cooldown:        5,

    async execute(interaction, client) {
        const sub   = interaction.options.getSubcommand();
        const guild = interaction.guild!;

        if (sub === 'view') {
            const config = await getLevelConfig(guild.id);
            const card = new FadeContainer(Colours.FADE)
                .text(`## ${e('settings')} Leveling Config`)
                .separator(true)
                .text([
                    `**Enabled** — \`${config.enabled ? 'Yes' : 'No'}\``,
                    `**XP Rate** — \`${config.xpMin}–${config.xpMax} XP\` per message`,
                    `**Cooldown** — \`${config.xpCooldown}s${config.xpCooldown === 0 ? ' (none)' : ''}\``,
                    `**Announce** — ${config.announceChannel ? `<#${config.announceChannel}>` : 'Same channel'}`,
                    config.announceMessage ? `**Custom msg** — \`Script set\`` : '**Custom msg** — \`Default\`',
                ].filter(Boolean).join('\n'))
                .build();
            await sendResponse(interaction, [card], true);
            return;
        }

        if (sub === 'toggle') {
            const enabled = interaction.options.getBoolean('enabled', true);
            await updateLevelConfig(guild.id, { enabled });
            const card = new FadeContainer(enabled ? Colours.SUCCESS : Colours.WARNING)
                .text(`${e('success')}  Leveling **${enabled ? 'enabled' : 'disabled'}**`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'channel') {
            const channel = interaction.options.getChannel('channel');
            await updateLevelConfig(guild.id, { announceChannel: channel?.id ?? null });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Level-up announcements → ${channel ? `<#${channel.id}>` : 'same channel as message'}`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'xprate') {
            const min = interaction.options.getInteger('min', true);
            const max = interaction.options.getInteger('max', true);
            if (min > max) {
                await interaction.reply({ content: `${e('error')} Min XP can't be greater than max XP.`, flags: MessageFlags.Ephemeral });
                return;
            }
            await updateLevelConfig(guild.id, { xpMin: min, xpMax: max });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  XP rate set to \`${min}–${max}\` per message`)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'cooldown') {
            const seconds = interaction.options.getInteger('seconds', true);
            await updateLevelConfig(guild.id, { xpCooldown: seconds });
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  XP cooldown set to \`${seconds}s\``)
                .build();
            await sendResponse(interaction, [card]);
            return;
        }

        if (sub === 'message') {
            const script = interaction.options.getString('script');
            if (script) {
                // Direct script paste — save and confirm
                await updateLevelConfig(guild.id, { announceMessage: script });
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Level-up card script saved!\n-# Use \`/levelconfig message\` again (without script) to open the builder and verify fields`)
                    .build();
                await sendResponse(interaction, [card]);
            } else {
                // No script — open interactive builder panel
                const config = await getLevelConfig(guild.id);
                const panel = buildCardBuilderPanel(config.announceMessage ?? undefined, 'levelup' as any);
                await sendResponse(interaction, [panel], true);
            }
            return;
        }

        if (sub === 'messageembed') {
            const script = interaction.options.getString('script');
            if (script) {
                await updateLevelConfig(guild.id, { announceMessage: script });
                const card = new FadeContainer(Colours.SUCCESS)
                    .text(`${e('success')}  Level-up embed script saved!\n-# Use \`/levelconfig messageembed\` again (without script) to open the builder and verify fields`)
                    .build();
                await sendResponse(interaction, [card]);
            } else {
                const config = await getLevelConfig(guild.id);
                const panel = buildEmbedBuilderPanel(config.announceMessage ?? undefined, 'levelup' as any);
                await sendResponse(interaction, [panel], true);
            }
            return;
        }

        if (sub === 'messageplain') {
            const text = interaction.options.getString('text', true);
            // Prefix with a sentinel so xpgain knows it's plain text
            const stored = `__plain__${text}`;
            await updateLevelConfig(guild.id, { announceMessage: stored });
            const preview = text
                .replace(/{user}/g,   interaction.user.toString())
                .replace(/{level}/g,  '10')
                .replace(/{server}/g, guild.name);
            const card = new FadeContainer(Colours.SUCCESS)
                .text(`${e('success')}  Plain level-up message set\n-# Preview: ${preview}`)
                .build();
            await sendResponse(interaction, [card], false, { parse: [] });
            return;
        }
    },
} satisfies Command;