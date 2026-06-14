import { Team } from 'discord.js';
import type { FadeClient } from '../client.js';

export async function isBotOwner(client: FadeClient, userId: string): Promise<boolean> {
    if (process.env.OWNER_ID === userId) return true;
    
    if (!client.application?.owner) await client.application?.fetch().catch(() => null);
    
    const owner = client.application?.owner;
    if (!owner) return false;
    
    if (owner instanceof Team) {
        return owner.members.has(userId);
    } else {
        return owner.id === userId;
    }
}
