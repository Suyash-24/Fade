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
    ctx.fillStyle = fill;
    ctx.fill();
}

export interface ReputationCardData {
    username: string;
    avatarUrl: string;
    helper: number;
    developer: number;
    artist: number;
    trusted: number;
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
    const trustScore = Math.min(100, Math.floor((totalRep / 50) * 100)); // Sample logic

    // 1. Sleek Background 
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#0a0a0c'); // Near black
    bgGradient.addColorStop(1, '#13131a'); // Dark grey/blue
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Glowing orb effect
    const glow = ctx.createRadialGradient(width/2, height/2, 50, width/2, height/2, 400);
    glow.addColorStop(0, 'rgba(166, 136, 250, 0.08)');
    glow.addColorStop(1, 'transparent');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, width, height);

    // 2. Main Container Card
    drawRoundedRect(ctx, 30, 30, width - 60, height - 60, 25, 'rgba(255, 255, 255, 0.03)');
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.stroke();

    // 3. User Avatar
    try {
        const avatarImg = await loadImage(data.avatarUrl.replace('.webp', '.png'));
        
        // Avatar Glow
        ctx.shadowColor = '#a688fa';
        ctx.shadowBlur = 30;
        drawRoundedRect(ctx, 60, 60, 110, 110, 55, '#000');
        ctx.shadowBlur = 0; // Reset
        
        drawRoundedImage(ctx, avatarImg, 60, 60, 110, 55); 
        
        ctx.beginPath();
        ctx.arc(115, 115, 55, 0, Math.PI * 2);
        ctx.lineWidth = 3;
        ctx.strokeStyle = 'rgba(166, 136, 250, 0.8)';
        ctx.stroke();
    } catch (e) {
        drawRoundedRect(ctx, 60, 60, 110, 110, 55, '#2a2a2a');
    }

    // 4. Username & Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '38px "RobotoBold"';
    ctx.fillText(data.username, 200, 105);
    
    ctx.fillStyle = 'rgba(166, 136, 250, 0.8)';
    ctx.font = '20px "Roboto"';
    ctx.fillText('FADE COMMUNITY', 200, 135);

    // 5. Overall Trust Score Display
    const scoreX = width - 210;
    const scoreY = 60;
    
    drawRoundedRect(ctx, scoreX, scoreY, 150, 110, 20, 'rgba(0, 0, 0, 0.4)');
    
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '14px "RobotoBold"';
    ctx.textAlign = 'center';
    ctx.fillText('TRUST SCORE', scoreX + 75, scoreY + 28);
    
    if (trustScore >= 80) ctx.fillStyle = '#4ade80';
    else if (trustScore >= 50) ctx.fillStyle = '#facc15';
    else ctx.fillStyle = '#f87171';
    
    ctx.font = '54px "RobotoBold"';
    ctx.fillText(totalRep.toString(), scoreX + 75, scoreY + 80);
    
    ctx.textAlign = 'left'; // Reset

    // 6. Reputation Breakdown Grid
    const startY = 210;
    const boxW = 165;
    const boxH = 100;
    const gap = 15;

    const categories = [
        { name: 'HELPER', value: data.helper, color: '#60a5fa', emojiId: '1507811177634467850' }, // success tick
        { name: 'DEVELOPER', value: data.developer, color: '#f472b6', emojiId: '1508099321365794846' }, // bot
        { name: 'ARTIST', value: data.artist, color: '#fbbf24', emojiId: '1508102130748362804' }, // star
        { name: 'TRUSTED', value: data.trusted, color: '#34d399', emojiId: '1508103725200441375' } // crown
    ];

    for (let idx = 0; idx < categories.length; idx++) {
        const cat = categories[idx];
        const x = 50 + (idx * (boxW + gap));
        
        // Box bg
        drawRoundedRect(ctx, x, startY, boxW, boxH, 16, 'rgba(0, 0, 0, 0.3)');
        ctx.lineWidth = 1;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
        ctx.stroke();
        
        // Top accent glow line
        ctx.shadowColor = cat.color;
        ctx.shadowBlur = 10;
        drawRoundedRect(ctx, x, startY, boxW, 4, 2, cat.color);
        ctx.shadowBlur = 0;

        // Fetch & Draw Icon
        const img = await getEmojiImage(cat.emojiId);
        if (img) {
            ctx.globalAlpha = 0.8;
            ctx.drawImage(img, x + 15, startY + 15, 24, 24);
            ctx.globalAlpha = 1.0;
        }

        // Category Name
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '13px "RobotoBold"';
        ctx.fillText(cat.name, x + 48, startY + 32);

        // Value
        ctx.fillStyle = '#ffffff';
        ctx.font = '36px "RobotoBold"';
        ctx.fillText(cat.value.toString(), x + 20, startY + 75);
    }

    return canvas.toBuffer('image/png');
}
