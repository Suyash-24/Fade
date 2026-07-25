import { PermissionFlagsBits, TextChannel, ThreadChannel, VoiceChannel } from 'discord.js';
import type { Command } from '../../types/command.js';
import { sendMessage, FadeContainer } from '../../components/builders.js';
import { e, Colours } from '../../components/emojis.js';
import { parseDuration, formatDuration } from '../../utils/moderation.js';
import { sendLog, LogColour } from '../../utils/logsender.js';

export default {
    data: { name: 'slowmode', description: 'Set the slowmode for a channel' },
    prefixOnly:      true,

    category:        'moderation',
    guildOnly:       true,
    userPermissions: [PermissionFlagsBits.ManageChannels],
    botPermissions:  [PermissionFlagsBits.ManageChannels],
    cooldown:        3,

    async prefixExecute(message, args) {
        const hasPerm = message.member!.permissions.has(PermissionFlagsBits.ManageChannels);
        if (!hasPerm) {
            const missing = new FadeContainer(Colours.DANGER)
                .text(`${e('error')} You are missing the \`ManageChannels\` permission to run this command.`)
                .build();
            return await sendMessage(message, [missing]);
        }

        let channel: any = message.channel;
        let durationStr = args[0];

        // check if they tagged a channel first
        if (message.mentions.channels.size > 0) {
            channel = message.mentions.channels.first()!;
            durationStr = args[1];
        }

        if (!durationStr) {
             const c = new FadeContainer(Colours.INFO)
                .text(`${e('shield')} Please provide a duration (e.g. \`5s\`, \`10m\`, \`0\` or \`off\`).`)
                .build();
             return await sendMessage(message, [c]);
        }

        let seconds = 0;
        if (durationStr.toLowerCase() === 'off' || durationStr === '0') {
            seconds = 0;
        } else {
            seconds = parseDuration(durationStr) || 0;
            if (!seconds && durationStr !== '0') {
                const invalid = new FadeContainer(Colours.DANGER)
                    .text(`${e('error')} Invalid duration format. Example: \`5s\`, \`10m\`, \`1h\`.`)
                    .build();
                return await sendMessage(message, [invalid]);
            }
        }

        if (seconds > 21600) {
             seconds = 21600; // max is 6 hours
        }

        if (!('setRateLimitPerUser' in channel)) {
             const c = new FadeContainer(Colours.DANGER)
                 .text(`${e('error')} You cannot set slowmode in this type of channel.`)
                 .build();
             return await sendMessage(message, [c]);
        }

        try {
            await (channel as any).setRateLimitPerUser(seconds, `Requested by ${message.author.tag}`);
        } catch (error) {
             const err = new FadeContainer(Colours.DANGER)
                 .text(`${e('error')} Failed to set slowmode. Check my permissions.`)
                 .build();
             return await sendMessage(message, [err]);
        }

        // Mod logging
        await sendLog({
            guild: message.guild!,
            category: 'mod',
            event: 'channelUpdate', 
            color: LogColour.MOD,
            title: `${e('shield')} Slowmode Updated`,
            fields: [
                { name: 'Moderator', value: `<@${message.author.id}>` },
                { name: 'Channel', value: `<#${channel.id}>` },
                { name: 'Duration', value: seconds === 0 ? 'Off' : formatDuration(seconds) },
            ],
            footer: `ID: ${message.author.id}`,
        });

        const successText = seconds === 0 
            ? `${e('success')} Slowmode disabled in <#${channel.id}>.`
            : `${e('success')} Slowmode set to \`${formatDuration(seconds)}\` in <#${channel.id}>.`;

        const success = new FadeContainer(Colours.SUCCESS)
            .text(successText)
            .build();
        await sendMessage(message, [success]);
    }
} as Command;
