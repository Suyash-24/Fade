// src/utils/canvas/serverStatsCard.ts
import { createCanvas, loadImage, GlobalFonts, Image } from '@napi-rs/canvas';

let fontLoaded = false;
async function loadFonts() {
    if (fontLoaded) return;
    try {
        const fetchAndRegister = async (url: string, name: string) => {
            try {
                const res = await fetch(url);
                if (res.ok) {
                    GlobalFonts.register(Buffer.from(await res.arrayBuffer()), name);
                } else {
                    console.error(`Failed to load font ${name}, status: ${res.status}`);
                }
            } catch (e) {
                console.error(`Failed to fetch font ${name}:`, e);
            }
        };

        await Promise.all([
            fetchAndRegister('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf', 'RobotoBold'),
            fetchAndRegister('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf', 'Roboto'),
            fetchAndRegister('https://github.com/googlefonts/noto-emoji/raw/main/fonts/NotoColorEmoji.ttf', 'NotoColorEmoji'),
            fetchAndRegister('https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf', 'NotoSans'),
            fetchAndRegister('https://github.com/google/fonts/raw/main/ofl/notosansmath/NotoSansMath-Regular.ttf', 'NotoSansMath'),
            fetchAndRegister('https://github.com/google/fonts/raw/main/ofl/notosanssymbols/NotoSansSymbols-Regular.ttf', 'NotoSansSymbols'),
            fetchAndRegister('https://github.com/google/fonts/raw/main/ofl/notosanssymbols2/NotoSansSymbols2-Regular.ttf', 'NotoSansSymbols2')
        ]);
        
        fontLoaded = true;
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
    ctx.shadowColor = 'rgba(0, 0, 0, 0.02)';
    ctx.shadowBlur = 10;
    ctx.shadowOffsetY = 4;
    
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, 28);
    ctx.fillStyle = '#ffffff'; // Elegant white cards
    ctx.fill();
    
    ctx.shadowColor = 'transparent';
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = '#ffe4e6'; // rose-100
    ctx.stroke();
    ctx.restore();
}

