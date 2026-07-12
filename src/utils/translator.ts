// src/utils/translator.ts
// 3-tier translation engine — no API keys required:
//   Tier 1: Unofficial Google Translate (translate.googleapis.com)
//   Tier 2: Lingva Translate (multiple mirrors)
//   Tier 3: MyMemory API
//
// Also includes a Unicode normalizer that converts fancy Discord fonts
// (Mathematical Bold, Italic, Monospace, etc.) back to plain ASCII
// so the translation API can actually read them.

import { logger } from './logger.js';

// ── Unicode fancy-font normalizer ─────────────────────────────────────────────
// Discord users frequently use Mathematical Alphanumeric Symbols (U+1D400–U+1D7FF).
// These look like letters but are completely different code points. Translation
// APIs cannot understand them. We map them back to plain ASCII before translating.

const MATH_RANGES: [number, number, number][] = [
    // [unicodeStart, asciiStart, length]
    [0x1D400, 0x41, 26], // Mathematical Bold Capital A-Z
    [0x1D41A, 0x61, 26], // Mathematical Bold Small a-z
    [0x1D434, 0x41, 26], // Mathematical Italic Capital
    [0x1D44E, 0x61, 26], // Mathematical Italic Small
    [0x1D468, 0x41, 26], // Mathematical Bold Italic Capital
    [0x1D482, 0x61, 26], // Mathematical Bold Italic Small
    [0x1D49C, 0x41, 26], // Mathematical Script Capital
    [0x1D4B6, 0x61, 26], // Mathematical Script Small
    [0x1D4D0, 0x41, 26], // Mathematical Bold Script Capital
    [0x1D4EA, 0x61, 26], // Mathematical Bold Script Small
    [0x1D504, 0x41, 26], // Mathematical Fraktur Capital
    [0x1D51E, 0x61, 26], // Mathematical Fraktur Small
    [0x1D538, 0x41, 26], // Mathematical Double-Struck Capital
    [0x1D552, 0x61, 26], // Mathematical Double-Struck Small
    [0x1D56C, 0x41, 26], // Mathematical Bold Fraktur Capital
    [0x1D586, 0x61, 26], // Mathematical Bold Fraktur Small
    [0x1D5A0, 0x41, 26], // Mathematical Sans-Serif Capital
    [0x1D5BA, 0x61, 26], // Mathematical Sans-Serif Small
    [0x1D5D4, 0x41, 26], // Mathematical Sans-Serif Bold Capital
    [0x1D5EE, 0x61, 26], // Mathematical Sans-Serif Bold Small
    [0x1D608, 0x41, 26], // Mathematical Sans-Serif Italic Capital
    [0x1D622, 0x61, 26], // Mathematical Sans-Serif Italic Small
    [0x1D63C, 0x41, 26], // Mathematical Sans-Serif Bold Italic Capital
    [0x1D656, 0x61, 26], // Mathematical Sans-Serif Bold Italic Small
    [0x1D670, 0x41, 26], // Mathematical Monospace Capital
    [0x1D68A, 0x61, 26], // Mathematical Monospace Small
    // Digits
    [0x1D7CE, 0x30, 10], // Mathematical Bold Digit 0-9
    [0x1D7D8, 0x30, 10], // Mathematical Double-Struck Digit
    [0x1D7E2, 0x30, 10], // Mathematical Sans-Serif Digit
    [0x1D7EC, 0x30, 10], // Mathematical Sans-Serif Bold Digit
    [0x1D7F6, 0x30, 10], // Mathematical Monospace Digit
];

// Individual outliers not covered by the contiguous ranges above
const MATH_SPECIAL: Record<number, string> = {
    0x212C: 'B', 0x2130: 'E', 0x2131: 'F', 0x210B: 'H',
    0x2110: 'I', 0x2112: 'L', 0x2133: 'M', 0x211B: 'R',
    0x212F: 'e', 0x210A: 'g', 0x2134: 'o',
    0x1D49E: 'C', 0x1D4A2: 'G', 0x1D4A5: 'J', 0x1D4A6: 'K',
    0x1D4A9: 'N', 0x1D4AA: 'O', 0x1D4AB: 'P', 0x1D4AC: 'Q',
    0x1D4AE: 'S', 0x1D4AF: 'T', 0x1D4B0: 'U', 0x1D4B1: 'V',
    0x1D4B2: 'W', 0x1D4B3: 'X', 0x1D4B4: 'Y', 0x1D4B5: 'Z',
    0x1D506: 'C', 0x1D50B: 'H', 0x1D50C: 'I', 0x1D515: 'R',
    0x1D51D: 'Z', 0x1D53A: 'C', 0x1D53F: 'H', 0x1D545: 'O',
    0x1D547: 'Q', 0x1D548: 'R', 0x1D549: 'S', 0x1D551: 'Z',
};

