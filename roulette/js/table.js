import { RED } from './physics.js';

// Logical layout (horizontal orientation): 14 x 5 cells.
// x: 0 = zero, 1..12 = number columns, 13 = "2 to 1".
// y: 0..2 = number rows (top row 3,6,..36), 3 = dozens, 4 = even-money row.
const LW = 14, LH = 5;
const num = (c, r) => 3 * (c + 1) - r;
const range = (a, b) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

const OUTSIDE = [
  { key: 'o:low', label: '1–18', nums: range(1, 18), rect: [1, 4, 3, 5] },
  { key: 'o:even', label: 'EVEN', nums: range(1, 36).filter((n) => n % 2 === 0), rect: [3, 4, 5, 5] },
  { key: 'o:red', label: 'RED', nums: [...RED], rect: [5, 4, 7, 5], diamond: '#c0141f' },
  { key: 'o:black', label: 'BLACK', nums: range(1, 36).filter((n) => !RED.has(n)), rect: [7, 4, 9, 5], diamond: '#111' },
  { key: 'o:odd', label: 'ODD', nums: range(1, 36).filter((n) => n % 2 === 1), rect: [9, 4, 11, 5] },
  { key: 'o:high', label: '19–36', nums: range(19, 36), rect: [11, 4, 13, 5] },
  { key: 'o:d1', label: '1st 12', nums: range(1, 12), rect: [1, 3, 5, 4] },
  { key: 'o:d2', label: '2nd 12', nums: range(13, 24), rect: [5, 3, 9, 4] },
  { key: 'o:d3', label: '3rd 12', nums: range(25, 36), rect: [9, 3, 13, 4] },
  ...[0, 1, 2].map((r) => ({
    key: `o:col${r}`, label: '2 to 1',
    nums: range(1, 36).filter((n) => n % 3 === (3 - r) % 3),
    rect: [13, r, 14, r + 1],
  })),
];
for (const o of OUTSIDE) o.anchor = [(o.rect[0] + o.rect[2]) / 2, (o.rect[1] + o.rect[3]) / 2];

function insideBet(nums, anchor) {
  const sorted = [...nums].sort((a, b) => a - b);
  const names = { 1: 'Straight', 2: 'Split', 3: sorted[0] === 0 ? 'Trio' : 'Street', 4: 'Corner', 6: 'Six line' };
  return {
    key: 'i:' + sorted.join(','),
    nums: sorted,
    anchor,
    label: `${names[sorted.length]} ${sorted.join('-')}`,
  };
}

export const payoutMultiplier = (bet) => 36 / bet.nums.length;

export function compactMoney(n) {
  if (n >= 1e6) return (n / 1e6).toFixed(n % 1e6 ? 1 : 0) + 'M';
  if (n >= 1e4) return Math.round(n / 1e3) + 'K';
  if (n >= 1e3) return (n / 1e3).toFixed(n % 1e3 ? 1 : 0) + 'K';
  return String(n);
}

