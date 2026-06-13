// src/events/boosterRoles.ts
// Fires on guildMemberUpdate to handle boost start/end:
//   - Boost start: grant award role if configured
//   - Boost end:   remove award role + delete custom booster role
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import { getBoosterConfig, getBoosterRole, deleteBoosterRole } from '../db/queries/boosterRoles.js';
import { logger } from '../utils/logger.js';

const event: Event<'guildMemberUpdate'> = {
    name: 'guildMemberUpdate',

    async execute(_client: FadeClient, oldMember, newMember) {
        const wasBooster = !!oldMember.premiumSince;
        const isBooster  = !!newMember.premiumSince;

        // No boost change — nothing to do
        if (wasBooster === isBooster) return;

        const guildId = newMember.guild.id;

        try {
            const config = await getBoosterConfig(guildId);

            if (!wasBooster && isBooster) {
                // ── Boost started ─────────────────────────────────────────────
                if (config?.awardRoleId) {
                    await newMember.roles.add(config.awardRoleId, '[Fade] Booster award role').catch(() => null);
                }

            } else if (wasBooster && !isBooster) {
                // ── Boost ended ───────────────────────────────────────────────

                // Remove award role
                if (config?.awardRoleId) {
                    await newMember.roles.remove(config.awardRoleId, '[Fade] Boost ended').catch(() => null);
                }

                // Delete custom booster role
                const entry = await getBoosterRole(guildId, newMember.id);
                if (entry) {
                    const role = newMember.guild.roles.cache.get(entry.roleId);
                    if (role) await role.delete('[Fade] Boost ended').catch(() => null);
                    await deleteBoosterRole(guildId, newMember.id);
                }
            }

        } catch (err) {
            logger.error('boosterRoles guildMemberUpdate failed', err, { guildId, userId: newMember.id });
        }
    },
};

export default event;
