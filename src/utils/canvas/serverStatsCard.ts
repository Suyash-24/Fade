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
    engagement: {
        voiceActive: number;
        boosts: number;
        boostTier: number;
    };
    analytics: {
        chartData: { date: string, messages: number, voiceSeconds: number }[];
        topChatters: { name: string, value: number }[];
        topTalkers: { name: string, value: number }[];
        topText: { name: string, value: number }[];
        topVoice: { name: string, value: number }[];
    }
}

export async function buildServerStatsCard(data: ServerStatsData): Promise<Buffer> {
    await loadFonts();

    const width = 1200;
    const height = 980; // Increased height to fit 3 rows
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, width, height);

    let guildImg: Image | null = null;
    if (data.guildIcon) {
        try {
            guildImg = await loadImage(data.guildIcon);
            ctx.save();
            ctx.filter = 'blur(100px)';
            const scale = Math.max(width / guildImg.width, height / guildImg.height);
            const w = guildImg.width * scale;
            const h = guildImg.height * scale;
            ctx.globalAlpha = 0.5;
            ctx.drawImage(guildImg, width/2 - w/2, height/2 - h/2, w, h);
            ctx.restore();
        } catch {}
    }

    const pad = 50;
    const gap = 30;
    const row1Y = pad;
    const row1H = 280;
    const row2Y = row1Y + row1H + gap;
    const row2H = 260;
    const row3Y = row2Y + row2H + gap;
    const row3H = 300;

    // --- ROW 1: Identity & Audience ---
    const colAW = 450;
    const colBW = width - (pad * 2) - gap - colAW;

    // Card A: Profile
    drawBentoCard(ctx, pad, row1Y, colAW, row1H);
    if (guildImg) drawRoundedImage(ctx, guildImg, pad + 40, row1Y + 40, 90, 25);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '42px "RobotoBold", sans-serif';
    let name = data.guildName;
    if (name.length > 20) name = name.substring(0, 18) + '...';
    ctx.fillText(name, pad + 40, row1Y + 180);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '22px "Roboto", sans-serif';
    ctx.fillText(`Owned by ${data.overview.owner}`, pad + 40, row1Y + 220);
    ctx.fillText(`Created ${data.overview.createdFormatted}`, pad + 40, row1Y + 250);

    // Card B: Audience
    const cbX = pad + colAW + gap;
    drawBentoCard(ctx, cbX, row1Y, colBW, row1H);
    ctx.fillStyle = '#f8fafc';
    ctx.font = '64px "RobotoBold", sans-serif';
    ctx.fillText(data.memberCount.toLocaleString(), cbX + 40, row1Y + 90);
    ctx.fillStyle = '#94a3b8';
    ctx.font = '24px "Roboto", sans-serif';
    ctx.fillText('Total Members', cbX + 40, row1Y + 125);

    ctx.save();
    ctx.fillStyle = 'rgba(16, 185, 129, 0.15)';
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

    const barW = colBW - 420;
    const barX = cbX + 380;
    ctx.fillStyle = '#f8fafc';
    ctx.font = '20px "RobotoBold", sans-serif';
    ctx.fillText('Composition', barX, row1Y + 60);
    drawProgressBar(ctx, barX, row1Y + 75, barW, 12, data.humanCount / data.memberCount, '#8b5cf6');
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px "Roboto", sans-serif';
    ctx.fillText(`Humans: ${data.humanCount}`, barX, row1Y + 110);
    ctx.fillText(`Bots: ${data.botCount}`, barX + barW - ctx.measureText(`Bots: ${data.botCount}`).width, row1Y + 110);

    ctx.fillStyle = '#f8fafc';
    ctx.font = '20px "RobotoBold", sans-serif';
    ctx.fillText('Online Status', barX, row1Y + 160);
    drawProgressBar(ctx, barX, row1Y + 175, barW, 12, data.onlineCount / data.memberCount, '#10b981');
    ctx.fillStyle = '#94a3b8';
    ctx.font = '16px "Roboto", sans-serif';
    ctx.fillText(`Online: ${data.onlineCount}`, barX, row1Y + 210);
    ctx.fillText(`Offline: ${data.memberCount - data.onlineCount}`, barX + barW - ctx.measureText(`Offline: ${data.memberCount - data.onlineCount}`).width, row1Y + 210);


    // --- ROW 2: Top Members & Top Channels ---
    const colHalfW = (width - (pad * 2) - gap) / 2;

    const drawList = (x: number, y: number, title: string, items: {name: string, value: string | number}[], valSuffix: string, color: string) => {
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '22px "RobotoBold", sans-serif';
        ctx.fillText(title, x, y);
        
        let curY = y + 40;
        for (let i = 0; i < 3; i++) {
            const item = items[i];
            
            // Rank Badge
            ctx.fillStyle = 'rgba(255,255,255,0.05)';
            ctx.beginPath();
            ctx.roundRect(x, curY - 22, 30, 30, 8);
            ctx.fill();
            ctx.fillStyle = '#94a3b8';
            ctx.font = '16px "RobotoBold", sans-serif';
            ctx.fillText(`${i + 1}`, x + 10, curY - 1);

            if (item) {
                ctx.fillStyle = '#f8fafc';
                ctx.font = '20px "Roboto", sans-serif';
                let itemName = item.name;
                if (itemName.length > 18) itemName = itemName.substring(0, 16) + '..';
                ctx.fillText(itemName, x + 45, curY);

                ctx.fillStyle = color;
                ctx.font = '20px "RobotoBold", sans-serif';
                const valStr = `${item.value} ${valSuffix}`;
                ctx.fillText(valStr, x + (colHalfW/2) - 40 - ctx.measureText(valStr).width, curY);
            } else {
                ctx.fillStyle = 'rgba(255,255,255,0.2)';
                ctx.font = '18px "Roboto", sans-serif';
                ctx.fillText('-', x + 45, curY);
            }
            curY += 45;
        }
    };

    // Card C: Top Contributors
    drawBentoCard(ctx, pad, row2Y, colHalfW, row2H);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '26px "RobotoBold", sans-serif';
    ctx.fillText('Top Contributors (14d)', pad + 40, row2Y + 45);
    // line separator
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(pad + 40, row2Y + 65, colHalfW - 80, 1);

    drawList(pad + 40, row2Y + 105, 'Chatters', data.analytics.topChatters, 'msg', '#10b981');
    drawList(pad + 40 + (colHalfW/2), row2Y + 105, 'Talkers', data.analytics.topTalkers, 'hrs', '#8b5cf6');

    // Card D: Top Channels
    const cdX = pad + colHalfW + gap;
    drawBentoCard(ctx, cdX, row2Y, colHalfW, row2H);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '26px "RobotoBold", sans-serif';
    ctx.fillText('Top Channels (14d)', cdX + 40, row2Y + 45);
    ctx.fillStyle = 'rgba(255,255,255,0.1)';
    ctx.fillRect(cdX + 40, row2Y + 65, colHalfW - 80, 1);

    drawList(cdX + 40, row2Y + 105, 'Text', data.analytics.topText, 'msg', '#10b981');
    drawList(cdX + 40 + (colHalfW/2), row2Y + 105, 'Voice', data.analytics.topVoice, 'hrs', '#8b5cf6');


    // --- ROW 3: Activity Chart ---
    drawBentoCard(ctx, pad, row3Y, width - (pad * 2), row3H);
    ctx.fillStyle = '#e2e8f0';
    ctx.font = '26px "RobotoBold", sans-serif';
    ctx.fillText('Activity Trends', pad + 40, row3Y + 45);

    // Legend
    ctx.fillStyle = '#10b981';
    ctx.beginPath();
    ctx.arc(pad + 250, row3Y + 38, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.font = '18px "Roboto", sans-serif';
    ctx.fillText('Messages', pad + 265, row3Y + 44);

    ctx.fillStyle = '#8b5cf6';
    ctx.beginPath();
    ctx.arc(pad + 380, row3Y + 38, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#94a3b8';
    ctx.fillText('Voice (Hours)', pad + 395, row3Y + 44);

    // Draw Line Chart
    const chartX = pad + 40;
    const chartY = row3Y + 90;
    const chartW = width - (pad * 2) - 80;
    const chartH = row3H - 120;

    const cData = data.analytics.chartData;
    if (cData.length > 0) {
        const maxMsgs = Math.max(...cData.map(d => d.messages), 10);
        const maxVoice = Math.max(...cData.map(d => d.voiceSeconds / 3600), 10);

        const drawLineChart = (dataValues: number[], maxVal: number, colorStr: string, rgb: string) => {
            const stepX = chartW / (dataValues.length - 1);
            
            // 1. Draw Fill
            ctx.beginPath();
            let first = true;
            for (let i = 0; i < dataValues.length; i++) {
                const x = chartX + (i * stepX);
                const y = chartY + chartH - ((dataValues[i] / maxVal) * chartH);
                if (first) {
                    ctx.moveTo(x, chartY + chartH);
                    ctx.lineTo(x, y);
                    first = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.lineTo(chartX + chartW, chartY + chartH);
            ctx.closePath();
            
            const grad = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
            grad.addColorStop(0, `rgba(${rgb}, 0.3)`);
            grad.addColorStop(1, `rgba(${rgb}, 0.0)`);
            ctx.fillStyle = grad;
            ctx.fill();

            // 2. Draw Stroke
            ctx.beginPath();
            ctx.strokeStyle = colorStr;
            ctx.lineWidth = 4;
            ctx.lineJoin = 'round';
            first = true;
            for (let i = 0; i < dataValues.length; i++) {
                const x = chartX + (i * stepX);
                const y = chartY + chartH - ((dataValues[i] / maxVal) * chartH);
                if (first) {
                    ctx.moveTo(x, y);
                    first = false;
                } else {
                    ctx.lineTo(x, y);
                }
            }
            ctx.shadowColor = colorStr;
            ctx.shadowBlur = 10;
            ctx.stroke();
            ctx.shadowColor = 'transparent';
        };

        // Draw Message Line
        drawLineChart(cData.map(d => d.messages), maxMsgs, '#10b981', '16, 185, 129');
        // Draw Voice Line
        drawLineChart(cData.map(d => d.voiceSeconds / 3600), maxVoice, '#8b5cf6', '139, 92, 246');
    } else {
        ctx.fillStyle = '#94a3b8';
        ctx.font = '18px "Roboto", sans-serif';
        ctx.fillText('Not enough data to display chart.', pad + 40, row3Y + 150);
    }

    return canvas.toBuffer('image/png');
}
