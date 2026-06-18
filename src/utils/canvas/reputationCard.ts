// src/utils/canvas/reputationCard.ts
import { createCanvas, loadImage, GlobalFonts, Image } from '@napi-rs/canvas';

let fontLoaded = false;
async function loadFonts() {
    if (fontLoaded) return;
    try {
        const [boldRes, regRes] = await Promise.all([
            fetch('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf'),
            fetch('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf')
        ]);
        
        if (boldRes.ok && regRes.ok) {
            GlobalFonts.register(Buffer.from(await boldRes.arrayBuffer()), 'RobotoBold');
            GlobalFonts.register(Buffer.from(await regRes.arrayBuffer()), 'Roboto');
            fontLoaded = true;
        }
    } catch (e) {
        console.error('Failed to load remote fonts for Reputation Canvas', e);
    }
}

// Helper to draw a rounded image (for avatars)
function drawRoundedImage(ctx: any, img: Image, x: number, y: number, size: number, radius: number) {
    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x + radius, y);
    ctx.lineTo(x + size - radius, y);
    ctx.quadraticCurveTo(x + size, y, x + size, y + radius);
    ctx.lineTo(x + size, y + size - radius);
    ctx.quadraticCurveTo(x + size, y + size, x + size - radius, y + size);
    ctx.lineTo(x + radius, y + size);
    ctx.quadraticCurveTo(x, y + size, x, y + size - radius);
    ctx.lineTo(x, y + radius);
    ctx.quadraticCurveTo(x, y, x + radius, y);
    ctx.closePath();
    ctx.clip();
    ctx.drawImage(img, x, y, size, size);
    ctx.restore();
}

function drawRoundedRect(ctx: any, x: number, y: number, width: number, height: number, radius: number, fill: string) {
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
    ctx.closePath();
    if (fill !== 'transparent') {
        ctx.fillStyle = fill;
        ctx.fill();
    }
}

export interface ReputationCardData {
    username: string;
    avatarUrl: string;
    helper: number;
    developer: number;
    artist: number;
    trusted: number;
    bannerUrl?: string;
}

const imageCache: Map<string, Image> = new Map();

async function getEmojiImage(id: string): Promise<Image | null> {
    if (imageCache.has(id)) return imageCache.get(id)!;
    try {
        const url = `https://cdn.discordapp.com/emojis/${id}.png`;
        const img = await loadImage(url);
        imageCache.set(id, img);
        return img;
    } catch (e) {
        return null;
    }
}