export function normalizeFancyText(text: string): string {
    const chars = [...text]; // spread handles surrogate pairs correctly
    return chars.map(char => {
        const cp = char.codePointAt(0)!;

        // Check individual outliers first
        if (MATH_SPECIAL[cp]) return MATH_SPECIAL[cp];

        // Check contiguous ranges
        for (const [start, asciiStart, len] of MATH_RANGES) {
            if (cp >= start && cp < start + len) {
                return String.fromCharCode(asciiStart + (cp - start));
            }
        }

        return char;
    }).join('');
}

// ── Flag emoji → language code ─────────────────────────────────────────────────
// Regional indicator letters A-Z are U+1F1E6–U+1F1FF
// A flag is two regional indicators. We decode them to ISO 3166 country code
// then map country → language.

const COUNTRY_TO_LANG: Record<string, string> = {
    US: 'en', GB: 'en', AU: 'en', CA: 'en', NZ: 'en', IE: 'en',
    FR: 'fr', BE: 'fr',
    DE: 'de', AT: 'de', CH: 'de',
    JP: 'ja',
    KR: 'ko',
    CN: 'zh', TW: 'zh', HK: 'zh',
    ES: 'es', MX: 'es', AR: 'es', CO: 'es', CL: 'es', PE: 'es',
    PT: 'pt', BR: 'pt',
    RU: 'ru',
    IN: 'hi',
    IT: 'it',
    NL: 'nl',
    PL: 'pl',
    TR: 'tr',
    SA: 'ar', AE: 'ar', EG: 'ar', MA: 'ar', QA: 'ar',
    ID: 'id',
    TH: 'th',
    VN: 'vi',
    UA: 'uk',
    SE: 'sv',
    NO: 'no',
    DK: 'da',
    FI: 'fi',
    GR: 'el',
    CZ: 'cs',
    HU: 'hu',
    RO: 'ro',
    BG: 'bg',
    HR: 'hr',
    SK: 'sk',
    SI: 'sl',
    IL: 'he',
    IR: 'fa',
    PK: 'ur',
    BD: 'bn',
    MY: 'ms',
    PH: 'tl',
    ET: 'am',
    KE: 'sw',
    NG: 'yo',
    GH: 'ak',
    AF: 'ps',
    MM: 'my',
    KH: 'km',
    LK: 'si',
    NP: 'ne',
    MN: 'mn',
    AZ: 'az',
    KZ: 'kk',
    GE: 'ka',
    AM: 'hy',
    MK: 'mk',
    RS: 'sr',
    AL: 'sq',
    LV: 'lv',
    LT: 'lt',
    EE: 'et',
    BY: 'be',
};

/** Returns the ISO 639-1 language code from a flag emoji, or null if unknown. */
export function flagToLang(emoji: string): string | null {
    const cps = [...emoji].map(c => c.codePointAt(0)!);
    if (cps.length !== 2) return null;
    const [a, b] = cps;
    // Regional indicators start at U+1F1E6 (= 'A')
    if (a < 0x1F1E6 || a > 0x1F1FF || b < 0x1F1E6 || b > 0x1F1FF) return null;
    const country = String.fromCharCode(a - 0x1F1E6 + 65) + String.fromCharCode(b - 0x1F1E6 + 65);
    return COUNTRY_TO_LANG[country] ?? null;
}

