// src/commands/general/valorant.ts
import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types/command.js';
import { FadeContainer, sendResponse, sendMessage } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { findAgent, findWeapon, findSkin, findMap, getMaps, getAgents, tierColor } from '../../utils/valorant.js';

export default {
    data: new SlashCommandBuilder()
        .setName('valorant')
        .setDescription('Valorant agents, weapons, skins, and maps')

        .addSubcommand(s => s
            .setName('agent')
            .setDescription('Look up a Valorant agent')
            .addStringOption(o => o.setName('name').setDescription('Agent name').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('weapon')
            .setDescription('Look up a Valorant weapon')
            .addStringOption(o => o.setName('name').setDescription('Weapon name').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('skin')
            .setDescription('Look up a Valorant skin')
            .addStringOption(o => o.setName('name').setDescription('Skin name').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('map')
            .setDescription('Look up a Valorant map')
            .addStringOption(o => o.setName('name').setDescription('Map name').setRequired(true))
        )
        .addSubcommand(s => s
            .setName('maps')
            .setDescription('List all Valorant maps')
        )
        .addSubcommand(s => s
            .setName('agents')
            .setDescription('List all Valorant agents')
        ),

    category: 'general',
    cooldown: 5,

    async execute(interaction) {
        const sub = interaction.options.getSubcommand();
        await interaction.deferReply();

        try {
            // ── Agent ─────────────────────────────────────────────────────────
            if (sub === 'agent') {
                const name  = interaction.options.getString('name', true);
                const agent = await findAgent(name);
                if (!agent) { await interaction.editReply(`${e('error')} Agent \`${name}\` not found.`); return; }

                const abilities = (agent.abilities ?? [])
                    .filter((a: any) => a.displayName && a.description)
                    .map((a: any) => `**${a.displayName}** — ${a.description.slice(0, 80)}…`)
                    .join('\n');

                const card = new FadeContainer(0xFF4655)
                    .text(
                        `## ${agent.displayName}\n` +
                        `-# ${agent.role?.displayName ?? 'Agent'}\n\n` +
                        `${agent.description?.slice(0, 200) ?? ''}\n\n` +
                        (abilities ? `**Abilities:**\n${abilities}` : '')
                    );
                const img = agent.fullPortrait ?? agent.displayIcon;
                if (img) card.gallery([{ url: img }]);
                await interaction.editReply({ components: [card.build()], flags: MessageFlags.IsComponentsV2 } as any);
                return;
            }

            // ── Weapon ────────────────────────────────────────────────────────
            if (sub === 'weapon') {
                const name   = interaction.options.getString('name', true);
                const weapon = await findWeapon(name);
                if (!weapon) { await interaction.editReply(`${e('error')} Weapon \`${name}\` not found.`); return; }

                const stats = weapon.weaponStats;
                const lines = stats ? [
                    stats.fireRate      ? `**Fire Rate** — ${stats.fireRate} rounds/s` : null,
                    stats.magazineSize  ? `**Magazine** — ${stats.magazineSize}` : null,
                    stats.reloadTimeSeconds ? `**Reload** — ${stats.reloadTimeSeconds}s` : null,
                    stats.equipTimeSeconds  ? `**Equip** — ${stats.equipTimeSeconds}s` : null,
                ].filter(Boolean).join('\n') : '';

                const card = new FadeContainer(0xFF4655)
                    .text(
                        `## ${weapon.displayName}\n` +
                        `-# ${weapon.category?.replace('EEquippableCategory::', '') ?? 'Weapon'}\n\n` +
                        (lines ? `${lines}\n\n` : '') +
                        `**Skins available:** ${weapon.skins?.length ?? 0}`
                    );
                if (weapon.displayIcon) card.gallery([{ url: weapon.displayIcon }]);
                await interaction.editReply({ components: [card.build()], flags: MessageFlags.IsComponentsV2 } as any);
                return;
            }

            // ── Skin ──────────────────────────────────────────────────────────
            if (sub === 'skin') {
                const name = interaction.options.getString('name', true);
                const skin = await findSkin(name);
                if (!skin) { await interaction.editReply(`${e('error')} Skin \`${name}\` not found.`); return; }

                const tier  = skin.contentTierUuid ? skin.displayName : null;
                const image = skin.chromas?.[0]?.fullRender ?? skin.displayIcon;

                const card = new FadeContainer(0xFF4655)
                    .text(
                        `## ${skin.displayName}\n` +
                        `-# ${skin.weaponName ?? 'Skin'}\n` +
                        (skin.themeUuid ? `-# Collection available` : '')
                    );
                if (image) card.gallery([{ url: image }]);
                await interaction.editReply({ components: [card.build()], flags: MessageFlags.IsComponentsV2 } as any);
                return;
            }

            // ── Map ───────────────────────────────────────────────────────────
            if (sub === 'map') {
                const name = interaction.options.getString('name', true);
                const map  = await findMap(name);
                if (!map) { await interaction.editReply(`${e('error')} Map \`${name}\` not found.`); return; }

                const card = new FadeContainer(0xFF4655)
                    .text(
                        `## ${map.displayName}\n` +
                        (map.tacticalDescription ? `-# ${map.tacticalDescription}\n\n` : '') +
                        (map.coordinates ? `📍 ${map.coordinates}\n` : '') +
                        (map.narrativeDescription ? `\n${map.narrativeDescription.slice(0, 200)}` : '')
                    );
                const img = map.splash ?? map.displayIcon;
                if (img) card.gallery([{ url: img }]);
                await interaction.editReply({ components: [card.build()], flags: MessageFlags.IsComponentsV2 } as any);
                return;
            }

            // ── Maps list ─────────────────────────────────────────────────────
            if (sub === 'maps') {
                const maps  = await getMaps();
                const lines = maps.map(m => `**${m.displayName}** · ${m.tacticalDescription ?? ''}`).join('\n');
                const card  = new FadeContainer(0xFF4655)
                    .text(`## 🗺️ Valorant Maps\n${lines}`)
                    .build();
                await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);
                return;
            }

            // ── Agents list ───────────────────────────────────────────────────
            if (sub === 'agents') {
                const agents = await getAgents();
                // Group by role
                const byRole = new Map<string, string[]>();
                for (const a of agents) {
                    const role = a.role?.displayName ?? 'Unknown';
                    if (!byRole.has(role)) byRole.set(role, []);
                    byRole.get(role)!.push(a.displayName);
                }
                const lines = [...byRole.entries()]
                    .map(([role, names]) => `**${role}:** ${names.join(', ')}`)
                    .join('\n');
                const card = new FadeContainer(0xFF4655)
                    .text(`## 🎮 Valorant Agents\n${lines}`)
                    .build();
                await interaction.editReply({ components: [card], flags: MessageFlags.IsComponentsV2 } as any);
                return;
            }

        } catch (err: any) {
            await interaction.editReply(`${e('error')} ${err.message ?? 'Valorant API request failed.'}`);
        }
    },

    async prefixExecute(message, args) {
        const sub  = args[0]?.toLowerCase();
        const name = args.slice(1).join(' ');

        try {
            if (sub === 'agent' && name) {
                const agent = await findAgent(name);
                if (!agent) { await message.reply(`${e('error')} Agent not found.`); return; }
                const card = new FadeContainer(0xFF4655)
                    .text(`## ${agent.displayName}\n-# ${agent.role?.displayName ?? 'Agent'}\n\n${agent.description?.slice(0, 200) ?? ''}`);
                const img = agent.fullPortrait ?? agent.displayIcon;
                if (img) card.gallery([{ url: img }]);
                await sendMessage(message, [card.build()]);
            } else if (sub === 'skin' && name) {
                const skin = await findSkin(name);
                if (!skin) { await message.reply(`${e('error')} Skin not found.`); return; }
                const image = skin.chromas?.[0]?.fullRender ?? skin.displayIcon;
                const card  = new FadeContainer(0xFF4655).text(`## ${skin.displayName}\n-# ${skin.weaponName ?? 'Skin'}`);
                if (image) card.gallery([{ url: image }]);
                await sendMessage(message, [card.build()]);
            } else if (sub === 'map' && name) {
                const map = await findMap(name);
                if (!map) { await message.reply(`${e('error')} Map not found.`); return; }
                const card = new FadeContainer(0xFF4655).text(`## ${map.displayName}\n-# ${map.tacticalDescription ?? ''}`);
                const img  = map.splash ?? map.displayIcon;
                if (img) card.gallery([{ url: img }]);
                await sendMessage(message, [card.build()]);
            } else if (sub === 'maps') {
                const maps  = await getMaps();
                const lines = maps.map(m => `**${m.displayName}**`).join(', ');
                const card  = new FadeContainer(0xFF4655).text(`## 🗺️ Valorant Maps\n${lines}`).build();
                await sendMessage(message, [card]);
            } else if (sub === 'agents') {
                const agents = await getAgents();
                const lines  = agents.map((a: any) => a.displayName).join(', ');
                const card   = new FadeContainer(0xFF4655).text(`## 🎮 Valorant Agents\n${lines}`).build();
                await sendMessage(message, [card]);
            } else {
                await message.reply(
                    `**Valorant commands:**\n` +
                    `\`f!val agent <name>\` · \`f!val skin <name>\` · \`f!val map <name>\`\n` +
                    `\`f!val maps\` · \`f!val agents\``
                );
            }
        } catch (err: any) {
            await message.reply(`${e('error')} ${err.message ?? 'Valorant API request failed.'}`);
        }
    },

    aliases: ['val', 'valo'],
} satisfies Command;
