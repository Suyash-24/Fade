// src/db/queries/boundRoles.ts
import { db } from '../index.js';
import { boundRoles } from '../schema.js';
import { eq, and } from 'drizzle-orm';

export async function addBoundRole(guildId: string, roleId: string, type: string) {
    await db.insert(boundRoles).values({
        guildId,
        roleId,
        type
    }).onConflictDoNothing();
}

export async function removeBoundRole(guildId: string, roleId: string, type: string) {
    await db.delete(boundRoles).where(
        and(
            eq(boundRoles.guildId, guildId),
            eq(boundRoles.roleId, roleId),
            eq(boundRoles.type, type)
        )
    );
}

export async function getBoundRoles(guildId: string, type: string) {
    const roles = await db.select().from(boundRoles).where(
        and(
            eq(boundRoles.guildId, guildId),
            eq(boundRoles.type, type)
        )
    );
    return roles.map(r => r.roleId);
}
