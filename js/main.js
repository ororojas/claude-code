import { RouletteSim, colorOf, GEO } from './physics.js';
import { Wheel3D } from './wheel3d.js';
import { BettingTable, payoutMultiplier } from './table.js';
import { Sfx } from './audio.js';

const COLORS = ['#f5c542', '#38bdf8', '#f472b6', '#a3e635', '#fb923c', '#f1f5f9', '#a78bfa', '#2dd4bf'];
const CHIPS = [
  { v: 1, c: '#ececec', t: '#1d1d1d' },
  { v: 5, c: '#c8202f', t: '#fff' },
  { v: 25, c: '#1f8a4c', t: '#fff' },
  { v: 100, c: '#1b1b1b', t: '#fff' },
  { v: 500, c: '#6d3fc4', t: '#fff' },
];
const MAX_PLAYERS = 8;
const STORE = 'roulette-night-v1';

const $ = (id) => document.getElementById(id);
const money = (n) => '$' + Math.round(n).toLocaleString('en-US');
const signed = (n) => (n > 0 ? '+' : n < 0 ? '−' : '') + money(Math.abs(n));
const betTotal = (p) => [...p.bets.values()].reduce((s, b) => s + b.amount, 0);

const state = {
  players: [],
  activeId: null,
  chip: 25,
  phase: 'betting',
  history: [],
  lastBets: new Map(),
  sound: true,
  topView: false,
  buyin: 1000,
};
let nextId = 1;
let tableDirty = true;

const sim = new RouletteSim();
const sfx = new Sfx();
const table = new BettingTable($('table'));
let wheel = null;
try {
  wheel = new Wheel3D($('wheel'));
} catch (err) {
  console.error(err);
  $('status').textContent = 'This browser could not start 3D graphics';
}

const active = () => state.players.find((p) => p.id === state.activeId) || null;

function makePlayer(name, color, balance) {
  return { id: nextId++, name, color, balance, bets: new Map(), undo: [] };
}

function save() {
  try {
    localStorage.setItem(STORE, JSON.stringify({
      players: state.players.map((p) => ({ name: p.name, color: p.color, balance: p.balance + betTotal(p) })),
      active: state.players.findIndex((p) => p.id === state.activeId),
      chip: state.chip,
      history: state.history.slice(0, 40),
      sound: state.sound,
      topView: state.topView,
      buyin: state.buyin,
    }));
  } catch { /* storage unavailable */ }
}

function loadSaved() {
  try {
    const s = JSON.parse(localStorage.getItem(STORE));
    return s && Array.isArray(s.players) && s.players.length ? s : null;
  } catch {
    return null;
  }
}

// ---------- UI rendering ----------

