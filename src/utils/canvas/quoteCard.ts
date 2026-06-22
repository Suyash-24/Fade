// src/utils/canvas/quoteCard.ts
// Generates a cinematic dark quote card image.
// Layout: Avatar on the LEFT, large quote text on the RIGHT, author attribution below.

import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';

let fontLoaded = false;

async function loadFonts() {
    if (fontLoaded) return;
    try {
        const [boldRes, regRes, italicRes] = await Promise.all([
            fetch('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf'),
            fetch('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf'),
            fetch('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Italic.ttf'),
        ]);
        if (boldRes.ok)   GlobalFonts.register(Buffer.from(await boldRes.arrayBuffer()),   'RobotoBold');
        if (regRes.ok)    GlobalFonts.register(Buffer.from(await regRes.arrayBuffer()),    'Roboto');
        if (italicRes.ok) GlobalFonts.register(Buffer.from(await italicRes.arrayBuffer()), 'RobotoItalic');
        fontLoaded = true;
    } catch { /* fonts fall back to system */ }
}

// Draw a perfect circle avatar
function drawCircleAvatar(ctx: any, img: any, cx: number, cy: number, r: number) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, cx - r, cy - r, r * 2, r * 2);
    ctx.restore();
}

// Word-wrap text and return lines
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
    content: string;       // The message text
    authorName: string;    // Display name of the original author
    authorHandle: string;  // Username (e.g. snowversefx)
    avatarUrl: string;     // Author's avatar URL
    quotedBy?: string;     // Who quoted it (optional, shown as watermark)
}

export async function generateQuoteCard(opts: QuoteCardOptions): Promise<Buffer> {
    await loadFonts();

    const W = 960;
    const H = 420;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d');

    // ── Background ────────────────────────────────────────────────────────────
    const bg = ctx.createLinearGradient(0, 0, W, H);
    bg.addColorStop(0,   '#0d0d10');
    bg.addColorStop(0.5, '#111115');
    bg.addColorStop(1,   '#0a0a0d');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Subtle radial glow behind avatar area
    const glow = ctx.createRadialGradient(180, H / 2, 0, 180, H / 2, 260);
    glow.addColorStop(0,   'rgba(88, 101, 242, 0.12)');
    glow.addColorStop(1,   'rgba(0, 0, 0, 0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    // Thin left accent bar
    ctx.fillStyle = '#5865F2';
    ctx.fillRect(0, 0, 4, H);

    // ── Avatar ────────────────────────────────────────────────────────────────
    const avatarR  = 95;
    const avatarCX = 175;
    const avatarCY = H / 2;

    try {
        // Force static PNG for GIF avatars
        const staticUrl = opts.avatarUrl.replace(/\.gif(\?|$)/, '.png$1');
        const img = await loadImage(staticUrl);
        
        // Outer ring
        ctx.beginPath();
        ctx.arc(avatarCX, avatarCY, avatarR + 4, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(88, 101, 242, 0.35)';
        ctx.fill();

        drawCircleAvatar(ctx, img, avatarCX, avatarCY, avatarR);
    } catch {
        // Fallback: initial circle
        ctx.beginPath();
        ctx.arc(avatarCX, avatarCY, avatarR, 0, Math.PI * 2);
        ctx.fillStyle = '#5865F2';
        ctx.fill();

        ctx.font = `bold ${avatarR}px RobotoBold, sans-serif`;
        ctx.fillStyle = '#FFFFFF';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(opts.authorName.charAt(0).toUpperCase(), avatarCX, avatarCY);
        ctx.textBaseline = 'alphabetic';
    }

    // ── Large opening quote mark ──────────────────────────────────────────────
    const textStartX = 320;
    const textEndX   = W - 50;
    const textMaxW   = textEndX - textStartX;

    ctx.font      = '130px RobotoBold, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.06)';
    ctx.textAlign = 'left';
    ctx.fillText('\u201C', textStartX - 30, 145);

    // ── Quote text ────────────────────────────────────────────────────────────
    // Dynamically scale font size to fit the content
    let fontSize = 38;
    ctx.font = `${fontSize}px Roboto, sans-serif`;
    let lines = wrapText(ctx, opts.content, textMaxW);

    // Reduce font size if too many lines
    while (lines.length > 5 && fontSize > 22) {
        fontSize -= 2;
        ctx.font = `${fontSize}px Roboto, sans-serif`;
        lines = wrapText(ctx, opts.content, textMaxW);
    }

    const lineH      = fontSize * 1.45;
    const blockH     = lines.length * lineH;
    let   textStartY = (H - blockH - 60) / 2 + lineH; // vertically centered

    ctx.fillStyle = '#F0F0F0';
    ctx.textAlign = 'left';
    for (const line of lines) {
        ctx.fillText(line, textStartX, textStartY);
        textStartY += lineH;
    }

    const afterTextY = textStartY + 10;

    // ── Divider ───────────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.15)';
    ctx.fillRect(textStartX, afterTextY, 200, 1);

    // ── Author attribution ────────────────────────────────────────────────────
    ctx.font      = `italic ${Math.max(20, fontSize - 6)}px RobotoItalic, Roboto, sans-serif`;
    ctx.fillStyle = '#AAAAAA';
    ctx.textAlign = 'left';
    ctx.fillText(`— ${opts.authorName}`, textStartX, afterTextY + 32);

    // Handle (smaller, muted)
    ctx.font      = '16px Roboto, sans-serif';
    ctx.fillStyle = '#555555';
    ctx.fillText(`@${opts.authorHandle}`, textStartX, afterTextY + 56);

    // ── Watermark (bottom right) ───────────────────────────────────────────────
    if (opts.quotedBy) {
        ctx.font      = '14px Roboto, sans-serif';
        ctx.fillStyle = 'rgba(255,255,255,0.12)';
        ctx.textAlign = 'right';
        ctx.fillText(`quoted by ${opts.quotedBy}`, W - 20, H - 14);
    }

    return canvas.toBuffer('image/png');
}
