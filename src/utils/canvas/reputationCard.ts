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

export async function generateReputationCard(data: ReputationCardData): Promise<Buffer> {
    await loadFonts();

    const width = 800;
    const height = 400;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Trust Score Calculation
    const totalRep = data.helper + data.developer + data.artist + data.trusted;
    const trustScore = Math.min(100, Math.floor((totalRep / 50) * 100)); // Sample logic: 50 total rep = 100% Trust Score

    // 1. Background
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#0f0c29'); // Deep purple/black
    bgGradient.addColorStop(0.5, '#302b63'); // Muted purple
    bgGradient.addColorStop(1, '#24243e'); // Dark blue
    
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Subtle overlay pattern or styling
    ctx.fillStyle = 'rgba(255, 255, 255, 0.02)';
    for (let i = 0; i < height; i += 4) {
        ctx.fillRect(0, i, width, 1);
    }

    // 2. Main Container Card
    drawRoundedRect(ctx, 40, 40, width - 80, height - 80, 20, 'rgba(0, 0, 0, 0.4)');
    
    // Border for Container
    ctx.lineWidth = 1;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.stroke();

    // 3. User Avatar
    try {
        const avatarImg = await loadImage(data.avatarUrl.replace('.webp', '.png'));
        drawRoundedImage(ctx, avatarImg, 70, 70, 120, 60); // 120x120 size, 50% radius for circle
        
        // Avatar Ring
        ctx.beginPath();
        ctx.arc(130, 130, 65, 0, Math.PI * 2);
        ctx.lineWidth = 4;
        ctx.strokeStyle = '#a688fa';
        ctx.stroke();
    } catch (e) {
        // Fallback if avatar fails
        drawRoundedRect(ctx, 70, 70, 120, 120, 60, '#2a2a2a');
    }

    // 4. Username & Title
    ctx.fillStyle = '#ffffff';
    ctx.font = '36px "RobotoBold"';
    ctx.fillText(data.username, 220, 110);
    
    ctx.fillStyle = '#a688fa';
    ctx.font = '20px "Roboto"';
    ctx.fillText('Fade Community Member', 220, 140);

    // 5. Overall Trust Score Display
    const scoreX = width - 200;
    const scoreY = 70;
    
    drawRoundedRect(ctx, scoreX, scoreY, 130, 120, 15, 'rgba(166, 136, 250, 0.1)');
    
    ctx.fillStyle = '#a688fa';
    ctx.font = '16px "RobotoBold"';
    ctx.textAlign = 'center';
    ctx.fillText('TRUST SCORE', scoreX + 65, scoreY + 30);
    
    // Dynamic score color
    if (trustScore >= 80) ctx.fillStyle = '#4ade80'; // Green
    else if (trustScore >= 50) ctx.fillStyle = '#facc15'; // Yellow
    else ctx.fillStyle = '#f87171'; // Red
    
    ctx.font = '48px "RobotoBold"';
    ctx.fillText(totalRep.toString(), scoreX + 65, scoreY + 80);
    
    ctx.fillStyle = 'rgba(255,255,255,0.5)';
    ctx.font = '14px "Roboto"';
    ctx.fillText('TOTAL REP', scoreX + 65, scoreY + 105);
    ctx.textAlign = 'left'; // Reset

    // 6. Reputation Breakdown Grid
    const startY = 220;
    const boxW = 160;
    const boxH = 90;
    const gap = 20;

    const categories = [
        { name: 'HELPER', value: data.helper, color: '#60a5fa', icon: '🤝' },
        { name: 'DEVELOPER', value: data.developer, color: '#f472b6', icon: '💻' },
        { name: 'ARTIST', value: data.artist, color: '#fbbf24', icon: '🎨' },
        { name: 'TRUSTED', value: data.trusted, color: '#34d399', icon: '⭐' }
    ];

    categories.forEach((cat, idx) => {
        const x = 70 + (idx * (boxW + gap));
        
        // Box bg
        drawRoundedRect(ctx, x, startY, boxW, boxH, 12, 'rgba(0, 0, 0, 0.5)');
        
        // Top accent line
        drawRoundedRect(ctx, x, startY, boxW, 4, 2, cat.color);

        // Icon
        ctx.font = '24px "Roboto"';
        ctx.fillText(cat.icon, x + 15, startY + 35);
        
        // Category Name
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '14px "RobotoBold"';
        ctx.fillText(cat.name, x + 50, startY + 32);

        // Value
        ctx.fillStyle = '#ffffff';
        ctx.font = '32px "RobotoBold"';
        ctx.fillText(cat.value.toString(), x + 15, startY + 75);
    });

    return canvas.toBuffer('image/png');
}