let toastTimer = 0;
function toast(msg) {
  const t = $('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

function setStatus(msg) {
  $('status').textContent = msg;
  $('status').style.opacity = msg ? 1 : 0;
}

function bettingStatus() {
  const total = state.players.reduce((s, p) => s + betTotal(p), 0);
  setStatus(total ? `${money(total)} on the table · swipe the wheel or tap SPIN` : 'Place your bets');
}

const tileEls = new Map();

function renderPlayers() {
  const box = $('players');
  box.textContent = '';
  tileEls.clear();
  for (const p of state.players) {
    const tile = document.createElement('button');
    tile.className = 'ptile';
    tile.style.setProperty('--pc', p.color);
    const chip = document.createElement('div');
    chip.className = 'pchip';
    chip.textContent = (p.name.trim()[0] || '?').toUpperCase();
    chip.style.color = luminance(p.color) > 0.6 ? '#1b1b1b' : '#fff';
    const info = document.createElement('div');
    const name = document.createElement('div');
    name.className = 'pname';
    name.textContent = p.name;
    const bal = document.createElement('div');
    bal.className = 'pbal';
    const bet = document.createElement('div');
    bet.className = 'pbet';
    info.append(name, bal, bet);
    const edit = document.createElement('span');
    edit.className = 'pedit';
    edit.textContent = '✎';
    edit.addEventListener('click', (e) => {
      e.stopPropagation();
      openPlayerSheet(p);
    });
    tile.append(chip, info, edit);
    tile.addEventListener('click', () => selectPlayer(p.id));
    box.append(tile);
    tileEls.set(p.id, { tile, bal, bet });
  }
  if (state.players.length < MAX_PLAYERS) {
    const add = document.createElement('button');
    add.className = 'addtile';
    add.textContent = '+';
    add.setAttribute('aria-label', 'Add player');
    add.addEventListener('click', () => openPlayerSheet(null));
    box.append(add);
  }
  refreshTiles();
}

function refreshTiles() {
  for (const p of state.players) {
    const el = tileEls.get(p.id);
    if (!el) continue;
    el.tile.classList.toggle('active', p.id === state.activeId);
    el.bal.textContent = money(p.balance);
    const t = betTotal(p);
    el.bet.textContent = t ? `${money(t)} on table` : p.balance <= 0 ? 'Out of chips' : 'No bets';
  }
  updateControls();
}

function selectPlayer(id) {
  state.activeId = id;
  refreshTiles();
  tileEls.get(id)?.tile.scrollIntoView({ block: 'nearest', inline: 'nearest', behavior: 'smooth' });
  tableDirty = true;
  save();
}

function floatOnTile(p, text, cls) {
  const el = tileEls.get(p.id);
  if (!el) return;
  const f = document.createElement('div');
  f.className = `float ${cls}`;
  f.textContent = text;
  el.tile.append(f);
  el.tile.classList.remove('flash');
  if (cls === 'pos') {
    void el.tile.offsetWidth;
    el.tile.classList.add('flash');
  }
  setTimeout(() => f.remove(), 1700);
}

function renderChips() {
  const box = $('chips');
  box.textContent = '';
  for (const ch of CHIPS) {
    const b = document.createElement('button');
    b.className = 'chipbtn' + (ch.v === state.chip ? ' sel' : '');
    b.style.setProperty('--c', ch.c);
    b.style.setProperty('--t', ch.t);
    const s = document.createElement('span');
    s.textContent = ch.v;
    b.append(s);
    b.setAttribute('aria-label', `$${ch.v} chip`);
    b.addEventListener('click', () => {
      state.chip = ch.v;
      sfx.unlock();
      sfx.chip();
      renderChips();
      save();
    });
    box.append(b);
  }
}

function renderHistory() {
  const box = $('history');
  box.textContent = '';
  for (const n of state.history.slice(0, 18)) {
    const d = document.createElement('div');
    d.className = `hnum ${colorOf(n)}`;
    d.textContent = n;
    box.append(d);
  }
}

function updateControls() {
  const betting = state.phase === 'betting';
  const p = active();
  $('spinBtn').disabled = !betting;
  $('undoBtn').disabled = !betting || !p || !p.undo.length;
  $('clearBtn').disabled = !betting || !p || !p.bets.size;
  $('rebetBtn').disabled = !betting || ![...state.lastBets.values()].some((l) => l.length);
}

function changed() {
  tableDirty = true;
  refreshTiles();
  if (state.phase === 'betting') bettingStatus();
  save();
}

// ---------- Betting ----------

function placeBet(bet, amount = state.chip, p = active(), quiet = false) {
  if (!p) return false;
  if (p.balance <= 0) {
    if (!quiet) toast(`${p.name} is out of chips`);
    return false;
  }
  const amt = Math.min(amount, p.balance);
  p.balance -= amt;
  const cur = p.bets.get(bet.key);
  if (cur) cur.amount += amt;
  else p.bets.set(bet.key, { key: bet.key, nums: bet.nums, anchor: bet.anchor, label: bet.label, amount: amt });
  p.undo.push({ key: bet.key, amount: amt });
  if (!quiet) {
    sfx.chip();
    if (amt < amount) toast(`${p.name} went all in`);
    changed();
  }
  return true;
}

function undo() {
  const p = active();
  const u = p?.undo.pop();
  if (!u) return;
  const b = p.bets.get(u.key);
  if (b) {
    b.amount -= u.amount;
    if (b.amount <= 0) p.bets.delete(u.key);
    p.balance += u.amount;
  }
  sfx.chip();
  changed();
}

function clearBets() {
  const p = active();
  if (!p) return;
  p.balance += betTotal(p);
  p.bets.clear();
  p.undo = [];
  sfx.chip();
  changed();
}

function rebet() {
  let placed = 0;
  for (const p of state.players) {
    for (const b of state.lastBets.get(p.id) || []) {
      if (placeBet(b, b.amount, p, true)) placed++;
    }
  }
  if (placed) {
    sfx.chip();
    changed();
  } else {
    toast('Nothing to rebet');
  }
}

const tcv = $('table');
let pressing = false;

function previewAt(e) {
  const r = tcv.getBoundingClientRect();
  const bet = table.hitTest(e.clientX - r.left, e.clientY - r.top);
  table.preview = bet;
  table.previewColor = active()?.color;
  table.previewAmount = Math.min(state.chip, active()?.balance ?? 0) || state.chip;
  const info = $('betInfo');
  if (bet) {
    info.textContent = `${bet.label} · pays ${payoutMultiplier(bet) - 1}:1`;
    info.classList.add('show');
  } else {
    info.classList.remove('show');
  }
  tableDirty = true;
}

function endPreview() {
  pressing = false;
  table.preview = null;
  $('betInfo').classList.remove('show');
  tableDirty = true;
}

tcv.addEventListener('pointerdown', (e) => {
  sfx.unlock();
  if (state.phase !== 'betting') {
    if (state.phase === 'spinning') toast('No more bets');
    return;
  }
  if (!active()) {
    toast('Add a player first');
    return;
  }
  pressing = true;
  tcv.setPointerCapture(e.pointerId);
  previewAt(e);
});
tcv.addEventListener('pointermove', (e) => {
  if (pressing) previewAt(e);
});
tcv.addEventListener('pointerup', () => {
  if (!pressing) return;
  const bet = table.preview;
  endPreview();
  if (bet && state.phase === 'betting') placeBet(bet);
});
tcv.addEventListener('pointercancel', endPreview);

// ---------- Spinning ----------

function spin(speed) {
  if (state.phase !== 'betting' || !wheel) return;
  sfx.unlock();
  endPreview();
  state.phase = 'spinning';
  sim.launch(speed ?? 11.5 + Math.random() * 3);
  setStatus('Ball in play');
  updateControls();
}

sim.onDrop = () => setStatus('No more bets');
sim.onImpact = (v, kind) => sfx.click(v, kind);
sim.onSettle = (n) => setTimeout(() => resolve(n), 400);

function resolve(n) {
  state.phase = 'result';
  state.history.unshift(n);
  const rows = [];
  for (const p of state.players) {
    let staked = 0;
    let paid = 0;
    for (const b of p.bets.values()) {
      staked += b.amount;
      if (b.nums.includes(n)) paid += b.amount * payoutMultiplier(b);
    }
    if (!staked) continue;
    p.balance += paid;
    rows.push({ p, net: paid - staked });
  }
  state.lastBets = new Map(state.players.map((p) => [p.id, [...p.bets.values()].map((b) => ({ ...b }))]));

  table.winning = n;
  table.resolveAt = performance.now();
  wheel.setFocus(true);

  const color = colorOf(n);
  const num = $('resNum');
  num.className = `res-num ${color}`;
  num.textContent = n;
  $('resTitle').textContent = n === 0 ? 'Zero' : `${n} ${color === 'red' ? 'Red' : 'Black'}`;
  $('resTags').textContent = n === 0
    ? 'HOUSE NUMBER'
    : [n % 2 ? 'ODD' : 'EVEN', n <= 18 ? '1–18' : '19–36', n <= 12 ? '1ST 12' : n <= 24 ? '2ND 12' : '3RD 12'].join(' · ');
  const list = $('resList');
  list.textContent = '';
  rows.sort((a, b) => b.net - a.net);
  if (!rows.length) {
    const r = document.createElement('div');
    r.className = 'res-row zero';
    r.textContent = 'No bets this round';
    list.append(r);
  }
  for (const { p, net } of rows) {
    const r = document.createElement('div');
    r.className = 'res-row';
    const dot = document.createElement('span');
    dot.className = 'dot';
    dot.style.background = p.color;
    const name = document.createElement('span');
    name.textContent = p.name;
    const amt = document.createElement('span');
    amt.className = `amt ${net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero'}`;
    amt.textContent = signed(net);
    r.append(dot, name, amt);
    list.append(r);
    floatOnTile(p, signed(net), net > 0 ? 'pos' : net < 0 ? 'neg' : 'zero');
  }
  $('result').classList.add('show');
  setStatus('');
  if (rows.some((r) => r.net > 0)) sfx.win();
  renderHistory();
  refreshTiles();
  save();
}

function nextRound() {
  for (const p of state.players) {
    p.bets.clear();
    p.undo = [];
  }
  table.winning = null;
  state.phase = 'betting';
  wheel?.setFocus(false);
  $('result').classList.remove('show');
  changed();
}

const wcv = $('wheel');
let swipe = null;
wcv.addEventListener('pointerdown', (e) => {
  swipe = { x: e.clientX, y: e.clientY, t: performance.now() };
  wcv.setPointerCapture(e.pointerId);
});
wcv.addEventListener('pointerup', (e) => {
  if (!swipe) return;
  const d = Math.hypot(e.clientX - swipe.x, e.clientY - swipe.y);
  const dt = Math.max(1, performance.now() - swipe.t);
  swipe = null;
  if (d > 60 && dt < 900 && state.phase === 'betting') {
    spin(Math.max(10.5, Math.min(15.5, 9.5 + (d / dt) * 2.5)));
  }
});
wcv.addEventListener('pointercancel', () => { swipe = null; });

// ---------- Player sheet ----------

let editing = null;
let pickedColor = null;
let removeArmed = false;

function openPlayerSheet(p) {
  if (!p && state.players.length >= MAX_PLAYERS) return;
  editing = p;
  $('psTitle').textContent = p ? 'Edit player' : 'Add player';
  $('psSub').textContent = p ? `${money(p.balance)} in chips` : 'Everyone gets their own chip color on the table.';
  $('psName').value = p ? p.name : '';
  $('psExtra').style.display = p ? 'flex' : 'none';
  $('psRemove').disabled = state.phase !== 'betting';
  $('psRemove').textContent = 'Remove';
  removeArmed = false;
  const taken = new Set(state.players.filter((x) => x !== p).map((x) => x.color));
  pickedColor = p ? p.color : COLORS.find((c) => !taken.has(c));
  const sw = $('psSwatches');
  sw.textContent = '';
  for (const c of COLORS) {
    const b = document.createElement('button');
    b.className = 'swatch' + (c === pickedColor ? ' sel' : '') + (taken.has(c) ? ' taken' : '');
    b.style.background = c;
    b.addEventListener('click', () => {
      pickedColor = c;
      [...sw.children].forEach((x) => x.classList.toggle('sel', x === b));
    });
    sw.append(b);
  }
  $('playerSheet').classList.add('show');
  if (!p) setTimeout(() => $('psName').focus(), 50);
}

function closePlayerSheet() {
  $('playerSheet').classList.remove('show');
  $('psName').blur();
  editing = null;
}

$('psSave').addEventListener('click', () => {
  const name = $('psName').value.trim().slice(0, 16) || `Player ${state.players.length + (editing ? 0 : 1)}`;
  if (editing) {
    editing.name = name;
    editing.color = pickedColor;
  } else {
    const p = makePlayer(name, pickedColor, state.buyin);
    state.players.push(p);
    state.activeId = p.id;
  }
  closePlayerSheet();
  renderPlayers();
  changed();
});
$('psCancel').addEventListener('click', closePlayerSheet);
$('psTopup').addEventListener('click', () => {
  if (!editing) return;
  editing.balance += 1000;
  $('psSub').textContent = `${money(editing.balance)} in chips`;
  floatOnTile(editing, '+$1,000', 'pos');
  changed();
});
$('psRemove').addEventListener('click', () => {
  if (!editing || state.phase !== 'betting') return;
  if (!removeArmed) {
    removeArmed = true;
    $('psRemove').textContent = 'Tap again to remove';
    return;
  }
  state.players = state.players.filter((x) => x !== editing);
  if (state.activeId === editing.id) state.activeId = state.players[0]?.id ?? null;
  closePlayerSheet();
  renderPlayers();
  changed();
});
$('psName').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') $('psSave').click();
});

