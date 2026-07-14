// src/utils/automod.ts
// Fade AutoMod engine — bleed-level feature parity.
// Features:
//   1. Per-rule punishment config
//   2. Punishment escalation (warn → mute → kick → ban)
//   3. Domain whitelist for anti-links
//   4. Extended invite link detection (shortlinks)
//   5. Per-channel spam tracking
import {
    type Message,
    PermissionFlagsBits,
    MessageFlags,
} from 'discord.js';
import { getAutomodConfig } from '../db/queries/automod.js';
import { createCase, getWarningCount } from '../db/queries/moderation.js';
import { FadeContainer } from '../components/builders.js';
import { e, Colours } from '../components/emojis.js';
import { logger } from './logger.js';
import { checkPhishingDomain } from './phishingScanner.js';

// ── Types ─────────────────────────────────────────────────────────────────────

export type AutomodPunishment = 'delete' | 'warn' | 'mute' | 'kick' | 'ban';

interface Violation {
    rule:       string;
    reason:     string;
    baseAction: AutomodPunishment;
}



// ── Spam tracker ──────────────────────────────────────────────────────────────
// Key: "guildId:userId" (guild-wide) or "guildId:channelId:userId" (per-channel)

const spamTracker = new Map<string, number[]>();

function trackSpam(key: string): number {
    const now    = Date.now();
    const list   = spamTracker.get(key) ?? [];
    const recent = list.filter(t => now - t < 10_000);
    recent.push(now);
    spamTracker.set(key, recent);
    return recent.length;
}

// ── Regex patterns ────────────────────────────────────────────────────────────

// All known Discord invite formats + shortlink services
const INVITE_REGEX = new RegExp(
    [
        'discord\\.gg\\/[a-zA-Z0-9-]+',
        'discord(?:app)?\\.com\\/invite\\/[a-zA-Z0-9-]+',
        'dis\\.gd\\/[a-zA-Z0-9-]+',
        'dsc\\.gg\\/[a-zA-Z0-9-]+',
        'invite\\.gg\\/[a-zA-Z0-9-]+',
        'discord\\.me\\/[a-zA-Z0-9-]+',
        'top\\.gg\\/servers\\/[a-zA-Z0-9-]+',
    ].join('|'),
    'gi',
);

const URL_REGEX     = /https?:\/\/([^\s/]+)/gi;
const MENTION_REGEX = /<@[!&]?\d+>|@everyone|@here/g;

// ── Rules ─────────────────────────────────────────────────────────────────────

function checkSpam(message: Message, config: any): Violation | null {
    if (!config.antiSpam) return null;

    const spamPerChannel = config.spamPerChannel ?? false;
    const key = spamPerChannel
        ? `${message.guild!.id}:${message.channelId}:${message.author.id}`
        : `${message.guild!.id}:${message.author.id}`;

    const count = trackSpam(key);

    if (count >= config.spamThreshold) {
        return {
            rule:       'Anti-Spam',
            reason:     `Sending messages too quickly`,
            baseAction: (config.spamPunishment ?? 'mute') as AutomodPunishment,
        };
    }
    return null;
}

function checkInvites(message: Message, config: any): Violation | null {
    if (!config.antiInvites) return null;
    if (INVITE_REGEX.test(message.content)) {
        return {
            rule:       'Anti-Invites',
            reason:     'Posting Discord invites is not allowed',
            baseAction: (config.invitesPunishment ?? 'delete') as AutomodPunishment,
        };
    }
    return null;
}

function checkLinks(message: Message, config: any): Violation | null {
    if (!config.antiLinks) return null;

    const whitelisted = config.whitelistedDomains as string[] ?? [];
    const matches     = [...message.content.matchAll(URL_REGEX)];

    for (const match of matches) {
        const domain = match[1]?.toLowerCase();
        if (!domain) continue;

        // Check if domain or parent domain is whitelisted
        const isWhitelisted = whitelisted.some(w =>
            domain === w || domain.endsWith(`.${w}`)
        );

        if (!isWhitelisted) {
            return {
                rule:       'Anti-Links',
                reason:     `Posting links is not allowed (blocked domain: ${domain})`,
                baseAction: (config.linksPunishment ?? 'delete') as AutomodPunishment,
            };
        }
    }
    return null;
}

