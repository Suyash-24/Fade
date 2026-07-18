// src/utils/canvas/serverStatsCard.ts — Premium Dark Dashboard
import { createCanvas, loadImage, GlobalFonts } from '@napi-rs/canvas';
import { join } from 'path';

let fontLoaded = false;

async function loadFonts() {
    if (fontLoaded) return;
    fontLoaded = true;
    console.log('[Canvas] Loading fonts from local assets...');
    
    // Load all local fonts bundled with the project
    GlobalFonts.loadFontsFromDir(join(process.cwd(), 'assets', 'fonts'));
    
    console.log('[Canvas] Font loading complete. Registered fonts:');
    console.log(GlobalFonts.families.map(f => f.family).join(', '));
}






const BOLD    = '"Roboto", "Noto Sans", "Noto Sans Thai", "Noto Sans Arabic", "Noto Sans Devanagari", "Noto Sans CJK KR", "Noto Color Emoji", sans-serif';
const REGULAR = '"Roboto", "Noto Sans", "Noto Sans Thai", "Noto Sans Arabic", "Noto Sans Devanagari", "Noto Sans CJK KR", "Noto Color Emoji", sans-serif';

const C = {
    bg:        '#0b0c18',
    card:      '#161728',
    border:    'rgba(255,255,255,0.07)',
    text:      '#e2e8f0',
    muted:     '#64748b',
    dim:       '#2d3748',
    gold:      '#e8b96a',
    goldFade:  'rgba(232,185,106,0.14)',
    purple:    '#818cf8',
    purpleFade:'rgba(129,140,248,0.14)',
    green:     '#34d399',
    greenFade: 'rgba(52,211,153,0.14)',
    orange:    '#fb923c',
    red:       '#f87171',
    yellow:    '#fbbf24',
    silver:    '#94a3b8',
    bronze:    '#cd7f32',
};

// ── Primitives ─────────────────────────────────────────────────────────────────

function rr(ctx: any, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
}

function card(ctx: any, x: number, y: number, w: number, h: number, r = 14, tintRGB?: string) {
    ctx.save();
    rr(ctx, x, y, w, h, r);
    const g = ctx.createLinearGradient(x, y, x, y + h * 0.7);
    if (tintRGB) {
        g.addColorStop(0, `rgba(${tintRGB},0.12)`);
        g.addColorStop(0.5, '#181929');
        g.addColorStop(1, '#141525');
    } else {
        g.addColorStop(0, '#1d1e32');
        g.addColorStop(1, '#141525');
    }
    ctx.fillStyle = g; ctx.fill();
    // Top highlight strip
    ctx.save();
    rr(ctx, x, y, w, 1, 0);
    ctx.fillStyle = 'rgba(255,255,255,0.06)'; ctx.fill();
    ctx.restore();
    ctx.strokeStyle = C.border; ctx.lineWidth = 1; ctx.stroke();
    ctx.restore();
}

function pbar(ctx: any, x: number, y: number, w: number, h: number, pct: number,
    c1: string, c2?: string, bg = 'rgba(255,255,255,0.06)') {
    ctx.save();
    rr(ctx, x, y, w, h, h / 2); ctx.fillStyle = bg; ctx.fill();
    if (pct > 0) {
        const fw = Math.max(h, w * Math.min(pct, 1));
        rr(ctx, x, y, fw, h, h / 2);
        if (c2) {
            const g = ctx.createLinearGradient(x, y, x + fw, y);
            g.addColorStop(0, c1); g.addColorStop(1, c2);
            ctx.fillStyle = g;
        } else { ctx.fillStyle = c1; }
        ctx.fill();
    }
    ctx.restore();
}