// ---------- Welcome & menu ----------

const nameRows = [];

function addNameRow(value = '') {
  if (nameRows.length >= MAX_PLAYERS) return;
  const row = document.createElement('div');
  row.className = 'nameRow';
  const dot = document.createElement('span');
  dot.className = 'dot';
  const input = document.createElement('input');
  input.className = 'field';
  input.maxLength = 16;
  input.autocomplete = 'off';
  input.autocapitalize = 'words';
  input.value = value;
  const x = document.createElement('button');
  x.className = 'x';
  x.textContent = '✕';
  x.setAttribute('aria-label', 'Remove');
  x.addEventListener('click', () => {
    if (nameRows.length <= 1) return;
    nameRows.splice(nameRows.indexOf(row), 1);
    row.remove();
    paintNameRows();
  });
  row.append(dot, input, x);
  row.input = input;
  row.dot = dot;
  nameRows.push(row);
  $('nameList').append(row);
  paintNameRows();
}

function paintNameRows() {
  nameRows.forEach((r, i) => {
    r.dot.style.background = COLORS[i];
    r.input.placeholder = `Player ${i + 1}`;
  });
  $('addNameBtn').style.display = nameRows.length >= MAX_PLAYERS ? 'none' : 'block';
}

$('addNameBtn').addEventListener('click', () => {
  addNameRow();
  nameRows[nameRows.length - 1].input.focus();
});

