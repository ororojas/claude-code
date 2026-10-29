// The iPad is the dealer. With real cards it plays only its own hand and
// players mark each hand's result; with virtual cards it deals everyone,
// runs each player's turn, and settles every hand itself.
const SUITS = ['♠', '♥', '♦', '♣'];
const RANKS = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
const DECKS = 6;
const RESHUFFLE_AT = 52 * DECKS * 0.25;
const PAYOUT = { win: 2, push: 1, lose: 0, bj: 2.5 };
const OUTCOME_LABEL = { win: 'Win', push: 'Push', lose: 'Lose', bj: 'Blackjack' };

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const $ = (id) => document.getElementById(id);
const isTen = (c) => c.r === '10' || c.r === 'J' || c.r === 'Q' || c.r === 'K';
const cardValue = (c) => (c.r === 'A' ? 11 : isTen(c) ? 10 : +c.r);

export function handValue(cards) {
  let total = 0;
  let aces = 0;
  for (const c of cards) {
    total += cardValue(c);
    if (c.r === 'A') aces++;
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

const newHand = (bet) => ({ bet, cards: [], doubled: false, outcome: null, done: false, splitAces: false });

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
    this.cur = null;
    this.endMsg = '';
    this.shoe = [];
    this.shuffle();
    $('bjMain').addEventListener('click', () => this.primary());
    $('bjClear').addEventListener('click', () => this.clearBet());
    $('bjRebet').addEventListener('click', () => this.rebet());
    $('bjCards').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (this.phase !== 'betting' && this.phase !== 'settled') {
        this.ctx.toast('Switch card mode between hands');
        return;
      }
      if (this.phase === 'settled') this.nextHand();
      this.ctx.state.bjVirtual = b.dataset.v === 'virtual';
      this.ctx.sfx.chip();
      this.ctx.onChange();
    });
  }

  get virtual() {
    return !!this.ctx.state.bjVirtual;
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
      hands: [newHand(this.bets.get(p.id))],
      insurance: 0,
      insSettled: false,
      insPaid: 0,
      net: null,
    }));
    this.bets.clear();
    this.dealer = [];
    this.holeHidden = true;
    this.dealerBJ = false;
    this.cur = null;
    this.phase = 'dealing';
    this.ctx.onChange();

    if (this.virtual) {
      for (let round = 0; round < 2; round++) {
        for (const seat of this.seats) {
          await sleep(280);
          seat.hands[0].cards.push(this.draw());
          this.render();
        }
        await sleep(280);
        this.dealer.push(this.draw());
        this.render();
      }
    } else {
      await sleep(300);
      this.dealer.push(this.draw());
      this.render();
      await sleep(500);
      this.dealer.push(this.draw());
      this.render();
    }
    await sleep(450);
    const up = this.dealer[0];
    if (up.r === 'A') {
      this.phase = 'insurance';
      this.ctx.onChange();
    } else if (isTen(up)) {
      this.peek();
    } else {
      this.afterPeek();
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
    if (!this.dealerBJ) {
      this.ctx.toast('Dealer does not have Blackjack');
      this.afterPeek();
      return;
    }
    this.holeHidden = false;
    this.ctx.sfx.card();
    if (this.virtual) {
      for (const seat of this.seats) {
        const h = seat.hands[0];
        h.outcome = this.isNatural(seat, h) ? 'push' : 'lose';
      }
      this.payOut('Dealer has Blackjack');
    } else {
      this.phase = 'results';
      this.ctx.onChange();
    }
  }

  afterPeek() {
    if (!this.virtual) {
      this.phase = 'play';
      this.ctx.onChange();
      return;
    }
    for (const seat of this.seats) {
      const h = seat.hands[0];
      if (this.isNatural(seat, h)) {
        h.outcome = 'bj';
        h.done = true;
        this.ctx.floatOnTile(seat.p, 'Blackjack!', 'pos');
      }
    }
    this.phase = 'turn';
    this.advance();
  }

  isNatural(seat, hand) {
    return seat.hands.length === 1 && hand.cards.length === 2 && handValue(hand.cards).total === 21;
  }

  // ---------- Real-card actions ----------

  double(seat, hand) {
    if (this.phase !== 'play' || hand.doubled) return;
    if (!this.takeExtra(seat, hand, 'double')) return;
    hand.bet *= 2;
    hand.doubled = true;
    this.ctx.toast(`${seat.p.name} doubled. Take exactly one more card.`);
    this.ctx.onChange();
  }

  split(seat, hand) {
    if (this.phase !== 'play' || hand.doubled || seat.hands.length >= 4) return;
    if (!this.takeExtra(seat, hand, 'split')) return;
    seat.hands.splice(seat.hands.indexOf(hand) + 1, 0, newHand(hand.bet));
    this.ctx.toast(`${seat.p.name} split. Play each hand on its own.`);
    this.ctx.onChange();
  }

  takeExtra(seat, hand, what) {
    if (seat.p.balance < hand.bet) {
      this.ctx.toast(`${seat.p.name} needs ${this.ctx.money(hand.bet)} to ${what}`);
      return false;
    }
    seat.p.balance -= hand.bet;
    this.ctx.sfx.chip();
    return true;
  }

  // ---------- Virtual-card turns ----------

  currentHand() {
    if (!this.cur) return null;
    const seat = this.seats[this.cur.si];
    return { seat, hand: seat.hands[this.cur.hi] };
  }

  nextTurn() {
    for (let si = 0; si < this.seats.length; si++) {
      const hi = this.seats[si].hands.findIndex((h) => !h.done);
      if (hi >= 0) return { si, hi };
    }
    return null;
  }

  advance() {
    this.cur = this.nextTurn();
    if (!this.cur) {
      this.dealerPlay();
      return;
    }
    this.ctx.select(this.seats[this.cur.si].p.id);
    this.ctx.onChange();
  }

  checkHand(hand) {
    const v = handValue(hand.cards).total;
    if (v > 21) {
      hand.outcome = 'lose';
      hand.done = true;
    } else if (v === 21) {
      hand.done = true;
    }
  }

  canDouble(seat, hand) {
    return hand.cards.length === 2 && !hand.splitAces && seat.p.balance >= hand.bet;
  }

  canSplit(seat, hand) {
    return hand.cards.length === 2 && seat.hands.length < 4 && seat.p.balance >= hand.bet
      && cardValue(hand.cards[0]) === cardValue(hand.cards[1]);
  }

  hit() {
    const { hand } = this.currentHand();
    hand.cards.push(this.draw());
    this.checkHand(hand);
    this.advance();
  }

  stand() {
    const { hand } = this.currentHand();
    hand.done = true;
    this.ctx.sfx.chip();
    this.advance();
  }

  vDouble() {
    const { seat, hand } = this.currentHand();
    if (!this.canDouble(seat, hand) || !this.takeExtra(seat, hand, 'double')) return;
    hand.bet *= 2;
    hand.doubled = true;
    hand.cards.push(this.draw());
    this.checkHand(hand);
    hand.done = true;
    this.advance();
  }

  async vSplit() {
    const { seat, hand } = this.currentHand();
    if (!this.canSplit(seat, hand) || !this.takeExtra(seat, hand, 'split')) return;
    const second = newHand(hand.bet);
    second.cards.push(hand.cards.pop());
    seat.hands.splice(seat.hands.indexOf(hand) + 1, 0, second);
    const aces = hand.cards[0].r === 'A';
    this.phase = 'splitting';
    this.ctx.onChange();
    for (const h of [hand, second]) {
      await sleep(320);
      h.cards.push(this.draw());
      h.splitAces = aces;
      if (aces) h.done = true;
      else this.checkHand(h);
      this.render();
    }
    this.phase = 'turn';
    this.advance();
  }

  // ---------- Dealer & settlement ----------

  async dealerPlay() {
    this.phase = 'dealer';
    this.cur = null;
    this.ctx.onChange();
    await sleep(500);
    this.holeHidden = false;
    this.ctx.sfx.card();
    this.render();
    const live = !this.virtual || this.seats.some((s) => s.hands.some((h) => !h.outcome));
    if (live) {
      while (handValue(this.dealer).total < 17) {
        await sleep(850);
        this.dealer.push(this.draw());
        this.render();
      }
    }
    await sleep(400);
    if (!this.virtual) {
      this.phase = 'results';
      this.ctx.onChange();
      return;
    }
    const d = handValue(this.dealer).total;
    for (const seat of this.seats) {
      for (const h of seat.hands) {
        if (h.outcome) continue;
        const v = handValue(h.cards).total;
        h.outcome = d > 21 || v > d ? 'win' : v === d ? 'push' : 'lose';
      }
    }
    this.payOut(!live ? `Dealer shows ${d}` : d > 21 ? `Dealer busts with ${d}` : `Dealer stands on ${d}`);
  }

  outcomesFor(seat, hand) {
    if (this.dealerBJ) return ['push', 'lose'];
    return seat.hands.length === 1 && !hand.doubled ? ['bj', 'win', 'push', 'lose'] : ['win', 'push', 'lose'];
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

  payOut(msg = 'Paid. Tap NEXT HAND or a betting circle to go again.') {
    if (!this.allMarked()) {
      this.ctx.toast('Every hand needs Win, Push or Lose first');
      return;
    }
    const { ctx } = this;
    let anyWin = false;
    for (const seat of this.seats) {
      let paid = 0;
      for (const h of seat.hands) {
        h.paid = h.bet * PAYOUT[h.outcome];
        paid += h.paid;
      }
      seat.p.balance += paid;
      seat.net = paid + seat.insPaid - seat.hands.reduce((t, h) => t + h.bet, 0) - seat.insurance;
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
    this.cur = null;
    this.phase = 'betting';
    this.ctx.onChange();
  }

  // ---------- Rendering ----------

  message() {
    const { money } = this.ctx;
    const d = handValue(this.dealer).total;
    const v = this.virtual;
    switch (this.phase) {
      case 'betting': {
        const total = [...this.bets.values()].reduce((a, b) => a + b, 0);
        return total ? `${money(total)} bet · tap DEAL when everyone is in` : 'Pick a chip, then tap your betting circle';
      }
      case 'dealing': return 'Dealing…';
      case 'insurance':
        return v
          ? 'Dealer shows an Ace. Take insurance on your seat if you want it, then CONTINUE.'
          : 'Dealer shows an Ace. Deal 2 cards each, take insurance if you want it, then CONTINUE.';
      case 'peek': return 'Dealer checks for Blackjack…';
      case 'play': return 'Deal 2 cards each and play your hands. Double or split on your seat, then tap DEALER PLAYS.';
      case 'turn':
      case 'splitting': {
        const cur = this.currentHand();
        return cur ? `${cur.seat.p.name}'s turn` : '';
      }
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
    for (const b of $('bjCards').children) b.classList.toggle('sel', (b.dataset.v === 'virtual') === this.virtual);
    $('bjCards').classList.toggle('locked', this.busy());
    $('bjStage').classList.toggle('dealt', this.virtual && this.phase !== 'betting');
    this.renderDealer();
    $('bjMsg').textContent = this.message();
    $('bjShoe').textContent = `${this.shoe.length} cards`;
    this.renderPanel();
    this.renderSeats();

    const main = $('bjMain');
    const labels = { betting: 'DEAL', insurance: 'CONTINUE', play: 'DEALER PLAYS', results: 'PAY OUT', settled: 'NEXT HAND' };
    main.textContent = labels[this.phase] || (this.phase === 'turn' || this.phase === 'splitting' ? 'IN PLAY' : 'DEALING');
    main.disabled = !labels[this.phase]
      || (this.phase === 'betting' && !this.bets.size)
      || (this.phase === 'results' && !this.allMarked());
    const p = this.ctx.active();
    $('bjClear').disabled = this.phase !== 'betting' || !p || !this.bets.get(p.id);
    $('bjRebet').disabled = this.phase !== 'betting' || !this.last.size;
  }

  renderDealer() {
    syncCards($('bjDealerCards'), this.dealer, (i) => i === 1 && this.holeHidden);
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
      tot.textContent = String(v.total);
    }
  }

  renderPanel() {
    const panel = $('bjPanel');
    const cur = this.phase === 'turn' && this.currentHand();
    panel.hidden = !cur;
    panel.textContent = '';
    if (!cur) return;
    const { seat, hand } = cur;
    const { money } = this.ctx;
    panel.style.setProperty('--pc', seat.p.color);
    const head = el('div', 'turn-head');
    head.append(this.avatar(seat.p));
    const who = el('div', 'turn-who');
    who.append(el('b', '', seat.p.name));
    const n = seat.hands.length;
    who.append(el('span', '', `${n > 1 ? `Hand ${this.cur.hi + 1} of ${n} · ` : ''}${money(hand.bet)} bet`));
    head.append(who);
    const v = handValue(hand.cards);
    head.append(el('div', 'turn-total', `${v.soft && v.total < 21 ? 'Soft ' : ''}${v.total}`));
    const acts = el('div', 'turn-acts');
    const add = (label, cls, fn, ok = true) => {
      const b = el('button', `big ${cls}`, label);
      b.disabled = !ok;
      b.addEventListener('click', fn);
      acts.append(b);
    };
    add('Hit', 'hit', () => this.hit());
    add('Stand', 'stand', () => this.stand());
    if (hand.cards.length === 2 && !hand.splitAces) add(`Double +${money(hand.bet)}`, 'dbl', () => this.vDouble(), this.canDouble(seat, hand));
    if (hand.cards.length === 2 && cardValue(hand.cards[0]) === cardValue(hand.cards[1])) {
      add('Split', 'spl', () => this.vSplit(), this.canSplit(seat, hand));
    }
    panel.append(head, acts);
  }

  avatar(p) {
    const a = el('span', 'pchip', (p.name.trim()[0] || '?').toUpperCase());
    a.style.setProperty('--pc', p.color);
    a.style.color = this.ctx.luminance(p.color) > 0.6 ? '#1b1b1b' : '#fff';
    return a;
  }

  renderSeats() {
    const box = $('bjSeats');
    const { money, signed, state, luminance } = this.ctx;
    const keep = new Map([...box.querySelectorAll('.hcards')].map((c) => [c.dataset.key, c]));
    box.textContent = '';
    for (const p of state.players) {
      const seat = this.seats.find((s) => s.p === p);
      const turnSeat = this.cur && this.seats[this.cur.si] === seat;
      const s = el('div', 'seat');
      s.style.setProperty('--pc', p.color);
      s.classList.toggle('active', p.id === state.activeId);
      s.classList.toggle('turn', !!turnSeat && this.phase === 'turn');
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
        wrap.classList.toggle('cur', !!turnSeat && this.cur.hi === i && this.phase === 'turn');
        if (this.virtual) {
          const key = `${p.id}:${i}`;
          const cards = keep.get(key) || el('div', 'hcards');
          cards.dataset.key = key;
          syncCards(cards, h.cards, () => false);
          wrap.append(cards);
        }
        const row = el('div', 'hand');
        row.append(chipEl(p.color, money(h.bet), luminance, true));
        const bits = [];
        if (this.virtual && h.cards.length) {
          const v = handValue(h.cards).total;
          bits.push(this.isNatural(seat, h) ? 'Blackjack' : v > 21 ? `Bust ${v}` : String(v));
        } else if (seat.hands.length > 1) {
          bits.push(`Hand ${i + 1}`);
        }
        if (h.doubled) bits.push('Doubled');
        if (this.phase === 'settled' && !(this.virtual && h.outcome === 'bj')) bits.push(OUTCOME_LABEL[h.outcome]);
        if (bits.length) row.append(el('span', `hres ${this.phase === 'settled' ? h.outcome : ''}`, bits.join(' · ')));
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

// Adds cards that are new since the last render so only those animate in.
function syncCards(box, cards, faceDown) {
  while (box.children.length > cards.length) box.lastChild.remove();
  cards.forEach((c, i) => {
    let card = box.children[i];
    if (!card || card.getAttribute('aria-label') !== `${c.r}${c.s}`) {
      while (box.children.length > i) box.lastChild.remove();
      card = cardEl(c);
      card.style.setProperty('--tilt', `${(i % 2 ? 1 : -1) * (1 + randInt(3))}deg`);
      box.append(card);
    }
    card.classList.toggle('down', faceDown(i));
  });
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