function drawProgressBar(ctx: any, x: number, y: number, w: number, h: number, pct: number, color: string) {
    ctx.save();
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, h/2);
    ctx.fillStyle = '#f1f5f9'; // Light gray underlay
    ctx.fill();

    if (pct > 0) {
        ctx.beginPath();
        ctx.roundRect(x, y, Math.max(h, w * pct), h, h/2);
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
        botJoinedFormatted: string;
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

    // Background gradient (soft pink to white)
    const bgGrad = ctx.createLinearGradient(0, 0, width, height);
    bgGrad.addColorStop(0, '#fff5f6');
    bgGrad.addColorStop(1, '#ffffff');
    ctx.fillStyle = bgGrad;
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
            ctx.globalAlpha = 0.08; // extremely subtle blur overlay
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
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.font = '42px "RobotoBold", "NotoColorEmoji", "NotoSans", "NotoSansMath", "NotoSansSymbols", "NotoSansSymbols2", "Segoe UI Emoji", "Segoe UI Symbol", "Segoe UI", sans-serif';
    let name = data.guildName;
    const nameArr = [...name];
    if (nameArr.length > 20) name = nameArr.slice(0, 18).join('') + '...';
    ctx.fillText(name, pad + 40, row1Y + 180);
    ctx.fillStyle = '#64748b'; // slate-500
    ctx.font = '20px "Roboto", "NotoColorEmoji", "NotoSans", "NotoSansMath", "NotoSansSymbols", "Segoe UI Symbol", "Segoe UI", sans-serif';
    ctx.fillText(`Owner: ${data.overview.owner}`, pad + 40, row1Y + 220);
    ctx.fillText(`Roles: ${data.overview.roles} total`, pad + 40, row1Y + 250);

    // Card B: Audience
    const cbX = pad + colAW + gap;
    drawBentoCard(ctx, cbX, row1Y, colBW, row1H);
    ctx.fillStyle = '#0f172a'; // slate-900
    ctx.font = '64px "RobotoBold", sans-serif';
    ctx.fillText(data.memberCount.toLocaleString(), cbX + 40, row1Y + 90);
    ctx.fillStyle = '#64748b'; // slate-500
    ctx.font = '24px "Roboto", sans-serif';
    ctx.fillText('Total Members', cbX + 40, row1Y + 125);

    // Dates
    ctx.fillStyle = '#64748b';
    ctx.font = '16px "Roboto", "NotoColorEmoji", "NotoSans", "NotoSansSymbols", "Segoe UI Symbol", sans-serif';
    ctx.fillText(`Created: ${data.overview.createdFormatted}`, cbX + 40, row1Y + 180);
    ctx.fillText(`Bot Joined: ${data.overview.botJoinedFormatted}`, cbX + 40, row1Y + 210);

    const barW = colBW - 420;
    const barX = cbX + 380;
    ctx.fillStyle = '#1e293b'; // slate-800
    ctx.font = '20px "RobotoBold", sans-serif';
    ctx.fillText('Composition', barX, row1Y + 60);
    drawProgressBar(ctx, barX, row1Y + 75, barW, 12, data.humanCount / data.memberCount, '#be185d'); // Darker Pink
    ctx.fillStyle = '#64748b';
    ctx.font = '16px "Roboto", sans-serif';
    ctx.fillText(`Humans: ${data.humanCount}`, barX, row1Y + 110);
    ctx.textAlign = 'right';
    ctx.fillText(`Bots: ${data.botCount}`, barX + barW, row1Y + 110);
    ctx.textAlign = 'left';

    ctx.fillStyle = '#1e293b';
    ctx.font = '20px "RobotoBold", sans-serif';
    ctx.fillText('Online Status', barX, row1Y + 160);
    drawProgressBar(ctx, barX, row1Y + 175, barW, 12, data.onlineCount / data.memberCount, '#475569'); // Slate
    ctx.fillStyle = '#64748b';
    ctx.font = '16px "Roboto", sans-serif';
    ctx.fillText(`Online: ${data.onlineCount}`, barX, row1Y + 210);
    ctx.textAlign = 'right';
    ctx.fillText(`Offline: ${data.memberCount - data.onlineCount}`, barX + barW, row1Y + 210);
    ctx.textAlign = 'left';

    // --- ROW 2: Top Members & Top Channels ---
    const colHalfW = (width - (pad * 2) - gap) / 2;

    const drawList = (x: number, y: number, title: string, items: {name: string, value: string | number}[], valSuffix: string, color: string) => {
        ctx.fillStyle = '#475569'; // Slate-600
        ctx.font = '20px "RobotoBold", sans-serif';
        ctx.fillText(title, x, y);
        
        let curY = y + 40;
        for (let i = 0; i < 3; i++) {
            const item = items[i];
            
            // Rank Badge (Light pink badge on White card)
            ctx.fillStyle = 'rgba(190, 24, 93, 0.12)';
            ctx.beginPath();
            ctx.roundRect(x, curY - 22, 28, 28, 6);
            ctx.fill();
            ctx.fillStyle = '#be185d'; // Darker pink text
            ctx.font = '14px "RobotoBold", sans-serif';
            ctx.fillText(`${i + 1}`, x + 10, curY - 2);

            if (item) {
                ctx.fillStyle = '#334155'; // Slate-700
                ctx.font = '18px "Roboto", "NotoColorEmoji", "NotoSans", "NotoSansMath", "NotoSansSymbols", "NotoSansSymbols2", "Segoe UI Emoji", "Segoe UI Symbol", "Segoe UI", "Arial", sans-serif';
                let itemChars = [...item.name];
                let itemName = item.name;
                let truncated = false;
                while (ctx.measureText(itemName).width > 110 && itemChars.length > 3) {
                    itemChars.pop();
                    itemName = itemChars.join('');
                    truncated = true;
                }
                if (truncated) itemName += '..';
                ctx.fillText(itemName, x + 40, curY);

                ctx.fillStyle = color;
                ctx.font = '18px "RobotoBold", sans-serif';
                const valStr = `${item.value} ${valSuffix}`;
                ctx.textAlign = 'right';
                ctx.fillText(valStr, x + 240, curY);
                ctx.textAlign = 'left';
            } else {
                ctx.fillStyle = 'rgba(0, 0, 0, 0.2)'; // Darker dash for light mode
                ctx.font = '18px "Roboto", "NotoColorEmoji", "NotoSans", "NotoSansSymbols", "Segoe UI Emoji", "Segoe UI Symbol", sans-serif';
                ctx.fillText('-', x + 40, curY);
            }
            curY += 40;
        }
    };

    // Card C: Top Contributors
    drawBentoCard(ctx, pad, row2Y, colHalfW, row2H);
    ctx.fillStyle = '#1e293b'; // slate-800
    ctx.font = '24px "RobotoBold", sans-serif';
    ctx.fillText('Top Contributors (14d)', pad + 40, row2Y + 45);
    // line separator
    ctx.fillStyle = '#ffe4e6'; // rose-100
    ctx.fillRect(pad + 40, row2Y + 65, colHalfW - 80, 1);

    drawList(pad + 40, row2Y + 105, 'Chatters', data.analytics.topChatters, 'msg', '#be185d'); // Darker Pink
    drawList(pad + 40 + (colHalfW/2), row2Y + 105, 'Talkers', data.analytics.topTalkers, 'hrs', '#475569'); // Slate

    // Card D: Top Channels
    const cdX = pad + colHalfW + gap;
    drawBentoCard(ctx, cdX, row2Y, colHalfW, row2H);
    ctx.fillStyle = '#1e293b'; // slate-800
    ctx.font = '24px "RobotoBold", sans-serif';
    ctx.fillText('Top Channels (14d)', cdX + 40, row2Y + 45);
    ctx.fillStyle = '#ffe4e6'; // rose-100
    ctx.fillRect(cdX + 40, row2Y + 65, colHalfW - 80, 1);

    drawList(cdX + 40, row2Y + 105, 'Text', data.analytics.topText, 'msg', '#be185d');
    drawList(cdX + 40 + (colHalfW/2), row2Y + 105, 'Voice', data.analytics.topVoice, 'hrs', '#475569');


    // --- ROW 3: Activity Chart ---
    drawBentoCard(ctx, pad, row3Y, width - (pad * 2), row3H);
    ctx.fillStyle = '#1e293b'; // slate-800
    ctx.font = '24px "RobotoBold", sans-serif';
    ctx.fillText('Activity Trends', pad + 40, row3Y + 45);

    // Legend
    ctx.fillStyle = '#be185d'; // Darker pink dot
    ctx.beginPath();
    ctx.arc(pad + 250, row3Y + 38, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#64748b'; // slate-500
    ctx.font = '16px "Roboto", sans-serif';
    ctx.fillText('Messages', pad + 265, row3Y + 43);

    ctx.fillStyle = '#475569'; // Slate dot
    ctx.beginPath();
    ctx.arc(pad + 380, row3Y + 38, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#64748b';
    ctx.fillText('Voice (Hours)', pad + 395, row3Y + 43);

    // Draw Line Chart
    const chartX = pad + 40;
    const chartY = row3Y + 90;
    const chartW = width - (pad * 2) - 80;
    const chartH = row3H - 120;

    // Draw grid lines
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 1;
    for (let i = 0; i <= 4; i++) {
        const gy = chartY + (chartH / 4) * i;
        ctx.beginPath();
        ctx.moveTo(chartX, gy);
        ctx.lineTo(chartX + chartW, gy);
        ctx.stroke();
    }

    const cData = data.analytics.chartData;
    if (cData.length > 0) {
        const maxMsgs = Math.max(...cData.map(d => d.messages), 10);
        const maxVoice = Math.max(...cData.map(d => d.voiceSeconds / 3600), 10);

        const drawLineChart = (dataValues: number[], maxVal: number, colorStr: string, rgb: string) => {
            const stepX = chartW / (dataValues.length - 1);
            const pts = dataValues.map((v, i) => ({
                x: chartX + (i * stepX),
                y: chartY + chartH - ((v / maxVal) * chartH)
            }));

            const buildPath = () => {
                ctx.moveTo(pts[0].x, pts[0].y);
                for (let i = 0; i < pts.length - 1; i++) {
                    const curr = pts[i];
                    const next = pts[i + 1];
                    const cx = (curr.x + next.x) / 2;
                    ctx.bezierCurveTo(cx, curr.y, cx, next.y, next.x, next.y);
                }
            };
            
            // 1. Draw Fill
            ctx.beginPath();
            ctx.moveTo(pts[0].x, chartY + chartH);
            ctx.lineTo(pts[0].x, pts[0].y);
            buildPath();
            ctx.lineTo(pts[pts.length - 1].x, chartY + chartH);
            ctx.closePath();
            
            const grad = ctx.createLinearGradient(0, chartY, 0, chartY + chartH);
            grad.addColorStop(0, `rgba(${rgb}, 0.08)`);
            grad.addColorStop(1, `rgba(${rgb}, 0.0)`);
            ctx.fillStyle = grad;
            ctx.fill();

            // 2. Draw Stroke
            ctx.beginPath();
            ctx.strokeStyle = colorStr;
            ctx.lineWidth = 3;
            ctx.lineJoin = 'round';
            buildPath();
            ctx.stroke();

            // 3. Draw Points
            ctx.fillStyle = colorStr;
            for (let i = 0; i < pts.length; i++) {
                ctx.beginPath();
                ctx.arc(pts[i].x, pts[i].y, 3, 0, Math.PI * 2);
                ctx.fill();
            }
        };

        // Draw Message Line (Darker Pink)
        drawLineChart(cData.map(d => d.messages), maxMsgs, '#be185d', '190, 24, 93');
        // Draw Voice Line (Slate-600)
        drawLineChart(cData.map(d => d.voiceSeconds / 3600), maxVoice, '#475569', '71, 85, 105');
    } else {
        ctx.fillStyle = '#64748b';
        ctx.font = '18px "Roboto", sans-serif';
        ctx.fillText('Not enough data to display chart.', pad + 40, row3Y + 150);
    }

    return canvas.toBuffer('image/png');
}
