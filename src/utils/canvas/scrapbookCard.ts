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
        console.error('Failed to load remote fonts for Scrapbook Canvas', e);
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
    if (fill !== 'transparent') {
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

function formatDuration(seconds: number): string {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    if (hrs > 0) return `${hrs}h ${mins}m`;
    return `${mins}m`;
}

export interface ScrapbookData {
    topChatter?: { username: string; avatarUrl: string; messages: number } | null;
    topVoiceDuo?: { username: string; avatarUrl: string; voiceSeconds: number }[] | null;
    topMessage?: { username: string; avatarUrl: string; content: string; reactions: number } | null;
    topNightOwl?: { username: string; avatarUrl: string; messages: number } | null;
}

export async function generateScrapbookCard(data: ScrapbookData): Promise<Buffer> {
    await loadFonts();

    const width = 1200;
    const height = 800;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    // Background gradient (aesthetic dark/polaroid vibe)
    const bgGradient = ctx.createLinearGradient(0, 0, width, height);
    bgGradient.addColorStop(0, '#0f0f13');
    bgGradient.addColorStop(1, '#050507');
    ctx.fillStyle = bgGradient;
    ctx.fillRect(0, 0, width, height);

    // Aesthetic soft glows behind sections
    const drawGlow = (x: number, y: number, radius: number, color: string) => {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, radius);
        glow.addColorStop(0, color);
        glow.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = glow;
        ctx.fillRect(0, 0, width, height);
    };

    drawGlow(200, 200, 500, 'rgba(65, 88, 208, 0.15)'); // Blue-ish purple top left
    drawGlow(1000, 600, 600, 'rgba(200, 80, 192, 0.1)'); // Pinkish bottom right
    drawGlow(600, 800, 400, 'rgba(255, 204, 112, 0.05)'); // Warm glow at bottom center

    // Title
    ctx.font = 'bold 50px RobotoBold, sans-serif';
    ctx.fillStyle = '#FFFFFF';
    ctx.textAlign = 'center';
    ctx.fillText('WEEKLY SCRAPBOOK', width / 2, 70);

    // Grid layout: 2 columns, 2 rows
    // Col 1: Top Message (Top left), Funniest Quote (Bottom left)
    // Col 2: Top Chatter (Top right), Voice Duo (Bottom right)

    // --- Render Bubble Helper ---
    async function drawMessageBubble(x: number, y: number, title: string, msg: any, icon: string) {
        drawRoundedRect(ctx, x, y, 520, 280, 20, 'rgba(255, 255, 255, 0.05)');
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.font = 'bold 24px RobotoBold, sans-serif';
        ctx.fillStyle = '#A3A3A3';
        ctx.textAlign = 'left';
        ctx.fillText(title, x + 30, y + 45);

        if (!msg) {
            ctx.font = '20px Roboto, sans-serif';
            ctx.fillStyle = '#555555';
            ctx.fillText('No data this week.', x + 30, y + 100);
            return;
        }

        try {
            const avatar = await loadImage(msg.avatarUrl);
            drawRoundedImage(ctx, avatar, x + 30, y + 70, 50, 25);
        } catch { }

        ctx.font = 'bold 22px RobotoBold, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(msg.username, x + 95, y + 105);

        // Word wrap content
        ctx.font = 'italic 20px Roboto, sans-serif';
        ctx.fillStyle = '#DDDDDD';
        
        // Sanitize raw mentions `<@123>` or `<@!123>` to `@User` for aesthetic display
        const cleanMsg = msg.content
            .replace(/<@!?\d+>/g, '@User')
            .replace(/<#\d+>/g, '#channel');

        const words = cleanMsg.split(' ');
        let line = '';
        let lineY = y + 160;
        for (let n = 0; n < words.length; n++) {
            const testLine = line + words[n] + ' ';
            const metrics = ctx.measureText(testLine);
            if (metrics.width > 460 && n > 0) {
                ctx.fillText(`"${line.trim()}"`, x + 30, lineY);
                line = words[n] + ' ';
                lineY += 28;
                if (lineY > y + 230) {
                    line = '... ';
                    break;
                }
            } else {
                line = testLine;
            }
        }
        ctx.fillText(`"${line.trim()}"`, x + 30, lineY);

        ctx.font = 'bold 20px RobotoBold, sans-serif';
        ctx.fillStyle = '#FFD700'; // Gold
        ctx.textAlign = 'right';
        ctx.fillText(`${msg.reactions} reactions`, x + 490, y + 45);
    }

    // --- Render Polaroid Helper ---
    async function drawPolaroid(x: number, y: number, title: string, user: any, statText: string) {
        drawRoundedRect(ctx, x, y, 250, 320, 10, '#FFFFFF');
        
        // Image box
        drawRoundedRect(ctx, x + 15, y + 15, 220, 220, 5, '#E0E0E0');

        if (user) {
            try {
                const avatar = await loadImage(user.avatarUrl);
                drawRoundedImage(ctx, avatar, x + 15, y + 15, 220, 5);
            } catch { }
            
            ctx.font = 'bold 24px RobotoBold, sans-serif';
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.fillText(user.username, x + 125, y + 270);
            
            ctx.font = '18px Roboto, sans-serif';
            ctx.fillStyle = '#555555';
            ctx.fillText(statText, x + 125, y + 295);
        } else {
            ctx.font = 'bold 20px RobotoBold, sans-serif';
            ctx.fillStyle = '#000000';
            ctx.textAlign = 'center';
            ctx.fillText('No data', x + 125, y + 280);
        }

        // Floating Title
        ctx.font = 'bold 20px RobotoBold, sans-serif';
        ctx.fillStyle = '#BBBBBB';
        ctx.textAlign = 'center';
        ctx.fillText(title, x + 125, y - 15);
    }

    // Top Message (Left Top)
    await drawMessageBubble(50, 120, 'Top Message', data.topMessage, '');
    
    // The Night Owl (Left Bottom)
    // We will draw it as a horizontal banner card instead of a text bubble
    drawRoundedRect(ctx, 50, 440, 520, 280, 20, 'rgba(255, 255, 255, 0.05)');
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.font = 'bold 24px RobotoBold, sans-serif';
    ctx.fillStyle = '#A3A3A3';
    ctx.textAlign = 'left';
    ctx.fillText('The Night Owl', 80, 485);

    ctx.font = 'italic 18px Roboto, sans-serif';
    ctx.fillStyle = '#777777';
    ctx.fillText('Most messages between 12 AM and 6 AM', 80, 515);

    if (data.topNightOwl) {
        try {
            const avatar = await loadImage(data.topNightOwl.avatarUrl);
            drawRoundedImage(ctx, avatar, 80, 550, 100, 50); // Circle avatar
        } catch { }

        ctx.font = 'bold 32px RobotoBold, sans-serif';
        ctx.fillStyle = '#FFFFFF';
        ctx.fillText(data.topNightOwl.username, 210, 595);

        ctx.font = '22px Roboto, sans-serif';
        ctx.fillStyle = '#AAAAAA';
        ctx.fillText(`${data.topNightOwl.messages} late night msgs`, 210, 630);
    } else {
        ctx.font = '20px Roboto, sans-serif';
        ctx.fillStyle = '#555555';
        ctx.fillText('No night owls this week.', 80, 600);
    }

    // Top Chatter Polaroid (Right Top)
    await drawPolaroid(750, 150, 'TOP CHATTER', data.topChatter, data.topChatter ? `${data.topChatter.messages} msgs` : '');

    // Voice Duo Polaroids (Right Bottom)
    ctx.font = 'bold 20px RobotoBold, sans-serif';
    ctx.fillStyle = '#BBBBBB';
    ctx.textAlign = 'center';
    ctx.fillText('VOICE DUO', 880, 500);

    if (data.topVoiceDuo && data.topVoiceDuo.length >= 1) {
        // Draw miniature polaroids side by side, slightly tilted
        const u1 = data.topVoiceDuo[0];
        const u2 = data.topVoiceDuo[1];

        async function drawMiniPolaroid(x: number, y: number, angle: number, user: any) {
            ctx.save();
            ctx.translate(x + 85, y + 105);
            ctx.rotate(angle * Math.PI / 180);
            ctx.translate(-(x + 85), -(y + 105));
            
            drawRoundedRect(ctx, x, y, 170, 210, 8, '#FFFFFF');
            
            if (user) {
                try {
                    const avatar = await loadImage(user.avatarUrl);
                    drawRoundedImage(ctx, avatar, x + 10, y + 10, 150, 5);
                } catch {}
                ctx.font = 'bold 16px RobotoBold, sans-serif';
                ctx.fillStyle = '#000000';
                ctx.textAlign = 'center';
                // Trim username
                let name = user.username;
                if (name.length > 12) name = name.substring(0, 12) + '...';
                ctx.fillText(name, x + 85, y + 185);
                
                ctx.font = '14px Roboto, sans-serif';
                ctx.fillStyle = '#555555';
                ctx.fillText(formatDuration(user.voiceSeconds), x + 85, y + 200);
            }
            ctx.restore();
        }

        await drawMiniPolaroid(670, 530, -5, u1);
        if (u2) {
            await drawMiniPolaroid(880, 540, 5, u2);
            // Draw a plus in between
            ctx.font = 'bold 40px RobotoBold, sans-serif';
            ctx.fillStyle = '#FFFFFF';
            ctx.textAlign = 'center';
            ctx.fillText('+', 860, 630);
        }
    } else {
        ctx.font = 'bold 20px RobotoBold, sans-serif';
        ctx.fillStyle = '#555555';
        ctx.textAlign = 'center';
        ctx.fillText('No voice activity this week.', 880, 600);
    }

    return canvas.toBuffer('image/png');
}
