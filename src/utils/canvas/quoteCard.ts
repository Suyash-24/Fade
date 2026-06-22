// src/utils/canvas/quoteCard.ts
// "Ambient Album" design — raw square avatar with a beautiful blurred background
// matching the user's avatar colors (Apple Music / Spotify lyrics style).

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
        if (boldRes.ok)   GlobalFonts.register(Buffer.from(await boldRes.arrayBuffer()), 'RobotoBold');
        if (regRes.ok)    GlobalFonts.register(Buffer.from(await regRes.arrayBuffer()),  'Roboto');
        if (italicRes.ok) GlobalFonts.register(Buffer.from(await italicRes.arrayBuffer()), 'RobotoItalic');
        fontLoaded = true;
    } catch { }
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

    const W = 1100;
    const H = 460;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');

    let avatarImg: any = null;
    try {
        // Force static PNG, and request high resolution (512x512) for crispness
        const staticUrl = opts.avatarUrl.replace(/\.gif(\?|$)/, '.png$1');
        const hqUrl = staticUrl.includes('size=') 
            ? staticUrl.replace(/size=\d+/, 'size=512') 
            : staticUrl + (staticUrl.includes('?') ? '&size=512' : '?size=512');
            
        avatarImg = await loadImage(hqUrl);
    } catch {
        // Fallback handled below
    }

    // ── 1. Background: Ambient Blurred Avatar ─────────────────────────────────
    if (avatarImg) {
        ctx.save();
        // Heavy blur to create a smooth, ambient color bleed
        ctx.filter = 'blur(45px)';
        
        // Scale image to cover the entire canvas
        const scale = Math.max(W / avatarImg.width, H / avatarImg.height);
        const w = avatarImg.width * scale;
        const h = avatarImg.height * scale;
        const x = (W - w) / 2;
        const y = (H - h) / 2;
        
        // Draw larger than canvas to hide the unblurred edges
        ctx.drawImage(avatarImg, x - 100, y - 100, w + 200, h + 200);
        ctx.restore();

        // Darken the background to ensure text is highly readable
        ctx.fillStyle = 'rgba(12, 12, 16, 0.75)';
        ctx.fillRect(0, 0, W, H);

        // Add a secondary gradient to make the left side darker, anchoring the square image
        const bgGrad = ctx.createLinearGradient(0, 0, W, 0);
        bgGrad.addColorStop(0, 'rgba(0,0,0,0.6)');
        bgGrad.addColorStop(1, 'rgba(0,0,0,0.1)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);
    } else {
        // Pure fallback background
        ctx.fillStyle = '#0a0a0d';
        ctx.fillRect(0, 0, W, H);
    }

    // ── 2. Left Side: Raw, Unshaped Square Avatar ─────────────────────────────
    const sqSize = 300;
    const sqX = 80;
    const sqY = (H - sqSize) / 2;

    if (avatarImg) {
        ctx.save();
        // Gorgeous deep drop shadow for 3D depth
        ctx.shadowColor = 'rgba(0, 0, 0, 0.6)';
        ctx.shadowBlur = 30;
        ctx.shadowOffsetY = 15;
        
        // Draw exactly as is - no clipping, no borders
        ctx.drawImage(avatarImg, sqX, sqY, sqSize, sqSize);
        ctx.restore();

        // Extremely subtle 1px white inner border just to separate dark images from dark bg
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.strokeRect(sqX, sqY, sqSize, sqSize);
    } else {
        // Fallback
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(sqX, sqY, sqSize, sqSize);
        ctx.font = `bold 120px RobotoBold, sans-serif`;
        ctx.fillStyle = '#444';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(opts.authorName.charAt(0).toUpperCase(), sqX + sqSize / 2, sqY + sqSize / 2);
        ctx.textBaseline = 'alphabetic';
    }

    // ── 3. Right Side: Typography ─────────────────────────────────────────────
    const textX = sqX + sqSize + 70;
    const textMaxW = W - textX - 60;

    // Giant subtle quote watermark overlapping the text area
    ctx.font = '300px RobotoBold, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.textAlign = 'left';
    ctx.fillText('\u201C', textX - 35, 250);

    // Auto-scale quote font
    let fontSize = 46;
    ctx.font = `${fontSize}px Roboto, sans-serif`;
    let lines = wrapText(ctx, opts.content, textMaxW);
    while (lines.length > 5 && fontSize > 24) {
        fontSize -= 2;
        ctx.font = `${fontSize}px Roboto, sans-serif`;
        lines = wrapText(ctx, opts.content, textMaxW);
    }

    const lineH = fontSize * 1.35;
    const blockH = lines.length * lineH;
    
    // Vertically center the text block, slightly biased upward
    let textY = Math.max(90, (H - blockH) / 2 - 25);

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    
    // Add text shadow for maximum legibility over the blurred background
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
    ctx.shadowBlur = 12;
    ctx.shadowOffsetY = 2;
    for (const line of lines) {
        ctx.fillText(line, textX, textY);
        textY += lineH;
    }
    ctx.shadowColor = 'transparent';

    // ── 4. Author Details ─────────────────────────────────────────────────────
    const authorTop = textY + 30;

    // A crisp white accent line instead of a colored one
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    ctx.fillRect(textX, authorTop - 8, 40, 2);

    ctx.font = `italic ${Math.max(22, fontSize - 12)}px RobotoItalic, sans-serif`;
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.fillText(`— ${opts.authorName}`, textX, authorTop + 24);

    ctx.font = '18px Roboto, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fillText(`@${opts.authorHandle}`, textX, authorTop + 54);

    // ── 5. Quoted By Watermark ────────────────────────────────────────────────
    if (opts.quotedBy) {
        ctx.font = '14px Roboto, sans-serif';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.25)';
        ctx.textAlign = 'right';
        ctx.fillText(`quoted by ${opts.quotedBy}`, W - 24, H - 20);
    }

    return canvas.toBuffer('image/png');
}
