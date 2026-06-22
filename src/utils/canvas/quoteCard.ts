// src/utils/canvas/quoteCard.ts
// "Aurora" quote card — each user gets their own personalized aura color.
// Design: Dark bg, large avatar with radial glow bloom, big quote text, colored accent line at bottom.

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';

let fontLoaded = false;
async function loadFonts() {
    if (fontLoaded) return;
    try {
        const [boldRes, regRes] = await Promise.all([
            fetch('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf'),
            fetch('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf'),
        ]);
        if (boldRes.ok) GlobalFonts.register(Buffer.from(await boldRes.arrayBuffer()), 'RobotoBold');
        if (regRes.ok)  GlobalFonts.register(Buffer.from(await regRes.arrayBuffer()),  'Roboto');
        fontLoaded = true;
    } catch { }
}

// Pick a unique accent color per username (consistent, not random)
function getUserAccent(username: string): { primary: string; secondary: string } {
    const palettes = [
        { primary: '#C084FC', secondary: '#7C3AED' }, // purple
        { primary: '#F472B6', secondary: '#BE185D' }, // pink
        { primary: '#34D399', secondary: '#065F46' }, // emerald
        { primary: '#60A5FA', secondary: '#1D4ED8' }, // blue
        { primary: '#FBBF24', secondary: '#92400E' }, // amber
        { primary: '#F87171', secondary: '#991B1B' }, // red
        { primary: '#38BDF8', secondary: '#0369A1' }, // sky
        { primary: '#A78BFA', secondary: '#5B21B6' }, // violet
        { primary: '#FB923C', secondary: '#9A3412' }, // orange
        { primary: '#4ADE80', secondary: '#166534' }, // green
    ];
    let hash = 0;
    for (let i = 0; i < username.length; i++) {
        hash = ((hash << 5) - hash) + username.charCodeAt(i);
        hash = hash & hash;
    }
    return palettes[Math.abs(hash) % palettes.length];
}

function hexToRgb(hex: string) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

function drawCircleAvatar(ctx: any, img: any, cx: number, cy: number, r: number) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
}

function wrapText(ctx: any, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let current = '';
    for (const word of words) {
        const test = current ? `${current} ${word}` : word;
        if (ctx.measureText(test).width > maxWidth && current) {
            lines.push(current);
            current = word;
        } else {
            current = test;
        }
    }
    if (current) lines.push(current);
    return lines;
}

export interface QuoteCardOptions {
    content:      string;
    authorName:   string;
    authorHandle: string;
    avatarUrl:    string;
    quotedBy?:    string;
}

