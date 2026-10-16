// The iPad is the dealer: it deals and plays its own hand from a virtual
// shoe, while players are dealt real cards and report their final totals.
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const DECKS = 6;
const RESHUFFLE_AT = 52 * DECKS * 0.25;
const RESULTS = ['bust', 'low', 17, 18, 19, 20, 21];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);
const isTen = (c) => c.r === '10' || c.r === 'J' || c.r === 'Q' || c.r === 'K';

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    if (c.r === 'A') {
      total += 11;
      aces++;
    } else {
      total += isTen(c) ? 10 : +c.r;
    }
  }
  while (total > 21 && aces) {
    total -= 10;
    aces--;
  }
  return { total, soft: aces > 0 };
}

function randInt(n) {
  const buf = new Uint32Array(1);
  const lim = Math.floor(0x100000000 / n) * n;
  do crypto.getRandomValues(buf); while (buf[0] >= lim);
  return buf[0] % n;
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
}

export class Blackjack {
  constructor(ctx) {
    this.ctx = ctx;
    this.phase = 'betting';
    this.bets = new Map();
    this.last = new Map();
    this.seats = [];
    this.dealer = [];
    this.holeHidden = true;
    this.cur = null;
    this.endMsg = '';
    this.shoe = [];
    this.shuffle();
    $('bjMain').addEventListener('click', () => this.primary());
    $('bjClear').addEventListener('click', () => this.clearBet());
    $('bjRebet').addEventListener('click', () => this.rebet());
  }

  shuffle() {
    const s = [];
    for (let d = 0; d < DECKS; d++) for (const suit of SUITS) for (const r of RANKS) s.push({ r, s: suit });
    for (let i = s.length - 1; i > 0; i--) {
      const j = randInt(i + 1);
      [s[i], s[j]] = [s[j], s[i]];
    }
    this.shoe = s;
  }

  draw() {
    this.ctx.sfx.card();
    return this.shoe.pop();
  }

  staked(p) {
    if (this.phase === 'betting') return this.bets.get(p.id) || 0;
    if (this.phase === 'settled') return 0;
    const seat = this.seats.find((s) => s.p === p);
    if (!seat) return 0;
    return seat.hands.reduce((t, h) => t + (h.outcome ? 0 : h.bet), 0) + (seat.insSettled ? 0 : seat.insurance);
  }

  busy() {
    return this.phase !== 'betting' && this.phase !== 'settled';
  }

  reset() {
    this.phase = 'betting';
    this.bets.clear();
    this.last.clear();
    this.seats = [];
    this.dealer = [];
    this.cur = null;
    this.render();
  }

  removePlayer(id) {
    this.bets.delete(id);
    this.last.delete(id);
    this.seats = this.seats.filter((s) => s.p.id !== id);
  }

  primary() {
    if (this.phase === 'betting') this.deal();
    else if (this.phase === 'check') this.resolveCheck();
    else if (this.phase === 'settled') this.nextHand();
  }

  // ---------- Betting ----------

  tapSpot(p) {
    const { ctx } = this;
    ctx.select(p.id);
    if (this.phase === 'settled') this.nextHand();
    if (this.phase !== 'betting') return;
    if (p.balance <= 0) {
      ctx.toast(`${p.name} is out of chips`);
      return;
    }
    const amt = Math.min(ctx.chipAmount(p), p.balance);
    p.balance -= amt;
    this.bets.set(p.id, (this.bets.get(p.id) || 0) + amt);
    ctx.sfx.chip();
    ctx.chipUsed();
    ctx.onChange();
  }

  clearBet() {
    const p = this.ctx.active();
    const amt = p && this.bets.get(p.id);
    if (!amt) return;
    p.balance += amt;
    this.bets.delete(p.id);
    this.ctx.sfx.chip();
    this.ctx.onChange();
  }

  rebet() {
    let placed = 0;
    for (const p of this.ctx.state.players) {
      const want = this.last.get(p.id);
      if (!want || this.bets.get(p.id) || p.balance <= 0) continue;
      const amt = Math.min(want, p.balance);
      p.balance -= amt;
      this.bets.set(p.id, amt);
      placed++;
    }
    if (!placed) {
      this.ctx.toast('Nothing to rebet');
      return;
    }
    this.ctx.sfx.chip();
    this.ctx.onChange();
  }

