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

function drawBentoCard(ctx: any, x: number, y: number, w: number, h: number) {
    ctx.save();
    ctx.shadowColor = 'rgba(0, 0, 0, 0.4)';
    ctx.shadowBlur = 20;
    ctx.shadowOffsetY = 10;
    
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 28);
    ctx.fillStyle = 'rgba(15, 23, 42, 0.7)';
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.5;
    const gradient = ctx.createLinearGradient(x, y, x + w, y + h);
    gradient.addColorStop(0, 'rgba(255, 255, 255, 0.15)');
    gradient.addColorStop(1, 'rgba(255, 255, 255, 0.02)');
    ctx.strokeStyle = gradient;
    ctx.stroke();
    ctx.restore();
}

function drawProgressBar(ctx: any, x: number, y: number, w: number, h: number, pct: number, color: string) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h/2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.fill();

    if (pct > 0) {
        ctx.beginPath();
        ctx.roundRect(x, y, Math.max(h, w * pct), h, h/2);
        
        ctx.shadowColor = color;
        ctx.shadowBlur = 15;
        ctx.fillStyle = color;
        ctx.fill();
    }
    ctx.restore();
}

export interface ServerStatsData {
    guildName: string;
    guildIcon: string | null;
    memberCount: number;
    humanCount: number;
    botCount: number;
    onlineCount: number;
    joined24h: number;
    joined7d: number;
    overview: {
        owner: string;
        createdFormatted: string;
        roles: number;
    };
    security: {
        verificationLevel: string;
        explicitContent: string;
        mfaLevel: string;
    };
    engagement: {
        voiceActive: number;
        boosts: number;
        boostTier: number;
    };
    infrastructure: {
        textChannels: number;
        voiceChannels: number;
        categories: number;
        emojis: number;
    };
}

