// src/utils/canvas/serverStatsCard.ts
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
        console.error('Failed to load remote fonts for Server Stats Canvas', e);
    }
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
    if (fill) {
        ctx.fillStyle = fill;
        ctx.fill();
    }
}

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

export interface ServerStatsData {
    guildName: string;
    guildIcon: string | null;
    memberCount: number;
    humanCount: number;
    botCount: number;
    onlineCount: number;
    overview: {
        owner: string;
        createdFormatted: string;
        boosts: number;
        boostTier: number;
        roles: number;
    };
    infrastructure: {
        textChannels: number;
        voiceChannels: number;
        categories: number;
        emojis: number;
        stickers: number;
    };
}

export async function buildServerStatsCard(data: ServerStatsData): Promise<Buffer> {
    await loadFonts();

    const width = 1200;
    const height = 675;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background
    ctx.fillStyle = '#0f172a'; // slate-900 base
    ctx.fillRect(0, 0, width, height);

    let guildImg: Image | null = null;
    if (data.guildIcon) {
        try {
            guildImg = await loadImage(data.guildIcon);
            // Draw blurred background
            ctx.save();
            ctx.filter = 'blur(70px)';
            const scale = Math.max(width / guildImg.width, height / guildImg.height);
            const w = guildImg.width * scale;
            const h = guildImg.height * scale;
            ctx.globalAlpha = 0.5;
            ctx.drawImage(guildImg, width/2 - w/2, height/2 - h/2, w, h);
            ctx.restore();
        } catch {}
    }

    // Glassmorphism overlay
    ctx.fillStyle = 'rgba(15, 23, 42, 0.75)'; // slate-900 with opacity
    ctx.fillRect(0, 0, width, height);

    // 2. Header
    const padX = 60;
    let padY = 60;
    
    if (guildImg) {
        drawRoundedImage(ctx, guildImg, padX, padY, 80, 20);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '54px "RobotoBold", sans-serif';
        // Center vertically with the icon since subtitle is removed
        ctx.fillText(data.guildName, padX + 110, padY + 55); 
    } else {
        ctx.fillStyle = '#f8fafc';
        ctx.font = '54px "RobotoBold", sans-serif';
        ctx.fillText(data.guildName, padX, padY + 55);
    }

    padY += 140;

    // 3 Columns Layout
    const colWidth = (width - padX * 2 - 60) / 3;
    const gap = 30;

    const drawCard = (x: number, y: number, w: number, h: number, title: string) => {
        drawRoundedRect(ctx, x, y, w, h, 24, 'rgba(30, 41, 59, 0.6)'); // slate-800
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '26px "RobotoBold", sans-serif';
        ctx.fillText(title, x + 30, y + 45);
        ctx.beginPath();
        ctx.moveTo(x + 30, y + 65);
        ctx.lineTo(x + w - 30, y + 65);
        ctx.strokeStyle = 'rgba(148, 163, 184, 0.2)';
        ctx.lineWidth = 2;
        ctx.stroke();
    };

    const drawStatLine = (x: number, y: number, label: string, value: string) => {
        ctx.fillStyle = '#cbd5e1';
        ctx.font = '18px "RobotoBold", sans-serif';
        ctx.fillText(label, x, y);
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(value, x + colWidth - 60 - ctx.measureText(value).width, y);
    };

    // Column 1: Audience
    const col1X = padX;
    drawCard(col1X, padY, colWidth, 380, 'Audience');

    ctx.fillStyle = '#f8fafc';
    ctx.font = '48px "RobotoBold", sans-serif';
    ctx.fillText(data.memberCount.toLocaleString(), col1X + 30, padY + 120);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px "Roboto", sans-serif';
    ctx.fillText('Total Members', col1X + 30, padY + 150);

    let barY = padY + 200;
    ctx.fillStyle = '#f8fafc';
    ctx.font = '20px "RobotoBold", sans-serif';
    ctx.fillText('Composition', col1X + 30, barY);
    
    drawRoundedRect(ctx, col1X + 30, barY + 15, colWidth - 60, 16, 8, 'rgba(15, 23, 42, 0.8)');
    const humanPct = Math.max(0, Math.min(1, data.humanCount / data.memberCount));
    if (humanPct > 0) {
        drawRoundedRect(ctx, col1X + 30, barY + 15, Math.max(16, (colWidth - 60) * humanPct), 16, 8, '#7B8CDE');
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px "Roboto", sans-serif';
    ctx.fillText(`Humans: ${data.humanCount} (${Math.round(humanPct*100)}%)`, col1X + 30, barY + 55);
    ctx.fillText(`Bots: ${data.botCount}`, col1X + 30 + colWidth - 60 - ctx.measureText(`Bots: ${data.botCount}`).width, barY + 55);

    barY += 90;
    ctx.fillStyle = '#f8fafc';
    ctx.font = '20px "RobotoBold", sans-serif';
    ctx.fillText('Online Status', col1X + 30, barY);
    
    drawRoundedRect(ctx, col1X + 30, barY + 15, colWidth - 60, 16, 8, 'rgba(15, 23, 42, 0.8)');
    const onlinePct = Math.max(0, Math.min(1, data.onlineCount / data.memberCount));
    if (onlinePct > 0) {
        drawRoundedRect(ctx, col1X + 30, barY + 15, Math.max(16, (colWidth - 60) * onlinePct), 16, 8, '#10b981');
    }
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px "Roboto", sans-serif';
    ctx.fillText(`Online: ${data.onlineCount} (${Math.round(onlinePct*100)}%)`, col1X + 30, barY + 55);
    ctx.fillText(`Offline: ${data.memberCount - data.onlineCount}`, col1X + 30 + colWidth - 60 - ctx.measureText(`Offline: ${data.memberCount - data.onlineCount}`).width, barY + 55);


    // Column 2: Overview
    const col2X = col1X + colWidth + gap;
    drawCard(col2X, padY, colWidth, 380, 'Overview');

    let startY = padY + 110;
    const lineSpacing = 45;

    drawStatLine(col2X + 30, startY, 'Owner', data.overview.owner);
    startY += lineSpacing;
    drawStatLine(col2X + 30, startY, 'Created On', data.overview.createdFormatted);
    startY += lineSpacing;
    
    // Boosts with Tier
    const boostLabel = `Boosts (Tier ${data.overview.boostTier})`;
    drawStatLine(col2X + 30, startY, boostLabel, data.overview.boosts.toString());
    startY += lineSpacing;
    
    drawStatLine(col2X + 30, startY, 'Total Roles', data.overview.roles.toLocaleString());


    // Column 3: Infrastructure
    const col3X = col2X + colWidth + gap;
    drawCard(col3X, padY, colWidth, 380, 'Infrastructure');

    startY = padY + 110;

    drawStatLine(col3X + 30, startY, 'Text Channels', data.infrastructure.textChannels.toLocaleString());
    startY += lineSpacing;
    
    drawStatLine(col3X + 30, startY, 'Voice Channels', data.infrastructure.voiceChannels.toLocaleString());
    startY += lineSpacing;
    
    drawStatLine(col3X + 30, startY, 'Categories', data.infrastructure.categories.toLocaleString());
    startY += lineSpacing;
    
    drawStatLine(col3X + 30, startY, 'Emojis', data.infrastructure.emojis.toLocaleString());
    startY += lineSpacing;
    
    drawStatLine(col3X + 30, startY, 'Stickers', data.infrastructure.stickers.toLocaleString());

    return canvas.toBuffer('image/png');
}