export class BettingTable {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.preview = null;
    this.winning = null;
    this.resolveAt = 0;
    this.w = this.h = 0;
  }

  resize(w, h) {
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    this.dpr = dpr;
    this.w = w; this.h = h;
    this.canvas.width = Math.round(w * dpr);
    this.canvas.height = Math.round(h * dpr);
    const pad = 6;
    const aw = w - pad * 2, ah = h - pad * 2;
    this.horiz = aw >= ah;
    if (this.horiz) {
      this.ux = Math.min(aw / LW, (ah / LH) * 1.5);
      this.uy = Math.min(ah / LH, this.ux * 1.6);
      this.ox = (w - this.ux * LW) / 2;
      this.oy = (h - this.uy * LH) / 2;
    } else {
      this.uy = Math.min(ah / LW, (aw / LH) * 0.9);
      this.ux = Math.min(aw / LH, this.uy * 2.3);
      this.ox = (w - this.ux * LH) / 2;
      this.oy = (h - this.uy * LW) / 2;
    }
    this.pxX = this.horiz ? this.ux : this.uy;
    this.pxY = this.horiz ? this.uy : this.ux;
    this.cell = Math.min(this.pxX, this.pxY);
  }

  toScreen(lx, ly) {
    return this.horiz
      ? [this.ox + lx * this.ux, this.oy + ly * this.uy]
      : [this.ox + (LH - ly) * this.ux, this.oy + lx * this.uy];
  }

  toLogical(X, Y) {
    return this.horiz
      ? [(X - this.ox) / this.ux, (Y - this.oy) / this.uy]
      : [(Y - this.oy) / this.uy, LH - (X - this.ox) / this.ux];
  }

  rectL(x0, y0, x1, y1) {
    const [ax, ay] = this.toScreen(x0, y0);
    const [bx, by] = this.toScreen(x1, y1);
    return { x: Math.min(ax, bx), y: Math.min(ay, by), w: Math.abs(bx - ax), h: Math.abs(by - ay) };
  }

  hitTest(X, Y) {
    const [lx, ly] = this.toLogical(X, Y);
    if (lx < 0 || lx > LW || ly < 0 || ly > LH) return null;

    for (const o of OUTSIDE) {
      const [x0, y0, x1, y1] = o.rect;
      if (lx >= x0 && lx < x1 && ly >= y0 && ly < y1) return o;
    }
    if (ly >= 3) return null;
    if (lx < 1) {
      const eX = Math.min(0.3, 16 / this.pxX);
      if (lx < 1 - eX) return insideBet([0], [0.5, 1.5]);
    }

    const eX = Math.min(0.3, Math.max(0.16, 16 / this.pxX));
    const eY = Math.min(0.3, Math.max(0.16, 14 / this.pxY));
    const c = Math.max(0, Math.min(11, Math.floor(lx - 1)));
    const r = Math.max(0, Math.min(2, Math.floor(ly)));
    const dx = lx - 1 - c, dy = ly - r;
    const L = dx < eX, R = dx > 1 - eX, T = dy < eY, B = dy > 1 - eY;

    if (B && r === 2) {
      if (L && c > 0) return insideBet([0, 1, 2].flatMap((k) => [num(c - 1, k), num(c, k)]), [1 + c, 3]);
      if (R && c < 11) return insideBet([0, 1, 2].flatMap((k) => [num(c, k), num(c + 1, k)]), [2 + c, 3]);
      return insideBet([num(c, 0), num(c, 1), num(c, 2)], [1.5 + c, 3]);
    }
    if (L && c === 0) {
      if (T && r > 0) return insideBet([0, num(0, r), num(0, r - 1)], [1, r]);
      if (B && r < 2) return insideBet([0, num(0, r), num(0, r + 1)], [1, r + 1]);
      return insideBet([0, num(0, r)], [1, r + 0.5]);
    }
    const hc = L && c > 0 ? c - 1 : R && c < 11 ? c + 1 : null;
    const vr = T && r > 0 ? r - 1 : B && r < 2 ? r + 1 : null;
    const ax = 1 + c + (L ? 0 : 1), ay = r + (T ? 0 : 1);
    if (hc !== null && vr !== null) {
      return insideBet([num(c, r), num(hc, r), num(c, vr), num(hc, vr)], [ax, ay]);
    }
    if (hc !== null) return insideBet([num(c, r), num(hc, r)], [ax, r + 0.5]);
    if (vr !== null) return insideBet([num(c, r), num(c, vr)], [1.5 + c, ay]);
    return insideBet([num(c, r)], [1.5 + c, r + 0.5]);
  }

  numberRect(n) {
    if (n === 0) return this.rectL(0, 0, 1, 3);
    const c = Math.ceil(n / 3) - 1;
    const r = 3 * (c + 1) - n;
    return this.rectL(1 + c, r, 2 + c, r + 1);
  }

  draw(players, activeId, now) {
    const g = this.ctx;
    g.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    g.clearRect(0, 0, this.w, this.h);
    const fs = this.cell;
    const gold = 'rgba(232, 199, 120, 0.9)';

    const outer = this.rectL(0, 0, LW, LH);
    g.fillStyle = 'rgba(0,0,0,0.12)';
    roundRect(g, outer.x - 4, outer.y - 4, outer.w + 8, outer.h + 8, 12);
    g.fill();

    const z = this.rectL(0, 0, 1, 3);
    g.fillStyle = cellGradient(g, z, '#0f9a4c', '#086a33');
    roundRect(g, z.x + 2, z.y + 2, z.w - 4, z.h - 4, 10);
    g.fill();
    text(g, '0', z.x + z.w / 2, z.y + z.h / 2, fs * 0.5, '#fff');

    for (let c = 0; c < 12; c++) {
      for (let r = 0; r < 3; r++) {
        const n = num(c, r);
        const rc = this.rectL(1 + c, r, 2 + c, r + 1);
        g.fillStyle = RED.has(n) ? cellGradient(g, rc, '#d21a27', '#9c0f19') : cellGradient(g, rc, '#262626', '#0c0c0c');
        g.fillRect(rc.x + 1.5, rc.y + 1.5, rc.w - 3, rc.h - 3);
        text(g, String(n), rc.x + rc.w / 2, rc.y + rc.h / 2, fs * 0.42, '#fff');
      }
    }

    for (const o of OUTSIDE) {
      const rc = this.rectL(...o.rect);
      g.fillStyle = 'rgba(255,255,255,0.035)';
      g.fillRect(rc.x + 1.5, rc.y + 1.5, rc.w - 3, rc.h - 3);
      if (o.diamond) {
        const cx = rc.x + rc.w / 2, cy = rc.y + rc.h / 2;
        const dw = Math.min(rc.w, rc.h * 2) * 0.32, dh = Math.min(rc.h, rc.w) * 0.32;
        g.beginPath();
        g.moveTo(cx - dw, cy); g.lineTo(cx, cy - dh); g.lineTo(cx + dw, cy); g.lineTo(cx, cy + dh);
        g.closePath();
        g.fillStyle = o.diamond;
        g.fill();
        g.strokeStyle = gold; g.lineWidth = 1.5; g.stroke();
      } else {
        const tall = rc.h > rc.w * 1.3;
        const size = tall ? Math.min(rc.w * 0.36, fs * 0.42) : fs * (o.label === '2 to 1' ? 0.26 : 0.32);
        text(g, o.label, rc.x + rc.w / 2, rc.y + rc.h / 2, size, '#f3e7c4', tall);
      }
    }

    g.strokeStyle = gold;
    g.lineWidth = 1.5;
    for (const o of OUTSIDE) strokeR(g, this.rectL(...o.rect));
    for (let c = 0; c < 12; c++) for (let r = 0; r < 3; r++) strokeR(g, this.rectL(1 + c, r, 2 + c, r + 1));
    strokeR(g, z);
    g.lineWidth = 2.5;
    strokeR(g, this.rectL(0, 0, LW, 3));

    if (this.preview) {
      g.fillStyle = 'rgba(255,255,255,0.28)';
      if (this.preview.key.startsWith('o:')) {
        const rc = this.rectL(...this.preview.rect);
        g.fillRect(rc.x, rc.y, rc.w, rc.h);
      } else {
        for (const n of this.preview.nums) {
          const rc = this.numberRect(n);
          g.fillRect(rc.x, rc.y, rc.w, rc.h);
        }
      }
    }

    if (this.winning !== null) {
      const rc = this.numberRect(this.winning);
      const pulse = 0.55 + 0.45 * Math.sin(now / 180);
      g.save();
      g.shadowColor = '#ffe9a8';
      g.shadowBlur = 18 * pulse;
      g.strokeStyle = `rgba(255, 236, 170, ${0.6 + 0.4 * pulse})`;
      g.lineWidth = 4;
      g.strokeRect(rc.x + 2, rc.y + 2, rc.w - 4, rc.h - 4);
      g.restore();
      const cx = rc.x + rc.w / 2, cy = rc.y + rc.h / 2;
      drawDolly(g, cx, cy, Math.min(rc.w, rc.h) * 0.28);
    }

    const chipR = Math.max(11, Math.min(24, fs * 0.33));
    const stacks = new Map();
    for (const p of players) {
      for (const bet of p.bets.values()) {
        const list = stacks.get(bet.key) || [];
        list.push({ p, bet });
        stacks.set(bet.key, list);
      }
    }
    const fadeT = this.winning !== null ? Math.max(0, Math.min(1, (now - this.resolveAt - 700) / 700)) : 0;
    for (const list of stacks.values()) {
      list.forEach(({ p, bet }, i) => {
        const [sx, sy] = this.toScreen(...bet.anchor);
        const off = i * chipR * 0.55;
        const won = this.winning !== null && bet.nums.includes(this.winning);
        const lost = this.winning !== null && !won;
        const alpha = lost ? 1 - fadeT : 1;
        if (alpha <= 0.01) return;
        drawChip(g, sx + off, sy - off, chipR, p.color, compactMoney(bet.amount), alpha,
          won ? 0.5 + 0.5 * Math.sin(now / 150) : 0, p.id === activeId, bet.amount);
      });
    }

    if (this.preview && this.previewColor) {
      const [sx, sy] = this.toScreen(...this.preview.anchor);
      drawChip(g, sx, sy, chipR, this.previewColor, compactMoney(this.previewAmount), 0.6, 0, true, 1);
    }
  }
}

