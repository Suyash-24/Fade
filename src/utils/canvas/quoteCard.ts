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
    const paragraphs = text.split('\n');
    const lines: string[] = [];
    for (const paragraph of paragraphs) {
        if (!paragraph.trim()) {
            lines.push('');
            continue;
        }
        const words = paragraph.split(/\s+/);
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
    }
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

    const W = 1060;
    const H = 420;
    const canvas = createCanvas(W, H);
    const ctx    = canvas.getContext('2d');

    let avatarImg: any = null;
    try {
        const staticUrl = opts.avatarUrl.replace(/\.gif(\?|$)/, '.png$1');
        const hqUrl = staticUrl.includes('size=') 
            ? staticUrl.replace(/size=\d+/, 'size=512') 
            : staticUrl + (staticUrl.includes('?') ? '&size=512' : '?size=512');
            
        avatarImg = await loadImage(hqUrl);
    } catch { }

    // ── 1. Background: Ambient Blurred Avatar ─────────────────────────────────
    if (avatarImg) {
        ctx.save();
        ctx.filter = 'blur(45px)';
        const scale = Math.max(W / avatarImg.width, H / avatarImg.height);
        const w = avatarImg.width * scale;
        const h = avatarImg.height * scale;
        const x = (W - w) / 2;
        const y = (H - h) / 2;
        ctx.drawImage(avatarImg, x - 100, y - 100, w + 200, h + 200);
        ctx.restore();

        // Darken the background to ensure text is highly readable
        ctx.fillStyle = 'rgba(12, 12, 16, 0.75)';
        ctx.fillRect(0, 0, W, H);

        // Add a secondary gradient to make the right side darker for text
        const bgGrad = ctx.createLinearGradient(0, 0, W, 0);
        bgGrad.addColorStop(0, 'rgba(0,0,0,0.2)');
        bgGrad.addColorStop(1, 'rgba(0,0,0,0.7)');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(0, 0, W, H);
    } else {
        ctx.fillStyle = '#0a0a0d';
        ctx.fillRect(0, 0, W, H);
    }

    // ── 2. Left Side: Full-Height Avatar with Opacity Fade ────────────────────
    const imgSize = H; // 420x420, spans full height

    if (avatarImg) {
        // Create a temporary canvas to apply the gradient mask (fade effect)
        const tempCanvas = createCanvas(imgSize, imgSize);
        const tempCtx = tempCanvas.getContext('2d');

        // Draw the raw avatar
        tempCtx.drawImage(avatarImg, 0, 0, imgSize, imgSize);

        // Apply a gradient mask to fade out the right edge seamlessly
        tempCtx.globalCompositeOperation = 'destination-out';
        const maskGrad = tempCtx.createLinearGradient(0, 0, imgSize, 0);
        maskGrad.addColorStop(0, 'rgba(0,0,0,0)');      // Solid left
        maskGrad.addColorStop(0.6, 'rgba(0,0,0,0)');    // Solid middle
        maskGrad.addColorStop(1, 'rgba(0,0,0,1)');      // Transparent right edge
        tempCtx.fillStyle = maskGrad;
        tempCtx.fillRect(0, 0, imgSize, imgSize);

        // Optional: reduce overall opacity slightly for a cinematic feel
        ctx.globalAlpha = 0.9;
        ctx.drawImage(tempCanvas, 0, 0);
        ctx.globalAlpha = 1.0;
    } else {
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, imgSize, imgSize);
        ctx.font = `bold 160px RobotoBold, sans-serif`;
        ctx.fillStyle = '#444';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(opts.authorName.charAt(0).toUpperCase(), imgSize / 2, imgSize / 2);
        ctx.textBaseline = 'alphabetic';
    }

    // ── 3. Right Side: Typography ─────────────────────────────────────────────
    const textX = imgSize + 30; // Starts right after the fade
    const textMaxW = W - textX - 50;

    // Giant subtle quote watermark
    ctx.font = '300px RobotoBold, sans-serif';
    ctx.fillStyle = 'rgba(255, 255, 255, 0.03)';
    ctx.textAlign = 'left';
    ctx.fillText('\u201C', textX - 35, 250);

    // Auto-scale quote font to fit both width and height
    let fontSize = 48;
    let lines: string[] = [];
    let lineH = 0;
    let blockH = 0;
    const maxBlockH = 240; // Max allowed height for the text block

    while (fontSize >= 16) {
        ctx.font = `${fontSize}px Roboto, sans-serif`;
        lines = wrapText(ctx, opts.content, textMaxW);
        lineH = fontSize * 1.35;
        blockH = lines.length * lineH;

        // Ensure no single line/word overflows horizontally
        let tooWide = false;
        for (const line of lines) {
            if (ctx.measureText(line).width > textMaxW) {
                tooWide = true;
                break;
            }
        }

        if (blockH <= maxBlockH && !tooWide) {
            break; // It fits perfectly
        }
        fontSize -= 2;
    }

    // Truncate if it's still too long even at minimum font size
    if (blockH > maxBlockH || fontSize < 16) {
        const maxLines = Math.floor(maxBlockH / lineH);
        lines = lines.slice(0, maxLines);
        if (lines.length > 0) {
            lines[lines.length - 1] = lines[lines.length - 1].replace(/\s+\S*$/, '') + '...';
        }
        blockH = lines.length * lineH;
    }

    // Vertically center the text block
    let textY = Math.max(90, (H - blockH) / 2 - 25);

    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'left';
    
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