export function langToName(code: string): string {
    const names: Record<string, string> = {
        en: 'English', fr: 'French', de: 'German', ja: 'Japanese',
        ko: 'Korean', zh: 'Chinese', es: 'Spanish', pt: 'Portuguese',
        ru: 'Russian', hi: 'Hindi', it: 'Italian', nl: 'Dutch',
        pl: 'Polish', tr: 'Turkish', ar: 'Arabic', id: 'Indonesian',
        th: 'Thai', vi: 'Vietnamese', uk: 'Ukrainian', sv: 'Swedish',
        no: 'Norwegian', da: 'Danish', fi: 'Finnish', el: 'Greek',
        cs: 'Czech', hu: 'Hungarian', ro: 'Romanian', bg: 'Bulgarian',
        he: 'Hebrew', fa: 'Persian', ur: 'Urdu', bn: 'Bengali',
        ms: 'Malay', tl: 'Filipino', sw: 'Swahili', my: 'Burmese',
        km: 'Khmer', si: 'Sinhala', ne: 'Nepali', am: 'Amharic',
        ka: 'Georgian', hy: 'Armenian', mn: 'Mongolian', az: 'Azerbaijani',
        kk: 'Kazakh', sr: 'Serbian', hr: 'Croatian', sk: 'Slovak',
        sl: 'Slovenian', mk: 'Macedonian', al: 'Albanian', lv: 'Latvian',
        lt: 'Lithuanian', et: 'Estonian', be: 'Belarusian',
    };
    return names[code] ?? code.toUpperCase();
}

// ── Translation tiers ─────────────────────────────────────────────────────────

const LINGVA_MIRRORS = [
    'https://lingva.ml',
    'https://translate.plausibility.cloud',
    'https://lingva.pussthecat.org',
];

async function tierGoogle(text: string, targetLang: string): Promise<string> {
    const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=${encodeURIComponent(targetLang)}&dt=t&q=${encodeURIComponent(text)}`;
    const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0' },
        signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error(`Google ${res.status}`);
    const data = await res.json() as any;
    // Response: [[[translated, original, ...], ...], ...]
    const translated = (data[0] as any[][])
        .map((chunk: any[]) => chunk[0])
        .filter(Boolean)
        .join('');
    if (!translated) throw new Error('Empty response');
    return translated;
}

async function tierLingva(text: string, targetLang: string): Promise<string> {
    for (const mirror of LINGVA_MIRRORS) {
        try {
            const url = `${mirror}/api/v1/auto/${encodeURIComponent(targetLang)}/${encodeURIComponent(text)}`;
            const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
            if (!res.ok) continue;
            const data = await res.json() as any;
            if (data.translation) return data.translation;
        } catch { /* try next mirror */ }
    }
    throw new Error('All Lingva mirrors failed');
}

async function tierMyMemory(text: string, targetLang: string): Promise<string> {
    const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${encodeURIComponent(targetLang)}`;
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) throw new Error(`MyMemory ${res.status}`);
    const data = await res.json() as any;
    const result = data?.responseData?.translatedText;
    if (!result || result === text) throw new Error('No translation');
    return result;
}

// ── Public translate function ─────────────────────────────────────────────────

export interface TranslationResult {
    translated: string;
    provider: string;
}

export async function translate(
    text: string,
    targetLang: string,
): Promise<TranslationResult> {
    // Always normalize fancy Unicode fonts first
    const normalised = normalizeFancyText(text);

    // Tier 1 — unofficial Google (fastest, most accurate)
    try {
        const translated = await tierGoogle(normalised, targetLang);
        logger.info(`[Translate] Tier1 Google → ${targetLang}`);
        return { translated, provider: 'Google' };
    } catch (e: any) {
        logger.warn(`[Translate] Google failed: ${e.message}`);
    }

    // Tier 2 — Lingva (multiple mirrors)
    try {
        const translated = await tierLingva(normalised, targetLang);
        logger.info(`[Translate] Tier2 Lingva → ${targetLang}`);
        return { translated, provider: 'Lingva' };
    } catch (e: any) {
        logger.warn(`[Translate] Lingva failed: ${e.message}`);
    }

    // Tier 3 — MyMemory
    try {
        const translated = await tierMyMemory(normalised, targetLang);
        logger.info(`[Translate] Tier3 MyMemory → ${targetLang}`);
        return { translated, provider: 'MyMemory' };
    } catch (e: any) {
        logger.warn(`[Translate] MyMemory failed: ${e.message}`);
    }

    throw new Error('All translation providers failed. Please try again later.');
}
