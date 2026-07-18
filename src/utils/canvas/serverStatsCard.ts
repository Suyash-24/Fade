// src/utils/canvas/serverStatsCard.ts — Dark Dashboard Theme
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';

let fontLoaded = false;
async function loadFonts() {
    if (fontLoaded) return;
    const reg = async (url: string, name: string) => {
        try {
            const res = await fetch(url);
            if (res.ok) GlobalFonts.register(Buffer.from(await res.arrayBuffer()), name);
        } catch {}
    };
    await Promise.all([
        reg('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Bold.ttf', 'RobotoBold'),
        reg('https://raw.githubusercontent.com/googlefonts/roboto/main/src/hinted/Roboto-Regular.ttf', 'Roboto'),
        reg('https://raw.githubusercontent.com/googlefonts/noto-fonts/main/hinted/ttf/NotoSans/NotoSans-Regular.ttf', 'NotoSans'),
    ]);
    fontLoaded = true;
}

const BOLD = '"RobotoBold", "NotoSans", sans-serif';
const REGULAR = '"Roboto", "NotoSans", sans-serif';

// ── Canvas Helpers ─────────────────────────────────────────────────────────────

function rr(ctx: any, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
}

function card(ctx: any, x: number, y: number, w: number, h: number, r = 14) {
    ctx.save();
    rr(ctx, x, y, w, h, r);
    ctx.fillStyle = '#1c1d2e';
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.07)';
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.restore();
}

function progressBar(ctx: any, x: number, y: number, w: number, h: number, pct: number, color: string, bg = 'rgba(255,255,255,0.08)') {
    ctx.save();
    rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
    if (pct > 0) { rr(ctx, x, y, Math.max(h, w * Math.min(pct, 1)), h, h / 2); ctx.fillStyle = color; ctx.fill(); }
    ctx.restore();
}

async function circleAvatar(ctx: any, url: string | null, name: string, x: number, y: number, size: number) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, size / 2, 0, Math.PI * 2);
    ctx.clip();
    if (url) {
        try {
            const img = await loadImage(url);
            ctx.drawImage(img, x, y, size, size);
            ctx.restore(); return;
        } catch {}
    }
    const palette = ['#6366f1', '#8b5cf6', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#14b8a6'];
    ctx.fillStyle = palette[(name.codePointAt(0) ?? 0) % palette.length];
    ctx.fillRect(x, y, size, size);
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(size * 0.42)}px ${BOLD}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((name[0] ?? '?').toUpperCase(), x + size / 2, y + size / 2);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.restore();
}

function donut(ctx: any, cx: number, cy: number, radius: number, thick: number,
    segs: { value: number; color: string }[], pctLabel: string) {
    const total = segs.reduce((s, g) => s + g.value, 0);
    if (total === 0) return;
    let angle = -Math.PI / 2;
    for (const seg of segs) {
        if (seg.value <= 0) continue;
        const sweep = (seg.value / total) * 2 * Math.PI - 0.03;
        ctx.beginPath();
        ctx.arc(cx, cy, radius, angle, angle + sweep);
        ctx.strokeStyle = seg.color;
        ctx.lineWidth = thick;
        ctx.lineCap = 'round';
        ctx.stroke();
        angle += (seg.value / total) * 2 * Math.PI;
    }
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `bold 24px ${BOLD}`;
    ctx.fillText(pctLabel, cx, cy - 9);
    ctx.fillStyle = '#64748b';
    ctx.font = `12px ${REGULAR}`;
    ctx.fillText('ONLINE', cx, cy + 12);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.restore();
}

function accentBar(ctx: any, x: number, y: number, color: string) {
    rr(ctx, x, y, 3, 18, 2);
    ctx.fillStyle = color;
    ctx.fill();
}

// ── Data Interface ─────────────────────────────────────────────────────────────

export interface ServerStatsData {
    guildName: string;
    guildIcon: string | null;
    timeframeLabel: string;   // "7 DAYS" | "30 DAYS" | "ALL TIME"
    dateLabel: string;
    memberCount: number;
    guildJoinedLabel: string; // "JAN 2022"
    boostTier: number;
    botName: string;
    stats: {
        members:    { value: number; trend: string };
        online:     { value: number; pct: string };
        messages:   { value: number; trend: string };
        voiceHours: { value: number; trend: string };
    };
    presence: { online: number; dnd: number; idle: number; offline: number };
    chartData: { label: string; messages: number }[];
    topTextChannels:  { name: string; messages: number }[];
    topVoiceChannels: { name: string; hours: number }[];
    topMembers: {
        avatarURL:   string | null;
        username:    string;
        messages:    number;
        voiceHours:  number;
    }[];
}