export async function generateQuoteCard(opts: QuoteCardOptions): Promise<Buffer> {
    await loadFonts();

    const W = 1000;
    const H = 420;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');

    const accent = getUserAccent(opts.authorHandle);
    const rgb    = hexToRgb(accent.primary);

    // ── Deep dark background ───────────────────────────────────────────────────
    ctx.fillStyle = '#07070a';
    ctx.fillRect(0, 0, W, H);

    // ── Left aura bloom — radiates from behind avatar ─────────────────────────
    const auraX = 190;
    const auraY = H / 2;

    // Outer wide bloom
    const outerGlow = ctx.createRadialGradient(auraX, auraY, 0, auraX, auraY, 380);
    outerGlow.addColorStop(0,   `rgba(${rgb.r},${rgb.g},${rgb.b},0.18)`);
    outerGlow.addColorStop(0.4, `rgba(${rgb.r},${rgb.g},${rgb.b},0.06)`);
    outerGlow.addColorStop(1,   `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    ctx.fillStyle = outerGlow;
    ctx.fillRect(0, 0, W, H);

    // Inner tight halo right around avatar
    const innerGlow = ctx.createRadialGradient(auraX, auraY, 80, auraX, auraY, 180);
    innerGlow.addColorStop(0,   `rgba(${rgb.r},${rgb.g},${rgb.b},0.22)`);
    innerGlow.addColorStop(1,   `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    ctx.fillStyle = innerGlow;
    ctx.fillRect(0, 0, W, H);

    // ── Decorative giant quote mark in bg (barely visible) ────────────────────
    ctx.font      = '260px RobotoBold, sans-serif';
    ctx.fillStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.06)`;
    ctx.textAlign = 'left';
    ctx.fillText('\u201C', 320, 280);

    // ── Avatar — large, clean circle, sits on top of glow ────────────────────
    const avatarR = 105;
    try {
        const staticUrl = opts.avatarUrl.replace(/\.gif(\?|$)/, '.png$1');
        const img = await loadImage(staticUrl);
        drawCircleAvatar(ctx, img, auraX, auraY, avatarR);

        // Thin glowing ring right at avatar edge
        ctx.beginPath();
        ctx.arc(auraX, auraY, avatarR + 2, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`;
        ctx.lineWidth = 2;
        ctx.stroke();
    } catch {
        ctx.beginPath();
        ctx.arc(auraX, auraY, avatarR, 0, Math.PI * 2);
        ctx.fillStyle = '#1a1a1a';
        ctx.fill();
        ctx.font          = `bold ${avatarR}px RobotoBold, sans-serif`;
        ctx.fillStyle     = accent.primary;
        ctx.textAlign     = 'center';
        ctx.textBaseline  = 'middle';
        ctx.fillText(opts.authorName.charAt(0).toUpperCase(), auraX, auraY);
        ctx.textBaseline  = 'alphabetic';
    }

    // ── Text layout (right of avatar) ─────────────────────────────────────────
    const textX   = 338;
    const textMaxW = W - textX - 48;

    // Auto-scale font size
    let fontSize = 40;
    ctx.font = `${fontSize}px Roboto, sans-serif`;
    let lines = wrapText(ctx, opts.content, textMaxW);
    while (lines.length > 5 && fontSize > 22) {
        fontSize -= 2;
        ctx.font = `${fontSize}px Roboto, sans-serif`;
        lines    = wrapText(ctx, opts.content, textMaxW);
    }

    const lineH  = fontSize * 1.55;
    const blockH = lines.length * lineH;
    // Center vertically, bias upward slightly to leave room for author below
    let textY = Math.max(80, (H - blockH) / 2 - 28);

    ctx.fillStyle = '#F0F0F0';
    ctx.textAlign = 'left';
    ctx.font      = `${fontSize}px Roboto, sans-serif`;
    for (const line of lines) {
        ctx.fillText(line, textX, textY);
        textY += lineH;
    }

    // ── Author section ────────────────────────────────────────────────────────
    const authorTop = textY + 22;

    // Short accent-colored bar instead of a grey line
    ctx.fillStyle = accent.primary;
    ctx.fillRect(textX, authorTop, 36, 3);

    ctx.font      = `italic ${Math.max(18, fontSize - 8)}px Roboto, sans-serif`;
    ctx.fillStyle = accent.primary;
    ctx.textAlign = 'left';
    ctx.fillText(`— ${opts.authorName}`, textX, authorTop + 30);

    ctx.font      = '15px Roboto, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.28)';
    ctx.fillText(`@${opts.authorHandle}`, textX, authorTop + 52);

    // ── Bottom accent line (full width gradient) ───────────────────────────────
    const lineGrad = ctx.createLinearGradient(0, 0, W, 0);
    lineGrad.addColorStop(0,   `rgba(${rgb.r},${rgb.g},${rgb.b},0.9)`);
    lineGrad.addColorStop(0.5, `rgba(${rgb.r},${rgb.g},${rgb.b},0.5)`);
    lineGrad.addColorStop(1,   `rgba(${rgb.r},${rgb.g},${rgb.b},0)`);
    ctx.fillStyle = lineGrad;
    ctx.fillRect(0, H - 3, W, 3);

    // ── Watermark ─────────────────────────────────────────────────────────────
    if (opts.quotedBy) {
        ctx.font      = '12px Roboto, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.1)';
        ctx.textAlign = 'right';
        ctx.fillText(`quoted by ${opts.quotedBy}`, W - 16, H - 10);
    }

    return canvas.toBuffer('image/png');
}