  // ---------- Round flow ----------

  async deal() {
    const players = this.ctx.state.players.filter((p) => this.bets.get(p.id));
    if (!players.length) {
      this.ctx.toast('Tap a betting circle to place a bet first');
      return;
    }
    this.ctx.sfx.unlock();
    if (this.shoe.length < RESHUFFLE_AT) {
      this.shuffle();
      this.ctx.toast('New shoe shuffled');
    }
    this.seats = players.map((p) => ({
      p,
      base: this.bets.get(p.id),
      hands: [this.newHand(this.bets.get(p.id))],
      natural: false,
      insurance: 0,
      insSettled: false,
      insPaid: 0,
      net: null,
    }));
    this.bets.clear();
    this.dealer = [];
    this.holeHidden = true;
    this.phase = 'dealing';
    this.render();
    await sleep(300);
    this.dealer.push(this.draw());
    this.render();
    await sleep(500);
    this.dealer.push(this.draw());
    this.render();
    await sleep(450);
    this.phase = 'check';
    this.ctx.onChange();
  }

  newHand(bet) {
    return { bet, result: null, doubled: false, acted: false, outcome: null, paid: 0 };
  }

  toggleNatural(seat) {
    if (this.phase !== 'check') return;
    seat.natural = !seat.natural;
    this.ctx.sfx.chip();
    this.render();
  }

  toggleInsurance(seat) {
    if (this.phase !== 'check') return;
    const p = seat.p;
    if (seat.insurance) {
      p.balance += seat.insurance;
      seat.insurance = 0;
    } else {
      const amt = Math.floor(seat.hands[0].bet / 2);
      if (!amt || p.balance < amt) {
        this.ctx.toast(`${p.name} needs ${this.ctx.money(amt)} for insurance`);
        return;
      }
      p.balance -= amt;
      seat.insurance = amt;
    }
    this.ctx.sfx.chip();
    this.ctx.onChange();
  }

  async resolveCheck() {
    const up = this.dealer[0];
    const peek = up.r === 'A' || isTen(up);
    const dealerBJ = handValue(this.dealer).total === 21;
    this.phase = 'peek';
    this.render();
    if (peek) await sleep(1000);

    for (const seat of this.seats) {
      seat.insSettled = true;
      if (seat.insurance && dealerBJ) {
        seat.insPaid = seat.insurance * 3;
        seat.p.balance += seat.insPaid;
      }
    }

    if (peek && dealerBJ) {
      this.holeHidden = false;
      this.ctx.sfx.card();
      for (const seat of this.seats) {
        const h = seat.hands[0];
        h.result = seat.natural ? 'bj' : 'lose';
        h.outcome = seat.natural ? 'push' : 'lose';
        h.paid = seat.natural ? h.bet : 0;
        seat.p.balance += h.paid;
      }
      this.finish('Dealer has Blackjack');
      return;
    }

    for (const seat of this.seats) {
      if (!seat.natural) continue;
      const h = seat.hands[0];
      h.result = 'bj';
      h.outcome = 'bj';
      h.paid = h.bet * 2.5;
      seat.p.balance += h.paid;
      this.ctx.floatOnTile(seat.p, `Blackjack +${this.ctx.money(h.bet * 1.5)}`, 'pos');
    }
    this.phase = 'playing';
    this.cur = this.nextOpen();
    if (peek) this.ctx.toast('Dealer does not have Blackjack');
    if (!this.cur) {
      this.dealerPlay();
      return;
    }
    this.ctx.select(this.seats[this.cur.si].p.id);
    this.ctx.onChange();
  }

  nextOpen() {
    for (let si = 0; si < this.seats.length; si++) {
      const hi = this.seats[si].hands.findIndex((h) => h.result === null);
      if (hi >= 0) return { si, hi };
    }
    return null;
  }

  currentHand() {
    if (!this.cur) return null;
    const seat = this.seats[this.cur.si];
    return { seat, hand: seat.hands[this.cur.hi] };
  }

  double() {
    const { seat, hand } = this.currentHand();
    if (hand.acted) return;
    if (seat.p.balance < hand.bet) {
      this.ctx.toast(`${seat.p.name} needs ${this.ctx.money(hand.bet)} to double`);
      return;
    }
    seat.p.balance -= hand.bet;
    hand.bet *= 2;
    hand.doubled = true;
    hand.acted = true;
    this.ctx.sfx.chip();
    this.ctx.toast('Doubled. Take exactly one more card.');
    this.ctx.onChange();
  }