function strokeR(g, rc) {
  g.strokeRect(rc.x, rc.y, rc.w, rc.h);
}

function cellGradient(g, rc, a, b) {
  const gr = g.createLinearGradient(rc.x, rc.y, rc.x, rc.y + rc.h);
  gr.addColorStop(0, a);
  gr.addColorStop(1, b);
  return gr;
}

function text(g, s, x, y, size, color, rotate = false) {
  g.save();
  g.translate(x, y);
  if (rotate) g.rotate(-Math.PI / 2);
  g.font = `700 ${Math.round(size)}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillText(s, 0, 1.5);
  g.fillStyle = color;
  g.fillText(s, 0, 0);
  g.restore();
}

function roundRect(g, x, y, w, h, r) {
  g.beginPath();
  g.moveTo(x + r, y);
  g.arcTo(x + w, y, x + w, y + h, r);
  g.arcTo(x + w, y + h, x, y + h, r);
  g.arcTo(x, y + h, x, y, r);
  g.arcTo(x, y, x + w, y, r);
  g.closePath();
}

function drawDolly(g, x, y, r) {
  g.save();
  const gr = g.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.1, x, y, r);
  gr.addColorStop(0, '#ffffff');
  gr.addColorStop(0.5, '#dfe8f2');
  gr.addColorStop(1, '#8fa3b8');
  g.shadowColor = 'rgba(0,0,0,0.5)';
  g.shadowBlur = 8;
  g.shadowOffsetY = 3;
  g.fillStyle = gr;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  g.restore();
}

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

export function drawChip(g, x, y, r, color, label, alpha = 1, glow = 0, emphasize = false, amount = 1) {
  g.save();
  g.globalAlpha = alpha;
  const layers = amount >= 100 ? 3 : amount >= 25 ? 2 : 1;
  for (let i = layers - 1; i >= 0; i--) {
    const cy = y + i * 3;
    g.fillStyle = 'rgba(0,0,0,0.4)';
    g.beginPath();
    g.arc(x + 1.5, cy + 3, r, 0, Math.PI * 2);
    g.fill();
    if (glow > 0 && i === 0) {
      g.shadowColor = '#ffe18a';
      g.shadowBlur = 14 + 12 * glow;
    }
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, cy, r, 0, Math.PI * 2);
    g.fill();
    g.shadowBlur = 0;
    g.fillStyle = 'rgba(255,255,255,0.92)';
    for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + 0.2;
      g.beginPath();
      g.arc(x, cy, r, a, a + 0.32);
      g.arc(x, cy, r * 0.74, a + 0.32, a, true);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 1;
    g.beginPath();
    g.arc(x, cy, r, 0, Math.PI * 2);
    g.stroke();
  }
  const inner = g.createRadialGradient(x - r * 0.25, y - r * 0.3, 0, x, y, r * 0.66);
  inner.addColorStop(0, 'rgba(255,255,255,0.35)');
  inner.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = color;
  g.beginPath();
  g.arc(x, y, r * 0.64, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = inner;
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.7)';
  g.setLineDash([2, 2]);
  g.lineWidth = 1;
  g.stroke();
  g.setLineDash([]);
  if (emphasize) {
    g.strokeStyle = 'rgba(255,255,255,0.95)';
    g.lineWidth = 2;
    g.beginPath();
    g.arc(x, y, r + 2, 0, Math.PI * 2);
    g.stroke();
  }
  const size = label.length > 3 ? r * 0.62 : r * 0.78;
  g.font = `800 ${Math.round(size)}px -apple-system, "SF Pro Display", "Helvetica Neue", Arial, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = luminance(color) > 0.6 ? '#1b1b1b' : '#fff';
  g.fillText(label, x, y + 0.5);
  g.restore();
}
