// src/utils/moderation.ts
// Shared utilities for all moderation commands.
// DM notifications, permission checks, duration parsing, case cards.
import {
    type GuildMember,
    type Guild,
    type User,
    EmbedBuilder,
    ContainerBuilder,
    TextDisplayBuilder,
    SeparatorBuilder,
    SeparatorSpacingSize,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
    MessageFlags,
} from 'discord.js';
import { e, Colours } from '../components/emojis.js';
import { FadeContainer, btn } from '../components/builders.js';
import type { CaseType } from '../db/queries/moderation.js';

// ── Permission checks ─────────────────────────────────────────────────────────

export function canModerate(
    moderator: GuildMember,
    target: GuildMember,
    action: string,
): { ok: boolean; reason?: string } {
    // Can't moderate yourself
    if (moderator.id === target.id) {
        return { ok: false, reason: "You can't moderate yourself." };
    }

    // Server owner can bypass member role hierarchy checks
    const moderatorIsOwner = moderator.id === target.guild.ownerId;

    // Can't moderate the guild owner
    if (target.id === target.guild.ownerId) {
        return { ok: false, reason: "You can't moderate the server owner." };
    }

    // Role hierarchy check
    if (!moderatorIsOwner && moderator.roles.highest.position <= target.roles.highest.position) {
        return { ok: false, reason: "You can't moderate someone with an equal or higher role." };
    }

    // Bot hierarchy check
    const botMember = target.guild.members.me;
    if (botMember && botMember.roles.highest.position <= target.roles.highest.position) {
        return { ok: false, reason: "I can't moderate someone with a role higher than mine." };
    }

    return { ok: true };
}

// ── Duration parser ───────────────────────────────────────────────────────────
// Parses "1d2h30m" style strings into seconds

export function parseDuration(input: string): number | null {
    const regex = /(\d+)\s*(s|sec|second|m|min|minute|h|hr|hour|d|day|w|week)/gi;
    let total = 0;
    let matched = false;

    for (const match of input.matchAll(regex)) {
        matched = true;
        const value = parseInt(match[1]);
        const unit  = match[2].toLowerCase();

        if      (unit.startsWith('s')) total += value;
        else if (unit.startsWith('m')) total += value * 60;
        else if (unit.startsWith('h')) total += value * 3600;
        else if (unit.startsWith('d')) total += value * 86400;
        else if (unit.startsWith('w')) total += value * 604800;
    }

    return matched ? total : null;
}

export function formatDuration(seconds: number): string {
    if (seconds < 60)      return `${seconds}s`;
    if (seconds < 3600)    return `${Math.floor(seconds / 60)}m`;
    if (seconds < 86400)   return `${Math.floor(seconds / 3600)}h`;
    if (seconds < 604800)  return `${Math.floor(seconds / 86400)}d`;
    return `${Math.floor(seconds / 604800)}w`;
}

// ── DM notification ───────────────────────────────────────────────────────────

const ACTION_LABELS: Record<CaseType, string> = {
    ban:     'Banned',
    kick:    'Kicked',
    warn:    'Warned',
    mute:    'Muted',
    unmute:  'Unmuted',
    unban:   'Unbanned',
    timeout: 'Timed out',
    softban: 'Softbanned',
    strip:   'Roles stripped',
};

export async function dmUser(
    user: User,
    guild: Guild,
    type: CaseType,
    reason: string,
    caseNumber: number,
    duration?: number,
    customDm?: string | null,
): Promise<boolean> {
    try {
        // Use custom DM if set
        if (customDm) {
            await user.send({ content: customDm }).catch(() => null);
            return true;
        }

        const label    = ACTION_LABELS[type];
        const durationStr = duration ? ` for **${formatDuration(duration)}**` : '';

        const container = new FadeContainer(
            type === 'warn'   ? Colours.WARNING :
            type === 'unmute' ? Colours.SUCCESS  :
            type === 'unban'  ? Colours.SUCCESS  :
            Colours.DANGER
        )
            .text(`## You have been ${label} in **${guild.name}**`)
            .separator(true)
            .text(
                `${e('id')}  **Case** — \`#${caseNumber}\`\n` +
                `**Reason** — ${reason}` +
                (durationStr ? `\n${e('uptime')}  **Duration** —${durationStr}` : '')
            )
            .separator(false)
            .text(`-# If you believe this is a mistake, contact the server staff.`)
            .build();

        await user.send({
            components: [container],
            flags: MessageFlags.IsComponentsV2,
        } as any);

        return true;
    } catch {
        // DMs disabled — not an error, just log it
        return false;
    }
}

// ── Case response card ────────────────────────────────────────────────────────

export function buildCaseCard(opts: {
    type:         CaseType;
    caseNumber:   number;
    user:         User;
    moderator:    User;
    reason:       string;
    duration?:    number;
    dmSent?:      boolean;
}) {
    const label = ACTION_LABELS[opts.type];
    const color = opts.type === 'warn'   ? Colours.WARNING
                : opts.type === 'unmute' ? Colours.SUCCESS
                : opts.type === 'unban'  ? Colours.SUCCESS
                : Colours.DANGER;

    const lines = [
        `${e('success')}  **${label}** — ${opts.user.tag}`,
        ``,
        `${e('id')}  **Case** — \`#${opts.caseNumber}\``,
        `${e('members')}  **User** — <@${opts.user.id}>`,
        `${e('shield')}  **Moderator** — <@${opts.moderator.id}>`,
        `**Reason** — ${opts.reason}`,
    ];

    if (opts.duration) {
        lines.push(`${e('uptime')}  **Duration** — \`${formatDuration(opts.duration)}\``);
    }

    if (opts.dmSent === false) {
        lines.push(`-# Could not DM user (DMs disabled)`);
    }

    return new FadeContainer(color)
        .text(lines.join('\n'))
        .build();
}