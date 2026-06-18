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

function clipRoundedRect(ctx: any, x: number, y: number, width: number, height: number, radius: number) {
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
    ctx.clip();
}

export async function generateReputationCard(data: ReputationCardData): Promise<Buffer> {
    await loadFonts();

    const width = 900;
    const height = 500;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    const totalRep = data.helper + data.developer + data.artist + data.trusted;
    const trustScore = Math.min(100, Math.floor((totalRep / 50) * 100)); 

    // 1. Ambient Blurred Background
    ctx.fillStyle = '#0a0a0c';
    ctx.fillRect(0, 0, width, height);

    try {
        if (data.bannerUrl) {
            const bannerImg = await loadImage(data.bannerUrl.replace('.webp', '.png?size=1024'));
            ctx.filter = 'blur(15px) brightness(0.6)';
            
            // Object fit cover
            const imgAspect = bannerImg.width / bannerImg.height;
            const canvasAspect = width / height;
            let drawW, drawH, drawX, drawY;
            if (imgAspect > canvasAspect) {
                drawH = height;
                drawW = bannerImg.width * (height / bannerImg.height);
                drawX = -((drawW - width) / 2);
                drawY = 0;
            } else {
                drawW = width;
                drawH = bannerImg.height * (width / bannerImg.width);
                drawX = 0;
                drawY = -((drawH - height) / 2);
            }
            ctx.drawImage(bannerImg, drawX, drawY, drawW, drawH);
            ctx.filter = 'none';
        } else {
            const avatarImg = await loadImage(data.avatarUrl.replace('.webp', '.png?size=1024'));
            ctx.filter = 'blur(30px) brightness(0.4)';
            ctx.drawImage(avatarImg, -100, -100, width + 200, height + 200);
            ctx.filter = 'none';
        }
    } catch (e) {
        ctx.filter = 'none';
    }

    // Gradient Overlay to ensure deep contrast
    const overlayGrad = ctx.createLinearGradient(0, 0, width, height);
    overlayGrad.addColorStop(0, 'rgba(5, 5, 10, 0.85)');
    overlayGrad.addColorStop(1, 'rgba(15, 15, 20, 0.4)');
    ctx.fillStyle = overlayGrad;
    ctx.fillRect(0, 0, width, height);

    // 2. The Master Glass Plate
    ctx.save();
    const gX = 40, gY = 40, gW = 820, gH = 420, gR = 30;
    
    // Outer glow for the plate
    ctx.shadowColor = 'rgba(0, 0, 0, 0.5)';
    ctx.shadowBlur = 30;
    ctx.shadowOffsetY = 15;
    drawRoundedRect(ctx, gX, gY, gW, gH, gR, 'rgba(255, 255, 255, 0.03)');
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;

    // Glass Fill
    drawRoundedRect(ctx, gX, gY, gW, gH, gR, 'rgba(15, 15, 20, 0.6)');
    
    // Plate Border
    const borderGrad = ctx.createLinearGradient(gX, gY, gX + gW, gY + gH);
    borderGrad.addColorStop(0, 'rgba(255, 255, 255, 0.3)');
    borderGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.02)');
    borderGrad.addColorStop(1, 'rgba(255, 255, 255, 0.08)');
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = borderGrad;
    drawRoundedRect(ctx, gX, gY, gW, gH, gR, 'transparent');
    ctx.stroke();

    // 3. Left Section: User Identity
    try {
        const avatarImg = await loadImage(data.avatarUrl.replace('.webp', '.png?size=512'));
        
        ctx.save();
        clipRoundedRect(ctx, 90, 80, 160, 160, 45); // iOS style rounded square
        ctx.drawImage(avatarImg, 90, 80, 160, 160);
        ctx.restore();
        
        // Avatar Inner Ring
        ctx.lineWidth = 2;
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        drawRoundedRect(ctx, 90, 80, 160, 160, 45, 'transparent');
        ctx.stroke();
    } catch (e) {
        drawRoundedRect(ctx, 90, 80, 160, 160, 45, '#1a1a1a');
    }

    // Username & Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '36px "RobotoBold"';
    ctx.textAlign = 'center';
    
    // Truncate username if too long
    let nameToDraw = data.username;
    if (ctx.measureText(nameToDraw).width > 240) {
        nameToDraw = nameToDraw.substring(0, 12) + '...';
    }
    ctx.fillText(nameToDraw, 170, 285);
    
    const titleGrad = ctx.createLinearGradient(70, 0, 270, 0);
    titleGrad.addColorStop(0, '#a688fa');
    titleGrad.addColorStop(1, '#f472b6');
    ctx.fillStyle = titleGrad;
    ctx.font = '14px "RobotoBold"';
    ctx.fillText('COMMUNITY MEMBER', 170, 315);

    // Trust Score Badge
    drawRoundedRect(ctx, 90, 350, 160, 75, 20, 'rgba(0, 0, 0, 0.4)');
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.05)';
    drawRoundedRect(ctx, 90, 350, 160, 75, 20, 'transparent');
    ctx.stroke();

    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.font = '11px "RobotoBold"';
    ctx.fillText('TRUST SCORE', 170, 372);
    
    if (trustScore >= 80) ctx.fillStyle = '#4ade80';
    else if (trustScore >= 50) ctx.fillStyle = '#facc15';
    else ctx.fillStyle = '#f87171';
    
    ctx.font = '34px "RobotoBold"';
    ctx.fillText(totalRep.toString(), 170, 410);
    ctx.textAlign = 'left';

    // 4. Subtle Vertical Divider
    const divX = 330;
    const divGrad = ctx.createLinearGradient(divX, gY, divX, gY + gH);
    divGrad.addColorStop(0, 'rgba(255, 255, 255, 0.0)');
    divGrad.addColorStop(0.5, 'rgba(255, 255, 255, 0.1)');
    divGrad.addColorStop(1, 'rgba(255, 255, 255, 0.0)');
    ctx.beginPath();
    ctx.moveTo(divX, gY + 30);
    ctx.lineTo(divX, gY + gH - 30);
    ctx.lineWidth = 1;
    ctx.strokeStyle = divGrad;
    ctx.stroke();

    // 5. Right Section: Modern Grid Dashboard
    const categories = [
        { name: 'HELPER', value: data.helper, color: '#60a5fa', emojiId: '1507811177634467850' }, 
        { name: 'DEVELOPER', value: data.developer, color: '#f472b6', emojiId: '1508099321365794846' }, 
        { name: 'ARTIST', value: data.artist, color: '#fbbf24', emojiId: '1508102130748362804' }, 
        { name: 'TRUSTED', value: data.trusted, color: '#34d399', emojiId: '1508103725200441375' } 
    ];

    const positions = [
        { x: 380, y: 80 }, { x: 630, y: 80 },
        { x: 380, y: 260 }, { x: 630, y: 260 }
    ];

    for (let idx = 0; idx < categories.length; idx++) {
        const cat = categories[idx];
        const pos = positions[idx];
        
        // Vertical Glowing Accent Bar
        ctx.shadowColor = cat.color;
        ctx.shadowBlur = 15;
        drawRoundedRect(ctx, pos.x, pos.y, 4, 120, 2, cat.color);
        ctx.shadowBlur = 0;

        // Fetch & Draw Icon
        const img = await getEmojiImage(cat.emojiId);
        if (img) {
            ctx.globalAlpha = 0.9;
            ctx.drawImage(img, pos.x + 25, pos.y + 5, 28, 28);
            ctx.globalAlpha = 1.0;
        }

        // Category Name
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '14px "RobotoBold"';
        ctx.fillText(cat.name, pos.x + 65, pos.y + 25);

        // Value
        ctx.fillStyle = '#ffffff';
        ctx.font = '64px "RobotoBold"';
        ctx.fillText(cat.value.toString(), pos.x + 25, pos.y + 90);

        // Label
        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.font = '12px "RobotoBold"';
        ctx.fillText('REP POINTS', pos.x + 25, pos.y + 115);
    }

    ctx.restore();
    return canvas.toBuffer('image/png');
}