async function circleAv(ctx: any, url: string | null, name: string, x: number, y: number, size: number) {
    const palette = ['#6366f1','#8b5cf6','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#14b8a6'];
    ctx.save();
    ctx.beginPath(); ctx.arc(x + size/2, y + size/2, size/2, 0, Math.PI*2); ctx.clip();
    let drawn = false;
    if (url) { try { ctx.drawImage(await loadImage(url), x, y, size, size); drawn = true; } catch {} }
    if (!drawn) {
        ctx.fillStyle = palette[(name.codePointAt(0) ?? 65) % palette.length];
        ctx.fillRect(x, y, size, size);
        ctx.fillStyle = '#fff';
        ctx.font = `bold ${Math.floor(size * 0.42)}px ${BOLD}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((name[0] ?? '?').toUpperCase(), x + size/2, y + size/2);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }
    ctx.restore();
}

function donut(ctx: any, cx: number, cy: number, r: number, thick: number,
    segs: { value: number; color: string }[], label: string) {
    const total = segs.reduce((s, g) => s + g.value, 0);
    if (total === 0) return;
    // Dark inner circle fill
    ctx.save();
    ctx.beginPath(); ctx.arc(cx, cy, r - thick/2 - 1, 0, Math.PI*2);
    ctx.fillStyle = '#0e0f1e'; ctx.fill();
    ctx.restore();
    let angle = -Math.PI / 2;
    for (const seg of segs) {
        if (seg.value <= 0) continue;
        const sweep = (seg.value / total) * Math.PI * 2 - 0.04;
        ctx.beginPath(); ctx.arc(cx, cy, r, angle, angle + sweep);
        ctx.strokeStyle = seg.color; ctx.lineWidth = thick; ctx.lineCap = 'round'; ctx.stroke();
        angle += (seg.value / total) * Math.PI * 2;
    }
    ctx.save();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = C.text; ctx.font = `bold 26px ${BOLD}`;
    ctx.fillText(label, cx, cy - 9);
    ctx.fillStyle = C.muted; ctx.font = `12px ${REGULAR}`;
    ctx.fillText('ONLINE', cx, cy + 13);
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    ctx.restore();
}

function slabel(ctx: any, text: string, x: number, y: number) {
    ctx.fillStyle = '#475569'; ctx.font = `11px ${BOLD}`; ctx.fillText(text, x, y);
}

function aline(ctx: any, x: number, y: number, color: string) {
    rr(ctx, x, y, 3, 18, 2); ctx.fillStyle = color; ctx.fill();
}

// ── Interface ──────────────────────────────────────────────────────────────────

export interface ServerStatsData {
    guildName:        string;
    guildIcon:        string | null;
    timeframeLabel:   string;
    dateLabel:        string;
    memberCount:      number;
    guildJoinedLabel: string;
    boostTier:        number;
    botName:          string;
    stats: {
        members:    { value: number; trend: string };
        online:     { value: number; pct: string };
        messages:   { value: number; trend: string };
        voiceHours: { value: number; trend: string };
    };
    presence:         { online: number; dnd: number; idle: number; offline: number };
    chartData:        { label: string; messages: number }[];
    topTextChannels:  { name: string; messages: number }[];
    topVoiceChannels: { name: string; hours: number }[];
    topMembers: {
        avatarURL:  string | null;
        username:   string;
        messages:   number;
        voiceHours: number;
    }[];
}

// ── Builder ────────────────────────────────────────────────────────────────────

export async function buildServerStatsCard(data: ServerStatsData): Promise<Buffer> {
    await loadFonts();

    const W   = 900;
    const PAD = 28;
    const GAP = 14;

    // Dynamic height — no empty space at the bottom
    const STAT_H  = 98;
    const CHART_H = 210;
    const CH_H    = 230;
    const ROW_H   = 48;
    const LB_HEAD = 82;
    const LB_H    = LB_HEAD + Math.max(data.topMembers.length, 1) * ROW_H + 14;

    const H = PAD
        + (80 + GAP * 2)     // header
        + STAT_H  + GAP
        + CHART_H + GAP
        + CH_H    + GAP
        + LB_H    + GAP
        + 40                 // footer
        + PAD;

    const canvas = createCanvas(W, H);
    const ctx = canvas.getContext('2d') as any;

    // ── Background ──────────────────────────────────────────────────────────────
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);

    // Purple glow — top-left
    const gl1 = ctx.createRadialGradient(0, 0, 0, 60, 100, 420);
    gl1.addColorStop(0, 'rgba(99,102,241,0.13)'); gl1.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl1; ctx.fillRect(0, 0, W, H);

    // Gold glow — bottom-right
    const gl2 = ctx.createRadialGradient(W, H, 0, W - 80, H - 80, 500);
    gl2.addColorStop(0, 'rgba(232,185,106,0.09)'); gl2.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gl2; ctx.fillRect(0, 0, W, H);

    let y = PAD;

    // ── HEADER ─────────────────────────────────────────────────────────────────
    if (data.guildIcon) {
        try {
            const img = await loadImage(data.guildIcon);
            ctx.save(); rr(ctx, PAD, y, 80, 80, 18); ctx.clip();
            ctx.drawImage(img, PAD, y, 80, 80); ctx.restore();
        } catch { card(ctx, PAD, y, 80, 80, 18); }
    } else {
        card(ctx, PAD, y, 80, 80, 18, '99,102,241');
        ctx.save(); ctx.fillStyle = '#818cf8'; ctx.font = `42px ${BOLD}`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText((data.guildName[0] ?? '?').toUpperCase(), PAD + 40, y + 40);
        ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic'; ctx.restore();
    }

    const hx = PAD + 80 + 18;
    ctx.fillStyle = C.text; ctx.font = `36px ${BOLD}`;
    let gn = data.guildName;
    while (ctx.measureText(gn).width > 490) gn = gn.slice(0, -1);
    if (gn !== data.guildName) gn += '...';
    ctx.fillText(gn, hx, y + 42);
    ctx.fillStyle = '#475569'; ctx.font = `13px ${REGULAR}`;
    ctx.fillText(`${data.memberCount.toLocaleString()} MEMBERS  ·  ${data.guildJoinedLabel}  ·  LVL ${data.boostTier}`, hx, y + 62);

    // Pill
    ctx.font = `bold 11px ${BOLD}`;
    const pt = data.timeframeLabel;
    const pw = ctx.measureText(pt).width + 22;
    rr(ctx, hx, y + 72, pw, 22, 11);
    ctx.fillStyle = C.goldFade; ctx.fill();
    ctx.fillStyle = C.gold; ctx.fillText(pt, hx + 11, y + 87);

    // Date
    ctx.fillStyle = '#374151'; ctx.font = `13px ${REGULAR}`;
    ctx.textAlign = 'right'; ctx.fillText(data.dateLabel, W - PAD, y + 22); ctx.textAlign = 'left';

    y += 80 + GAP * 2;

    // ── STAT CARDS ─────────────────────────────────────────────────────────────
    const CW = Math.floor((W - PAD * 2 - GAP * 3) / 4);
    const SCARDS = [
        { label: 'MEMBERS',    value: data.stats.members.value.toLocaleString(),    sub: data.stats.members.trend,    dot: C.gold,   nc: C.text,   tint: '232,185,106' },
        { label: 'ONLINE NOW', value: data.stats.online.value.toLocaleString(),     sub: data.stats.online.pct,       dot: C.green,  nc: C.green,  tint: '52,211,153' },
        { label: 'MESSAGES',   value: data.stats.messages.value.toLocaleString(),   sub: data.stats.messages.trend,   dot: C.purple, nc: C.text,   tint: '129,140,248' },
        { label: 'VOICE HRS',  value: data.stats.voiceHours.value.toLocaleString(), sub: data.stats.voiceHours.trend, dot: C.orange, nc: C.text,   tint: '251,146,60' },
    ];

    for (let i = 0; i < 4; i++) {
        const cx = PAD + i * (CW + GAP);
        const s = SCARDS[i];
        card(ctx, cx, y, CW, STAT_H, 14, s.tint);
        ctx.beginPath(); ctx.arc(cx + 18, y + 22, 5, 0, Math.PI * 2);
        ctx.fillStyle = s.dot; ctx.fill();
        ctx.fillStyle = '#94a3b8'; ctx.font = `10px ${BOLD}`; ctx.fillText(s.label, cx + 30, y + 26);
        ctx.fillStyle = s.nc; ctx.font = `40px ${BOLD}`; ctx.fillText(s.value, cx + 16, y + 72);
        ctx.fillStyle = s.sub.startsWith('↑') ? C.green : s.sub.startsWith('↓') ? C.red : C.muted;
        ctx.font = `11px ${REGULAR}`; ctx.fillText(s.sub, cx + 16, y + 90);
    }
    y += STAT_H + GAP;

    // ── CHARTS ─────────────────────────────────────────────────────────────────
    const BPW = 524, DPW = W - PAD * 2 - GAP - BPW;

    // Bar chart
    card(ctx, PAD, y, BPW, CHART_H);
    slabel(ctx, 'MESSAGES PER DAY', PAD + 18, y + 24);

    const bD = data.chartData;
    const maxM = Math.max(...bD.map(d => d.messages), 1);
    const baX = PAD + 52, baY = y + 42, baW = BPW - 68, baH = CHART_H - 66;
    const bCnt = bD.length;
    const bW = Math.max(10, Math.floor(baW / bCnt) - 5);
    const peakI = bD.reduce((mi, d, i) => d.messages > bD[mi].messages ? i : mi, 0);

    for (let i = 0; i <= 3; i++) {
        const val = Math.round((maxM * (3 - i)) / 3);
        const gy = baY + (baH / 3) * i;
        ctx.fillStyle = '#2d3748'; ctx.font = `10px ${REGULAR}`; ctx.textAlign = 'right';
        ctx.fillText(val >= 1000 ? `${(val/1000).toFixed(val < 10000 ? 1 : 0)}k` : `${val}`, baX - 5, gy + 4);
        ctx.textAlign = 'left';
        ctx.beginPath(); ctx.moveTo(baX, gy); ctx.lineTo(baX + baW, gy);
        ctx.strokeStyle = 'rgba(255,255,255,0.04)'; ctx.lineWidth = 1; ctx.stroke();
    }

    for (let i = 0; i < bCnt; i++) {
        const d = bD[i];
        const bx = baX + i * (bW + 5);
        const bh = d.messages > 0 ? Math.max(4, (d.messages / maxM) * baH) : 3;
        const by = baY + baH - bh;
        const isPeak = i === peakI && d.messages > 0;
        const bg = ctx.createLinearGradient(bx, by, bx, by + bh);
        if (isPeak) { bg.addColorStop(0, C.gold); bg.addColorStop(1, 'rgba(232,185,106,0.35)'); }
        else         { bg.addColorStop(0, 'rgba(129,140,248,0.65)'); bg.addColorStop(1, 'rgba(129,140,248,0.18)'); }
        rr(ctx, bx, by, bW, bh, 5); ctx.fillStyle = bg; ctx.fill();
        if (isPeak) {
            ctx.fillStyle = C.gold; ctx.font = `10px ${BOLD}`; ctx.textAlign = 'center';
            ctx.fillText(`${d.messages.toLocaleString()} peak`, bx + bW/2, by - 6); ctx.textAlign = 'left';
        }
        if (d.label) {
            ctx.fillStyle = isPeak ? C.gold : '#374151';
            ctx.font = `10px ${isPeak ? BOLD : REGULAR}`;
            ctx.textAlign = 'center'; ctx.fillText(d.label, bx + bW/2, baY + baH + 15); ctx.textAlign = 'left';
        }
    }

    // Donut card
    const dX = PAD + BPW + GAP;
    card(ctx, dX, y, DPW, CHART_H);
    slabel(ctx, 'MEMBER STATUS', dX + 18, y + 24);
    const { online, dnd, idle, offline } = data.presence;
    const totalP = online + dnd + idle + offline;
    const onPct = totalP > 0 ? Math.round(((online + dnd + idle) / totalP) * 100) : 0;
    const dCX = dX + DPW / 2, dCY = y + 105;
    donut(ctx, dCX, dCY, 58, 13, [
        { value: online, color: C.green },
        { value: dnd,    color: C.red },
        { value: idle,   color: C.yellow },
        { value: Math.max(offline, 1), color: '#1e293b' },
    ], `${onPct}%`);

    const fmtN = (n: number) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : `${n}`;
    const leg = [
        { l: `Online · ${fmtN(online)}`,  c: C.green },
        { l: `DND · ${fmtN(dnd)}`,        c: C.red },
        { l: `Idle · ${fmtN(idle)}`,      c: C.yellow },
        { l: `Offline · ${fmtN(offline)}`, c: '#374151' },
    ];
    const legY = dCY + 72;
    for (let i = 0; i < 4; i++) {
        const col = i % 2, row = Math.floor(i / 2);
        const lx = dX + 12 + col * (DPW / 2), ly = legY + row * 20;
        ctx.beginPath(); ctx.arc(lx + 5, ly - 4, 4, 0, Math.PI * 2);
        ctx.fillStyle = leg[i].c; ctx.fill();
        ctx.fillStyle = C.muted; ctx.font = `11px ${REGULAR}`; ctx.fillText(leg[i].l, lx + 14, ly);
    }

    y += CHART_H + GAP;

    // ── CHANNELS ───────────────────────────────────────────────────────────────
    const CPW = Math.floor((W - PAD * 2 - GAP) / 2);
    const CROW = 36;

    const drawCh = (sx: number, title: string, rightLbl: string,
        items: { name: string; count: number; unit: string }[], c1: string, c2: string) => {
        card(ctx, sx, y, CPW, CH_H);
        aline(ctx, sx + 16, y + 14, c1);
        ctx.fillStyle = C.text; ctx.font = `13px ${BOLD}`; ctx.fillText(title, sx + 26, y + 29);
        ctx.fillStyle = C.dim; ctx.font = `11px ${REGULAR}`;
        ctx.textAlign = 'right'; ctx.fillText(rightLbl, sx + CPW - 16, y + 29); ctx.textAlign = 'left';
        ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(sx + 16, y + 40, CPW - 32, 1);

        if (items.length === 0) {
            ctx.fillStyle = C.dim; ctx.font = `13px ${REGULAR}`;
            ctx.textAlign = 'center'; ctx.fillText('No data for this period', sx + CPW / 2, y + CH_H / 2 + 10); ctx.textAlign = 'left';
        } else {
            const maxV = Math.max(...items.map(it => it.count), 1);
            for (let i = 0; i < Math.min(items.length, 5); i++) {
                const it = items[i];
                const iy = y + 50 + i * CROW;
                ctx.fillStyle = '#94a3b8'; ctx.font = `12px ${REGULAR}`;
                let nm = it.name;
                while (ctx.measureText(`# ${nm}`).width > CPW - 108) nm = nm.slice(0, -1);
                if (nm !== it.name) nm += '..';
                ctx.fillText(`# ${nm}`, sx + 16, iy + 12);
                ctx.textAlign = 'right'; ctx.fillStyle = C.text; ctx.font = `12px ${BOLD}`;
                ctx.fillText(`${it.count.toLocaleString()} ${it.unit}`, sx + CPW - 16, iy + 12); ctx.textAlign = 'left';
                pbar(ctx, sx + 16, iy + 17, CPW - 32, 4, it.count / maxV, c1, c2);
            }
        }
        const total = items.reduce((s, it) => s + it.count, 0);
        ctx.fillStyle = '#2d3748'; ctx.font = `10px ${REGULAR}`;
        ctx.fillText(`Total ${total.toLocaleString()} ${items[0]?.unit ?? ''} across all channels`, sx + 16, y + CH_H - 10);
    };

    const tl = data.timeframeLabel.toLowerCase();
    drawCh(PAD, 'TEXT CHANNELS', `${tl} msgs`,
        data.topTextChannels.map(c => ({ name: c.name, count: c.messages, unit: 'msgs' })),
        C.purple, 'rgba(99,102,241,0.5)');
    drawCh(PAD + CPW + GAP, 'VOICE CHANNELS', `${tl} hours`,
        data.topVoiceChannels.map(c => ({ name: c.name, count: c.hours, unit: 'h' })),
        C.gold, 'rgba(232,185,106,0.45)');

    y += CH_H + GAP;

    // ── LEADERBOARD ────────────────────────────────────────────────────────────
    card(ctx, PAD, y, W - PAD * 2, LB_H);
    aline(ctx, PAD + 16, y + 14, C.gold);
    ctx.fillStyle = C.text; ctx.font = `13px ${BOLD}`; ctx.fillText('MEMBER LEADERBOARD', PAD + 26, y + 29);
    ctx.fillStyle = C.dim; ctx.font = `11px ${REGULAR}`;
    ctx.textAlign = 'right';
    ctx.fillText('messages', W - PAD - 76, y + 29);
    ctx.fillText('voice', W - PAD - 16, y + 29);
    ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(PAD + 16, y + 40, W - PAD * 2 - 32, 1);

    const CR = 36, CAV = 38, CN = 145;
    const BS = PAD + 16 + CR + CAV + CN + 8, BE = W - PAD - 130, BW = BE - BS;
    const RANK_C = [C.gold, C.silver, C.bronze, C.muted, C.muted];
    const BAR_C  = [
        [C.gold, 'rgba(232,185,106,0.4)'],
        ['#94a3b8', 'rgba(148,163,184,0.3)'],
        [C.bronze, 'rgba(205,127,50,0.4)'],
        [C.purple, 'rgba(129,140,248,0.4)'],
        [C.purple, 'rgba(129,140,248,0.35)'],
    ];

    ctx.fillStyle = '#2d3748'; ctx.font = `10px ${REGULAR}`;
    ctx.fillText('RANK', PAD + 16, y + 62);
    ctx.fillText('MEMBER', PAD + 16 + CR + CAV + 4, y + 62);
    ctx.fillText('7-DAY ACTIVITY', BS, y + 62);
    ctx.textAlign = 'right'; ctx.fillText('MSGS', W - PAD - 76, y + 62); ctx.fillText('VOICE', W - PAD - 16, y + 62); ctx.textAlign = 'left';
    ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fillRect(PAD + 16, y + 68, W - PAD * 2 - 32, 1);

    const maxMM = Math.max(...data.topMembers.map(m => m.messages), 1);

    for (let i = 0; i < data.topMembers.length; i++) {
        const m = data.topMembers[i];
        const ry = y + LB_HEAD - 2 + i * ROW_H;

        // Alternating row tint
        if (i % 2 === 0) { rr(ctx, PAD + 16, ry, W - PAD * 2 - 32, ROW_H - 4, 6); ctx.fillStyle = 'rgba(255,255,255,0.02)'; ctx.fill(); }

        // Rank number
        ctx.fillStyle = RANK_C[i] ?? C.muted; ctx.font = `15px ${BOLD}`;
        ctx.fillText(`${i + 1}`, PAD + 22, ry + 23);

        // Avatar
        await circleAv(ctx, m.avatarURL, m.username, PAD + 16 + CR, ry + 8, 30);

        // Name
        ctx.fillStyle = C.text; ctx.font = `13px ${BOLD}`;
        let dn = m.username;
        while (ctx.measureText(dn).width > CN - 8) dn = dn.slice(0, -1);
        if (dn !== m.username) dn += '..';
        ctx.fillText(dn, PAD + 16 + CR + CAV + 4, ry + 24);

        // Activity bar
        pbar(ctx, BS, ry + 15, BW, 12, m.messages / maxMM, BAR_C[i]?.[0] ?? C.purple, BAR_C[i]?.[1]);

        ctx.textAlign = 'right';
        ctx.fillStyle = C.text; ctx.font = `13px ${BOLD}`;
        ctx.fillText(m.messages.toLocaleString(), W - PAD - 76, ry + 24);
        ctx.fillStyle = C.muted; ctx.font = `12px ${REGULAR}`;
        ctx.fillText(`${m.voiceHours} h`, W - PAD - 16, ry + 24);
        ctx.textAlign = 'left';

        if (i < data.topMembers.length - 1) {
            ctx.fillStyle = 'rgba(255,255,255,0.03)';
            ctx.fillRect(PAD + 16, ry + ROW_H - 4, W - PAD * 2 - 32, 1);
        }
    }

    y += LB_H + GAP;

    // ── FOOTER ─────────────────────────────────────────────────────────────────
    // Gradient separator line
    const footerLine = ctx.createLinearGradient(PAD, y, W - PAD, y);
    footerLine.addColorStop(0, 'rgba(255,255,255,0)');
    footerLine.addColorStop(0.3, 'rgba(255,255,255,0.08)');
    footerLine.addColorStop(0.7, 'rgba(255,255,255,0.08)');
    footerLine.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = footerLine; ctx.fillRect(PAD, y, W - PAD * 2, 1);
    y += 12;

    ctx.fillStyle = '#2d3748'; ctx.font = `11px ${BOLD}`;
    ctx.fillText(data.botName.toUpperCase(), PAD, y + 14);
    ctx.textAlign = 'center';
    ctx.fillText(`SERVERSTATS  ·  LAST ${data.timeframeLabel}`, W / 2, y + 14);
    ctx.textAlign = 'right';
    ctx.fillText(data.guildName.toLowerCase().replace(/ /g, ''), W - PAD, y + 14);
    ctx.textAlign = 'left';

    return canvas.toBuffer('image/png');
}