// ── Builder ────────────────────────────────────────────────────────────────────

export async function buildServerStatsCard(data: ServerStatsData): Promise<Buffer> {
    await loadFonts();

    const W = 900;
    const H = 1100;
    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d') as any;

    // ── Background ──────────────────────────────────────────────────────────────
    ctx.fillStyle = '#13141f';
    ctx.fillRect(0, 0, W, H);
    // Subtle radial tint
    const bg = ctx.createRadialGradient(W / 2, 0, 0, W / 2, H / 2, W * 0.9);
    bg.addColorStop(0, 'rgba(99,102,241,0.06)');
    bg.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    const PAD = 28;
    const GAP = 14;
    let y = PAD;

    // ── HEADER ─────────────────────────────────────────────────────────────────
    // Guild icon
    if (data.guildIcon) {
        try {
            const img = await loadImage(data.guildIcon);
            ctx.save();
            rr(ctx, PAD, y, 80, 80, 16); ctx.clip();
            ctx.drawImage(img, PAD, y, 80, 80);
            ctx.restore();
        } catch {
            card(ctx, PAD, y, 80, 80, 16);
        }
    } else {
        card(ctx, PAD, y, 80, 80, 16);
        ctx.save();
        ctx.fillStyle = '#6366f1';
        ctx.font = `42px ${BOLD}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((data.guildName[0] ?? '?').toUpperCase(), PAD + 40, y + 40);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
        ctx.restore();
    }

    const hx = PAD + 80 + 18;

    // Guild name
    ctx.fillStyle = '#e2e8f0';
    ctx.font = `36px ${BOLD}`;
    let gName = data.guildName;
    while (ctx.measureText(gName).width > 500) gName = gName.slice(0, -1);
    if (gName !== data.guildName) gName += '...';
    ctx.fillText(gName, hx, y + 42);

    // Subtitle
    ctx.fillStyle = '#4a5568';
    ctx.font = `13px ${REGULAR}`;
    ctx.fillText(`${data.memberCount.toLocaleString()} MEMBERS  ·  ${data.guildJoinedLabel}  ·  LVL ${data.boostTier}`, hx, y + 62);

    // Timeframe pill
    ctx.font = `bold 11px ${BOLD}`;
    const pillTxt = data.timeframeLabel;
    const pillW = ctx.measureText(pillTxt).width + 22;
    rr(ctx, hx, y + 72, pillW, 22, 11);
    ctx.fillStyle = 'rgba(212,168,67,0.18)'; ctx.fill();
    ctx.fillStyle = '#d4a843';
    ctx.fillText(pillTxt, hx + 11, y + 87);

    // Date (top right)
    ctx.fillStyle = '#4a5568';
    ctx.font = `13px ${REGULAR}`;
    ctx.textAlign = 'right';
    ctx.fillText(data.dateLabel, W - PAD, y + 20);
    ctx.textAlign = 'left';

    y += 80 + GAP * 2;

    // ── STAT CARDS ─────────────────────────────────────────────────────────────
    const CARD_H = 98;
    const CARD_W = Math.floor((W - PAD * 2 - GAP * 3) / 4);
    const STATS = [
        { label: 'MEMBERS',   value: data.stats.members.value.toLocaleString(),    sub: data.stats.members.trend,    dot: '#f59e0b', numColor: '#e2e8f0' },
        { label: 'ONLINE NOW', value: data.stats.online.value.toLocaleString(),     sub: data.stats.online.pct,       dot: '#4ade80', numColor: '#4ade80' },
        { label: 'MESSAGES',  value: data.stats.messages.value.toLocaleString(),   sub: data.stats.messages.trend,   dot: '#818cf8', numColor: '#e2e8f0' },
        { label: 'VOICE HRS', value: data.stats.voiceHours.value.toLocaleString(), sub: data.stats.voiceHours.trend, dot: '#fb923c', numColor: '#e2e8f0' },
    ];
    for (let i = 0; i < 4; i++) {
        const cx = PAD + i * (CARD_W + GAP);
        const s = STATS[i];
        card(ctx, cx, y, CARD_W, CARD_H);
        // Dot
        ctx.beginPath(); ctx.arc(cx + 18, y + 21, 5, 0, Math.PI * 2);
        ctx.fillStyle = s.dot; ctx.fill();
        // Label
        ctx.fillStyle = '#4a5568'; ctx.font = `11px ${BOLD}`;
        ctx.fillText(s.label, cx + 30, y + 25);
        // Value
        ctx.fillStyle = s.numColor; ctx.font = `34px ${BOLD}`;
        ctx.fillText(s.value, cx + 16, y + 68);
        // Trend
        ctx.fillStyle = s.sub.startsWith('↑') ? '#4ade80' : s.sub.startsWith('↓') ? '#f87171' : '#4a5568';
        ctx.font = `11px ${REGULAR}`;
        ctx.fillText(s.sub, cx + 16, y + 88);
    }
    y += CARD_H + GAP;

    // ── CHARTS ROW ─────────────────────────────────────────────────────────────
    const CHART_H = 210;
    const BAR_PANEL_W = 528;
    const DONUT_PANEL_W = W - PAD * 2 - GAP - BAR_PANEL_W;

    // Bar chart card
    card(ctx, PAD, y, BAR_PANEL_W, CHART_H);
    ctx.fillStyle = '#64748b'; ctx.font = `11px ${BOLD}`;
    ctx.fillText('MESSAGES PER DAY', PAD + 18, y + 24);

    const bData = data.chartData;
    const maxM = Math.max(...bData.map(d => d.messages), 1);
    const baX = PAD + 52;
    const baY = y + 38;
    const baW = BAR_PANEL_W - 70;
    const baH = CHART_H - 68;
    const bCount = bData.length;
    const bW = Math.max(4, Math.floor(baW / bCount) - 5);
    const peakI = bData.reduce((mi, d, i) => d.messages > bData[mi].messages ? i : mi, 0);

    // Y-axis grid + labels
    for (let i = 0; i <= 3; i++) {
        const val = Math.round((maxM * (3 - i)) / 3);
        const gy = baY + (baH / 3) * i;
        ctx.fillStyle = '#374151'; ctx.font = `10px ${REGULAR}`;
        ctx.textAlign = 'right';
        ctx.fillText(val >= 1000 ? `${(val / 1000).toFixed(val < 10000 ? 1 : 0)}k` : `${val}`, baX - 5, gy + 4);
        ctx.textAlign = 'left';
        ctx.beginPath(); ctx.moveTo(baX, gy); ctx.lineTo(baX + baW, gy);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1; ctx.stroke();
    }

    for (let i = 0; i < bCount; i++) {
        const d = bData[i];
        const bx = baX + i * (bW + 5);
        const bh = d.messages > 0 ? Math.max(4, (d.messages / maxM) * baH) : 3;
        const by = baY + baH - bh;
        const isPeak = i === peakI && d.messages > 0;
        rr(ctx, bx, by, bW, bh, 4);
        ctx.fillStyle = isPeak ? '#d4a843' : 'rgba(129,140,248,0.30)'; ctx.fill();
        if (isPeak) {
            ctx.fillStyle = '#d4a843'; ctx.font = `10px ${BOLD}`;
            ctx.textAlign = 'center';
            ctx.fillText(`${d.messages.toLocaleString()} peak`, bx + bW / 2, by - 6);
            ctx.textAlign = 'left';
        }
        if (d.label) {
            ctx.fillStyle = isPeak ? '#d4a843' : '#374151';
            ctx.font = `10px ${isPeak ? BOLD : REGULAR}`;
            ctx.textAlign = 'center';
            ctx.fillText(d.label, bx + bW / 2, baY + baH + 15);
            ctx.textAlign = 'left';
        }
    }

    // Donut card
    const dX = PAD + BAR_PANEL_W + GAP;
    card(ctx, dX, y, DONUT_PANEL_W, CHART_H);
    ctx.fillStyle = '#64748b'; ctx.font = `11px ${BOLD}`;
    ctx.fillText('MEMBER STATUS', dX + 18, y + 24);

    const { online, dnd, idle, offline } = data.presence;
    const totalP = online + dnd + idle + offline;
    const onlinePct = totalP > 0 ? Math.round(((online + dnd + idle) / totalP) * 100) : 0;
    const dCX = dX + DONUT_PANEL_W / 2;
    const dCY = y + 105;

    donut(ctx, dCX, dCY, 58, 13, [
        { value: online, color: '#4ade80' },
        { value: dnd,    color: '#f87171' },
        { value: idle,   color: '#fbbf24' },
        { value: Math.max(offline, 1), color: '#2d3748' },
    ], `${onlinePct}%`);

    // Legend (2x2 grid)
    const fmt = (n: number) => n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;
    const legendItems = [
        { label: `Online · ${fmt(online)}`,  color: '#4ade80' },
        { label: `DND · ${fmt(dnd)}`,        color: '#f87171' },
        { label: `Idle · ${fmt(idle)}`,      color: '#fbbf24' },
        { label: `Offline · ${fmt(offline)}`, color: '#374151' },
    ];
    const legY = dCY + 72;
    for (let i = 0; i < 4; i++) {
        const col = i % 2;
        const row = Math.floor(i / 2);
        const lx = dX + 14 + col * (DONUT_PANEL_W / 2);
        const ly = legY + row * 20;
        ctx.beginPath(); ctx.arc(lx + 5, ly - 4, 4, 0, Math.PI * 2);
        ctx.fillStyle = legendItems[i].color; ctx.fill();
        ctx.fillStyle = '#64748b'; ctx.font = `11px ${REGULAR}`;
        ctx.fillText(legendItems[i].label, lx + 14, ly);
    }

    y += CHART_H + GAP;

    // ── CHANNELS ROW ───────────────────────────────────────────────────────────
    const CH_PANEL_W = Math.floor((W - PAD * 2 - GAP) / 2);
    const CH_PANEL_H = 220;
    const timeStr = data.timeframeLabel.toLowerCase();

    const drawChannelPanel = (
        startX: number, title: string, rightLabel: string,
        items: { name: string; count: number; unit: string }[],
        barColor: string
    ) => {
        card(ctx, startX, y, CH_PANEL_W, CH_PANEL_H);
        // Accent left bar
        accentBar(ctx, startX + 16, y + 14, barColor);
        ctx.fillStyle = '#e2e8f0'; ctx.font = `13px ${BOLD}`;
        ctx.fillText(title, startX + 26, y + 28);
        ctx.fillStyle = '#374151'; ctx.font = `11px ${REGULAR}`;
        ctx.textAlign = 'right';
        ctx.fillText(rightLabel, startX + CH_PANEL_W - 16, y + 28);
        ctx.textAlign = 'left';
        // Divider
        ctx.fillStyle = 'rgba(255,255,255,0.05)';
        ctx.fillRect(startX + 16, y + 40, CH_PANEL_W - 32, 1);

        const maxVal = Math.max(...items.map(it => it.count), 1);
        const rowH = Math.floor((CH_PANEL_H - 56 - 22) / Math.max(items.length, 1));

        for (let i = 0; i < items.length; i++) {
            const it = items[i];
            const iy = y + 52 + i * rowH;
            ctx.fillStyle = '#94a3b8'; ctx.font = `12px ${REGULAR}`;
            let n = it.name;
            while (ctx.measureText(`# ${n}`).width > CH_PANEL_W - 100) n = n.slice(0, -1);
            if (n !== it.name) n += '..';
            ctx.fillText(`# ${n}`, startX + 16, iy + 12);
            ctx.textAlign = 'right';
            ctx.fillStyle = '#e2e8f0'; ctx.font = `12px ${BOLD}`;
            ctx.fillText(`${it.count.toLocaleString()} ${it.unit}`, startX + CH_PANEL_W - 16, iy + 12);
            ctx.textAlign = 'left';
            progressBar(ctx, startX + 16, iy + 18, CH_PANEL_W - 32, 4, it.count / maxVal, barColor);
        }
        // Footer total
        const total = items.reduce((s, it) => s + it.count, 0);
        ctx.fillStyle = '#2d3748'; ctx.font = `10px ${REGULAR}`;
        ctx.fillText(`Total ${total.toLocaleString()} ${items[0]?.unit ?? ''} across all channels`, startX + 16, y + CH_PANEL_H - 10);
    };

    drawChannelPanel(PAD, 'TEXT CHANNELS', `${timeStr} msgs`,
        data.topTextChannels.map(c => ({ name: c.name, count: c.messages, unit: 'msgs' })),
        '#818cf8'
    );
    drawChannelPanel(PAD + CH_PANEL_W + GAP, 'VOICE CHANNELS', `${timeStr} hours`,
        data.topVoiceChannels.map(c => ({ name: c.name, count: c.hours, unit: 'h' })),
        '#d4a843'
    );

    y += CH_PANEL_H + GAP;

    // ── MEMBER LEADERBOARD ─────────────────────────────────────────────────────
    const ROW_H = 48;
    const LB_HEADER = 78;
    const LB_H = LB_HEADER + data.topMembers.length * ROW_H + 12;
    card(ctx, PAD, y, W - PAD * 2, LB_H);

    // Title
    accentBar(ctx, PAD + 16, y + 14, '#d4a843');
    ctx.fillStyle = '#e2e8f0'; ctx.font = `13px ${BOLD}`;
    ctx.fillText('MEMBER LEADERBOARD', PAD + 26, y + 28);
    ctx.fillStyle = '#374151'; ctx.font = `11px ${REGULAR}`;
    ctx.textAlign = 'right';
    ctx.fillText('messages', W - PAD - 76, y + 28);
    ctx.fillText('voice', W - PAD - 16, y + 28);
    ctx.textAlign = 'left';

    // Divider
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(PAD + 16, y + 40, W - PAD * 2 - 32, 1);

    // Column headers
    const COL_RANK = 36;
    const COL_AV = 38;
    const COL_NAME = 145;
    const BAR_START = PAD + 16 + COL_RANK + COL_AV + COL_NAME + 8;
    const BAR_END = W - PAD - 130;
    const BAR_W = BAR_END - BAR_START;

    ctx.fillStyle = '#2d3748'; ctx.font = `10px ${REGULAR}`;
    ctx.fillText('RANK', PAD + 16, y + 60);
    ctx.fillText('MEMBER', PAD + 16 + COL_RANK + COL_AV + 4, y + 60);
    ctx.fillText('7-DAY ACTIVITY', BAR_START, y + 60);
    ctx.textAlign = 'right';
    ctx.fillText('MSGS', W - PAD - 76, y + 60);
    ctx.fillText('VOICE', W - PAD - 16, y + 60);
    ctx.textAlign = 'left';

    // Divider
    ctx.fillStyle = 'rgba(255,255,255,0.04)';
    ctx.fillRect(PAD + 16, y + 66, W - PAD * 2 - 32, 1);

    const maxMMsgs = Math.max(...data.topMembers.map(m => m.messages), 1);

    for (let i = 0; i < data.topMembers.length; i++) {
        const m = data.topMembers[i];
        const ry = y + LB_HEADER - 2 + i * ROW_H;

        // Rank
        ctx.fillStyle = i === 0 ? '#d4a843' : '#4a5568';
        ctx.font = `14px ${BOLD}`;
        ctx.fillText(`${i + 1}`, PAD + 20, ry + 20);

        // Avatar
        await circleAvatar(ctx, m.avatarURL, m.username, PAD + 16 + COL_RANK, ry + 5, 30);

        // Name
        ctx.fillStyle = '#e2e8f0'; ctx.font = `13px ${BOLD}`;
        let dn = m.username;
        while (ctx.measureText(dn).width > COL_NAME - 8) dn = dn.slice(0, -1);
        if (dn !== m.username) dn += '..';
        ctx.fillText(dn, PAD + 16 + COL_RANK + COL_AV + 4, ry + 22);

        // Activity bar
        progressBar(ctx, BAR_START, ry + 11, BAR_W, 12, m.messages / maxMMsgs,
            i === 0 ? '#d4a843' : 'rgba(129,140,248,0.55)');

        // Stats
        ctx.textAlign = 'right';
        ctx.fillStyle = '#e2e8f0'; ctx.font = `13px ${BOLD}`;
        ctx.fillText(m.messages.toLocaleString(), W - PAD - 76, ry + 22);
        ctx.fillStyle = '#64748b'; ctx.font = `12px ${REGULAR}`;
        ctx.fillText(`${m.voiceHours} h`, W - PAD - 16, ry + 22);
        ctx.textAlign = 'left';

        // Row divider
        if (i < data.topMembers.length - 1) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(PAD + 16, ry + ROW_H - 4, W - PAD * 2 - 32, 1);
        }
    }

    y += LB_H + GAP;

    // ── FOOTER ─────────────────────────────────────────────────────────────────
    ctx.fillStyle = 'rgba(255,255,255,0.05)';
    ctx.fillRect(PAD, y, W - PAD * 2, 1);
    y += 10;

    ctx.fillStyle = '#374151'; ctx.font = `11px ${BOLD}`;
    ctx.fillText(data.botName.toUpperCase(), PAD, y + 14);
    ctx.textAlign = 'center';
    ctx.fillText(`SERVERSTATS  ·  LAST ${data.timeframeLabel}`, W / 2, y + 14);
    ctx.textAlign = 'right';
    ctx.fillText(data.guildName.toLowerCase().replace(/ /g, ''), W - PAD, y + 14);
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
}
