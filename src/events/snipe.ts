// src/events/snipe.ts
// Populates the snipe cache on message delete and edit.
import type { FadeClient } from '../client.js';
import type { Event } from '../types/event.js';
import {
    setSnipe,
    setEditSnipe,
    setReactionSnipe,
} from '../utils/snipeCache.js';

export const messageDeleteSnipe: Event<'messageDelete'> = {
    name: 'messageDelete',
    async execute(client, message) {
        // Skip bots, partials with no content, system messages
        if (message.author?.bot) return;
        if (!message.guild) return;
        if (!message.content && !message.attachments.size) return;

        const imageUrl = message.attachments.find(a =>
            a.contentType?.startsWith('image/')
        )?.url;

        setSnipe(message.channelId, {
            content:     message.content || '*(no text — attachment only)*',
            authorId:    message.author?.id ?? 'unknown',
            authorTag:   message.author?.tag ?? 'Unknown User',
            authorAvatar:message.author?.displayAvatarURL({ size: 256 }) ?? null,
            channelId:   message.channelId,
            guildId:     message.guild.id,
            imageUrl,
            deletedAt:   Date.now(),
        });
    },
};

export const messageUpdateSnipe: Event<'messageUpdate'> = {
    name: 'messageUpdate',
    async execute(client, oldMessage, newMessage) {
        if (newMessage.author?.bot) return;
        if (!newMessage.guild) return;
        if (oldMessage.content === newMessage.content) return;
        if (!oldMessage.content) return;

        setEditSnipe(newMessage.channelId, {
            before:      oldMessage.content,
            after:       newMessage.content ?? '',
            authorId:    newMessage.author?.id ?? 'unknown',
            authorTag:   newMessage.author?.tag ?? 'Unknown User',
            authorAvatar:newMessage.author?.displayAvatarURL({ size: 256 }) ?? null,
            channelId:   newMessage.channelId,
            guildId:     newMessage.guild.id,
            messageUrl:  newMessage.url,
            editedAt:    Date.now(),
        });
    },
};

export const messageReactionRemoveSnipe: Event<'messageReactionRemove'> = {
    name: 'messageReactionRemove',
    async execute(client, reaction, user) {
        if (user.bot) return;
        if (!reaction.message.guild) return;

        const emojiUrl = reaction.emoji.imageURL();
        const emojiName = reaction.emoji.id ? `<:${reaction.emoji.name}:${reaction.emoji.id}>` : reaction.emoji.name;

        setReactionSnipe(reaction.message.channelId, {
            emojiName:    emojiName ?? 'unknown',
            emojiUrl:     emojiUrl ?? null,
            authorId:     user.id,
            authorTag:    user.tag ?? 'Unknown User',
            authorAvatar: user.displayAvatarURL({ size: 256 }) ?? null,
            channelId:    reaction.message.channelId,
            guildId:      reaction.message.guild.id,
            messageUrl:   reaction.message.url,
            removedAt:    Date.now(),
        });
    },
};

export default [messageDeleteSnipe, messageUpdateSnipe, messageReactionRemoveSnipe];