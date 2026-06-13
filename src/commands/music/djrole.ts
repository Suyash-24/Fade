// src/commands/music/djrole.ts
// DJ Role management — stores in the musicConfig table (djRoleId column).
// The getDjRole() function lives in ../../music/djrole-store.ts to avoid circular imports.
import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { Command } from '../../types/command.js';
import { musicReply } from '../../music/utils.js';
import { buildMusicInfoCard, buildMusicErrorCard } from '../../music/cards.js';
import { db } from '../../db/index.js';
import { musicConfig } from '../../db/schema.js';
import { eq } from 'drizzle-orm';
import { ensureGuild } from '../../db/queries/guilds.js';
import { getDjRole, djRoleCache } from '../../music/djrole-store.js';

// Re-export for any code that imports from this file directly
export { getDjRole };

// ── Upsert helper ─────────────────────────────────────────────────────────────

async function setDjRole(guildId: string, roleId: string | null): Promise<void> {
    await ensureGuild(guildId);
    await db
        .insert(musicConfig)
        .values({ guildId, djRoleId: roleId })
        .onConflictDoUpdate({
            target: musicConfig.guildId,
            set: { djRoleId: roleId, updatedAt: new Date() },
        });
    // Update cache in the shared store
    djRoleCache.set(guildId, roleId);
}

// ── Command ───────────────────────────────────────────────────────────────────

export default {
    data: new SlashCommandBuilder()
        .setName('djrole')
        .setDescription('View or set the DJ role for music commands'),

    category:  'music',
    guildOnly: true,
    aliases:   ['djrole', 'dj'],
    cooldown:  3,

    async execute(interaction) {
        await interaction.reply({
            content: 'Use `f!djrole @role` to set the DJ role, or `f!djrole clear` to remove it.',
            flags: 64,
        });
    },

    async prefixExecute(message, args, _client) {
        const guildId = message.guild!.id;
        const sub = args[0]?.toLowerCase();

        // ── Show current DJ role ──────────────────────────────────────────────
        if (!sub) {
            const current = await getDjRole(guildId);
            if (!current) {
                await musicReply(message, [
                    buildMusicInfoCard(
                        '🎧 DJ Role',
                        'No DJ role is set. **Everyone** can use music commands.\n-# Use `f!djrole @role` to restrict music controls.',
                    ),
                ]);
            } else {
                await musicReply(message, [
                    buildMusicInfoCard(
                        '🎧 DJ Role',
                        `Current DJ role: <@&${current}>\n-# Only members with this role (or ManageGuild) can control music.\n-# Use \`f!djrole clear\` to remove the restriction.`,
                    ),
                ]);
            }
            return;
        }

        // Require ManageGuild to change the setting
        const member = message.member!;
        const hasManage = member.permissions.has(PermissionFlagsBits.ManageGuild);
        if (!hasManage) {
            await musicReply(message, [buildMusicErrorCard('You need the **Manage Server** permission to change the DJ role.')]);
            return;
        }

        // ── Clear DJ role ─────────────────────────────────────────────────────
        if (sub === 'clear' || sub === 'none' || sub === 'off') {
            await setDjRole(guildId, null);
            await musicReply(message, [
                buildMusicInfoCard('🎧 DJ Role Cleared', 'DJ role restriction removed. **Everyone** can now use music commands.'),
            ]);
            return;
        }

        // ── Set DJ role ───────────────────────────────────────────────────────
        // Accept a mention or a raw role ID
        const targetId = args[0]?.replace(/\D/g, '');
        const roleId  = targetId || null;

        if (!roleId) {
            await musicReply(message, [buildMusicErrorCard('Please mention a role or provide a role ID.\n-# Example: `f!djrole @DJ` or `f!djrole clear`')]);
            return;
        }

        const role = message.guild!.roles.cache.get(roleId);
        if (!role) {
            await musicReply(message, [buildMusicErrorCard("That role doesn't exist in this server.")]);
            return;
        }

        await setDjRole(guildId, roleId);
        await musicReply(message, [
            buildMusicInfoCard(
                '🎧 DJ Role Set',
                `DJ role set to <@&${roleId}>.\n-# Only members with this role (or ManageGuild permission) can control music.`,
            ),
        ]);
    },
} satisfies Command;
