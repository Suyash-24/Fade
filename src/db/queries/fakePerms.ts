// src/db/queries/fakePerms.ts
import { db } from '../index.js';
import { fakePermissions } from '../schema.js';
import { and, eq } from 'drizzle-orm';

export type FakePerm =
    | 'administrator'
    | 'ban_members'
    | 'kick_members'
    | 'moderate_members'
    | 'manage_messages'
    | 'manage_nicknames'
    | 'manage_roles'
    | 'manage_guild_expressions'
    | 'manage_guild'
    | 'manage_channels';

export async function getGuildFakePerms(guildId: string) {
    return db.select().from(fakePermissions).where(eq(fakePermissions.guildId, guildId));
}

export async function addFakePerm(guildId: string, roleId: string, permission: FakePerm) {
    await db.insert(fakePermissions)
        .values({ guildId, roleId, permission })
        .onConflictDoNothing();
}

export async function removeFakePerm(guildId: string, roleId: string, permission: FakePerm) {
    await db.delete(fakePermissions).where(
        and(
            eq(fakePermissions.guildId, guildId),
            eq(fakePermissions.roleId, roleId),
            eq(fakePermissions.permission, permission),
        )
    );
}

export async function clearRoleFakePerms(guildId: string, roleId: string) {
    await db.delete(fakePermissions).where(
        and(eq(fakePermissions.guildId, guildId), eq(fakePermissions.roleId, roleId))
    );
}
