// src/db/schema.ts
// Complete Fade database schema.
// Every feature has its tables defined here — single source of truth.
// Run `npm run db:generate` after changes, then `npm run db:migrate`.

import {
    pgTable,
    text,
    integer,
    bigint,
    boolean,
    timestamp,
    jsonb,
    primaryKey,
    serial,
    varchar,
    index,
    uniqueIndex,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ── Helpers ───────────────────────────────────────────────────────────────────

// Discord snowflake IDs are 64-bit integers — store as text to avoid JS precision loss
const snowflake = (name: string) => text(name);
const now       = () => timestamp('created_at', { withTimezone: true }).defaultNow().notNull();
const updatedAt = () => timestamp('updated_at', { withTimezone: true }).defaultNow().notNull();

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// CORE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// One row per guild. Created when bot joins, kept when bot leaves (data preserved).
export const guilds = pgTable('guilds', {
    guildId:    snowflake('guild_id').primaryKey(),
    prefix:     varchar('prefix', { length: 10 }).default('f!').notNull(),
    locale:     varchar('locale', { length: 10 }).default('en').notNull(),
    timezone:   varchar('timezone', { length: 50 }).default('UTC').notNull(),
    isPremium:  boolean('is_premium').default(false).notNull(),
    reqrole:    snowflake('reqrole'), // Role required to use custom role aliases
    translator: boolean('translator').default(true).notNull(), // Flag to toggle translator module
    createdAt:  now(),
    updatedAt:  updatedAt(),
});

// Per-guild bot appearance settings (avatar is applied live; bio stored for reference)
export const guildBotSettings = pgTable('guild_bot_settings', {
    guildId:   snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    bio:       text('bio'),
    updatedAt: updatedAt(),
});

// Global user profiles (cross-guild)
export const users = pgTable('users', {
    userId:    snowflake('user_id').primaryKey(),
    bio:       text('bio'),
    timezone:  varchar('timezone', { length: 50 }),
    birthday:  text('birthday'), // stored as MM-DD
    createdAt: now(),
});

export const noPrefixUsers = pgTable('no_prefix_users', {
    userId:    snowflake('user_id').primaryKey(),
    expiresAt: timestamp('expires_at', { withTimezone: true }), // null = lifetime
    createdAt: now(),
});

export const roleAliases = pgTable('role_aliases', {
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    alias:     varchar('alias', { length: 32 }).notNull(),
    roleId:    snowflake('role_id').notNull(),
    createdAt: now(),
}, (t) => [
    primaryKey({ columns: [t.guildId, t.alias] }),
]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MODERATION
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const cases = pgTable('cases', {
    id:          serial('id').primaryKey(),
    guildId:     snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    caseNumber:  integer('case_number').notNull(),
    type:        varchar('type', { length: 20 }).notNull(), // ban, kick, warn, mute, timeout, unban, unmute
    userId:      snowflake('user_id').notNull(),
    userTag:     text('user_tag').notNull(),
    moderatorId: snowflake('moderator_id').notNull(),
    moderatorTag:text('moderator_tag').notNull(),
    reason:      text('reason').default('No reason provided'),
    duration:    integer('duration'),    // seconds, null = permanent
    expiresAt:   timestamp('expires_at', { withTimezone: true }),
    active:      boolean('active').default(true).notNull(),
    createdAt:   now(),
}, (t) => [
    index('cases_guild_idx').on(t.guildId),
    index('cases_user_idx').on(t.guildId, t.userId),
]);

export const notes = pgTable('notes', {
    id:          serial('id').primaryKey(),
    guildId:     snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:      snowflake('user_id').notNull(),
    moderatorId: snowflake('moderator_id').notNull(),
    content:     text('content').notNull(),
    createdAt:   now(),
});

// Fake permissions — bleed feature, moderators restricted to bot-only actions
export const fakePermissions = pgTable('fake_permissions', {
    id:         serial('id').primaryKey(),
    guildId:    snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    roleId:     snowflake('role_id').notNull(),
    permission: text('permission').notNull(), // e.g. "ban_members"
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LOGGING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const logConfig = pgTable('log_config', {
    guildId:          snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    // Each log category can go to a different channel
    messageChannel:   snowflake('message_channel'),
    memberChannel:    snowflake('member_channel'),
    modChannel:       snowflake('mod_channel'),
    serverChannel:    snowflake('server_channel'),
    voiceChannel:     snowflake('voice_channel'),
    roleChannel:      snowflake('role_channel'),
    channelChannel:   snowflake('channel_channel'),
    emojiChannel:     snowflake('emoji_channel'),
    // Toggle individual events (stored as JSON array of disabled events)
    disabledEvents:   jsonb('disabled_events').$type<string[]>().default([]),
    updatedAt:        updatedAt(),
});

export const logIgnore = pgTable('log_ignore', {
    id:       serial('id').primaryKey(),
    guildId:  snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    targetId: snowflake('target_id').notNull(),
    type:     varchar('type', { length: 10 }).notNull(), // 'user' | 'channel'
});

export const lastfmUsers = pgTable('lastfm_users', {
    userId:         snowflake('user_id').primaryKey(),
    username:       text('username').notNull(),
    cachedArtists:  jsonb('cached_artists').$type<{ name: string; plays: number }[]>().default([]),
    lastCached:     timestamp('last_cached', { withTimezone: true }),
    npMode:         text('np_mode'),          // custom embed script for nowplaying
    npReactions:    jsonb('np_reactions').$type<{ upvote: string; downvote: string }>(),
    createdAt:      now(),
});

// Crowns: who has the most plays for an artist in a guild
export const lastfmCrowns = pgTable('lastfm_crowns', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:    snowflake('user_id').notNull(),
    artist:    text('artist').notNull(),
    plays:     integer('plays').notNull(),
    updatedAt: updatedAt(),
}, (t) => [
    index('lastfm_crowns_guild_artist_idx').on(t.guildId, t.artist),
]);

export const invokeMessages = pgTable('invoke_messages', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    command:   varchar('command', { length: 20 }).notNull(), // ban, kick, warn, mute, timeout
    message:   text('message'),   // custom response in channel (null = default 👍)
    dmMessage: text('dm_message'), // custom DM to punished user (null = default)
}, (t) => [
    index('invoke_messages_guild_cmd_idx').on(t.guildId, t.command),
]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WELCOME / GOODBYE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const welcomeConfig = pgTable('welcome_config', {
    guildId:      snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    channelId:    snowflake('channel_id'),
    message:      text('message'),       // text style — plain text + variables
    embedScript:  text('embed_script'),  // embed style — {key: value}$v... syntax
    cardScript:   text('card_script'),   // card style — {key: value}$v... syntax
    dmMessage:    text('dm_message'),
    enabled:      boolean('enabled').default(false).notNull(),
    autoRoles:    jsonb('auto_roles').$type<string[]>().default([]),
    style:        varchar('style', { length: 10 }).default('embed').notNull(),
    deleteAfter:  integer('delete_after'),  // auto-delete message after N seconds (null = never)
    updatedAt:    updatedAt(),
});

export const goodbyeConfig = pgTable('goodbye_config', {
    guildId:      snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    channelId:    snowflake('channel_id'),
    message:      text('message'),
    embedScript:  text('embed_script'),
    cardScript:   text('card_script'),
    enabled:      boolean('enabled').default(false).notNull(),
    style:        varchar('style', { length: 10 }).default('embed').notNull(),
    deleteAfter:  integer('delete_after'),  // auto-delete message after N seconds (null = never)
    updatedAt:    updatedAt(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// LEVELING
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const levelConfig = pgTable('level_config', {
    guildId:          snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    enabled:          boolean('enabled').default(false).notNull(),
    xpMin:            integer('xp_min').default(15).notNull(),
    xpMax:            integer('xp_max').default(25).notNull(),
    xpCooldown:       integer('xp_cooldown').default(60).notNull(), // seconds
    announceChannel:  snowflake('announce_channel'), // null = same channel
    announceMessage:  text('announce_message'),
    // Channels where XP is disabled
    ignoredChannels:  jsonb('ignored_channels').$type<string[]>().default([]),
    ignoredRoles:     jsonb('ignored_roles').$type<string[]>().default([]),
    updatedAt:        updatedAt(),
});

export const levels = pgTable('levels', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:    snowflake('user_id').notNull(),
    xp:        bigint('xp', { mode: 'number' }).default(0).notNull(),
    level:     integer('level').default(0).notNull(),
    messages:  bigint('messages', { mode: 'number' }).default(0).notNull(),
    updatedAt: updatedAt(),
}, (t) => [
    uniqueIndex('levels_guild_user_idx').on(t.guildId, t.userId),
    index('levels_rank_idx').on(t.guildId, t.xp),
]);

export const levelRewards = pgTable('level_rewards', {
    id:      serial('id').primaryKey(),
    guildId: snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    level:   integer('level').notNull(),
    roleId:  snowflake('role_id').notNull(),
    // If true, remove role when member outlevels it
    remove:  boolean('remove').default(false).notNull(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STATS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const messageStats = pgTable('message_stats', {
    id:       serial('id').primaryKey(),
    guildId:  snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:   snowflake('user_id').notNull(),
    count:    integer('count').default(0).notNull(),
    updatedAt:updatedAt(),
}, (t) => [index('msgstats_guild_idx').on(t.guildId)]);

export const voiceStats = pgTable('voice_stats', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:    snowflake('user_id').notNull(),
    seconds:   integer('seconds').default(0).notNull(),
    updatedAt: updatedAt(),
}, (t) => [index('vcstats_guild_idx').on(t.guildId)]);

export const inviteStats = pgTable('invite_stats', {
    id:       serial('id').primaryKey(),
    guildId:  snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:   snowflake('user_id').notNull(),
    regular:  integer('regular').default(0).notNull(),
    bonus:    integer('bonus').default(0).notNull(),
    fake:     integer('fake').default(0).notNull(),
    left:     integer('left').default(0).notNull(),
}, (t) => [index('invstats_guild_idx').on(t.guildId)]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// TICKETS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const ticketPanels = pgTable('ticket_panels', {
    id:          serial('id').primaryKey(),
    guildId:     snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    channelId:   snowflake('channel_id').notNull(),
    messageId:   snowflake('message_id'),
    label:       text('label').notNull(),
    description: text('description'),
    color:       integer('color').default(0x5865F2),
    createdAt:   now(),
});

export const ticketOptions = pgTable('ticket_options', {
    id:            serial('id').primaryKey(),
    panelId:       integer('panel_id').notNull().references(() => ticketPanels.id, { onDelete: 'cascade' }),
    guildId:       snowflake('guild_id').notNull(),
    label:         text('label').notNull(),
    emoji:         text('emoji'),
    categoryId:    snowflake('category_id'),
    supportRoles:  jsonb('support_roles').$type<string[]>().default([]),
    openMessage:   text('open_message'),
    // Form fields shown before ticket opens
    formFields:    jsonb('form_fields').$type<object[]>().default([]),
    maxOpen:       integer('max_open').default(1).notNull(),
});

export const tickets = pgTable('tickets', {
    id:         serial('id').primaryKey(),
    guildId:    snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    optionId:   integer('option_id').references(() => ticketOptions.id),
    channelId:  snowflake('channel_id').notNull(),
    userId:     snowflake('user_id').notNull(),
    status:     varchar('status', { length: 20 }).default('open').notNull(), // open, closed, deleted
    claimedBy:  snowflake('claimed_by'),
    createdAt:  now(),
    closedAt:   timestamp('closed_at', { withTimezone: true }),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANTINUKE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const antinukeConfig = pgTable('antinuke_config', {
    guildId:          snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    enabled:          boolean('enabled').default(false).notNull(),
    // Punishment for nuke attempts: ban, kick, strip (remove all roles)
    punishment:       varchar('punishment', { length: 20 }).default('ban').notNull(),
    // Thresholds — how many actions in the time window triggers protection
    banThreshold:     integer('ban_threshold').default(3).notNull(),
    kickThreshold:    integer('kick_threshold').default(3).notNull(),
    roleThreshold:    integer('role_threshold').default(3).notNull(),
    channelThreshold: integer('channel_threshold').default(3).notNull(),
    webhookThreshold: integer('webhook_threshold').default(3).notNull(),
    // Time window in seconds
    timeWindow:       integer('time_window').default(10).notNull(),
    // Bot join protection
    botAdd:           boolean('bot_add').default(true).notNull(),
    banEnabled:      boolean('ban_enabled').default(true).notNull(),
    kickEnabled:     boolean('kick_enabled').default(true).notNull(),
    channelEnabled:  boolean('channel_enabled').default(true).notNull(),
    roleEnabled:     boolean('role_enabled').default(true).notNull(),
    webhookEnabled:  boolean('webhook_enabled').default(true).notNull(),
    vanityEnabled:   boolean('vanity_enabled').default(false).notNull(),
    banPunishment:   varchar('ban_punishment', { length: 10 }).default('ban').notNull(),
    kickPunishment:  varchar('kick_punishment', { length: 10 }).default('ban').notNull(),
    channelPunishment: varchar('channel_punishment', { length: 10 }).default('ban').notNull(),
    rolePunishment:  varchar('role_punishment', { length: 10 }).default('ban').notNull(),
    webhookPunishment: varchar('webhook_punishment', { length: 10 }).default('ban').notNull(),
    emojiEnabled:    boolean('emoji_enabled').default(true).notNull(),
    emojiThreshold:  integer('emoji_threshold').default(5).notNull(),
    emojiPunishment: varchar('emoji_punishment', { length: 10 }).default('ban').notNull(),
    logChannelId:    snowflake('log_channel_id'),
    updatedAt:        updatedAt(),
});

export const antinukeWhitelist = pgTable('antinuke_whitelist', {
    id:       serial('id').primaryKey(),
    guildId:  snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:   snowflake('user_id').notNull(),
    addedBy:  snowflake('added_by').notNull(),
    createdAt:now(),
});
export const antinukeAdmins = pgTable('antinuke_admins', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:    snowflake('user_id').notNull(),
    addedBy:   snowflake('added_by').notNull(),
    createdAt: now(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ANTIRAID (join gate)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const antiraidConfig = pgTable('antiraid_config', {
    guildId:         snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    enabled:         boolean('enabled').default(false).notNull(),
    joinThreshold:   integer('join_threshold').default(10).notNull(),
    joinWindow:      integer('join_window').default(10).notNull(),
    action:          varchar('action', { length: 20 }).default('kick').notNull(),
    minAccountAge:   integer('min_account_age').default(0).notNull(),
    requireAvatar:   boolean('require_avatar').default(false).notNull(),
    lockOnRaid:      boolean('lock_on_raid').default(false).notNull(),
    updatedAt:       updatedAt(),
});

export const antiraidWhitelist = pgTable('antiraid_whitelist', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:    snowflake('user_id').notNull(),
    createdAt: now(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// AUTOMOD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const automodConfig = pgTable('automod_config', {
    guildId:        snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    enabled:        boolean('enabled').default(false).notNull(),
    logChannelId:   snowflake('log_channel_id'),
    ignoredRoles:   jsonb('ignored_roles').$type<string[]>().default([]),
    ignoredChannels:jsonb('ignored_channels').$type<string[]>().default([]),
    ruleIgnoredChannels: jsonb('rule_ignored_channels').$type<Record<string, string[]>>().default({}),
    blacklist: jsonb('blacklist').$type<string[]>().default([]),
    // Individual rule toggles
    antiSpam:       boolean('anti_spam').default(false).notNull(),
    antiLinks:      boolean('anti_links').default(false).notNull(),
    antiInvites:    boolean('anti_invites').default(false).notNull(),
    antiMassMention:boolean('anti_mass_mention').default(false).notNull(),
    antiCaps:       boolean('anti_caps').default(false).notNull(),
    antiSlurs:      boolean('anti_slurs').default(false).notNull(),
    // Per-rule punishments
    spamPunishment:    varchar('spam_punishment', { length: 10 }).default('mute').notNull(),
    linksPunishment:   varchar('links_punishment', { length: 10 }).default('delete').notNull(),
    invitesPunishment: varchar('invites_punishment', { length: 10 }).default('delete').notNull(),
    mentionsPunishment:varchar('mentions_punishment', { length: 10 }).default('delete').notNull(),
    capsPunishment:    varchar('caps_punishment', { length: 10 }).default('delete').notNull(),
    slursPunishment:   varchar('slurs_punishment', { length: 10 }).default('ban').notNull(),
    whitelistedDomains:jsonb('whitelisted_domains').$type<string[]>().default([]),
    spamPerChannel:    boolean('spam_per_channel').default(false).notNull(),
    // Thresholds
    spamThreshold:  integer('spam_threshold').default(5).notNull(),
    mentionLimit:   integer('mention_limit').default(5).notNull(),
    capsPercent:    integer('caps_percent').default(70).notNull(),
    updatedAt:      updatedAt(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ROLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const reactionRoles = pgTable('reaction_roles', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    channelId: snowflake('channel_id').notNull(),
    messageId: snowflake('message_id').notNull(),
    emoji:     text('emoji').notNull(),
    roleId:    snowflake('role_id').notNull(),
    exclusive: boolean('exclusive').default(false).notNull(),
});

export const buttonRoles = pgTable('button_roles', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    channelId: snowflake('channel_id').notNull(),
    messageId: snowflake('message_id').notNull(),
    label:     text('label').notNull(),
    emoji:     text('emoji'),
    roleId:    snowflake('role_id').notNull(),
    style:     integer('style').default(2).notNull(), // discord button style
    exclusive: boolean('exclusive').default(false).notNull(),
});

// Vanity roles — guild config (keyword to monitor + optional award channel/message)
export const vanityConfig = pgTable('vanity_config', {
    guildId:    snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    keyword:    text('keyword').notNull(),          // substring to look for in status (e.g. "/fade")
    channelId:  snowflake('channel_id'),            // channel to send award message
    message:    text('message'),                    // custom award message
    enabled:    boolean('enabled').default(true).notNull(),
    updatedAt:  updatedAt(),
});

// Vanity roles — one row per role awarded for vanity
export const vanityRoles = pgTable('vanity_roles', {
    id:       serial('id').primaryKey(),
    guildId:  snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    roleId:   snowflake('role_id').notNull(),
});

// Native Discord Server Tags (Clan tags)
export const serverTagConfig = pgTable('server_tag_config', {
    guildId:    snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    roleId:     snowflake('role_id'),               // role to grant
    channelId:  snowflake('channel_id'),            // channel for award message
    message:    text('message'),                    // custom award message text
    image:      text('image'),                      // custom award message image/banner URL
    enabled:    boolean('enabled').default(false).notNull(),
    updatedAt:  updatedAt(),
});

export const boosterRoles = pgTable('booster_roles', {
    id:       serial('id').primaryKey(),
    guildId:  snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:   snowflake('user_id').notNull(),
    roleId:   snowflake('role_id').notNull(),
    createdAt:now(),
});

// Guild-level config for the booster role system
export const boosterRoleConfig = pgTable('booster_role_config', {
    guildId:    snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    baseRoleId: snowflake('base_role_id'),   // custom roles are placed below this
    awardRoleId:snowflake('award_role_id'),  // role auto-granted on boost
    updatedAt:  updatedAt(),
});

export const tempRoles = pgTable('temp_roles', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:    snowflake('user_id').notNull(),
    roleId:    snowflake('role_id').notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    createdAt: now(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// STARBOARD
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const starboardConfig = pgTable('starboard_config', {
    guildId:        snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    channelId:      snowflake('channel_id'),
    emoji:          text('emoji').default('⭐').notNull(),
    threshold:      integer('threshold').default(3).notNull(),
    enabled:        boolean('enabled').default(false).notNull(),
    ignoreNsfw:     boolean('ignore_nsfw').default(true).notNull(),
    selfStar:       boolean('self_star').default(false).notNull(),
    showTimestamp:  boolean('show_timestamp').default(true).notNull(),
    showJumpUrl:    boolean('show_jump_url').default(true).notNull(),
    showAttachments:boolean('show_attachments').default(true).notNull(),
    color:          integer('color'),
    // Clownboard
    clownChannelId: snowflake('clown_channel_id'),
    clownEmoji:     text('clown_emoji').default('🤡').notNull(),
    clownThreshold: integer('clown_threshold').default(3).notNull(),
    clownEnabled:   boolean('clown_enabled').default(false).notNull(),
    updatedAt:      updatedAt(),
});

export const starboardEntries = pgTable('starboard_entries', {
    id:              serial('id').primaryKey(),
    guildId:         snowflake('guild_id').notNull(),
    originalId:      snowflake('original_id').notNull(),      // original message ID
    starboardId:     snowflake('starboard_id'),               // posted message ID
    authorId:        snowflake('author_id').notNull(),
    channelId:       snowflake('channel_id').notNull(),
    starCount:       integer('star_count').default(0).notNull(),
    createdAt:       now(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// GIVEAWAYS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const giveaways = pgTable('giveaways', {
    id:            serial('id').primaryKey(),
    guildId:       snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    channelId:     snowflake('channel_id').notNull(),
    messageId:     snowflake('message_id'),
    hostId:        snowflake('host_id').notNull(),
    prize:         text('prize').notNull(),
    winnerCount:   integer('winner_count').default(1).notNull(),
    requiredRole:  snowflake('required_role'),
    requiredRoles: jsonb('required_roles').$type<string[]>().default([]),
    minLevel:      integer('min_level').default(0).notNull(),
    description:   text('description'),
    thumbnail:     text('thumbnail'),
    image:         text('image'),
    status:        varchar('status', { length: 20 }).default('active').notNull(),
    endsAt:        timestamp('ends_at', { withTimezone: true }).notNull(),
    createdAt:     now(),
});

export const giveawayEntries = pgTable('giveaway_entries', {
    id:          serial('id').primaryKey(),
    giveawayId:  integer('giveaway_id').notNull().references(() => giveaways.id, { onDelete: 'cascade' }),
    userId:      snowflake('user_id').notNull(),
    createdAt:   now(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEBHOOKS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const webhooks = pgTable('webhooks', {
    id:         serial('id').primaryKey(),
    guildId:    snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    name:       text('name').notNull(),          // user-defined identifier
    channelId:  snowflake('channel_id').notNull(),
    webhookId:  text('webhook_id').notNull(),     // Discord webhook ID
    webhookUrl: text('webhook_url').notNull(),    // Discord webhook URL (token included)
    username:   text('username'),                 // display name override
    avatarUrl:  text('avatar_url'),               // avatar override
    createdBy:  snowflake('created_by').notNull(),
    createdAt:  now(),
}, (t) => [
    index('webhooks_guild_idx').on(t.guildId),
]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MUSIC
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const musicConfig = pgTable('music_config', {
    guildId:    snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    djRoleId:   snowflake('dj_role_id'),
    volume:     integer('volume').default(100).notNull(),
    stay247:    boolean('stay_247').default(false).notNull(),
    autoplay:   boolean('autoplay').default(false).notNull(),
    updatedAt:  updatedAt(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MISCELLANEOUS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const afk = pgTable('afk', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:    snowflake('user_id').notNull(),
    reason:    text('reason').default('AFK'),
    createdAt: now(),
});

export const reminders = pgTable('reminders', {
    id:          serial('id').primaryKey(),
    userId:      snowflake('user_id').notNull(),
    channelId:   snowflake('channel_id').notNull(),
    guildId:     snowflake('guild_id'),              // null = DM
    message:     text('message').notNull(),
    remindAt:    timestamp('remind_at', { withTimezone: true }).notNull(),
    createdAt:   now(),
}, (t) => [
    index('reminders_remind_at_idx').on(t.remindAt),
]);

export const birthdays = pgTable('birthdays', {
    id:         serial('id').primaryKey(),
    guildId:    snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:     snowflake('user_id').notNull(),
    birthday:   text('birthday').notNull(),   // MM-DD
    timezone:   text('timezone').default('UTC').notNull(),
}, (t) => [
    index('birthdays_guild_user_idx').on(t.guildId, t.userId),
]);

export const birthdayConfig = pgTable('birthday_config', {
    guildId:   snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    channelId: snowflake('channel_id'),
    roleId:    snowflake('role_id'),
    message:   text('message'),              // plain text, {embed}$v... script, or {card}$v... script
    style:     varchar('style', { length: 10 }).default('text').notNull(), // text | embed | card
    enabled:   boolean('enabled').default(true).notNull(),
    updatedAt: updatedAt(),
});

export const bumpReminder = pgTable('bump_reminder', {
    guildId:    snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    channelId:  snowflake('channel_id').notNull(),
    roleId:     snowflake('role_id'),          // role to ping
    message:    text('message'),
    lastBump:   timestamp('last_bump', { withTimezone: true }),
    enabled:    boolean('enabled').default(true).notNull(),
});

// Auto-responders (triggers → response)
export const responders = pgTable('responders', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    trigger:   text('trigger').notNull(),
    response:  text('response').notNull(),
    // strict = exact match, contains = substring, startsWith
    matchType: varchar('match_type', { length: 20 }).default('contains').notNull(),
    enabled:   boolean('enabled').default(true).notNull(),
    createdAt: now(),
});

// Reaction triggers (message → auto reaction)
export const reactionTriggers = pgTable('reaction_triggers', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    trigger:   text('trigger').notNull(),
    emoji:     text('emoji').notNull(),
    matchType: varchar('match_type', { length: 20 }).default('contains').notNull(),
    enabled:   boolean('enabled').default(true).notNull(),
});

// Scheduled/timer messages
export const timerMessages = pgTable('timer_messages', {
    id:         serial('id').primaryKey(),
    guildId:    snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    channelId:  snowflake('channel_id').notNull(),
    message:    text('message').notNull(),
    interval:   integer('interval').notNull(), // seconds
    lastSent:   timestamp('last_sent', { withTimezone: true }),
    enabled:    boolean('enabled').default(true).notNull(),
    createdAt:  now(),
});

// Sticky messages (kept at the bottom of a channel)
export const stickyMessages = pgTable('sticky_messages', {
    id:            serial('id').primaryKey(),
    guildId:       snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    channelId:     snowflake('channel_id').notNull(),
    message:       text('message').notNull(),
    enabled:       boolean('enabled').default(true).notNull(),
    cooldown:      integer('cooldown').default(30).notNull(), // seconds
    lastMessageId: snowflake('last_message_id'),
    lastSent:      timestamp('last_sent', { withTimezone: true }),
    createdAt:     now(),
    updatedAt:     updatedAt(),
}, (t) => [
    index('sticky_messages_channel_idx').on(t.guildId, t.channelId),
]);

// Channel/member/role counters in voice channel names
export const counters = pgTable('counters', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    channelId: snowflake('channel_id').notNull(),
    type:      varchar('type', { length: 20 }).notNull(), // members, online, bots, roles, channels
    template:  text('template').notNull(),                 // e.g. "Members: {count}"
    enabled:   boolean('enabled').default(true).notNull(),
});

// Command aliases (bleed feature — users create shortcuts to commands)
export const commandAliases = pgTable('command_aliases', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    alias:     text('alias').notNull(),
    command:   text('command').notNull(),
    createdBy: snowflake('created_by').notNull(),
    createdAt: now(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// VOICEMASTER
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const voicemasterConfig = pgTable('voicemaster_config', {
    guildId:         snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    // The "join to create" channel
    joinChannelId:   snowflake('join_channel_id'),
    // Category where temp channels are created
    categoryId:      snowflake('category_id'),
    // Global static interface location
    interfaceChannelId: snowflake('interface_channel_id'),
    interfaceMessageId: snowflake('interface_message_id'),
    // Default settings for new temp channels
    defaultName:     text('default_name').default('{user}\'s channel'),
    defaultLimit:    integer('default_limit').default(0), // 0 = unlimited
    enabled:         boolean('enabled').default(false).notNull(),
    updatedAt:       updatedAt(),
});

export const tempVoiceChannels = pgTable('temp_voice_channels', {
    channelId: snowflake('channel_id').primaryKey(),
    guildId:   snowflake('guild_id').notNull(),
    ownerId:   snowflake('owner_id').notNull(),
    createdAt: now(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// FORTNITE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const fortniteShopConfig = pgTable('fortnite_shop_config', {
    guildId:     snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    channelId:   snowflake('channel_id').notNull(),
    roleId:      snowflake('role_id'),
    voting:      boolean('voting').default(false).notNull(),
    lastShopDate:text('last_shop_date'),  // YYYY-MM-DD of last posted shop
    messageId:   snowflake('message_id'), // last posted shop message
    updatedAt:   updatedAt(),
});

export const fortniteWatches = pgTable('fortnite_watches', {
    id:        serial('id').primaryKey(),
    userId:    snowflake('user_id').notNull(),
    cosmetic:  text('cosmetic').notNull(), // lowercase cosmetic name
    createdAt: now(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SOCIAL NOTIFICATIONS
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const socialNotifications = pgTable('social_notifications', {
    id:          serial('id').primaryKey(),
    guildId:     snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    channelId:   snowflake('channel_id').notNull(),
    platform:    varchar('platform', { length: 20 }).notNull(), // youtube, twitch, twitter
    accountId:   text('account_id').notNull(),
    accountName: text('account_name').notNull(),
    message:     text('message'),         // custom notification message
    roleId:      snowflake('role_id'),    // role to ping
    enabled:     boolean('enabled').default(true).notNull(),
    lastPostId:  text('last_post_id'),    // track last posted content
    createdAt:   now(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// ECONOMY
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Per-guild economy configuration
export const economyConfig = pgTable('economy_config', {
    guildId:          snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    enabled:          boolean('enabled').default(false).notNull(),
    currencyName:     text('currency_name').default('coins').notNull(),
    currencyEmoji:    text('currency_emoji').default('🪙').notNull(),
    // Daily
    dailyAmount:      integer('daily_amount').default(100).notNull(),
    streakBonus:      boolean('streak_bonus').default(true).notNull(),
    // Work
    workMin:          integer('work_min').default(20).notNull(),
    workMax:          integer('work_max').default(80).notNull(),

    // Rob
    robEnabled:       boolean('rob_enabled').default(true).notNull(),
    robSuccessRate:   integer('rob_success_rate').default(40).notNull(), // % chance success
    robMinBalance:    integer('rob_min_balance').default(100).notNull(), // target must have this in wallet
    robFailPenalty:   integer('rob_fail_penalty').default(50).notNull(), // coins lost on fail
    // Gambling
    maxBet:           integer('max_bet').default(0).notNull(),           // 0 = unlimited
    updatedAt:        updatedAt(),
});

// Per-user per-guild wallet
export const economyWallets = pgTable('economy_wallets', {
    id:           serial('id').primaryKey(),
    guildId:      snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:       snowflake('user_id').notNull(),
    balance:      integer('balance').default(0).notNull(),       // spendable, rob-able
    bank:         integer('bank').default(0).notNull(),          // safe from rob
    totalEarned:  integer('total_earned').default(0).notNull(),  // lifetime earnings
    lastDaily:    timestamp('last_daily', { withTimezone: true }),
    dailyStreak:  integer('daily_streak').default(0).notNull(),
    lastWork:     timestamp('last_work', { withTimezone: true }),
    lastRob:      timestamp('last_rob', { withTimezone: true }),
    lastGamble:   timestamp('last_gamble', { withTimezone: true }),
    lastSlots:    timestamp('last_slots', { withTimezone: true }),
    createdAt:    now(),
    updatedAt:    updatedAt(),
}, (t) => [
    index('economy_wallets_guild_idx').on(t.guildId),
    index('economy_wallets_guild_user_idx').on(t.guildId, t.userId),
    index('economy_wallets_wealth_idx').on(t.guildId, t.balance, t.bank),
]);

// Append-only transaction ledger
export const economyTransactions = pgTable('economy_transactions', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:    snowflake('user_id').notNull(),
    type:      varchar('type', { length: 20 }).notNull(), // daily, work, rob, transfer, shop, gamble, slots, coinflip, admin
    amount:    integer('amount').notNull(),               // positive = earned, negative = spent
    note:      text('note'),
    createdAt: now(),
}, (t) => [
    index('economy_tx_guild_user_idx').on(t.guildId, t.userId),
]);

// Guild shop items
export const economyShop = pgTable('economy_shop', {
    id:          serial('id').primaryKey(),
    guildId:     snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    name:        text('name').notNull(),
    description: text('description'),
    price:       integer('price').notNull(),
    type:        varchar('type', { length: 20 }).default('custom').notNull(), // role | custom
    roleId:      snowflake('role_id'),                   // if type = role
    stock:       integer('stock').default(-1).notNull(), // -1 = unlimited
    enabled:     boolean('enabled').default(true).notNull(),
}, (t) => [
    index('economy_shop_guild_idx').on(t.guildId),
]);

// User purchase records
export const economyPurchases = pgTable('economy_purchases', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:    snowflake('user_id').notNull(),
    itemId:    integer('item_id').notNull().references(() => economyShop.id, { onDelete: 'cascade' }),
    quantity:  integer('quantity').notNull().default(1),
    createdAt: now(),
}, (t) => [
    index('economy_purchases_guild_user_idx').on(t.guildId, t.userId),
]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// COMMAND MANAGEMENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const disabledCommands = pgTable('disabled_commands', {
    id:          serial('id').primaryKey(),
    guildId:     snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    target:      varchar('target', { length: 50 }).notNull(), // e.g., 'command:play' or 'category:economy'
    channelId:   snowflake('channel_id'), // null means disabled globally
    createdAt:   now(),
}, (t) => [
    index('disabled_commands_guild_idx').on(t.guildId),
    uniqueIndex('disabled_commands_unique_idx').on(t.guildId, t.target, t.channelId),
]);

export const restrictedCommands = pgTable('restricted_commands', {
    id:          serial('id').primaryKey(),
    guildId:     snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    target:      varchar('target', { length: 50 }).notNull(), // e.g., 'command:play' or 'category:economy'
    type:        varchar('type', { length: 20 }).notNull(),   // 'role' or 'channel'
    entityId:    snowflake('entity_id').notNull(),            // Role ID or Channel ID
    createdAt:   now(),
}, (t) => [
    index('restricted_commands_guild_idx').on(t.guildId),
    uniqueIndex('restricted_commands_unique_idx').on(t.guildId, t.target, t.type, t.entityId),
]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// MUSIC / VOICE
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const twentyFourSeven = pgTable('twenty_four_seven', {
    guildId:   snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    voiceId:   snowflake('voice_id').notNull(),
    textId:    snowflake('text_id').notNull(),
    createdAt: now(),
});

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// REPUTATION SYSTEM
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const reputation = pgTable('reputation', {
    guildId:      snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:       snowflake('user_id').notNull(),
    helperRep:    integer('helper_rep').default(0).notNull(),
    developerRep: integer('developer_rep').default(0).notNull(),
    artistRep:    integer('artist_rep').default(0).notNull(),
    trustedRep:   integer('trusted_rep').default(0).notNull(),
    createdAt:    now(),
    updatedAt:    updatedAt(),
}, (t) => [
    primaryKey({ columns: [t.guildId, t.userId] }),
]);

export const repCooldowns = pgTable('rep_cooldowns', {
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    giverId:   snowflake('giver_id').notNull(),
    lastThank: timestamp('last_thank', { withTimezone: true }).notNull(),
}, (t) => [
    primaryKey({ columns: [t.guildId, t.giverId] }),
]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// WEEKLY SCRAPBOOK
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export const scrapbookArchives = pgTable('scrapbook_archives', {
    guildId:   snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    snapshotData: jsonb('snapshot_data').notNull(),
    createdAt: timestamp('created_at').defaultNow().notNull(),
});

export const scrapbookUsers = pgTable('scrapbook_users', {
    guildId:      snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    userId:       snowflake('user_id').notNull(),
    messageCount: integer('message_count').default(0).notNull(),
    nightOwlCount: integer('night_owl_count').default(0).notNull(),
    voiceSeconds: integer('voice_seconds').default(0).notNull(),
}, (t) => [
    primaryKey({ columns: [t.guildId, t.userId] }),
]);

export const scrapbookMessages = pgTable('scrapbook_messages', {
    id:               serial('id').primaryKey(),
    guildId:          snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    messageId:        snowflake('message_id').notNull(),
    authorId:         snowflake('author_id').notNull(),
    content:          text('content').notNull(),
    reactionCount:    integer('reaction_count').default(0).notNull(),
    comedyCount:      integer('comedy_count').default(0).notNull(), // tracks 😂, 🤣, 💀, 😭
    createdAt:        now(),
}, (t) => [
    uniqueIndex('scrapbook_msg_unique_idx').on(t.guildId, t.messageId),
]);

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
// SERVER MEMORY AI
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// Stores guild "memories" — facts taught by admins or scraped from channels.
// The embedding column is stored as TEXT (JSON array) since Drizzle doesn't have
// a built-in pgvector type. Raw SQL is used for cosine similarity searches.
export const serverMemories = pgTable('server_memories', {
    id:        serial('id').primaryKey(),
    guildId:   snowflake('guild_id').notNull().references(() => guilds.guildId, { onDelete: 'cascade' }),
    content:   text('content').notNull(),               // The raw fact/text
    addedBy:   snowflake('added_by').notNull(),          // Discord user ID of who added it
    embedding: text('embedding').notNull(),              // JSON stringified number[] vector
    createdAt: now(),
});

// Per-guild AI config
export const aiConfig = pgTable('ai_config', {
    guildId:   snowflake('guild_id').primaryKey().references(() => guilds.guildId, { onDelete: 'cascade' }),
    enabled:   boolean('enabled').default(true).notNull(),
    updatedAt: updatedAt(),
});