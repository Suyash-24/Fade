// src/utils/tempVoiceCanvas.ts
import { createCanvas, loadImage, Image, GlobalFonts } from '@napi-rs/canvas';

// 1. Fetch Roboto font remotely (to ensure it works anywhere)
let fontLoaded = false;
async function loadFont() {
    if (fontLoaded) return;
    try {
        const res = await fetch('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf');
        if (res.ok) {
            const buffer = Buffer.from(await res.arrayBuffer());
            GlobalFonts.register(buffer, 'Roboto');
            fontLoaded = true;
        }
    } catch (e) {
        console.error('Failed to load remote font for TempVoice Canvas', e);
    }
}

// 2. Define the exact grid layout for the Canvas
// This acts as the visual legend for what each button does
export interface TVButtonDefinition {
    id: string; // customId suffix (e.g. 'tvc_lock')
    emojiId: string; // the discord emoji ID to fetch
    label: string; // Text to draw
}

export const tvcButtons: TVButtonDefinition[] = [
    { id: 'tvc_name', emojiId: '1516714783146250410', label: 'RENAME' },
    { id: 'tvc_limit', emojiId: '1516714528279236628', label: 'LIMIT' },
    { id: 'tvc_lock', emojiId: '1516714571942068315', label: 'LOCK' },
    { id: 'tvc_unlock', emojiId: '1516714967259283566', label: 'UNLOCK' },
    
    { id: 'tvc_hide', emojiId: '1516714416135999689', label: 'HIDE' },
    { id: 'tvc_unhide', emojiId: '1516714919041699890', label: 'UNHIDE' },
    { id: 'tvc_permit', emojiId: '1516714675675463700', label: 'PERMIT' },
    { id: 'tvc_reject', emojiId: '1516714742956429362', label: 'REJECT' },
    
    { id: 'tvc_mute', emojiId: '1516714622194024478', label: 'MUTE' },
    { id: 'tvc_unmute', emojiId: '1516715017104527461', label: 'UNMUTE' },
    { id: 'tvc_deafen', emojiId: '1516714376684372068', label: 'DEAFEN' },
    { id: 'tvc_undeafen', emojiId: '1516714886959202365', label: 'UNDEAFEN' },
    
    { id: 'tvc_kick', emojiId: '1516714496167645234', label: 'KICK' },
    { id: 'tvc_ban', emojiId: '1516714296950784210', label: 'BAN' },
    { id: 'tvc_unban', emojiId: '1516714854864519261', label: 'UNBAN' },
    { id: 'tvc_info', emojiId: '1516714458041417858', label: 'INFO' },
    
    { id: 'tvc_claim', emojiId: '1516714340336668712', label: 'CLAIM' },
    { id: 'tvc_transfer', emojiId: '1516714816859930754', label: 'TRANSFER' },
    { id: 'tvc_privacy', emojiId: '1516714711075262584', label: 'PRIVACY' },
];

// 3. Cache images to prevent re-downloading on every click
const imageCache: Map<string, Image> = new Map();

async function getEmojiImage(id: string): Promise<Image | null> {
    if (imageCache.has(id)) return imageCache.get(id)!;
    try {
        const url = `https://cdn.discordapp.com/emojis/${id}.png`;
        const img = await loadImage(url);
        imageCache.set(id, img);
        return img;
    } catch (e) {
        console.error(`Failed to load emoji ${id}`, e);
        return null;
    }
}

// Draw a beautiful rounded rectangle
function drawRoundedRect(ctx: any, x: number, y: number, width: number, height: number, radius: number, bgColor: string, strokeColor?: string) {
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + width - radius, y);
    ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
    ctx.lineTo(x + width, y + height - radius);
    ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
    ctx.lineTo(x + radius, y + height);
    ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    
    ctx.fillStyle = bgColor;
    ctx.fill();
    
    if (strokeColor) {
        ctx.strokeStyle = strokeColor;
        ctx.lineWidth = 2;
        ctx.stroke();
    }
}

export async function generateTempVoiceCanvas(): Promise<Buffer> {
    await loadFont();

    // Dimensions for a 4x5 grid layout
    const cols = 4;
    const rows = 5; // 19 buttons fit in 4x5 (last row has 3)
    
    const padding = 20;
    const gapX = 15;
    const gapY = 15;
    
    const btnWidth = 145;
    const btnHeight = 45;
    
    const width = (cols * btnWidth) + ((cols - 1) * gapX) + (padding * 2);
    const height = (rows * btnHeight) + ((rows - 1) * gapY) + (padding * 2);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Draw background (Transparent or Dark Theme)
    // We'll use a very sleek dark modern theme
    ctx.fillStyle = '#111214'; // Discord dark color
    ctx.fillRect(0, 0, width, height);
    
    // Draw an inner glowing border
    drawRoundedRect(ctx, 5, 5, width - 10, height - 10, 15, '#1e1f22', '#2b2d31');

    ctx.font = 'bold 16px Roboto, sans-serif';
    ctx.textBaseline = 'middle';

    // Draw buttons
    for (let i = 0; i < tvcButtons.length; i++) {
        const btn = tvcButtons[i];
        
        // Calculate grid position
        const col = i % cols;
        const row = Math.floor(i / cols);
        
        // If it's the last row with 3 buttons, center them
        let offsetX = padding + (col * (btnWidth + gapX));
        if (row === 4) { // Row 5
            const totalInRow = 3;
            const rowWidth = (totalInRow * btnWidth) + ((totalInRow - 1) * gapX);
            const startX = (width - rowWidth) / 2;
            offsetX = startX + (col * (btnWidth + gapX));
        }
        
        const offsetY = padding + (row * (btnHeight + gapY));

        // Draw pill/button shape
        // Use a slightly lighter dark grey for the button base
        drawRoundedRect(ctx, offsetX, offsetY, btnWidth, btnHeight, 10, '#2b2d31');

        // Fetch and draw the emoji
        const img = await getEmojiImage(btn.emojiId);
        
        const iconSize = 24;
        const iconX = offsetX + 15;
        const iconY = offsetY + (btnHeight / 2) - (iconSize / 2);
        
        if (img) {
            ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
        }

        // Draw label text
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        
        // Text starts after the icon
        const textX = iconX + iconSize + 12;
        const textY = offsetY + (btnHeight / 2) + 1; // slight offset for perfect middle
        
        ctx.fillText(btn.label, textX, textY);
    }

    return canvas.toBuffer('image/png');
}