  split() {
    const { seat, hand } = this.currentHand();
    if (hand.acted || seat.hands.length >= 4) return;
    if (seat.p.balance < hand.bet) {
      this.ctx.toast(`${seat.p.name} needs ${this.ctx.money(hand.bet)} to split`);
      return;
    }
    seat.p.balance -= hand.bet;
    seat.hands.splice(this.cur.hi + 1, 0, this.newHand(hand.bet));
    this.ctx.sfx.chip();
    this.ctx.toast('Split. Deal one more card to each hand.');
    this.ctx.onChange();
  }

  setResult(r) {
    const { hand } = this.currentHand();
    hand.result = r;
    this.ctx.sfx.chip();
    this.cur = this.nextOpen();
    if (this.cur) {
      this.ctx.select(this.seats[this.cur.si].p.id);
      this.ctx.onChange();
    } else {
      this.dealerPlay();
    }
  }

  async dealerPlay() {
    this.phase = 'dealer';
    this.cur = null;
    this.ctx.onChange();
    await sleep(600);
    this.holeHidden = false;
    this.ctx.sfx.card();
    this.render();
    const live = this.seats.some((s) => s.hands.some((h) => !h.outcome && h.result !== 'bust'));
    if (live) {
      while (handValue(this.dealer).total < 17) {
        await sleep(850);
        this.dealer.push(this.draw());
        this.render();
      }
    }
    await sleep(600);
    this.settle(live);
  }

  settle(live) {
    const d = handValue(this.dealer).total;
    const dBust = d > 21;
    for (const seat of this.seats) {
      for (const h of seat.hands) {
        if (h.outcome) continue;
        const v = h.result === 'low' ? 16 : h.result;
        if (h.result === 'bust') h.outcome = 'lose';
        else if (dBust || v > d) h.outcome = 'win';
        else if (v === d) h.outcome = 'push';
        else h.outcome = 'lose';
        h.paid = h.outcome === 'win' ? h.bet * 2 : h.outcome === 'push' ? h.bet : 0;
        seat.p.balance += h.paid;
      }
    }
    const msg = !live ? `Dealer shows ${d}` : dBust ? `Dealer busts with ${d}` : `Dealer stands on ${d}`;
    this.finish(msg);
  }

  finish(msg) {
    const { ctx } = this;
    let anyWin = false;
    for (const seat of this.seats) {
      const staked = seat.hands.reduce((t, h) => t + h.bet, 0) + seat.insurance;
      const paid = seat.hands.reduce((t, h) => t + h.paid, 0) + seat.insPaid;
      seat.net = paid - staked;
      if (seat.net > 0) anyWin = true;
      this.last.set(seat.p.id, seat.base);
      ctx.floatOnTile(seat.p, ctx.signed(seat.net), seat.net > 0 ? 'pos' : seat.net < 0 ? 'neg' : 'zero');
    }
    this.endMsg = msg;
    this.phase = 'settled';
    if (anyWin) ctx.sfx.win();
    ctx.onChange();
  }

  nextHand() {
    this.seats = [];
    this.dealer = [];
    this.phase = 'betting';
    this.ctx.onChange();
  }

  // ---------- Rendering ----------

  message() {
    const { money } = this.ctx;
    switch (this.phase) {
      case 'betting': {
        const total = [...this.bets.values()].reduce((a, b) => a + b, 0);
        return total ? `${money(total)} bet · tap DEAL when everyone is in` : 'Pick a chip, then tap your betting circle';
      }
      case 'dealing': return 'Dealing…';
      case 'check':
        return this.dealer[0].r === 'A'
          ? 'Deal 2 cards to each player. Dealer shows an Ace: insurance is open.'
          : 'Deal 2 cards to each player. Got Blackjack? Tap it on your seat.';
      case 'peek': return 'Dealer checks for Blackjack…';
      case 'playing': {
        const { seat } = this.currentHand();
        return `${seat.p.name}, play your cards and tap your total`;
      }
      case 'dealer': return 'Dealer plays…';
      default: return this.endMsg;
    }
  }