export async function buildServerStatsCard(data: ServerStatsData): Promise<Buffer> {
    await loadFonts();

    const width = 1200;
    const height = 750;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // 1. Background
    ctx.fillStyle = '#020617'; // slate-950
    ctx.fillRect(0, 0, width, height);

    let guildImg: Image | null = null;
    if (data.guildIcon) {
        try {
            guildImg = await loadImage(data.guildIcon);
            ctx.save();
            ctx.filter = 'blur(90px)';
            const scale = Math.max(width / guildImg.width, height / guildImg.height);
            const w = guildImg.width * scale;
            const h = guildImg.height * scale;
            ctx.globalAlpha = 0.6;
            ctx.drawImage(guildImg, width/2 - w/2, height/2 - h/2, w, h);
            ctx.restore();
        } catch {}
    }

    // Grid layout coordinates
    const pad = 50;
    const gap = 30;
    const row1Y = pad;
    const row1H = 280;
    const row2Y = pad + row1H + gap;
    const row2H = 340;

    const colAW = 450;
    const colBW = width - (pad * 2) - gap - colAW;
    
    const colCW = (width - (pad * 2) - (gap * 2)) / 3;

    // CARD A: PROFILE
    drawBentoCard(ctx, pad, row1Y, colAW, row1H);
    if (guildImg) {
        drawRoundedImage(ctx, guildImg, pad + 40, row1Y + 40, 90, 25);
    }
    ctx.fillStyle = '#f8fafc';
    ctx.font = '42px "RobotoBold", sans-serif';
    // Handle long names
    let name = data.guildName;
    if (name.length > 20) name = name.substring(0, 18) + '...';
    ctx.fillText(name, pad + 40, row1Y + 180);
    
    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px "Roboto", sans-serif';
    ctx.fillText(`Owned by ${data.overview.owner}`, pad + 40, row1Y + 220);
    ctx.fillText(`Created ${data.overview.createdFormatted}`, pad + 40, row1Y + 250);


    // CARD B: GROWTH & AUDIENCE
    const cbX = pad + colAW + gap;
    drawBentoCard(ctx, cbX, row1Y, colBW, row1H);
    
    // Large members count on left
    ctx.fillStyle = '#f8fafc';
    ctx.font = '64px "RobotoBold", sans-serif';
    ctx.fillText(data.memberCount.toLocaleString(), cbX + 40, row1Y + 90);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px "Roboto", sans-serif';
    ctx.fillText('Total Members', cbX + 40, row1Y + 125);

    // Join rates (Badges)
    ctx.save();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)'; // Emerald tint
    ctx.roundRect(cbX + 40, row1Y + 155, 160, 40, 12);
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.font = '18px "RobotoBold", sans-serif';
    ctx.fillText(`+${data.joined24h} last 24h`, cbX + 55, row1Y + 182);

    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
    ctx.roundRect(cbX + 220, row1Y + 155, 160, 40, 12);
    ctx.fill();
    ctx.fillStyle = '#10b981';
    ctx.fillText(`+${data.joined7d} last 7d`, cbX + 235, row1Y + 182);
    ctx.restore();

    // Bars on right side
    const barW = colBW - 420;
    const barX = cbX + 380;
    
    // Composition Bar
    ctx.fillStyle = '#f8fafc';
    ctx.font = '20px "RobotoBold", sans-serif';
    ctx.fillText('Composition', barX, row1Y + 60);
    drawProgressBar(ctx, barX, row1Y + 75, barW, 12, data.humanCount / data.memberCount, '#8b5cf6'); // Violet
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px "Roboto", sans-serif';
    ctx.fillText(`Humans: ${data.humanCount}`, barX, row1Y + 110);
    ctx.fillText(`Bots: ${data.botCount}`, barX + barW - ctx.measureText(`Bots: ${data.botCount}`).width, row1Y + 110);

    // Online Bar
    ctx.fillStyle = '#f8fafc';
    ctx.font = '20px "RobotoBold", sans-serif';
    ctx.fillText('Online Status', barX, row1Y + 160);
    drawProgressBar(ctx, barX, row1Y + 175, barW, 12, data.onlineCount / data.memberCount, '#10b981');
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px "Roboto", sans-serif';
    ctx.fillText(`Online: ${data.onlineCount}`, barX, row1Y + 210);
    ctx.fillText(`Offline: ${data.memberCount - data.onlineCount}`, barX + barW - ctx.measureText(`Offline: ${data.memberCount - data.onlineCount}`).width, row1Y + 210);


    // CARD C: ENGAGEMENT
    const ccX = pad;
    drawBentoCard(ctx, ccX, row2Y, colCW, row2H);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '24px "RobotoBold", sans-serif';
    ctx.fillText('Voice Activity', ccX + 40, row2Y + 50);

    ctx.fillStyle = '#10b981';
    ctx.font = '72px "RobotoBold", sans-serif';
    ctx.fillText(data.engagement.voiceActive.toString(), ccX + 40, row2Y + 130);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '20px "Roboto", sans-serif';
    ctx.fillText('Users Active in VC', ccX + 40, row2Y + 165);

    // line separator
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(ccX + 40, row2Y + 200, colCW - 80, 2);

    ctx.fillStyle = '#e2e8f0';
    ctx.font = '24px "RobotoBold", sans-serif';
    ctx.fillText(`Level ${data.engagement.boostTier} Perks`, ccX + 40, row2Y + 250);
    ctx.fillStyle = '#f472b6'; // Pink for boosts
    ctx.fillText(`${data.engagement.boosts} Boosts`, ccX + 40, row2Y + 290);


    // CARD D: INFRASTRUCTURE
    const cdX = pad + colCW + gap;
    drawBentoCard(ctx, cdX, row2Y, colCW, row2H);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '24px "RobotoBold", sans-serif';
    ctx.fillText('Infrastructure', cdX + 40, row2Y + 50);

    const drawLine = (x: number, y: number, label: string, val: string) => {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '20px "Roboto", sans-serif';
        ctx.fillText(label, x, y);
        ctx.fillStyle = '#f8fafc';
        ctx.font = '22px "RobotoBold", sans-serif';
        ctx.fillText(val, x + colCW - 80 - ctx.measureText(val).width, y);
    };

    let startY = row2Y + 110;
    drawLine(cdX + 40, startY, 'Text Channels', data.infrastructure.textChannels.toString());
    startY += 45;
    drawLine(cdX + 40, startY, 'Voice Channels', data.infrastructure.voiceChannels.toString());
    startY += 45;
    drawLine(cdX + 40, startY, 'Categories', data.infrastructure.categories.toString());
    startY += 45;
    drawLine(cdX + 40, startY, 'Server Roles', data.overview.roles.toString());
    startY += 45;
    drawLine(cdX + 40, startY, 'Emojis', data.infrastructure.emojis.toString());


    // CARD E: SECURITY
    const ceX = pad + colCW * 2 + gap * 2;
    drawBentoCard(ctx, ceX, row2Y, colCW, row2H);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '24px "RobotoBold", sans-serif';
    ctx.fillText('Security Settings', ceX + 40, row2Y + 50);

    const drawSecBlock = (x: number, y: number, title: string, subtitle: string, isHigh: boolean) => {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '20px "RobotoBold", sans-serif';
        ctx.fillText(title, x, y);
        ctx.fillStyle = isHigh ? '#38bdf8' : '#94a3b8';
        ctx.font = '18px "Roboto", sans-serif';
        ctx.fillText(subtitle, x, y + 28);
    };

    drawSecBlock(ceX + 40, row2Y + 110, 'Verification Level', data.security.verificationLevel, data.security.verificationLevel === 'High' || data.security.verificationLevel === 'Highest');
    drawSecBlock(ceX + 40, row2Y + 190, 'Content Filter', data.security.explicitContent, data.security.explicitContent === 'All members');
    drawSecBlock(ceX + 40, row2Y + 270, 'MFA Requirement', data.security.mfaLevel, data.security.mfaLevel === 'Elevated');

    return canvas.toBuffer('image/png');
}