export async function generateReputationCard(data: ReputationCardData): Promise<Buffer> {
    await loadFonts();

    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Trust Score Calculation
    const totalRep = data.helper + data.developer + data.artist + data.trusted;
    const trustScore = Math.min(100, Math.floor((totalRep / 50) * 100)); 

    // 1. Sleek Background 
    ctx.fillStyle = '#0a0a0c'; // Near black
    ctx.fillRect(0, 0, width, height);

    // 2. Main Container Card Clipping
    ctx.save();
    ctx.beginPath();
    const cX = 30, cY = 30, cW = width - 60, cH = height - 60, cR = 25;
    ctx.moveTo(cX + cR, cY);
    ctx.lineTo(cX + cW - cR, cY);
    ctx.quadraticCurveTo(cX + cW, cY, cX + cW, cY + cR);
    ctx.lineTo(cX + cW, cY + cH - cR);
    ctx.quadraticCurveTo(cX + cW, cY + cH, cX + cW - cR, cY + cH);
    ctx.lineTo(cX + cR, cY + cH);
    ctx.quadraticCurveTo(cX, cY + cH, cX, cY + cH - cR);
    ctx.lineTo(cX, cY + cR);
    ctx.quadraticCurveTo(cX, cY, cX + cR, cY);
    ctx.closePath();
    ctx.clip();

    // 2.5 Draw Banner or Default Gradient
    if (data.bannerUrl) {
        try {
            const bannerImg = await loadImage(data.bannerUrl.replace('.webp', '.png?size=1024'));
            const imgAspect = bannerImg.width / bannerImg.height;
            const boxAspect = cW / cH;
            
            let drawW, drawH, drawX, drawY;
            if (imgAspect > boxAspect) {
                drawH = cH;
                drawW = bannerImg.width * (cH / bannerImg.height);
                drawX = cX - ((drawW - cW) / 2);
                drawY = cY;
            } else {
                drawW = cW;
                drawH = bannerImg.height * (cW / bannerImg.width);
                drawX = cX;
                drawY = cY - ((drawH - cH) / 2);
            }
            ctx.drawImage(bannerImg, drawX, drawY, drawW, drawH);
        } catch (e) {
            // Fallback
            ctx.fillStyle = '#13131a';
            ctx.fillRect(cX, cY, cW, cH);
        }
    } else {
        // Default subtle gradient
        const bgGrad = ctx.createLinearGradient(cX, cY, cX, cY + cH);
        bgGrad.addColorStop(0, '#1a1a24');
        bgGrad.addColorStop(1, '#0a0a0f');
        ctx.fillStyle = bgGrad;
        ctx.fillRect(cX, cY, cW, cH);
    }

    // Soft gradient overlay to make text readable (top to bottom)
    const overlayGrad = ctx.createLinearGradient(cX, cY, cX, cY + cH);
    overlayGrad.addColorStop(0, 'rgba(10, 10, 12, 0.4)');
    overlayGrad.addColorStop(0.5, 'rgba(10, 10, 12, 0.8)');
    overlayGrad.addColorStop(1, 'rgba(10, 10, 12, 0.95)');
    ctx.fillStyle = overlayGrad;
    ctx.fill();

    // 3. User Avatar
    try {
        const avatarImg = await loadImage(data.avatarUrl.replace('.webp', '.png'));
        
        // Avatar Shadow
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 20;
        ctx.shadowOffsetY = 10;
        
        ctx.beginPath();
        ctx.arc(115, 115, 55, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = '#000';
        ctx.fill();
        
        ctx.shadowBlur = 0;
        ctx.shadowOffsetY = 0; // Reset
        
        // Draw Avatar
        ctx.save();
        ctx.beginPath();
        ctx.arc(115, 115, 55, 0, Math.PI * 2);
        ctx.closePath();
        ctx.clip();
        ctx.drawImage(avatarImg, 60, 60, 110, 110); 
        ctx.restore();
        
        // Avatar Ring
        ctx.beginPath();
        ctx.arc(115, 115, 55, 0, Math.PI * 2);
        ctx.lineWidth = 4;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'; // Sleek subtle white ring
        ctx.stroke();
    } catch (e) {}

    // 4. Username & Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '40px "RobotoBold"';
    ctx.fillText(data.username, 200, 105);
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '20px "Roboto"';
    ctx.fillText('Fade Community Member', 200, 135);

    // 5. Overall Trust Score Display
    const scoreX = width - 210;
    const scoreY = 60;
    
    // Glassmorphism score background
    drawRoundedRect(ctx, scoreX, scoreY, 150, 110, 20, 'rgba(255, 255, 255, 0.05)');
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.stroke();
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '14px "RobotoBold"';
    ctx.textAlign = 'center';
    ctx.fillText('TRUST SCORE', scoreX + 75, scoreY + 30);
    
    if (trustScore >= 80) ctx.fillStyle = '#4ade80';
    else if (trustScore >= 50) ctx.fillStyle = '#facc15';
    else ctx.fillStyle = '#f87171';
    
    ctx.font = '54px "RobotoBold"';
    ctx.fillText(totalRep.toString(), scoreX + 75, scoreY + 82);
    
    ctx.textAlign = 'left'; // Reset

    // 6. Reputation Breakdown Grid
    const startY = 220;
    const boxW = 165;
    const boxH = 110;
    const gap = 15;

    const categories = [
        { name: 'HELPER', value: data.helper, color: '#60a5fa', emojiId: '1507811177634467850' }, 
        { name: 'DEVELOPER', value: data.developer, color: '#f472b6', emojiId: '1508099321365794846' }, 
        { name: 'ARTIST', value: data.artist, color: '#fbbf24', emojiId: '1508102130748362804' }, 
        { name: 'TRUSTED', value: data.trusted, color: '#34d399', emojiId: '1508103725200441375' } 
    ];

    for (let idx = 0; idx < categories.length; idx++) {
        const cat = categories[idx];
        const x = 50 + (idx * (boxW + gap));
        
        // Box bg
        drawRoundedRect(ctx, x, startY, boxW, boxH, 16, 'rgba(0, 0, 0, 0.4)');
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.stroke();
        
        // Accent line (Top)
        ctx.shadowColor = cat.color;
        ctx.shadowBlur = 10;
        drawRoundedRect(ctx, x, startY, boxW, 4, 2, cat.color);
        ctx.shadowBlur = 0;

        // Fetch & Draw Icon
        const img = await getEmojiImage(cat.emojiId);
        if (img) {
            ctx.globalAlpha = 0.9;
            ctx.drawImage(img, x + 15, startY + 18, 22, 22);
            ctx.globalAlpha = 1.0;
        }

        // Category Name
        ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.font = '13px "RobotoBold"';
        ctx.fillText(cat.name, x + 46, startY + 34);

        // Value
        ctx.fillStyle = '#ffffff';
        ctx.font = '40px "RobotoBold"';
        ctx.fillText(cat.value.toString(), x + 18, startY + 84);
    }
    
    ctx.restore(); // Restore from clipping mask

    // Main Container Border
    drawRoundedRect(ctx, cX, cY, cW, cH, cR, 'transparent');
    ctx.lineWidth = 2;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    return canvas.toBuffer('image/png');
}
