// src/components/emojis.ts
// Fade's emoji system.
// Unicode symbols are used now — they work everywhere with zero setup.
// When you upload application emojis via Discord Developer Portal,
// replace the EMOJI_IDS values and flip USE_CUSTOM_EMOJIS to true.
//
// How to upload application emojis:
//   Discord Developer Portal → Your App → Emojis → Upload
//   Then copy the emoji ID and paste into EMOJI_IDS below.

// Enable custom application emojis by setting the env var `USE_CUSTOM_EMOJIS=true`
// or by flipping this constant to `true` for a quick local change.
// Enable custom emojis by default for testing. Set USE_CUSTOM_EMOJIS='false' to disable.
const USE_CUSTOM_EMOJIS = process.env.USE_CUSTOM_EMOJIS === 'false' ? false : true;

// Placeholder IDs — fill these in after uploading to Developer Portal
const EMOJI_IDS: Record<string, string> = {

    goodping: '<:pinggreenbars:1507793711499579572>',
    mediumping: '<:pingamberbars:1507793690733580288>',
    badping: '<:pingredbars:1507793658215403663>',
    server: '<:server:1507801893844287710>',
    owner: '<:owner:1507802031656534146>',
    channels: '<:textchannel:1507802166256210042>',
    voice: '<:voicechannel:1507801949133864970>',
    members: '<:members:1507807708093354095>',
    bot: '<:bot:1508099321365794846>',
    id: '<:id:1508099411014848522>',
    date: '<:dategradcal:1507799417015636068>',
    roles: '<:roles:1507803370491219978>',
    success: '<:tick:1507811177634467850>',
    error: '<:cross:1507811231317102723>',
    latency: '<:latency:1507797716707704924>',
    shard: '<:shard:1507798188206194771>',
    uptime: '<:uptime:1508103886886666260>',
    refresh: '<:refresh:1508101984618680480>',
    shield: '<:verificationlevelnone:1507806631667437728>',
    verificationlevellow: '<:verificationlevellow:1507804581759942786>',
    verificationlevelmedium: '<:verificationlevelmedium:1507804617247953039>',
    verificationlevelhigh: '<:verificationlevelhigh:1507804658800922624>',
    verificationlevelhighest: '<:verificationlevelhighest:1507804694368485386>',
    verificationlevelverified: '<:verificationverifiedgreen:1507804726144794754>',
    warn: '<:warning:1507810585796939978>',
    star: '<:star:1508102130748362804>',
    crown: '<:crown:1508103725200441375>',
    trophy: '<:trophy:1507811676639068332>',
    online: '<:online:1508099658180984842>',
    idle: '<:idle:1508099623456215040>',
    dnd: '<:dnd:1508099593962000584>',
    offline: '<:offline:1508099696197898360>',
    ban: '<:moderationhammerred:1507812194971156480>',
    kick: '<:moderationkickamber:1507812220078264482>',
    mute: '<:moderationmutered:1507812248461246655>',
    music: '<:music48:1508104243649974346>',
    ticket: '<:ticket:1508102271672520888>',
    level: '<:level:1508103781265572080>',
    invite: '<:invite:1508101820772384998>',
    boost: '<:boost:1507807632856191096>',
    lock: '<:lock:1508101921259524307>',
    unlock: '<:unlock:1508102211131932835>',
    settings: '<:settings:1508102062536130631>',
    stats: '<:stats:1508102163245695037>',
    search: '<:search:1508102014679126080>',
    link: '<:link:1508101881950371961>',
    back: '<:back:1508101692804305036>',
    forward: '<:forward:1508101724601319506>',
    close: '<:close:1508101756544880713>',
    category: '<:categorys:1507807727093813291>',
    automod: '<:automod:1508114857298231346>',
    logs: '<:logs:1508120702656712844>',
    gift: '<:gift:1512355407962837012>',
    tada: '<a:tada:1512355452048900226>',
    heartdot: '<:heardot:1512355432079818823>',
    ticketbutton: '<a:ticketbutton:1512522377051766905>',
    protect: '<:protect:1514293016867901543>',
    vcunmute: '<:vcunmute:1516715017104527461>',
    vcmute: '<:vcmute:1516714622194024478>',
    vcban: '<:vcban:1516714296950784210>',
    vcunban: '<:vcunban:1516714854864519261>',
    vchide: '<:vchide:1516714416135999689>',
    vcunhide: '<:vcunhide:1516714919041699890>',
    vcstatus: '<:vcstatus:1516714783146250410>',
    vckick: '<:vckick:1516714496167645234>',
    vclock: '<:vclock:1516714571942068315>',
    vcunlock: '<:vcunlock:1516714967259283566>',
    vcdeafen: '<:vcdeafen:1516714376684372068>',
    vcundeafen: '<:vcundeafen:1516714886959202365>',
    vctransfer: '<:vctransfer:1516714816859930754>',
    vcclaim: '<:vcclaim:1516714340336668712>',
    vcremove: '<:vcremove:1516714742956429362>',
    vcprivacy: '<:vcprivacy:1516714711075262584>',
    vclimit: '<:vclimit:1516714528279236628>',
    vcinvite: '<:vcinvite:1516714458041417858>',
    vcpermit: '<:vcpermit:1516714675675463700>',
    afkset: '<:afkset:1518968712257081516>',
    isafk: '<a:isafk:1518968827369488527>',
    welcomeback: '<:wave:1518968774001168395>',
    loading: '<a:loading:1527670885647908875>',
    pinkarrow: '<a:pinkarrow:1527708995769466962>',
    statistics:'<:statistics:1527745278063677651>',
    detective:'<:detective:1529500367421964359>'
};