$('buyin').addEventListener('click', (e) => {
  const b = e.target.closest('button');
  if (!b) return;
  state.buyin = +b.dataset.v;
  [...$('buyin').children].forEach((x) => x.classList.toggle('sel', x === b));
});

function startGame(players) {
  sfx.unlock();
  state.players = players;
  state.activeId = players[0]?.id ?? null;
  state.phase = 'betting';
  state.lastBets = new Map();
  table.winning = null;
  sim.reset();
  wheel?.setFocus(false);
  $('result').classList.remove('show');
  $('welcome').classList.remove('show');
  renderPlayers();
  renderHistory();
  changed();
  sizeAll();
}

$('startBtn').addEventListener('click', () => {
  const players = nameRows.map((r, i) =>
    makePlayer(r.input.value.trim().slice(0, 16) || `Player ${i + 1}`, COLORS[i], state.buyin));
  state.history = [];
  startGame(players);
});

$('resumeBtn').addEventListener('click', () => {
  const s = loadSaved();
  if (!s) return;
  state.history = s.history || [];
  const players = s.players.map((p, i) => makePlayer(p.name, p.color || COLORS[i], p.balance));
  startGame(players);
  if (players[s.active]) selectPlayer(players[s.active].id);
});

$('menuBtn').addEventListener('click', () => $('menuSheet').classList.add('show'));
$('menuClose').addEventListener('click', () => $('menuSheet').classList.remove('show'));
$('newGameBtn').addEventListener('click', () => {
  if (state.phase === 'spinning') {
    toast('Wait for the ball to land');
    return;
  }
  $('menuSheet').classList.remove('show');
  $('resumeBtn').style.display = 'block';
  $('welcome').classList.add('show');
});