  render() {
    if (!$('bjStage') || $('bjStage').hidden) return;
    this.renderDealer();
    $('bjMsg').textContent = this.message();
    $('bjShoe').textContent = `${this.shoe.length} cards`;
    this.renderPanel();
    this.renderSeats();

    const main = $('bjMain');
    const labels = { betting: 'DEAL', check: 'CONTINUE', settled: 'NEXT HAND' };
    main.textContent = labels[this.phase] || 'DEAL';
    main.disabled = !labels[this.phase] || (this.phase === 'betting' && !this.bets.size);
    const p = this.ctx.active();
    $('bjClear').disabled = this.phase !== 'betting' || !p || !this.bets.get(p.id);
    $('bjRebet').disabled = this.phase !== 'betting' || !this.last.size;
  }

  renderDealer() {
    const box = $('bjDealerCards');
    while (box.children.length > this.dealer.length) box.lastChild.remove();
    this.dealer.forEach((c, i) => {
      let card = box.children[i];
      if (!card) {
        card = cardEl(c);
        card.style.setProperty('--tilt', `${(i % 2 ? 1 : -1) * (1 + randInt(3))}deg`);
        box.append(card);
      }
      card.classList.toggle('down', i === 1 && this.holeHidden);
    });
    const tot = $('bjDealerTotal');
    if (!this.dealer.length) {
      tot.textContent = '';
      tot.hidden = true;
      return;
    }
    const shown = this.holeHidden ? [this.dealer[0]] : this.dealer;
    const v = handValue(shown);
    tot.hidden = false;
    tot.className = 'bj-total';
    if (!this.holeHidden && this.dealer.length === 2 && v.total === 21) {
      tot.textContent = 'Blackjack';
      tot.classList.add('bj');
    } else if (v.total > 21) {
      tot.textContent = `Bust ${v.total}`;
      tot.classList.add('bust');
    } else {
      tot.textContent = v.soft && v.total < 21 && !(this.phase === 'settled') ? `Soft ${v.total}` : String(v.total);
    }
  }

  renderPanel() {
    const panel = $('bjPanel');
    panel.textContent = '';
    panel.hidden = this.phase !== 'playing' || !this.cur;
    if (panel.hidden) return;
    const { seat, hand } = this.currentHand();
    const { money } = this.ctx;
    panel.style.setProperty('--pc', seat.p.color);

    const head = el('div', 'turn-head');
    head.append(this.avatar(seat.p));
    const who = el('div', 'turn-who');
    who.append(el('b', '', seat.p.name));
    const n = seat.hands.length;
    who.append(el('span', '', `${n > 1 ? `Hand ${this.cur.hi + 1} of ${n} · ` : ''}${money(hand.bet)} bet${hand.doubled ? ' (doubled)' : ''}`));
    head.append(who);
    const acts = el('div', 'turn-acts');
    if (!hand.acted) {
      const dbl = el('button', 'pill', `Double +${money(hand.bet)}`);
      dbl.addEventListener('click', () => this.double());
      const spl = el('button', 'pill', 'Split');
      spl.disabled = n >= 4;
      spl.addEventListener('click', () => this.split());
      acts.append(dbl, spl);
    }
    head.append(acts);

    const pad = el('div', 'keypad');
    for (const r of RESULTS) {
      const label = r === 'bust' ? 'Bust' : r === 'low' ? '16 or less' : String(r);
      const k = el('button', `key${r === 'bust' ? ' bust' : r === 'low' ? ' low' : ''}`, label);
      k.addEventListener('click', () => this.setResult(r));
      pad.append(k);
    }
    panel.append(head, pad);
  }

  avatar(p) {
    const a = el('span', 'pchip', (p.name.trim()[0] || '?').toUpperCase());
    a.style.setProperty('--pc', p.color);
    a.style.color = this.ctx.luminance(p.color) > 0.6 ? '#1b1b1b' : '#fff';
    return a;
  }