// Unicode fallbacks — aesthetic, minimal, consistent
const UNICODE = {
    ping: '🏓',
    goodping: '🟢🏓',
    mediumping: '🟡🏓',
    badping: '🔴🏓',
    server: '🌐',
    owner: '👑',
    channels: '💬',
    voice: '🔊',
    members: '👥',
    bot: '🤖',
    id: '#',
    date: '📅',
    roles: '🎭',
    success: '✓',
    error: '✗',
    latency: '⚡',
    shard: '◈',
    uptime: '⏲',
    refresh: '↺',
    verificationlevellow: '🟢',
    verificationlevelmedium: '🟡',
    verificationlevelhigh: '🟠',
    verificationlevelhighest: '🔴',
    verificationlevelverified: '✅',
    shield: '🛡',
    warn: '⚠',
    star: '✦',
    crown: '◆',
    trophy: '◈',
    online: '🟢',
    idle: '🟡',
    dnd: '🔴',
    offline: '⚫',
    ban: '🔨',
    kick: '👢',
    mute: '🔇',
    music: '🎵',
    ticket: '🎫',
    level: '⬆',
    invite: '📨',
    boost: '🚀',
    lock: '🔒',
    unlock: '🔓',
    settings: '⚙',
    stats: '📊',
    search: '🔍',
    link: '🔗',
    back: '←',
    forward: '→',
    close: '✕',
    category: '📂',
    automod: '🛡',
    logs: '📜',
    tada: '🎉',
    heartdot: '💠',
    gift: '🎁',
    ticketbutton: '🎫',
    protect:'🛡️',
    vcunmute: '',
    vcmute: '',
    vcban: '',
    vcunban: '',
    vchide: '',
    vcunhide: '',
    vcstatus: '',
    vckick: '',
    vclock: '',
    vcunlock: '',
    vcdeafen: '',
    vcundeafen: '',
    vctransfer: '',
    vcclaim: '',
    vcremove: '',
    vcprivacy: '',
    vclimit: '',
    vcinvite: '',
    vcpermit: '',
    afkset: '',
    isafk: '',
    welcomeback: '',
    loading: '',
    pinkarrow: '',
    statistics: '',
    detective:''
};

type EmojiKey = keyof typeof UNICODE;

// Get emoji — returns custom app emoji or unicode fallback
export function e(key: EmojiKey): string {
    const custom = EMOJI_IDS[key];
    if (USE_CUSTOM_EMOJIS && custom) {
        // Support two formats in EMOJI_IDS:
        // - raw numeric ID: '123456789012345678' -> build `<:name:id>`
        // - full markup: '<:name:123...>' -> return as-is
        if (custom.startsWith('<') && custom.endsWith('>')) return custom;
        return `<:${key}:${custom}>`;
    }

    return UNICODE[key];
}

// For backwards compatibility or external usage. Application emojis do not require cache resolution.
export function eForClient(key: EmojiKey, client?: any, guild?: any): string {
    return e(key);
}

// Fade's accent colours (for embed colour fields)
export const Colours = {
    FADE: 0x7B8CDE, // Fade's signature blue-purple
    SUCCESS: 0x04fba5,
    WARNING: 0xECC94B,
    DANGER: 0xFC8181,
    INFO: 0x63B3ED,
    VOID: 0x2D3748,
    WHITE: 0xDED4F3,
    NONE: null,
} as const;