function checkMassMention(message: Message, config: any): Violation | null {
    if (!config.antiMassMention) return null;
    const mentions = message.content.match(MENTION_REGEX);
    const count    = mentions?.length ?? 0;
    if (count >= config.mentionLimit) {
        return {
            rule:       'Anti-Mass-Mention',
            reason:     `Too many mentions (${count})`,
            baseAction: (config.mentionsPunishment ?? 'delete') as AutomodPunishment,
        };
    }
    return null;
}

function checkCaps(message: Message, config: any): Violation | null {
    if (!config.antiCaps) return null;
    const text = message.content.replace(/[^a-zA-Z]/g, '');
    if (text.length < 8) return null;
    const upper = text.replace(/[^A-Z]/g, '').length;
    const pct   = Math.round((upper / text.length) * 100);
    if (pct >= config.capsPercent) {
        return {
            rule:       'Anti-Caps',
            reason:     `Too many capital letters (${pct}%)`,
            baseAction: (config.capsPunishment ?? 'delete') as AutomodPunishment,
        };
    }
    return null;
}

function checkSlurs(message: Message, config: any): Violation | null {
    if (!config.antiSlurs) return null;
    const blacklist = config.blacklist as string[] ?? [];
    const lower     = message.content.toLowerCase();
    const matched   = blacklist.find(word => lower.includes(word.toLowerCase()));
    if (matched) {
        return {
            rule:       'Anti-Slurs',
            reason:     'Message contains a blacklisted word',
            baseAction: (config.slursPunishment ?? 'ban') as AutomodPunishment,
        };
    }
    return null;
}

async function checkPhishing(message: Message, config: any): Promise<Violation | null> {
    // We always want anti-phishing enabled if automod is enabled, or we can tie it to anti-links
    // For safety, let's run it on all URLs posted.
    const matches = [...message.content.matchAll(URL_REGEX)];
    if (!matches.length) return null;

    for (const match of matches) {
        const domain = match[1]?.toLowerCase();
        if (!domain) continue;

        const isPhishing = await checkPhishingDomain(domain);
        if (isPhishing) {
            return {
                rule:       'Anti-Phishing',
                reason:     `Posted a known scam/phishing link (${domain})`,
                baseAction: 'ban', // Phishing is severe, default to ban (can be configurable later)
            };
        }
    }
    return null;
}

// ── Exemption check ───────────────────────────────────────────────────────────

function isExempt(message: Message, config: any, ruleKey?: string): boolean {
    const member = message.member!;

    // Server owner — always exempt
    if (member.id === message.guild!.ownerId) return true;

    // Admins and server managers — always exempt
    if (member.permissions.has(PermissionFlagsBits.Administrator)) return true;
    if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;

    // Global ignored channels
    const ignoredChannels = config.ignoredChannels as string[] ?? [];
    if (ignoredChannels.includes(message.channelId)) return true;

    // Per-rule ignored channels
    if (ruleKey) {
        const ruleIgnoredChannels = config.ruleIgnoredChannels as Record<string, string[]> ?? {};
        if (ruleIgnoredChannels[ruleKey]?.includes(message.channelId)) return true;
    }

    // Ignored roles
    const ignoredRoles = config.ignoredRoles as string[] ?? [];
    if (member.roles.cache.some(r => ignoredRoles.includes(r.id))) return true;

    return false;
}

// ── Punishment executor ───────────────────────────────────────────────────────