$('soundBtn').addEventListener('click', () => {
  state.sound = !state.sound;
  sfx.unlock();
  sfx.setEnabled(state.sound);
  $('soundWave').style.display = state.sound ? '' : 'none';
  save();
});
$('viewBtn').addEventListener('click', () => {
  state.topView = !state.topView;
  wheel?.setView(state.topView);
  save();
});

$('undoBtn').addEventListener('click', undo);
$('clearBtn').addEventListener('click', clearBets);
$('rebetBtn').addEventListener('click', rebet);
$('spinBtn').addEventListener('click', () => spin());
$('nextBtn').addEventListener('click', nextRound);

document.addEventListener('keydown', (e) => {
  if (e.target.tagName === 'INPUT') return;
  if (e.code === 'Space') {
    e.preventDefault();
    if (state.phase === 'result') nextRound();
    else spin();
  }
});
document.addEventListener('gesturestart', (e) => e.preventDefault());

function luminance(hex) {
  const n = parseInt(hex.slice(1), 16);
  return (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
}

// ---------- Sizing & loop ----------

function sizeAll() {
  const wr = $('wheelPane').getBoundingClientRect();
  wheel?.resize(wr.width, wr.height);
  const fr = $('felt').getBoundingClientRect();
  table.resize(fr.width, fr.height);
  tableDirty = true;
}
new ResizeObserver(sizeAll).observe($('stage'));
window.addEventListener('orientationchange', () => setTimeout(sizeAll, 250));

let last = performance.now();
function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  sim.update(dt);
  if (sim.state === 'spinning' && sim.ball) {
    sfx.roll(sim.ballSpeed(), Math.hypot(sim.ball.x, sim.ball.y) < GEO.rotorR);
  } else {
    sfx.roll(0, false);
  }
  wheel?.render(sim, dt);
  if (tableDirty || table.winning !== null) {
    table.draw(state.players, state.activeId, now);
    tableDirty = false;
  }
  requestAnimationFrame(frame);
}

// ---------- Boot ----------

const saved = loadSaved();
if (saved) {
  state.sound = saved.sound !== false;
  state.topView = !!saved.topView;
  state.chip = CHIPS.some((c) => c.v === saved.chip) ? saved.chip : 25;
  state.buyin = saved.buyin || 1000;
  $('resumeBtn').style.display = 'block';
  saved.players.forEach((p) => addNameRow(p.name));
} else {
  addNameRow();
  addNameRow();
}
[...$('buyin').children].forEach((x) => x.classList.toggle('sel', +x.dataset.v === state.buyin));
sfx.setEnabled(state.sound);
$('soundWave').style.display = state.sound ? '' : 'none';
wheel?.setView(state.topView);
renderChips();
renderPlayers();
renderHistory();
sizeAll();
bettingStatus();
requestAnimationFrame(frame);

