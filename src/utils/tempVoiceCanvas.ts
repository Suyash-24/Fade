// src/utils/tempVoiceCanvas.ts
import { createCanvas, loadImage, Image, GlobalFonts } from '@napi-rs/canvas';

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

export interface TVButtonDefinition {
    id: string;
    emojiId: string;
    label: string;
    style: 'secondary' | 'success' | 'danger' | 'primary';
}

export const tvcButtons: TVButtonDefinition[] = [
    { id: 'tvc_name', emojiId: '1516714783146250410', label: 'RENAME', style: 'secondary' },
    { id: 'tvc_limit', emojiId: '1516714528279236628', label: 'LIMIT', style: 'secondary' },
    { id: 'tvc_lock', emojiId: '1516714571942068315', label: 'LOCK', style: 'danger' },
    { id: 'tvc_unlock', emojiId: '1516714967259283566', label: 'UNLOCK', style: 'success' },
    
    { id: 'tvc_hide', emojiId: '1516714416135999689', label: 'HIDE', style: 'danger' },
    { id: 'tvc_unhide', emojiId: '1516714919041699890', label: 'UNHIDE', style: 'success' },
    { id: 'tvc_permit', emojiId: '1516714675675463700', label: 'PERMIT', style: 'success' },
    { id: 'tvc_reject', emojiId: '1516714742956429362', label: 'REJECT', style: 'danger' },
    
    { id: 'tvc_mute', emojiId: '1516714622194024478', label: 'MUTE', style: 'danger' },
    { id: 'tvc_unmute', emojiId: '1516715017104527461', label: 'UNMUTE', style: 'success' },
    { id: 'tvc_deafen', emojiId: '1516714376684372068', label: 'DEAFEN', style: 'danger' },
    { id: 'tvc_undeafen', emojiId: '1516714886959202365', label: 'UNDEAFEN', style: 'success' },
    
    { id: 'tvc_kick', emojiId: '1516714496167645234', label: 'KICK', style: 'danger' },
    { id: 'tvc_ban', emojiId: '1516714296950784210', label: 'BAN', style: 'danger' },
    { id: 'tvc_unban', emojiId: '1516714854864519261', label: 'UNBAN', style: 'success' },
    { id: 'tvc_info', emojiId: '1516714458041417858', label: 'INFO', style: 'secondary' },
    
    { id: 'tvc_claim', emojiId: '1516714340336668712', label: 'CLAIM', style: 'primary' },
    { id: 'tvc_transfer', emojiId: '1516714816859930754', label: 'TRANSFER', style: 'primary' },
];

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
function drawRoundedRect(ctx: any, x: number, y: number, width: number, height: number, radius: number) {
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
}

export async function generateTempVoiceCanvas(): Promise<Buffer> {
    await loadFont();

    const cols = 4;
    const rows = 5; 
    
    const padding = 30;
    const gapX = 18;
    const gapY = 18;
    
    const btnWidth = 160;
    const btnHeight = 55;
    
    const width = (cols * btnWidth) + ((cols - 1) * gapX) + (padding * 2);
    const height = (rows * btnHeight) + ((rows - 1) * gapY) + (padding * 2);

    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Sleek dark gradient background
    const bgGradient = ctx.createLinearGradient(0, 0, 0, height);
    bgGradient.addColorStop(0, '#111215');
    bgGradient.addColorStop(1, '#1a1b20');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);
    
    // 2. Inner glow border (Container frame)
    drawRoundedRect(ctx, 5, 5, width - 10, height - 10, 20);
    ctx.strokeStyle = 'rgba(123, 140, 222, 0.15)'; // Fade Accent Color glow
    ctx.lineWidth = 2;
    ctx.stroke();

    ctx.font = 'bold 16px Roboto, sans-serif';
    ctx.textBaseline = 'middle';

    // 3. Draw buttons with glassmorphism 3D effect
    for (let i = 0; i < tvcButtons.length; i++) {
        const btn = tvcButtons[i];
        
        const col = i % cols;
        const row = Math.floor(i / cols);
        
        let offsetX = padding + (col * (btnWidth + gapX));
        if (row === 4) { // Row 5 (2 items)
            const totalInRow = 2;
            const rowWidth = (totalInRow * btnWidth) + ((totalInRow - 1) * gapX);
            const startX = (width - rowWidth) / 2;
            offsetX = startX + (col * (btnWidth + gapX));
        }
        const offsetY = padding + (row * (btnHeight + gapY));

        let colorTop = '#2b2d35';
        let colorBottom = '#23242a';
        let edgeColor = 'rgba(255, 255, 255, 0.08)';

        if (btn.style === 'success') {
            colorTop = '#1e3323';
            colorBottom = '#16261a';
            edgeColor = 'rgba(87, 242, 135, 0.15)'; // subtle green
        } else if (btn.style === 'danger') {
            colorTop = '#3a2020';
            colorBottom = '#2d1818';
            edgeColor = 'rgba(237, 66, 69, 0.15)'; // subtle red
        } else if (btn.style === 'primary') {
            colorTop = '#20263a';
            colorBottom = '#181c2d';
            edgeColor = 'rgba(88, 101, 242, 0.15)'; // subtle blurple
        }

        // Drop shadow for floating effect
        ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
        ctx.shadowBlur = 10;
        ctx.shadowOffsetY = 4;
        
        // Button Gradient Base
        const btnGradient = ctx.createLinearGradient(offsetX, offsetY, offsetX, offsetY + btnHeight);
        btnGradient.addColorStop(0, colorTop);
        btnGradient.addColorStop(1, colorBottom);
        
        drawRoundedRect(ctx, offsetX, offsetY, btnWidth, btnHeight, 12);
        ctx.fillStyle = btnGradient;
        ctx.fill();

        // Reset shadow so it doesn't apply to inner elements
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;

        // Top edge highlight (simulates 3D lighting)
        ctx.save();
        ctx.clip();
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
        ctx.lineTo(offsetX + btnWidth, offsetY);
        ctx.strokeStyle = edgeColor;
        ctx.lineWidth = 3;
        ctx.stroke();
        ctx.restore();

        // Draw Emoji Icon
        const img = await getEmojiImage(btn.emojiId);
        const iconSize = 26;
        const iconX = offsetX + 20;
        const iconY = offsetY + (btnHeight / 2) - (iconSize / 2);
        
        if (img) {
            ctx.drawImage(img, iconX, iconY, iconSize, iconSize);
        }

        // Draw Label Text
        const textX = iconX + iconSize + 15;
        const textY = offsetY + (btnHeight / 2) + 1;
        
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'left';
        
        // Subtle text shadow for sharpness
        ctx.shadowColor = 'rgba(0, 0, 0, 0.8)';
        ctx.shadowBlur = 2;
        ctx.shadowOffsetY = 1;
        ctx.fillText(btn.label, textX, textY);
        
        // Reset shadow again
        ctx.shadowColor = 'transparent';
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0;
    }

    return canvas.toBuffer('image/png');
}