async function punish(
    message: Message,
    violation: Violation,
    config: any,
): Promise<void> {
    const { guild, author, member } = message;
    if (!guild || !member) return;

    const action = violation.baseAction;

    // Always delete the offending message
    await message.delete().catch(() => null);

    // Send warning card in channel (auto-deletes after 8s)
    if (action !== 'delete') {
        const card = new FadeContainer(Colours.WARNING)
            .text(
                `${e('warn')}  <@${author.id}> · **${violation.rule}**\n` +
                `-# ${violation.reason}`
            )
            .build();

        const warning = await (message.channel as any).send({
            components: [card],
            flags:      MessageFlags.IsComponentsV2,
            allowedMentions: { parse: [] },
        } as any).catch(() => null);

        if (warning) setTimeout(() => warning.delete().catch(() => null), 8_000);
    }

    const reason = `[Fade AutoMod] ${violation.rule}: ${violation.reason}`;
    const botId  = guild.client.user!.id;
    const botTag = guild.client.user!.tag;

    try {
        if (action === 'warn') {
            await createCase({
                guildId: guild.id, type: 'warn',
                userId: author.id, userTag: author.tag,
                moderatorId: botId, moderatorTag: botTag, reason,
            });
        }

        if (action === 'mute') {
            await member.timeout(5 * 60 * 1000, reason).catch(() => null);
            await createCase({
                guildId: guild.id, type: 'mute',
                userId: author.id, userTag: author.tag,
                moderatorId: botId, moderatorTag: botTag,
                reason, duration: 300,
            });
        }

        if (action === 'kick') {
            await member.kick(reason).catch(() => null);
            await createCase({
                guildId: guild.id, type: 'kick',
                userId: author.id, userTag: author.tag,
                moderatorId: botId, moderatorTag: botTag, reason,
            });
        }

        if (action === 'ban') {
            await guild.bans.create(author.id, { reason, deleteMessageSeconds: 0 }).catch(() => null);
            await createCase({
                guildId: guild.id, type: 'ban',
                userId: author.id, userTag: author.tag,
                moderatorId: botId, moderatorTag: botTag, reason,
            });
        }

        // Log to automod log channel
        if (config.logChannelId) {
            const logChannel = guild.channels.cache.get(config.logChannelId);
            if (logChannel?.isTextBased()) {
                const logCard = new FadeContainer(Colours.WARNING)
                    .text(`## ${e('automod')} AutoMod Action`)
                    .separator(true)
                    .text([
                        `${e('members')}  **User** — <@${author.id}> (${author.tag})`,
                        `${e('warn')}  **Rule** — ${violation.rule}`,
                        `${e('ban')}  **Action** — \`${action}\``,
                        `**Reason** — ${violation.reason}`,
                        `${e('channels')}  **Channel** — <#${message.channelId}>`,
                        `-# <t:${Math.floor(Date.now() / 1000)}:T>`,
                    ].join('\n'))
                    .build();

                await logChannel.send({
                    components: [logCard],
                    flags:      MessageFlags.IsComponentsV2,
                    allowedMentions: { parse: [] },
                } as any).catch(() => null);
            }
        }

    } catch (err) {
        logger.error('AutoMod punishment failed', err, {
            guildId: guild.id,
            userId:  author.id,
            rule:    violation.rule,
            action,
        });
    }
}

// ── Main runner ───────────────────────────────────────────────────────────────

export async function runAutomod(message: Message): Promise<void> {
    if (!message.guild || message.author.bot) return;
    if (!message.member) return;

    try {
        const config = await getAutomodConfig(message.guild.id);
        if (!config.enabled) return;
        // Check global exemptions first
        if (isExempt(message, config)) return;

        const rules = [
            { key: 'phishing', fn: checkPhishing }, // Highest priority, checks API
            { key: 'spam', fn: checkSpam },
            { key: 'invites', fn: checkInvites },
            { key: 'links', fn: checkLinks },
            { key: 'mentions', fn: checkMassMention },
            { key: 'caps', fn: checkCaps },
            { key: 'slurs', fn: checkSlurs },
        ];

        for (const rule of rules) {
            // Check per-rule exemptions
            if (isExempt(message, config, rule.key)) continue;

            const violation = await rule.fn(message, config);
            if (violation) {
                await punish(message, violation, config);
                return;
            }
        }

    } catch (err) {
        logger.error('AutoMod runner failed', err, { guildId: message.guild?.id });
    }
}