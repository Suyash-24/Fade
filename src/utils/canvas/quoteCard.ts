// src/utils/canvas/quoteCard.ts
// Cinematic dark quote card — clean, no colored accents, just premium typography.

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

    const W = 960;
    const H = 400;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');

    // ── Pure dark background ──────────────────────────────────────────────────
    ctx.fillStyle = '#0e0e0e';
    ctx.fillRect(0, 0, W, H);

    // Soft vignette (dark edges, slightly lighter center) — cinematic feel
    const vignette = ctx.createRadialGradient(W / 2, H / 2, 80, W / 2, H / 2, W * 0.75);
    vignette.addColorStop(0, 'rgba(30, 30, 30, 0.4)');
    vignette.addColorStop(1, 'rgba(0, 0, 0, 0.7)');
    ctx.fillStyle = vignette;
    ctx.fillRect(0, 0, W, H);

    // ── Avatar — clean circle, no ring, no color ──────────────────────────────
    const avatarR  = 88;
    const avatarCX = 160;
    const avatarCY = H / 2;

    try {
        const staticUrl = opts.avatarUrl.replace(/\.gif(\?|$)/, '.png$1');
        const img = await loadImage(staticUrl);
        drawCircleAvatar(ctx, img, avatarCX, avatarCY, avatarR);
    } catch {
        // Fallback: dark grey circle with initial
        ctx.beginPath();
        ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
        ctx.fillStyle = '#2a2a2a';
        ctx.fill();
        ctx.font          = `bold ${avatarR}px RobotoBold, sans-serif`;
        ctx.fillStyle     = '#888888';
        ctx.textAlign     = 'center';
        ctx.textBaseline  = 'middle';
        ctx.fillText(opts.authorName.charAt(0).toUpperCase(), avatarCX, avatarCY);
        ctx.textBaseline  = 'alphabetic';
    }

    // ── Subtle vertical divider between avatar and text ───────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.07)';
    ctx.fillRect(285, 50, 1, H - 100);

    // ── Text area ─────────────────────────────────────────────────────────────
    const textX   = 320;
    const textMaxW = W - textX - 50;

    // Decorative large open-quote mark (very subtle)
    ctx.font      = '120px RobotoBold, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.textAlign = 'left';
    ctx.fillText('\u201C', textX - 8, 130);

    // Auto-size the quote text
    let fontSize = 40;
    ctx.font = `${fontSize}px Roboto, sans-serif`;
    let lines = wrapText(ctx, opts.content, textMaxW);
    while (lines.length > 5 && fontSize > 22) {
        fontSize -= 2;
        ctx.font = `${fontSize}px Roboto, sans-serif`;
        lines    = wrapText(ctx, opts.content, textMaxW);
    }

    const lineH  = fontSize * 1.5;
    const blockH = lines.length * lineH;
    // Push text block up a bit to leave room for author line below
    let textY = (H - blockH) / 2 - 18;

    ctx.fillStyle = '#ECECEC';
    ctx.textAlign = 'left';
    for (const line of lines) {
        ctx.fillText(line, textX, textY);
        textY += lineH;
    }

    // ── Author line ───────────────────────────────────────────────────────────
    const authorY = textY + 24;

    // Thin separator
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    ctx.fillRect(textX, textY + 8, 180, 1);

    ctx.font      = `italic ${Math.max(18, fontSize - 10)}px Roboto, sans-serif`;
    ctx.fillStyle = '#888888';
    ctx.textAlign = 'left';
    ctx.fillText(`— ${opts.authorName}`, textX, authorY + 14);

    ctx.font      = '14px Roboto, sans-serif';
    ctx.fillStyle = '#444444';
    ctx.fillText(`@${opts.authorHandle}`, textX, authorY + 36);

    // ── Tiny watermark ────────────────────────────────────────────────────────
    if (opts.quotedBy) {
        ctx.font      = '12px Roboto, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.08)';
        ctx.textAlign = 'right';
        ctx.fillText(`quoted by ${opts.quotedBy}`, W - 18, H - 14);
    }

    return canvas.toBuffer('image/png');
}
