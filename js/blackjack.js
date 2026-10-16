// The iPad is the dealer: it deals and plays its own hand from a virtual
// shoe. Players hold real cards and, once the dealer finishes, tap whether
// each of their hands won, pushed or lost.
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const DECKS = 6;
const RESHUFFLE_AT = 52 * DECKS * 0.25;
const PAYOUT = { win: 2, push: 1, lose: 0, bj: 2.5 };
const OUTCOME_LABEL = { win: 'Win', push: 'Push', lose: 'Lose', bj: 'Blackjack' };

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
    this.dealerBJ = false;
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
    return seat.hands.reduce((t, h) => t + h.bet, 0) + (seat.insSettled ? 0 : seat.insurance);
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
    this.render();
  }

  removePlayer(id) {
    this.bets.delete(id);
    this.last.delete(id);
    this.seats = this.seats.filter((s) => s.p.id !== id);
  }

  primary() {
    if (this.phase === 'betting') this.deal();
    else if (this.phase === 'insurance') this.peek();
    else if (this.phase === 'play') this.dealerPlay();
    else if (this.phase === 'results') this.payOut();
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
      hands: [{ bet: this.bets.get(p.id), doubled: false, outcome: null }],
      insurance: 0,
      insSettled: false,
      insPaid: 0,
      net: null,
    }));
    this.bets.clear();
    this.dealer = [];
    this.holeHidden = true;
    this.dealerBJ = false;
    this.phase = 'dealing';
    this.ctx.onChange();
    await sleep(300);
    this.dealer.push(this.draw());
    this.render();
    await sleep(500);
    this.dealer.push(this.draw());
    this.render();
    await sleep(450);
    const up = this.dealer[0];
    if (up.r === 'A') {
      this.phase = 'insurance';
      this.ctx.onChange();
    } else if (isTen(up)) {
      this.peek();
    } else {
      this.phase = 'play';
      this.ctx.onChange();
    }
  }

  toggleInsurance(seat) {
    if (this.phase !== 'insurance') return;
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

  async peek() {
    this.phase = 'peek';
    this.ctx.onChange();
    await sleep(1000);
    this.dealerBJ = handValue(this.dealer).total === 21;
    for (const seat of this.seats) {
      seat.insSettled = true;
      if (seat.insurance && this.dealerBJ) {
        seat.insPaid = seat.insurance * 3;
        seat.p.balance += seat.insPaid;
      }
    }
    if (this.dealerBJ) {
      this.holeHidden = false;
      this.ctx.sfx.card();
      this.phase = 'results';
    } else {
      this.ctx.toast('Dealer does not have Blackjack');
      this.phase = 'play';
    }
    this.ctx.onChange();
  }

  double(seat, hand) {
    if (this.phase !== 'play' || hand.doubled) return;
    if (seat.p.balance < hand.bet) {
      this.ctx.toast(`${seat.p.name} needs ${this.ctx.money(hand.bet)} to double`);
      return;
    }
    seat.p.balance -= hand.bet;
    hand.bet *= 2;
    hand.doubled = true;
    this.ctx.sfx.chip();
    this.ctx.toast(`${seat.p.name} doubled. Take exactly one more card.`);
    this.ctx.onChange();
  }

  split(seat, hand) {
    if (this.phase !== 'play' || hand.doubled || seat.hands.length >= 4) return;
    if (seat.p.balance < hand.bet) {
      this.ctx.toast(`${seat.p.name} needs ${this.ctx.money(hand.bet)} to split`);
      return;
    }
    seat.p.balance -= hand.bet;
    seat.hands.splice(seat.hands.indexOf(hand) + 1, 0, { bet: hand.bet, doubled: false, outcome: null });
    this.ctx.sfx.chip();
    this.ctx.toast(`${seat.p.name} split. Play each hand on its own.`);
    this.ctx.onChange();
  }

  async dealerPlay() {
    this.phase = 'dealer';
    this.ctx.onChange();
    await sleep(500);
    this.holeHidden = false;
    this.ctx.sfx.card();
    this.render();
    while (handValue(this.dealer).total < 17) {
      await sleep(850);
      this.dealer.push(this.draw());
      this.render();
    }
    await sleep(400);
    this.phase = 'results';
    this.ctx.onChange();
  }

  canBlackjack(seat, hand) {
    return seat.hands.length === 1 && !hand.doubled;
  }

  outcomesFor(seat, hand) {
    if (this.dealerBJ) return ['push', 'lose'];
    return this.canBlackjack(seat, hand) ? ['bj', 'win', 'push', 'lose'] : ['win', 'push', 'lose'];
  }

  mark(hand, outcome) {
    if (this.phase !== 'results') return;
    hand.outcome = hand.outcome === outcome ? null : outcome;
    this.ctx.sfx.chip();
    this.render();
  }

  allMarked() {
    return this.seats.every((s) => s.hands.every((h) => h.outcome));
  }

  payOut() {
    if (!this.allMarked()) {
      this.ctx.toast('Every hand needs Win, Push or Lose first');
      return;
    }
    const { ctx } = this;
    let anyWin = false;
    for (const seat of this.seats) {
      let paid = seat.insPaid;
      for (const h of seat.hands) {
        h.paid = h.bet * PAYOUT[h.outcome];
        paid += h.paid;
      }
      seat.p.balance += paid - seat.insPaid;
      seat.net = paid - seat.hands.reduce((t, h) => t + h.bet, 0) - seat.insurance;
      if (seat.net > 0) anyWin = true;
      this.last.set(seat.p.id, seat.base);
      ctx.floatOnTile(seat.p, ctx.signed(seat.net), seat.net > 0 ? 'pos' : seat.net < 0 ? 'neg' : 'zero');
    }
    this.endMsg = 'Paid. Tap NEXT HAND or a betting circle to go again.';
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
    const d = handValue(this.dealer).total;
    switch (this.phase) {
      case 'betting': {
        const total = [...this.bets.values()].reduce((a, b) => a + b, 0);
        return total ? `${money(total)} bet · tap DEAL when everyone is in` : 'Pick a chip, then tap your betting circle';
      }
      case 'dealing': return 'Dealing…';
      case 'insurance': return 'Dealer shows an Ace. Deal 2 cards each, take insurance if you want it, then CONTINUE.';
      case 'peek': return 'Dealer checks for Blackjack…';
      case 'play': return 'Deal 2 cards each and play your hands. Double or split on your seat, then tap DEALER PLAYS.';
      case 'dealer': return 'Dealer plays…';
      case 'results':
        if (this.dealerBJ) return 'Dealer has Blackjack. Tap Push if you have Blackjack too, otherwise Lose.';
        return d > 21
          ? `Dealer busts with ${d}. Tap your result on every hand, then PAY OUT.`
          : `Dealer has ${d}. Tap your result on every hand, then PAY OUT.`;
      default: return this.endMsg;
    }
  }

  render() {
    if (!$('bjStage') || $('bjStage').hidden) return;
    this.renderDealer();
    $('bjMsg').textContent = this.message();
    $('bjShoe').textContent = `${this.shoe.length} cards`;
    this.renderSeats();

    const main = $('bjMain');
    const labels = { betting: 'DEAL', insurance: 'CONTINUE', play: 'DEALER PLAYS', results: 'PAY OUT', settled: 'NEXT HAND' };
    main.textContent = labels[this.phase] || 'DEALING';
    main.disabled = !labels[this.phase]
      || (this.phase === 'betting' && !this.bets.size)
      || (this.phase === 'results' && !this.allMarked());
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
      tot.textContent = v.soft && v.total < 21 && this.holeHidden === false && this.phase === 'dealer'
        ? `Soft ${v.total}` : String(v.total);
    }
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
    const { money, signed, state, luminance } = this.ctx;
    for (const p of state.players) {
      const seat = this.seats.find((s) => s.p === p);
      const s = el('div', 'seat');
      s.style.setProperty('--pc', p.color);
      s.classList.toggle('active', p.id === state.activeId);
      s.classList.toggle('out', this.phase !== 'betting' && !seat);
      s.classList.toggle('todo', this.phase === 'results' && !!seat && seat.hands.some((h) => !h.outcome));

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
        spot.append(amt ? chipEl(p.color, money(amt), luminance) : el('span', 'spot-label', 'BET'));
        spot.addEventListener('click', () => this.tapSpot(p));
        s.append(spot);
        box.append(s);
        continue;
      }
      if (!seat) {
        s.append(el('div', 'seat-note', 'Sitting out'));
        box.append(s);
        continue;
      }

      const hands = el('div', 'hands');
      seat.hands.forEach((h, i) => {
        const wrap = el('div', 'hand-wrap');
        const row = el('div', 'hand');
        row.append(chipEl(p.color, money(h.bet), luminance, true));
        const label = seat.hands.length > 1 ? `Hand ${i + 1}` : '';
        const note = [label, h.doubled ? 'Doubled' : ''].filter(Boolean).join(' · ');
        if (this.phase === 'settled') {
          row.append(el('span', `hres ${h.outcome}`, [note, OUTCOME_LABEL[h.outcome]].filter(Boolean).join(' · ')));
        } else if (note) {
          row.append(el('span', 'hres', note));
        }
        wrap.append(row);

        if (this.phase === 'play' && !h.doubled) {
          const acts = el('div', 'seat-tags');
          const dbl = el('button', 'tag', 'Double');
          dbl.addEventListener('click', () => this.double(seat, h));
          acts.append(dbl);
          if (seat.hands.length < 4) {
            const spl = el('button', 'tag', 'Split');
            spl.addEventListener('click', () => this.split(seat, h));
            acts.append(spl);
          }
          wrap.append(acts);
        }

        if (this.phase === 'results') {
          const seg = el('div', 'outcomes');
          for (const o of this.outcomesFor(seat, h)) {
            const b = el('button', `oc ${o}${h.outcome === o ? ' on' : ''}`, OUTCOME_LABEL[o]);
            b.addEventListener('click', () => this.mark(h, o));
            seg.append(b);
          }
          wrap.append(seg);
        }
        hands.append(wrap);
      });
      s.append(hands);

      if (this.phase === 'insurance') {
        const tags = el('div', 'seat-tags');
        const ins = el('button', `tag${seat.insurance ? ' on' : ''}`,
          seat.insurance ? `Insured ${money(seat.insurance)}` : `Insure ${money(Math.floor(seat.hands[0].bet / 2))}`);
        ins.addEventListener('click', () => this.toggleInsurance(seat));
        tags.append(ins);
        s.append(tags);
      } else if (seat.insurance && seat.insSettled && this.phase !== 'settled') {
        s.append(el('div', 'seat-note', seat.insPaid ? `Insurance paid ${money(seat.insPaid)}` : 'Insurance lost'));
      }
      if (this.phase === 'settled') {
        s.append(el('div', `seat-net ${seat.net > 0 ? 'pos' : seat.net < 0 ? 'neg' : 'zero'}`,
          seat.net === 0 ? 'Even' : signed(seat.net)));
      }
      box.append(s);
    }
  }
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
  const court = ['J', 'Q', 'K'].includes(c.r);
  const pip = el('div', `pip${court ? ' court' : ''}`, court ? c.r : c.s);
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