  renderSeats() {
    const box = $('bjSeats');
    box.textContent = '';
    const { money, signed, state } = this.ctx;
    for (const p of state.players) {
      const seat = this.seats.find((s) => s.p === p);
      const isTurn = this.cur && this.seats[this.cur.si] === seat;
      const s = el('div', 'seat');
      s.style.setProperty('--pc', p.color);
      s.classList.toggle('active', p.id === state.activeId);
      s.classList.toggle('turn', !!isTurn);
      s.classList.toggle('out', this.phase !== 'betting' && !seat);

      const head = el('button', 'seat-head');
      head.append(this.avatar(p));
      const info = el('div');
      info.append(el('div', 'pname', p.name), el('div', 'pbal', money(p.balance)));
      head.append(info);
      head.addEventListener('click', () => this.ctx.select(p.id));
      s.append(head);

      if (this.phase === 'betting') {
        const amt = this.bets.get(p.id) || 0;
        const spot = el('button', `spot${amt ? ' filled' : ''}`);
        spot.setAttribute('aria-label', `Bet for ${p.name}`);
        spot.append(amt ? chipEl(p.color, money(amt), this.ctx.luminance) : el('span', 'spot-label', 'BET'));
        spot.addEventListener('click', () => this.tapSpot(p));
        s.append(spot);
      } else if (!seat) {
        s.append(el('div', 'seat-note', 'Sitting out'));
      } else {
        const hands = el('div', 'hands');
        seat.hands.forEach((h, i) => {
          const row = el('div', 'hand');
          row.classList.toggle('cur', isTurn && this.cur.hi === i);
          row.append(chipEl(p.color, money(h.bet), this.ctx.luminance, true));
          row.append(el('span', `hres ${h.outcome || ''}`, handLabel(h, this.phase)));
          hands.append(row);
        });
        s.append(hands);
        if (this.phase === 'check') {
          const tags = el('div', 'seat-tags');
          const bj = el('button', `tag${seat.natural ? ' on' : ''}`, 'Blackjack!');
          bj.addEventListener('click', () => this.toggleNatural(seat));
          tags.append(bj);
          if (this.dealer[0]?.r === 'A') {
            const ins = el('button', `tag${seat.insurance ? ' on' : ''}`,
              seat.insurance ? `Insured ${money(seat.insurance)}` : `Insure ${money(Math.floor(seat.hands[0].bet / 2))}`);
            ins.addEventListener('click', () => this.toggleInsurance(seat));
            tags.append(ins);
          }
          s.append(tags);
        } else if (seat.insurance && seat.insSettled && this.phase !== 'settled') {
          s.append(el('div', 'seat-note', seat.insPaid ? 'Insurance paid' : 'Insurance lost'));
        }
        if (this.phase === 'settled') {
          s.append(el('div', `seat-net ${seat.net > 0 ? 'pos' : seat.net < 0 ? 'neg' : 'zero'}`,
            seat.net === 0 ? 'Push' : signed(seat.net)));
        }
      }
      box.append(s);
    }
  }
}

function handLabel(h, phase) {
  const r = h.result;
  const base = r === null ? (phase === 'playing' ? 'Playing…' : 'Your cards') : r === 'bj' ? 'Blackjack' : r === 'bust' ? 'Bust' : r === 'low' ? '16 or less' : r === 'lose' ? '' : String(r);
  const out = { win: 'Win', push: 'Push', lose: 'Lose', bj: 'Paid 3:2' }[h.outcome];
  return out ? [base, out].filter(Boolean).join(' · ') : base;
}

function cardEl(c) {
  const red = c.s === '♥' || c.s === '♦';
  const card = el('div', `card deal${red ? ' red' : ''}`);
  const inner = el('div', 'card-inner');
  const face = el('div', 'card-face');
  const tl = el('div', 'idx');
  tl.append(el('b', '', c.r), el('i', '', c.s));
  const br = tl.cloneNode(true);
  br.classList.add('br');
  const pip = el('div', 'pip', ['J', 'Q', 'K'].includes(c.r) ? c.r : c.s);
  if (['J', 'Q', 'K'].includes(c.r)) pip.classList.add('court');
  face.append(tl, pip, br);
  inner.append(face, el('div', 'card-back'));
  card.append(inner);
  card.setAttribute('aria-label', `${c.r}${c.s}`);
  return card;
}

function chipEl(color, label, luminance, small = false) {
  const c = el('span', `bjchip${small ? ' sm' : ''}`, label);
  c.style.setProperty('--pc', color);
  c.style.color = luminance(color) > 0.6 ? '#1b1b1b' : '#fff';
  return c;
}
