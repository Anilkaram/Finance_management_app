/* ============================================================
   Paisa Book — personal finance tracker (INR)
   Spends · Credit cards · Friend ledger · Recurring bills
   All data lives on-device in localStorage. No network calls.
   ============================================================ */

const KEY = 'paisabook.v1';

const DEFAULT_CATS = [
  { id: 'food',     name: 'Food & Dining',    color: '#ff8a5c', kind: 'expense' },
  { id: 'grocery',  name: 'Groceries',        color: '#35c07f', kind: 'expense' },
  { id: 'travel',   name: 'Travel & Fuel',    color: '#4f9dff', kind: 'expense' },
  { id: 'shopping', name: 'Shopping',         color: '#a78bfa', kind: 'expense' },
  { id: 'bills',    name: 'Bills & Utilities',color: '#f5a524', kind: 'expense' },
  { id: 'rent',     name: 'Rent',             color: '#e05c8a', kind: 'expense' },
  { id: 'health',   name: 'Health',           color: '#4ecdc4', kind: 'expense' },
  { id: 'ent',      name: 'Entertainment',    color: '#ffd166', kind: 'expense' },
  { id: 'emi',      name: 'EMI & Loans',      color: '#ff5f6d', kind: 'expense' },
  { id: 'other',    name: 'Other',            color: '#8b93a7', kind: 'expense' }
];

/* Money coming in needs its own categories — filing a salary under "Food & Dining" is useless. */
const INCOME_CATS = [
  { id: 'salary',   name: 'Salary',              color: '#35c07f', kind: 'income' },
  { id: 'business', name: 'Business & Freelance',color: '#4f9dff', kind: 'income' },
  { id: 'interest', name: 'Interest & Dividends',color: '#a78bfa', kind: 'income' },
  { id: 'refund',   name: 'Refund & Cashback',   color: '#4ecdc4', kind: 'income' },
  { id: 'rentin',   name: 'Rent received',       color: '#f5a524', kind: 'income' },
  { id: 'gift',     name: 'Gift',                color: '#e05c8a', kind: 'income' },
  { id: 'otherin',  name: 'Other income',        color: '#8b93a7', kind: 'income' }
];
const catsFor = kind => S.cats.filter(c => (c.kind || 'expense') === kind);

const clone = o => JSON.parse(JSON.stringify(o));   // avoids structuredClone on older WebViews

const BLANK = { v: 1, cats: DEFAULT_CATS.concat(INCOME_CATS), txns: [], cards: [], cardEvents: [], people: [], ledger: [], bills: [] };

let S = load();
let tab = 'home';
let cur = ymOf(new Date());          // month being viewed, 'YYYY-MM'
let srcFilter = 'all';               // spends screen filter

/* ---------------- persistence ---------------- */
function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return clone(BLANK);
    const d = JSON.parse(raw);
    for (const k in BLANK) if (d[k] === undefined) d[k] = clone(BLANK[k]);
    if (!d.cats || !d.cats.length) d.cats = clone(DEFAULT_CATS);
    d.cats.forEach(c => { if (!c.kind) c.kind = 'expense'; });
    INCOME_CATS.forEach(ic => { if (!d.cats.some(c => c.id === ic.id)) d.cats.push(clone(ic)); });
    return d;
  } catch (e) {
    console.error('load failed', e);
    return clone(BLANK);
  }
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); }
  catch (e) { toast('Could not save — storage full?'); console.error(e); }
}
const uid = p => p + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/* ---------------- formatting ---------------- */
const inr = new Intl.NumberFormat('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
function money(n) {
  const v = Math.abs(Number(n) || 0);
  return '₹' + inr.format(v);
}
function signed(n) { return (n < 0 ? '-' : '') + money(n); }
/* Compact INR for tight spaces: ₹39.7k, ₹1.2L, ₹3Cr */
function moneyShort(n) {
  const v = Math.abs(Number(n) || 0);
  if (v >= 1e7) return '₹' + (v / 1e7).toFixed(v >= 1e8 ? 0 : 1) + 'Cr';
  if (v >= 1e5) return '₹' + (v / 1e5).toFixed(v >= 1e6 ? 0 : 1) + 'L';
  if (v >= 1000) return '₹' + (v / 1000).toFixed(v >= 1e4 ? 0 : 1) + 'k';
  return '₹' + Math.round(v);
}
function esc(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const MON = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
const DOW = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

function ymOf(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'); }
function todayISO() { const d = new Date(); return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
function parseISO(iso) { const [y, m, d] = String(iso).split('-').map(Number); return new Date(y, m - 1, d); }
function fmtDate(iso) { const d = parseISO(iso); return String(d.getDate()).padStart(2,'0') + '/' + String(d.getMonth()+1).padStart(2,'0') + '/' + d.getFullYear(); }
function fmtDayLong(iso) {
  const d = parseISO(iso), t = parseISO(todayISO());
  const diff = Math.round((d - t) / 864e5);
  if (diff === 0) return 'Today';
  if (diff === -1) return 'Yesterday';
  if (diff === 1) return 'Tomorrow';
  return DOW[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()] + (d.getFullYear() !== t.getFullYear() ? ' ' + d.getFullYear() : '');
}
function monthLabel(ym) { const [y, m] = ym.split('-').map(Number); return MON[m - 1] + ' ' + y; }
function shiftMonth(ym, by) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 1 + by, 1);
  return ymOf(d);
}
function daysInMonth(ym) { const [y, m] = ym.split('-').map(Number); return new Date(y, m, 0).getDate(); }
/* ISO date for a day-of-month inside a given month, clamped to month length */
function occurrence(day, ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = Math.min(Math.max(1, Number(day) || 1), daysInMonth(ym));
  return y + '-' + String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');
}
function daysUntil(iso) { return Math.round((parseISO(iso) - parseISO(todayISO())) / 864e5); }
/* next occurrence of a day-of-month from today onwards */
function nextOccurrence(day) {
  const t = ymOf(new Date());
  const thisOne = occurrence(day, t);
  return daysUntil(thisOne) >= 0 ? thisOne : occurrence(day, shiftMonth(t, 1));
}
const num = v => { const n = parseFloat(String(v).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; };

/* ---------------- derived data ---------------- */
const catOf = id => S.cats.find(c => c.id === id) || { id: 'other', name: 'Other', color: '#8b93a7' };
const cardOf = id => S.cards.find(c => c.id === id) || null;
const personOf = id => S.people.find(p => p.id === id) || null;

function srcLabel(src) {
  const c = cardOf(src);
  if (c) return c.name;
  return { cash: 'Cash', bank: 'Bank / UPI' }[src] || 'Cash';
}
function txnsIn(ym) { return S.txns.filter(t => t.date.slice(0, 7) === ym); }
function monthSpend(ym) { return txnsIn(ym).filter(t => t.kind === 'expense').reduce((a, t) => a + t.amt, 0); }
function monthIncome(ym) { return txnsIn(ym).filter(t => t.kind === 'income').reduce((a, t) => a + t.amt, 0); }

/* Outstanding on a card = card spends + interest/fees - payments - refunds */
function cardBalance(id) {
  let b = 0;
  S.txns.forEach(t => { if (t.src === id) b += (t.kind === 'expense' ? t.amt : -t.amt); });
  S.cardEvents.forEach(e => {
    if (e.cardId !== id) return;
    if (e.kind === 'statement') return;   // a statement reports a total, it does not add debt
    b += (e.kind === 'payment' ? -e.amt : e.amt);
  });
  return b;
}

/** The most recent statement the user has entered for a card, if any. */
function lastStatementEntry(id) {
  const today = todayISO();
  return S.cardEvents
    .filter(e => e.cardId === id && e.kind === 'statement' && e.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date))[0] || null;
}
function cardSpendIn(id, ym) {
  return S.txns.filter(t => t.src === id && t.kind === 'expense' && t.date.slice(0,7) === ym)
               .reduce((a, t) => a + t.amt, 0);
}
function cardEventsIn(id, ym, kind) {
  return S.cardEvents.filter(e => e.cardId === id && e.date.slice(0,7) === ym && (!kind || e.kind === kind))
                     .reduce((a, e) => a + e.amt, 0);
}
function cardInterestTotal(id) {
  return S.cardEvents.filter(e => e.cardId === id && (e.kind === 'interest' || e.kind === 'fee'))
                     .reduce((a, e) => a + e.amt, 0);
}
/* A card is valid through the end of its expiry month */
function expiryPast(exp) {
  if (!exp || !/^\d{2}\/\d{2}$/.test(exp)) return false;
  const [mm, yy] = exp.split('/').map(Number);
  const now = new Date();
  return yy < now.getFullYear() % 100 || (yy === now.getFullYear() % 100 && mm < now.getMonth() + 1);
}

const totalCardOutstanding = () => S.cards.reduce((a, c) => a + cardDues(c.id).outstanding, 0);

/* Date of the most recent statement to have been generated, or null if no cycle is set. */
function lastStatementDate(stmtDay) {
  if (!stmtDay) return null;
  const t = ymOf(new Date());
  const thisMonth = occurrence(stmtDay, t);
  return daysUntil(thisMonth) <= 0 ? thisMonth : occurrence(stmtDay, shiftMonth(t, -1));
}

/*
 * What a card owes, split the way a bank splits it:
 *   due         — billed on the last statement, payable by the due date
 *   unbilled    — spent since that statement, rolls into the next one
 *   outstanding — everything owed right now (due + unbilled)
 * Without a statement day there is no cycle to divide on, so it is all treated as due.
 */
function cardDues(id) {
  const c = cardOf(id);
  const outstanding = cardBalance(id);

  // If a real statement has been entered, trust that figure over anything derived.
  const entered = lastStatementEntry(id);
  if (entered) {
    let paidSince = 0, chargedSince = 0;
    S.txns.forEach(t => {
      if (t.src !== id || t.date <= entered.date) return;
      chargedSince += t.kind === 'expense' ? t.amt : -t.amt;
    });
    S.cardEvents.forEach(e => {
      if (e.cardId !== id || e.date <= entered.date) return;
      if (e.kind === 'payment') paidSince += e.amt;
      else if (e.kind !== 'statement') chargedSince += e.amt;
    });
    const rawDue = entered.amt - paidSince;          // negative once you overpay the bill
    return {
      outstanding: rawDue + chargedSince,
      due: Math.max(0, rawDue),
      unbilled: chargedSince + Math.min(0, rawDue),  // overpayment credits the next cycle
      stmt: entered.date, hasCycle: true, entered: true, billed: entered.amt
    };
  }

  const stmt = c ? lastStatementDate(c.stmtDay) : null;
  if (!stmt) {
    return { outstanding, due: outstanding, unbilled: 0, stmt: null, hasCycle: false };
  }

  let billed = 0;      // total amount due printed on that statement
  let paidSince = 0;   // payments made after it was generated

  S.txns.forEach(t => {
    if (t.src !== id || t.date > stmt) return;
    billed += t.kind === 'expense' ? t.amt : -t.amt;
  });
  S.cardEvents.forEach(e => {
    if (e.cardId !== id) return;
    if (e.kind === 'payment') {
      if (e.date <= stmt) billed -= e.amt; else paidSince += e.amt;
    } else if (e.date <= stmt) {
      billed += e.amt;
    }
  });

  const due = Math.max(0, billed - paidSince);
  return { outstanding, due, unbilled: outstanding - due, stmt, hasCycle: true, entered: false, billed };
}

const totalCardDue = () => S.cards.reduce((a, c) => a + cardDues(c.id).due, 0);

/* Friend ledger: positive = they owe me, negative = I owe them */
function ledgerSign(e) {
  return (e.dir === 'lent' || e.dir === 'paid') ? e.amt : -e.amt;
}
function personBalance(pid) {
  return S.ledger.filter(e => e.pid === pid).reduce((a, e) => a + ledgerSign(e), 0);
}
function friendTotals() {
  let owedToMe = 0, iOwe = 0;
  S.people.forEach(p => { const b = personBalance(p.id); if (b > 0) owedToMe += b; else iOwe += -b; });
  return { owedToMe, iOwe };
}

/* Bills active in a given month */
function billsFor(ym) {
  return S.bills.filter(b => {
    if (b.active === false) return false;
    if (b.kind === 'emi' && b.emiStart && b.emiN) {
      const [sy, sm] = b.emiStart.split('-').map(Number);
      const [cy, cm] = ym.split('-').map(Number);
      const idx = (cy - sy) * 12 + (cm - sm);
      return idx >= 0 && idx < Number(b.emiN);
    }
    if (b.start && ym < b.start.slice(0, 7)) return false;
    return true;
  }).map(b => ({
    bill: b,
    due: occurrence(b.dueDay, ym),
    paid: !!(b.paid && b.paid[ym])
  })).sort((a, b) => a.due.localeCompare(b.due));
}

/* ---------------- UI shell ---------------- */
const $ = s => document.querySelector(s);
const view = $('#view');

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.remove('hidden');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.add('hidden'), 2200);
}

function setTab(name) {
  tab = name;
  document.querySelectorAll('.tab').forEach(b => b.classList.toggle('active', b.dataset.tab === name));
  render();
}

document.querySelectorAll('.tab').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));
$('#prevMonth').addEventListener('click', () => { cur = shiftMonth(cur, -1); render(); });
$('#nextMonth').addEventListener('click', () => { cur = shiftMonth(cur, 1); render(); });
$('#monthLabel').addEventListener('click', () => monthPicker());
$('#fab').addEventListener('click', () => {
  if (tab === 'cards') return S.cards.length ? cardPicker() : cardForm();
  if (tab === 'friends') return S.people.length ? ledgerForm() : personForm();
  if (tab === 'bills') return billForm();
  txnForm();
});

/* Native card scanner, present only in the Android build */
function scanner() {
  const P = window.Capacitor && window.Capacitor.Plugins;
  return (P && P.CardScanner) ? P.CardScanner : null;
}

/* ---------------- bottom sheet ---------------- */
function openSheet(title, html, after) {
  $('#sheetTitle').textContent = title;
  $('#sheetBody').innerHTML = html;
  $('#sheetWrap').classList.remove('hidden');
  $('#sheet').scrollTop = 0;
  if (after) after();
}
/* focus a field once the sheet has settled; no-op if it was closed meanwhile */
function focusLater(sel) { setTimeout(() => { const el = $(sel); if (el) el.focus(); }, 120); }
function closeSheet() { $('#sheetWrap').classList.add('hidden'); $('#sheetBody').innerHTML = ''; }
$('#sheetClose').addEventListener('click', closeSheet);
$('#sheetBackdrop').addEventListener('click', closeSheet);

/* Segmented control helper: wires .seg buttons, returns a getter */
function seg(rootSel) {
  const root = $(rootSel);
  root.addEventListener('click', e => {
    const b = e.target.closest('button'); if (!b) return;
    root.querySelectorAll('button').forEach(x => x.classList.remove('on'));
    b.classList.add('on');
    root.dispatchEvent(new CustomEvent('segchange', { detail: b.dataset.val }));
  });
  return () => (root.querySelector('button.on') || root.querySelector('button')).dataset.val;
}

/* ---------------- month / year picker ---------------- */
/* Tap the month label to jump straight to any month of any year, instead of
   stepping one month at a time with the arrows. */
function monthPicker(year) {
  const y = year || Number(cur.split('-')[0]);
  const nowYM = ymOf(new Date());

  const cells = MON.map((label, i) => {
    const ym = y + '-' + String(i + 1).padStart(2, '0');
    const spent = monthSpend(ym);
    const classes = ['mcell'];
    if (ym === cur) classes.push('on');
    else if (ym === nowYM) classes.push('now');
    return `<button class="${classes.join(' ')}" data-ym="${ym}">
      <div class="mn">${label}</div>
      <div class="mv">${spent > 0 ? moneyShort(spent) : '—'}</div>
    </button>`;
  }).join('');

  openSheet('Jump to month', `
    <div class="ypick">
      <button class="mn-btn" data-y="${y - 1}" aria-label="Previous year">&#8249;</button>
      <div class="yv">${y}</div>
      <button class="mn-btn" data-y="${y + 1}" aria-label="Next year">&#8250;</button>
    </div>
    <div class="mgrid">${cells}</div>
    ${cur === nowYM ? '' : `<button class="btn ghost" id="mpToday" style="margin-top:14px">Back to ${monthLabel(nowYM)}</button>`}
  `, () => {
    const body = $('#sheetBody');
    body.querySelectorAll('[data-y]').forEach(el =>
      el.addEventListener('click', () => monthPicker(Number(el.dataset.y))));
    body.querySelectorAll('[data-ym]').forEach(el =>
      el.addEventListener('click', () => { cur = el.dataset.ym; closeSheet(); render(); }));
    if ($('#mpToday')) $('#mpToday').addEventListener('click', () => { cur = nowYM; closeSheet(); render(); });
  });
}

/* ---------------- render router ---------------- */
function render() {
  $('#monthLabel').textContent = monthLabel(cur);
  const titles = { home: 'Overview', spends: 'Spends', cards: 'Credit Cards', friends: 'Friends', bills: 'Bills & EMIs' };
  $('#screenTitle').textContent = titles[tab];
  $('#monthNav').classList.toggle('hidden', tab === 'cards' || tab === 'friends');

  if (tab === 'home') viewHome();
  else if (tab === 'spends') viewSpends();
  else if (tab === 'cards') viewCards();
  else if (tab === 'friends') viewFriends();
  else if (tab === 'bills') viewBills();

  bind();
  window.scrollTo(0, 0);
}

function bind() {
  view.querySelectorAll('[data-act]').forEach(el => {
    el.addEventListener('click', () => ACT[el.dataset.act] && ACT[el.dataset.act](el.dataset));
  });
}

function empty(icon, title, sub, actLabel, act) {
  return `<div class="empty">
    <div class="e-ic">${icon}</div>
    <div class="e-t">${esc(title)}</div>
    <div class="e-s">${esc(sub)}</div>
    ${actLabel ? `<button class="btn" style="max-width:230px;margin:16px auto 0" data-act="${act}">${esc(actLabel)}</button>` : ''}
  </div>`;
}

/* ============================================================
   HOME
   ============================================================ */
function viewHome() {
  const spend = monthSpend(cur), income = monthIncome(cur), net = income - spend;
  const ft = friendTotals();
  const outstanding = totalCardOutstanding();
  const cardsDue = totalCardDue();
  const bl = billsFor(cur);
  const pending = bl.filter(x => !x.paid).reduce((a, x) => a + x.bill.amt, 0);
  const isNow = cur === ymOf(new Date());
  $('#screenSub').textContent = isNow ? 'This month so far' : monthLabel(cur);

  let h = `
  <div class="sec">
    <div class="hero">
      <div class="hero-label">Spent in ${monthLabel(cur)}</div>
      <div class="hero-amt">${money(spend)}</div>
      <div class="hero-row">
        <div class="hero-cell"><div class="k">Income</div><div class="v pos">${money(income)}</div></div>
        <div class="hero-cell"><div class="k">Net</div><div class="v ${net < 0 ? 'neg' : 'pos'}">${net < 0 ? '-' : '+'}${money(net)}</div></div>
      </div>
    </div>
  </div>

  <div class="sec grid2">
    <button class="stat" data-act="goCards">
      <div class="k"><i class="dot" style="background:var(--purple)"></i>Cards due now</div>
      <div class="v ${cardsDue > 0 ? 'neg' : ''}">${money(cardsDue)}</div>
      <div class="s">${money(outstanding)} outstanding</div>
    </button>
    <button class="stat" data-act="goBills">
      <div class="k"><i class="dot" style="background:var(--amber)"></i>Bills pending</div>
      <div class="v ${pending > 0 ? 'warn' : ''}">${money(pending)}</div>
      <div class="s">${bl.filter(x => !x.paid).length} of ${bl.length} unpaid</div>
    </button>
    <button class="stat" data-act="goFriends">
      <div class="k"><i class="dot" style="background:var(--green)"></i>To collect</div>
      <div class="v pos">${money(ft.owedToMe)}</div>
      <div class="s">friends owe me</div>
    </button>
    <button class="stat" data-act="goFriends">
      <div class="k"><i class="dot" style="background:var(--red)"></i>To pay back</div>
      <div class="v neg">${money(ft.iOwe)}</div>
      <div class="s">I owe friends</div>
    </button>
  </div>`;

  /* ---- upcoming 21 days ---- */
  const up = [];
  S.cards.forEach(c => {
    const d = cardDues(c.id);
    if (d.due > 0 && c.dueDay) {
      up.push({
        date: nextOccurrence(c.dueDay), title: c.name + ' bill',
        sub: d.hasCycle ? 'Credit card · amount due' : 'Credit card',
        amt: d.due, tone: 'purple', act: 'openCard', id: c.id
      });
    }
  });
  /* earliest unpaid occurrence per bill: this month (overdue included), else next month */
  const nowYM = ymOf(new Date());
  const seenBill = new Set();
  [nowYM, shiftMonth(nowYM, 1)].forEach(ym => {
    billsFor(ym).forEach(x => {
      if (x.paid || seenBill.has(x.bill.id)) return;
      if (ym !== nowYM && daysUntil(x.due) > 21) return;
      seenBill.add(x.bill.id);
      up.push({ date: x.due, title: x.bill.name, sub: x.bill.kind === 'emi' ? 'EMI' : 'Recurring bill', amt: x.bill.amt, tone: 'amber', act: 'openBill', id: x.bill.id, m: ym });
    });
  });
  up.sort((a, b) => a.date.localeCompare(b.date));
  const soon = up.filter(u => daysUntil(u.date) <= 21).slice(0, 6);

  if (soon.length) {
    h += `<div class="sec"><div class="sec-head"><h3>Coming up</h3></div>` +
      soon.map(u => {
        const d = daysUntil(u.date);
        const when = d < 0 ? `${-d}d overdue` : d === 0 ? 'Due today' : d === 1 ? 'Tomorrow' : `in ${d} days`;
        const cls = d < 0 ? 'neg' : d <= 3 ? 'warn' : 'mutedtxt';
        return `<button class="row" data-act="${u.act}" data-id="${u.id}" ${u.m ? `data-m="${u.m}"` : ''}>
          <div class="row-ic" style="background:rgba(255,255,255,.05);color:var(--${u.tone})">${esc(u.title.slice(0,1).toUpperCase())}</div>
          <div class="row-mid"><div class="row-t">${esc(u.title)}</div><div class="row-s">${esc(u.sub)} · ${fmtDate(u.date)}</div></div>
          <div class="row-r"><div class="row-amt">${money(u.amt)}</div><div class="row-sub ${cls}">${when}</div></div>
        </button>`;
      }).join('') + `</div>`;
  }

  /* ---- category breakdown ---- */
  const byCat = {};
  txnsIn(cur).filter(t => t.kind === 'expense').forEach(t => { byCat[t.cat] = (byCat[t.cat] || 0) + t.amt; });
  const cats = Object.entries(byCat).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (cats.length) {
    const max = cats[0][1];
    h += `<div class="sec"><div class="sec-head"><h3>Where it went</h3><span class="link" data-act="goSpends">All spends</span></div>
      <div class="card">` + cats.map(([id, v]) => {
        const c = catOf(id);
        return `<div class="catbar">
          <div class="nm">${esc(c.name)}</div>
          <div class="tr"><i style="width:${Math.max(3, v / max * 100)}%;background:${c.color}"></i></div>
          <div class="vl">${money(v)}</div>
        </div>`;
      }).join('') + `</div></div>`;
  }

  /* ---- 6 month trend ---- */
  const months = []; for (let i = 5; i >= 0; i--) months.push(shiftMonth(cur, -i));
  const vals = months.map(m => monthSpend(m));
  const mx = Math.max(...vals, 1);
  if (vals.some(v => v > 0)) {
    h += `<div class="sec"><div class="sec-head"><h3>Last 6 months</h3><span class="link">${money(vals.reduce((a,b)=>a+b,0) / (vals.filter(v=>v>0).length || 1))} avg</span></div>
      <div class="card"><div class="trend">` + months.map((m, i) => `
        <div class="tcol">
          <div class="tbar ${m === cur ? 'cur' : ''}" style="height:${Math.max(3, vals[i] / mx * 82)}%"></div>
          <div class="tlab">${MON[Number(m.split('-')[1]) - 1]}</div>
        </div>`).join('') + `</div></div></div>`;
  }

  /* ---- recent ---- */
  const recent = [...S.txns].sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts).slice(0, 5);
  if (recent.length) {
    h += `<div class="sec"><div class="sec-head"><h3>Recent activity</h3><span class="link" data-act="goSpends">See all</span></div>`
      + recent.map(txnRow).join('') + `</div>`;
  } else {
    h += `<div class="sec">` + empty('&#8681;', 'No transactions yet',
      'Tap the + button to log your first spend. Everything stays on this phone.', 'Add a spend', 'newTxn') + `</div>`;
  }

  /* ---- backup ---- */
  h += `<div class="sec"><div class="sec-head"><h3>Data &amp; backup</h3></div>
    <div class="card">
      <div class="row-s" style="margin-bottom:12px;line-height:1.5">All records are stored only on this device. Export a JSON backup before reinstalling or clearing app data.</div>
      <div class="btn-row">
        <button class="btn ghost" data-act="exportData">Export backup</button>
        <button class="btn ghost" data-act="importData">Import</button>
      </div>
      <button class="btn danger" data-act="resetData" style="margin-top:10px">Erase all data</button>
    </div></div>
    <div style="text-align:center;color:var(--faint);font-size:11px;padding:6px 0 4px">
      ${S.txns.length} transactions · ${S.cards.length} cards · ${S.people.length} people · ${S.bills.length} bills
    </div>`;

  view.innerHTML = h;
}

function txnRow(t) {
  const c = catOf(t.cat);
  const inc = t.kind === 'income';
  return `<button class="row" data-act="openTxn" data-id="${t.id}">
    <div class="row-ic" style="background:${c.color}22;color:${c.color}">${esc(c.name.slice(0, 1))}</div>
    <div class="row-mid">
      <div class="row-t">${esc(t.note || c.name)}</div>
      <div class="row-s">${esc(c.name)} · ${esc(srcLabel(t.src))}</div>
    </div>
    <div class="row-r">
      <div class="row-amt ${inc ? 'pos' : ''}">${inc ? '+' : '-'}${money(t.amt)}</div>
      <div class="row-sub">${fmtDate(t.date)}</div>
    </div>
  </button>`;
}

/* ============================================================
   SPENDS
   ============================================================ */
function viewSpends() {
  let list = txnsIn(cur);
  if (srcFilter !== 'all') list = list.filter(t => t.src === srcFilter);
  list.sort((a, b) => b.date.localeCompare(a.date) || b.ts - a.ts);

  const spend = list.filter(t => t.kind === 'expense').reduce((a, t) => a + t.amt, 0);
  const inc = list.filter(t => t.kind === 'income').reduce((a, t) => a + t.amt, 0);
  const dim = daysInMonth(cur);
  const elapsed = cur === ymOf(new Date()) ? new Date().getDate() : dim;
  $('#screenSub').textContent = `${list.length} entries · ${money(spend / (elapsed || 1))}/day avg`;

  const srcs = [['all', 'All'], ['cash', 'Cash'], ['bank', 'Bank / UPI'], ...S.cards.map(c => [c.id, c.name])];
  let h = `<div class="chips">` + srcs.map(([v, l]) =>
    `<button class="chip ${srcFilter === v ? 'on' : ''}" data-act="setSrc" data-v="${v}">${esc(l)}</button>`).join('') + `</div>`;

  h += `<div class="sec grid2">
    <div class="stat"><div class="k">Spent</div><div class="v neg">${money(spend)}</div><div class="s">${monthLabel(cur)}</div></div>
    <div class="stat"><div class="k">Received</div><div class="v pos">${money(inc)}</div><div class="s">income &amp; refunds</div></div>
  </div>`;

  if (!list.length) {
    h += empty('&#8681;', 'Nothing here', `No entries for ${monthLabel(cur)}${srcFilter !== 'all' ? ' in ' + srcLabel(srcFilter) : ''}.`, 'Add a spend', 'newTxn');
    view.innerHTML = h; return;
  }

  let day = '';
  h += `<div class="sec">`;
  list.forEach(t => {
    if (t.date !== day) {
      day = t.date;
      const dayTotal = list.filter(x => x.date === day && x.kind === 'expense').reduce((a, x) => a + x.amt, 0);
      h += `<div class="daygroup">${fmtDayLong(day)}<span>${money(dayTotal)}</span></div>`;
    }
    h += txnRow(t);
  });
  h += `</div>`;
  view.innerHTML = h;
}

/* ============================================================
   CARDS
   ============================================================ */
function viewCards() {
  const total = totalCardOutstanding();
  const dueNow = totalCardDue();
  const limit = S.cards.reduce((a, c) => a + (Number(c.limit) || 0), 0);
  $('#screenSub').textContent = S.cards.length ? `${money(dueNow)} due now` : 'No cards yet';

  if (!S.cards.length) {
    view.innerHTML = empty('&#9646;&#9646;', 'No credit cards added',
      'Add a card to track its outstanding balance, statement, due date and the interest the bank charges you.',
      'Add a card', 'newCard');
    return;
  }

  let h = `<div class="sec">
    <div class="hero">
      <div class="hero-label">Amount due now</div>
      <div class="hero-amt ${dueNow > 0 ? 'neg' : ''}">${money(dueNow)}</div>
      <div class="hero-row">
        <div class="hero-cell"><div class="k">Unbilled</div><div class="v">${money(Math.max(0, total - dueNow))}</div></div>
        <div class="hero-cell"><div class="k">Outstanding</div><div class="v">${money(total)}</div></div>
      </div>
      <div class="hero-row">
        <div class="hero-cell"><div class="k">Total limit</div><div class="v">${money(limit)}</div></div>
        <div class="hero-cell"><div class="k">Available</div><div class="v pos">${money(Math.max(0, limit - total))}</div></div>
      </div>
      ${limit > 0 ? `<div class="bar"><i style="width:${Math.min(100, total / limit * 100)}%;background:${total / limit > .5 ? 'var(--red)' : 'var(--accent)'}"></i></div>` : ''}
    </div>
  </div>`;

  h += `<div class="sec"><div class="sec-head"><h3>Your cards</h3></div>`;
  S.cards.forEach(c => {
    const dues = cardDues(c.id);
    const bal = dues.outstanding;
    const lim = Number(c.limit) || 0;
    const util = lim ? Math.min(100, bal / lim * 100) : 0;
    const due = c.dueDay ? nextOccurrence(c.dueDay) : null;
    const d = due ? daysUntil(due) : null;
    const cleared = dues.hasCycle && dues.due <= 0;
    const dueCls = cleared ? 'paid' : d === null ? '' : d < 0 ? 'over' : d <= 5 ? 'soon' : '';
    const dueTxt = cleared ? '✓ Paid' : !due ? 'No due date' : (dues.due <= 0 ? 'Nothing due' : d === 0 ? 'Due today' : d === 1 ? 'Due tomorrow' : `Due in ${d}d`);
    const intThis = cardEventsIn(c.id, ymOf(new Date()), 'interest');
    h += `<button class="cc" data-act="openCard" data-id="${c.id}">
      <div class="cc-top">
        <div>
          <div class="cc-name">${esc(c.name)}</div>
          <div class="cc-bank">${[esc(c.bank || 'Card'), c.network ? esc(c.network) : ''].filter(Boolean).join(' &middot; ')}${c.last4 ? ' &middot;&middot;&middot;&middot; ' + esc(c.last4) : ''}</div>
        </div>
        <div class="cc-due ${dueCls}">${dueTxt}</div>
      </div>
      <div class="cc-lab" style="margin-top:12px">${!dues.hasCycle ? 'Outstanding' : cleared ? 'Nothing due' : 'Amount due'}</div>
      <div class="cc-amt" style="margin-top:2px">${money(dues.hasCycle ? dues.due : bal)}</div>
      ${dues.hasCycle ? `<div class="cc-split">
        <span>Outstanding <b>${money(bal)}</b></span>
        <span>Unbilled <b>${money(Math.max(0, dues.unbilled))}</b></span>
      </div>` : ''}
      ${lim ? `<div class="bar"><i style="width:${util}%;background:${util > 70 ? 'var(--red)' : util > 40 ? 'var(--amber)' : 'var(--green)'}"></i></div>` : ''}
      <div class="cc-foot">
        <span>${lim ? Math.round(util) + '% of ' + money(lim) : 'No limit set'}</span>
        <span>${intThis > 0 ? '<span style="color:var(--red)">' + money(intThis) + ' interest</span>'
          : cleared ? (c.stmtDay ? 'Next bill ' + fmtDate(nextOccurrence(c.stmtDay)) : '')
          : (due ? fmtDate(due) : '')}</span>
      </div>
    </button>`;
  });
  h += `<button class="btn ghost" data-act="newCard" style="margin-top:4px">Add another card</button></div>`;
  view.innerHTML = h;
}

/* ============================================================
   FRIENDS
   ============================================================ */
function viewFriends() {
  const ft = friendTotals();
  $('#screenSub').textContent = S.people.length ? `${S.people.length} people` : 'No one added yet';

  if (!S.people.length) {
    view.innerHTML = empty('&#9679;&#9679;', 'No friends tracked',
      'Add a person to keep a running ledger of what you lent them and what you borrowed, with part-payments and settle-up.',
      'Add a person', 'newPerson');
    return;
  }

  let h = `<div class="sec grid2">
    <div class="stat"><div class="k"><i class="dot" style="background:var(--green)"></i>To collect</div>
      <div class="v pos">${money(ft.owedToMe)}</div><div class="s">owed to me</div></div>
    <div class="stat"><div class="k"><i class="dot" style="background:var(--red)"></i>To pay</div>
      <div class="v neg">${money(ft.iOwe)}</div><div class="s">I owe</div></div>
  </div>`;

  const net = ft.owedToMe - ft.iOwe;
  h += `<div class="sec"><div class="card" style="text-align:center">
      <div class="row-s">Net position</div>
      <div style="font-size:24px;font-weight:730;margin-top:3px" class="${net >= 0 ? 'pos' : 'neg'}">${net >= 0 ? '+' : '-'}${money(net)}</div>
      <div class="row-s" style="margin-top:2px">${net >= 0 ? 'more coming to you than going out' : 'you owe more than you are owed'}</div>
    </div></div>`;

  const sorted = [...S.people].sort((a, b) => Math.abs(personBalance(b.id)) - Math.abs(personBalance(a.id)));
  h += `<div class="sec"><div class="sec-head"><h3>People</h3></div>`;
  sorted.forEach(p => {
    const b = personBalance(p.id);
    const n = S.ledger.filter(e => e.pid === p.id).length;
    const last = S.ledger.filter(e => e.pid === p.id).sort((x, y) => y.date.localeCompare(x.date))[0];
    h += `<button class="row" data-act="openPerson" data-id="${p.id}">
      <div class="row-ic" style="background:${b > 0 ? 'rgba(53,192,127,.15)' : b < 0 ? 'rgba(255,95,109,.15)' : 'var(--surface3)'};color:${b > 0 ? 'var(--green)' : b < 0 ? 'var(--red)' : 'var(--muted)'}">${esc(p.name.slice(0, 1).toUpperCase())}</div>
      <div class="row-mid">
        <div class="row-t">${esc(p.name)}</div>
        <div class="row-s">${n} entr${n === 1 ? 'y' : 'ies'}${last ? ' · last ' + fmtDate(last.date) : ''}</div>
      </div>
      <div class="row-r">
        <div class="row-amt ${b > 0 ? 'pos' : b < 0 ? 'neg' : 'mutedtxt'}">${b === 0 ? money(0) : (b > 0 ? '+' : '-') + money(b)}</div>
        <div class="row-sub">${b > 0 ? 'owes you' : b < 0 ? 'you owe' : 'settled'}</div>
      </div>
    </button>`;
  });
  h += `<button class="btn ghost" data-act="newPerson" style="margin-top:4px">Add a person</button></div>`;
  view.innerHTML = h;
}

/* ============================================================
   BILLS & EMIs
   ============================================================ */
function viewBills() {
  const list = billsFor(cur);
  const total = list.reduce((a, x) => a + x.bill.amt, 0);
  const paid = list.filter(x => x.paid).reduce((a, x) => a + x.bill.amt, 0);
  $('#screenSub').textContent = list.length ? `${list.filter(x => x.paid).length}/${list.length} paid` : 'Nothing recurring yet';

  if (!S.bills.length) {
    view.innerHTML = empty('&#8635;', 'No recurring bills',
      'Add rent, subscriptions, insurance or loan EMIs and Paisa Book will remind you what is due each month.',
      'Add a bill or EMI', 'newBill');
    return;
  }

  let h = `<div class="sec">
    <div class="hero">
      <div class="hero-label">Due in ${monthLabel(cur)}</div>
      <div class="hero-amt">${money(total)}</div>
      <div class="hero-row">
        <div class="hero-cell"><div class="k">Paid</div><div class="v pos">${money(paid)}</div></div>
        <div class="hero-cell"><div class="k">Pending</div><div class="v ${total - paid > 0 ? 'warn' : ''}">${money(total - paid)}</div></div>
      </div>
      ${total ? `<div class="bar"><i style="width:${paid / total * 100}%;background:var(--green)"></i></div>` : ''}
    </div>
  </div>`;

  if (!list.length) {
    h += empty('&#8635;', 'Nothing due', `No recurring items fall in ${monthLabel(cur)}.`, 'Add a bill or EMI', 'newBill');
    view.innerHTML = h; return;
  }

  h += `<div class="sec"><div class="sec-head"><h3>${monthLabel(cur)}</h3></div>`;
  list.forEach(x => {
    const b = x.bill;
    const d = daysUntil(x.due);
    const c = catOf(b.cat);
    let status, cls;
    if (x.paid) { status = 'Paid'; cls = 'pos'; }
    else if (d < 0) { status = `${-d}d overdue`; cls = 'neg'; }
    else if (d === 0) { status = 'Due today'; cls = 'warn'; }
    else { status = `in ${d}d`; cls = 'mutedtxt'; }
    let sub = (b.kind === 'emi' ? 'EMI' : b.kind === 'subscription' ? 'Subscription' : 'Bill') + ' · ' + fmtDate(x.due);
    if (b.kind === 'emi' && b.emiN) sub += ` · ${Object.keys(b.paid || {}).length}/${b.emiN}`;
    h += `<button class="row" data-act="openBill" data-id="${b.id}" style="${x.paid ? 'opacity:.62' : ''}">
      <div class="row-ic" style="background:${c.color}22;color:${c.color}">${x.paid ? '&#10003;' : esc(b.name.slice(0, 1).toUpperCase())}</div>
      <div class="row-mid"><div class="row-t">${esc(b.name)}</div><div class="row-s">${sub}</div></div>
      <div class="row-r"><div class="row-amt">${money(b.amt)}</div><div class="row-sub ${cls}">${status}</div></div>
    </button>`;
  });
  h += `<button class="btn ghost" data-act="newBill" style="margin-top:4px">Add a bill or EMI</button></div>`;
  view.innerHTML = h;
}

/* ============================================================
   FORMS — transactions
   ============================================================ */
function txnForm(id) {
  const t = id ? S.txns.find(x => x.id === id) : null;
  const kind = t ? t.kind : 'expense';
  const srcOpts = [['cash', 'Cash'], ['bank', 'Bank / UPI'], ...S.cards.map(c => [c.id, c.name + ' (credit card)'])];

  openSheet(t ? 'Edit entry' : 'Add entry', `
    <div class="f"><div class="seg" id="tKind">
      <button data-val="expense" data-tone="red" class="${kind === 'expense' ? 'on' : ''}">Spent</button>
      <button data-val="income" data-tone="green" class="${kind === 'income' ? 'on' : ''}">Received</button>
    </div></div>
    <div class="f"><label>Amount</label>
      <input id="tAmt" class="amt-in" type="number" inputmode="decimal" step="0.01" placeholder="0" value="${t ? t.amt : ''}"></div>
    <div class="f"><label id="tCatLab">${kind === 'income' ? 'Income type' : 'Category'}</label><select id="tCat">
      ${catsFor(kind).map(c => `<option value="${c.id}" ${t && t.cat === c.id ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}
    </select></div>
    <div class="f"><label id="tSrcLab">${kind === 'income' ? 'Received in' : 'Paid from'}</label><select id="tSrc">
      ${srcOpts.map(([v, l]) => `<option value="${v}" ${t && t.src === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
    </select></div>
    <div class="f"><label>Date</label><input id="tDate" type="date" value="${t ? t.date : todayISO()}"></div>
    <div class="f"><label>Note</label><input id="tNote" type="text" placeholder="e.g. Swiggy dinner" value="${t ? esc(t.note) : ''}"></div>
    <button class="btn" id="tSave">${t ? 'Save changes' : 'Add entry'}</button>
    ${t ? `<button class="btn danger" id="tDel">Delete entry</button>` : ''}
  `, () => {
    const getKind = seg('#tKind');
    $('#tKind').addEventListener('segchange', ev => {
      const inc = ev.detail === 'income';
      $('#tCatLab').textContent = inc ? 'Income type' : 'Category';
      $('#tSrcLab').textContent = inc ? 'Received in' : 'Paid from';
      // swap the category list, keeping the current pick if it belongs to the new side
      const keep = $('#tCat').value;
      $('#tCat').innerHTML = catsFor(ev.detail)
        .map(c => `<option value="${c.id}" ${c.id === keep ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
      $('#tSave').textContent = t ? 'Save changes' : (inc ? 'Add income' : 'Add entry');
    });
    if (!t) focusLater('#tAmt');
    $('#tSave').addEventListener('click', () => {
      const amt = num($('#tAmt').value);
      if (amt <= 0) return toast('Enter an amount');
      const rec = {
        id: t ? t.id : uid('t'), kind: getKind(), amt,
        cat: $('#tCat').value, src: $('#tSrc').value,
        date: $('#tDate').value || todayISO(), note: $('#tNote').value.trim(),
        ts: t ? t.ts : Date.now()
      };
      if (t) S.txns[S.txns.findIndex(x => x.id === t.id)] = rec; else S.txns.push(rec);
      save(); closeSheet(); render(); toast(t ? 'Updated' : 'Added ' + money(amt));
    });
    if (t) $('#tDel').addEventListener('click', () => {
      if (!confirm('Delete this entry?')) return;
      S.txns = S.txns.filter(x => x.id !== t.id);
      save(); closeSheet(); render(); toast('Deleted');
    });
  });
}

/* ============================================================
   FORMS — credit cards
   ============================================================ */
function cardForm(id) {
  const c = id ? cardOf(id) : null;
  openSheet(c ? 'Edit card' : 'Add credit card', `
    ${scanner() ? `<button class="btn ghost" id="cScan">Scan card with camera</button>
      <div class="row-s" style="margin:7px 2px 16px;line-height:1.5;text-align:center">
        Reads the number to fill in the last 4 digits and expiry. The full number is never saved.
      </div>` : ''}
    <div class="f"><label>Card name</label><input id="cName" type="text" placeholder="e.g. HDFC Regalia" value="${c ? esc(c.name) : ''}"></div>
    <div class="f"><label>Bank</label><input id="cBank" type="text" placeholder="HDFC" value="${c ? esc(c.bank || '') : ''}"></div>
    <div class="frow">
      <div class="f"><label>Last 4 digits</label><input id="cLast4" type="text" inputmode="numeric" maxlength="4" placeholder="4321" value="${c ? esc(c.last4 || '') : ''}"></div>
      <div class="f"><label>Expiry MM/YY</label><input id="cExpiry" type="text" inputmode="numeric" maxlength="5" placeholder="08/29" value="${c ? esc(c.expiry || '') : ''}"></div>
    </div>
    <div id="cNetHint" class="row-s" style="margin:-6px 2px 13px">${c && c.network ? esc(c.network) + ' card' : ''}</div>
    <div class="f"><label>Credit limit</label><input id="cLimit" type="number" inputmode="decimal" placeholder="200000" value="${c && c.limit ? c.limit : ''}"></div>
    <div class="frow">
      <div class="f"><label>Statement day</label><input id="cStmt" type="number" inputmode="numeric" min="1" max="31" placeholder="18" value="${c && c.stmtDay ? c.stmtDay : ''}"></div>
      <div class="f"><label>Payment due day</label><input id="cDue" type="number" inputmode="numeric" min="1" max="31" placeholder="8" value="${c && c.dueDay ? c.dueDay : ''}"></div>
    </div>
    ${!c ? `<div class="f"><label>Current outstanding (optional)</label>
      <input id="cOpen" type="number" inputmode="decimal" placeholder="0" >
      <div class="row-s" style="margin-top:6px">Recorded as an opening balance so the card starts at the right number.</div></div>` : ''}
    <button class="btn" id="cSave">${c ? 'Save changes' : 'Add card'}</button>
    ${c ? `<button class="btn danger" id="cDel">Delete card</button>` : ''}
  `, () => {
    let scannedNetwork = '';
    const scanBtn = $('#cScan');
    if (scanBtn) scanBtn.addEventListener('click', () => {
      const sc = scanner();
      if (!sc) return;
      const label = scanBtn.textContent;
      scanBtn.textContent = 'Opening camera…';
      scanBtn.disabled = true;
      sc.scan().then(r => {
        if (r.cancelled) return;
        if (r.last4) $('#cLast4').value = r.last4;
        if (r.expiry) $('#cExpiry').value = r.expiry;
        if (r.network) {
          scannedNetwork = r.network;
          $('#cNetHint').textContent = r.network + ' card';
        }
        if (!$('#cName').value.trim() && r.network && r.last4) {
          $('#cName').value = r.network + ' ' + r.last4;
        }
        toast(r.last4 ? 'Card ending ' + r.last4 : 'Scanned');
      }).catch(e => {
        const code = e && e.code;
        if (code === 'PERMISSION_DENIED') toast('Camera access is needed to scan');
        else toast((e && e.message) || 'Could not read the card');
      }).finally(() => {
        scanBtn.textContent = label;
        scanBtn.disabled = false;
      });
    });

    $('#cSave').addEventListener('click', () => {
      const name = $('#cName').value.trim();
      if (!name) return toast('Give the card a name');
      const rec = {
        id: c ? c.id : uid('c'), name,
        bank: $('#cBank').value.trim(), last4: $('#cLast4').value.trim(),
        limit: num($('#cLimit').value),
        stmtDay: num($('#cStmt').value) || null, dueDay: num($('#cDue').value) || null,
        expiry: $('#cExpiry').value.trim(),
        network: scannedNetwork || (c ? c.network : '') || ''
      };
      if (c) S.cards[S.cards.findIndex(x => x.id === c.id)] = rec;
      else {
        S.cards.push(rec);
        const open = num($('#cOpen').value);
        if (open > 0) {
          // Date it to the last statement, not today: an existing balance is money already
          // billed, so dating it now would park the whole thing in "unbilled" and show
          // nothing due on a brand-new card.
          const openDate = lastStatementDate(rec.stmtDay) || todayISO();
          S.cardEvents.push({ id: uid('e'), cardId: rec.id, kind: 'opening', amt: open, date: openDate, note: 'Opening balance' });
        }
      }
      save(); closeSheet(); render(); toast(c ? 'Card updated' : 'Card added');
    });
    if (c) $('#cDel').addEventListener('click', () => {
      const n = S.txns.filter(t => t.src === c.id).length;
      if (!confirm(`Delete ${c.name}?` + (n ? `\n\n${n} transaction(s) on this card will be moved to Cash.` : ''))) return;
      S.txns.forEach(t => { if (t.src === c.id) t.src = 'cash'; });
      S.cardEvents = S.cardEvents.filter(e => e.cardId !== c.id);
      S.cards = S.cards.filter(x => x.id !== c.id);
      save(); closeSheet(); render(); toast('Card deleted');
    });
  });
}

function cardPicker() {
  openSheet('Add to card', S.cards.map(c =>
    `<button class="row" data-pick="${c.id}">
      <div class="row-ic" style="color:var(--purple)">${esc(c.name.slice(0,1).toUpperCase())}</div>
      <div class="row-mid"><div class="row-t">${esc(c.name)}</div><div class="row-s">${money(cardDues(c.id).outstanding)} outstanding</div></div>
    </button>`).join('') +
    `<button class="btn ghost" id="pNew" style="margin-top:8px">Add a new card</button>`, () => {
      $('#sheetBody').querySelectorAll('[data-pick]').forEach(el =>
        el.addEventListener('click', () => cardDetail(el.dataset.pick)));
      $('#pNew').addEventListener('click', () => cardForm());
    });
}

function cardDetail(id) {
  const c = cardOf(id); if (!c) return;
  const dues = cardDues(id);
  const bal = dues.outstanding;
  const nowM = ymOf(new Date());
  const lim = Number(c.limit) || 0;
  const spendThis = cardSpendIn(id, nowM);
  const intThis = cardEventsIn(id, nowM, 'interest');
  const feeThis = cardEventsIn(id, nowM, 'fee');
  const payThis = cardEventsIn(id, nowM, 'payment');
  const intTotal = cardInterestTotal(id);
  const due = c.dueDay ? nextOccurrence(c.dueDay) : null;

  const activity = [
    ...S.txns.filter(t => t.src === id).map(t => ({
      date: t.date, title: t.note || catOf(t.cat).name,
      sub: t.kind === 'income' ? 'Refund / cashback' : catOf(t.cat).name,
      amt: t.kind === 'income' ? -t.amt : t.amt, tid: t.id
    })),
    ...S.cardEvents.filter(e => e.cardId === id).map(e => ({
      date: e.date, title: e.note || ({ payment: 'Bill payment', interest: 'Interest charged', fee: 'Fee / charge', opening: 'Opening balance', statement: 'Statement generated' }[e.kind]),
      sub: { payment: 'Payment', interest: 'Interest', fee: 'Fee', opening: 'Opening balance', statement: 'Amount due' }[e.kind],
      amt: e.kind === 'payment' ? -e.amt : e.amt, eid: e.id, stmt: e.kind === 'statement'
    }))
  ].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 25);

  openSheet(c.name, `
    <div class="card" style="text-align:center;padding:16px">
      <div class="cc-lab">${dues.hasCycle ? 'Amount due' + (due ? ' by ' + fmtDate(due) : '') : 'Outstanding'}</div>
      <div style="font-size:32px;font-weight:750;letter-spacing:-1px;margin-top:2px" class="${(dues.hasCycle ? dues.due : bal) > 0 ? 'neg' : 'pos'}">${money(dues.hasCycle ? dues.due : bal)}</div>
      ${dues.hasCycle ? `<div class="row-s" style="margin-top:6px;line-height:1.5">
        ${dues.entered
          ? `From the statement you entered for ${fmtDate(dues.stmt)} — ${money(dues.billed)} billed.`
          : `Worked out from your ${fmtDate(dues.stmt)} statement cycle.`}<br>
        ${money(Math.max(0, dues.unbilled))} spent since then is not due yet.
      </div>` : `<div class="row-s" style="margin-top:6px;line-height:1.5">
        Enter your statement amount due below, or set a statement day on the card, to split
        this into what is due now and what is not billed yet.
      </div>`}
      ${lim ? `<div class="bar"><i style="width:${Math.min(100, bal / lim * 100)}%;background:${bal / lim > .7 ? 'var(--red)' : 'var(--accent)'}"></i></div>
      <div class="row-s" style="margin-top:6px">${money(Math.max(0, lim - bal))} available of ${money(lim)}</div>` : ''}
    </div>

    ${dues.due > 0
      ? `<button class="btn" id="aClear">Mark ${money(dues.due)} as paid</button>`
      : (dues.hasCycle ? `<div class="card" style="text-align:center;padding:12px;border-color:rgba(53,192,127,.35)">
          <span class="pill g">&#10003; Bill cleared</span>
          <div class="row-s" style="margin-top:6px">Nothing due until the next statement${c.stmtDay ? ' on ' + fmtDate(nextOccurrence(c.stmtDay)) : ''}.</div>
        </div>` : '')}
    <div class="btn-row">
      <button class="btn ${dues.due > 0 ? 'ghost' : ''}" id="aPay">Record payment</button>
      <button class="btn ghost" id="aInt">Add interest</button>
    </div>
    <button class="btn ghost" id="aStmt" style="margin-top:10px">${dues.entered ? 'Update statement — ' + money(dues.billed) : 'Enter statement amount due'}</button>

    <div class="card" style="margin-top:14px">
      <div class="kv"><span class="k">Amount due</span><span class="v ${dues.due > 0 ? 'neg' : ''}">${money(dues.due)}</span></div>
      <div class="kv"><span class="k">Unbilled since statement</span><span class="v">${money(Math.max(0, dues.unbilled))}</span></div>
      <div class="kv"><span class="k">Total outstanding</span><span class="v">${money(bal)}</span></div>
      <div class="kv"><span class="k">Spends this month</span><span class="v">${money(spendThis)}</span></div>
      <div class="kv"><span class="k">Interest charged this month</span><span class="v ${intThis ? 'neg' : ''}">${money(intThis)}</span></div>
      <div class="kv"><span class="k">Fees this month</span><span class="v ${feeThis ? 'neg' : ''}">${money(feeThis)}</span></div>
      <div class="kv"><span class="k">Paid this month</span><span class="v pos">${money(payThis)}</span></div>
      <div class="kv"><span class="k">Interest + fees, all time</span><span class="v ${intTotal ? 'neg' : ''}">${money(intTotal)}</span></div>
      ${c.network ? `<div class="kv"><span class="k">Network</span><span class="v">${esc(c.network)}</span></div>` : ''}
      ${c.expiry ? `<div class="kv"><span class="k">Expires</span><span class="v ${expiryPast(c.expiry) ? 'neg' : ''}">${esc(c.expiry)}${expiryPast(c.expiry) ? ' · expired' : ''}</span></div>` : ''}
      <div class="kv"><span class="k">Statement day</span><span class="v">${c.stmtDay ? c.stmtDay + getOrdinal(c.stmtDay) : '—'}</span></div>
      <div class="kv"><span class="k">Payment due</span><span class="v">${due ? fmtDate(due) : '—'}</span></div>
    </div>

    <div class="sec-head" style="margin-top:18px"><h3>Activity</h3></div>
    ${activity.length ? activity.map(a => `
      <button class="row" ${a.tid ? `data-tid="${a.tid}"` : `data-eid="${a.eid}"`}>
        <div class="row-ic" style="color:${a.stmt ? 'var(--accent)' : a.amt < 0 ? 'var(--green)' : 'var(--muted)'}">${a.stmt ? '&#9776;' : a.amt < 0 ? '&#8593;' : '&#8595;'}</div>
        <div class="row-mid"><div class="row-t">${esc(a.title)}</div><div class="row-s">${esc(a.sub)} · ${fmtDate(a.date)}</div></div>
        <div class="row-r"><div class="row-amt ${a.stmt ? 'mutedtxt' : a.amt < 0 ? 'pos' : ''}">${a.stmt ? '' : (a.amt < 0 ? '-' : '+')}${money(a.amt)}</div></div>
      </button>`).join('')
      : `<div class="row-s" style="padding:10px 2px">No activity yet. Log spends from the + button and pick this card as the source.</div>`}

    <button class="btn ghost" id="aEdit" style="margin-top:12px">Edit card details</button>
  `, () => {
    if ($('#aClear')) $('#aClear').addEventListener('click', () => {
      const amt = dues.due;
      if (!confirm(`Record a payment of ${money(amt)} for ${c.name} today?

This clears the amount due. Anything spent since the statement stays as unbilled.`)) return;
      S.cardEvents.push({ id: uid('e'), cardId: id, kind: 'payment', amt, date: todayISO(), note: 'Bill paid' });
      save(); render(); cardDetail(id); toast('Bill marked paid');
    });
    $('#aPay').addEventListener('click', () => cardEventForm(id, 'payment'));
    $('#aInt').addEventListener('click', () => cardEventForm(id, 'interest'));
    $('#aStmt').addEventListener('click', () => {
      const ex = lastStatementEntry(id);
      cardEventForm(id, 'statement', ex ? ex.id : null);
    });
    $('#aEdit').addEventListener('click', () => cardForm(id));
    $('#sheetBody').querySelectorAll('[data-tid]').forEach(el =>
      el.addEventListener('click', () => txnForm(el.dataset.tid)));
    $('#sheetBody').querySelectorAll('[data-eid]').forEach(el =>
      el.addEventListener('click', () => cardEventForm(id, null, el.dataset.eid)));
  });
}
function getOrdinal(n) { const s = ['th','st','nd','rd'], v = n % 100; return s[(v - 20) % 10] || s[v] || s[0]; }

function cardEventForm(cardId, kind, eventId) {
  const e = eventId ? S.cardEvents.find(x => x.id === eventId) : null;
  const k = e ? e.kind : (kind || 'payment');
  const c = cardOf(cardId);
  const dues = cardDues(cardId);
  const bal = dues.outstanding;

  openSheet(e ? 'Edit entry' : { payment: 'Record payment', interest: 'Interest charged', fee: 'Fee / charge', statement: 'Enter statement' }[k], `
    <div class="f"><div class="seg" id="eKind">
      <button data-val="payment" data-tone="green" class="${k === 'payment' ? 'on' : ''}">Payment</button>
      <button data-val="interest" data-tone="red" class="${k === 'interest' ? 'on' : ''}">Interest</button>
      <button data-val="fee" data-tone="red" class="${k === 'fee' ? 'on' : ''}">Fee</button>
      <button data-val="statement" class="${k === 'statement' ? 'on' : ''}">Statement</button>
      ${k === 'opening' ? `<button data-val="opening" class="on">Opening</button>` : ''}
    </div></div>
    <div class="f"><label id="eAmtLab">${k === 'statement' ? 'Total amount due on the bill' : 'Amount'}</label>
      <input id="eAmt" class="amt-in" type="number" inputmode="decimal" step="0.01" placeholder="0" value="${e ? e.amt : ''}"></div>
    ${!e && k === 'payment' && bal > 0 ? `<div class="btn-row" id="eQuick" style="margin:-4px 0 13px">
      ${dues.due > 0 ? `<button class="btn ghost" id="eDue">Amount due<br><b>${money(dues.due)}</b></button>` : ''}
      <button class="btn ghost" id="eFull">Full outstanding<br><b>${money(bal)}</b></button>
    </div>` : ''}
    <div class="f"><label id="eDateLab">${k === 'statement' ? 'Statement date' : 'Date'}</label>
      <input id="eDate" type="date" value="${e ? e.date : (k === 'statement' && c && c.stmtDay ? (lastStatementDate(c.stmtDay) || todayISO()) : todayISO())}"></div>
    <div class="f"><label>Note</label><input id="eNote" type="text" placeholder="${k === 'interest' ? 'e.g. finance charge on Aug statement' : 'optional'}" value="${e ? esc(e.note || '') : ''}"></div>
    <div class="row-s" id="eHelp" style="margin-bottom:12px;line-height:1.5">${k === 'statement'
      ? 'Type the total amount due printed on your bill. It becomes the figure to clear by the due date, and payments you record afterwards count against it. It is not added to the outstanding — your logged spends already cover that.'
      : 'Interest and fees are added exactly as the bank charged them — nothing is estimated. A payment reduces the outstanding and is not counted again as a monthly spend.'}</div>
    <button class="btn" id="eSave">${e ? 'Save changes' : 'Save'}</button>
    ${e ? `<button class="btn danger" id="eDel">Delete</button>` : ''}
  `, () => {
    const getKind = seg('#eKind');
    $('#eKind').addEventListener('segchange', ev => {
      const isStmt = ev.detail === 'statement';
      $('#eAmtLab').textContent = isStmt ? 'Total amount due on the bill' : 'Amount';
      $('#eDateLab').textContent = isStmt ? 'Statement date' : 'Date';
      $('#eHelp').textContent = isStmt
        ? 'Type the total amount due printed on your bill. It becomes the figure to clear by the due date, and payments you record afterwards count against it. It is not added to the outstanding — your logged spends already cover that.'
        : 'Interest and fees are added exactly as the bank charged them — nothing is estimated. A payment reduces the outstanding and is not counted again as a monthly spend.';
      const quick = $('#eQuick');
      if (quick) quick.classList.toggle('hidden', ev.detail !== 'payment');
    });
    focusLater('#eAmt');
    if ($('#eFull')) $('#eFull').addEventListener('click', () => { $('#eAmt').value = bal; });
    if ($('#eDue')) $('#eDue').addEventListener('click', () => { $('#eAmt').value = dues.due; });
    $('#eSave').addEventListener('click', () => {
      const amt = num($('#eAmt').value);
      if (amt <= 0) return toast('Enter an amount');
      const rec = { id: e ? e.id : uid('e'), cardId, kind: getKind(), amt, date: $('#eDate').value || todayISO(), note: $('#eNote').value.trim() };
      if (e) S.cardEvents[S.cardEvents.findIndex(x => x.id === e.id)] = rec; else S.cardEvents.push(rec);
      save(); render(); cardDetail(cardId); toast('Saved');
    });
    if (e) $('#eDel').addEventListener('click', () => {
      if (!confirm('Delete this entry?')) return;
      S.cardEvents = S.cardEvents.filter(x => x.id !== e.id);
      save(); render(); cardDetail(cardId); toast('Deleted');
    });
  });
}

/* ============================================================
   FORMS — friends
   ============================================================ */
function personForm(id) {
  const p = id ? personOf(id) : null;
  openSheet(p ? 'Edit person' : 'Add a person', `
    <div class="f"><label>Name</label><input id="pName" type="text" placeholder="e.g. Ramesh" value="${p ? esc(p.name) : ''}"></div>
    <div class="f"><label>Phone (optional)</label><input id="pPhone" type="tel" inputmode="tel" placeholder="9876543210" value="${p ? esc(p.phone || '') : ''}"></div>
    <button class="btn" id="pSave">${p ? 'Save' : 'Add person'}</button>
    ${p ? `<button class="btn danger" id="pDel">Delete person</button>` : ''}
  `, () => {
    focusLater('#pName');
    $('#pSave').addEventListener('click', () => {
      const name = $('#pName').value.trim();
      if (!name) return toast('Enter a name');
      if (p) { p.name = name; p.phone = $('#pPhone').value.trim(); save(); closeSheet(); render(); toast('Saved'); }
      else {
        const rec = { id: uid('p'), name, phone: $('#pPhone').value.trim() };
        S.people.push(rec); save(); render(); ledgerForm(null, rec.id);
      }
    });
    if (p) $('#pDel').addEventListener('click', () => {
      const n = S.ledger.filter(e => e.pid === p.id).length;
      if (!confirm(`Delete ${p.name} and ${n} ledger entr${n === 1 ? 'y' : 'ies'}?`)) return;
      S.ledger = S.ledger.filter(e => e.pid !== p.id);
      S.people = S.people.filter(x => x.id !== p.id);
      save(); closeSheet(); render(); toast('Deleted');
    });
  });
}

function personDetail(pid) {
  const p = personOf(pid); if (!p) return;
  const bal = personBalance(pid);
  const entries = S.ledger.filter(e => e.pid === pid).sort((a, b) => b.date.localeCompare(a.date));
  const lent = entries.filter(e => e.dir === 'lent').reduce((a, e) => a + e.amt, 0);
  const borrowed = entries.filter(e => e.dir === 'borrowed').reduce((a, e) => a + e.amt, 0);

  const DIRL = { lent: 'You lent', borrowed: 'You borrowed', received: 'They paid you back', paid: 'You paid back' };

  openSheet(p.name, `
    <div class="card" style="text-align:center;padding:16px">
      <div class="cc-lab">${bal > 0 ? 'They owe you' : bal < 0 ? 'You owe them' : 'All settled'}</div>
      <div style="font-size:32px;font-weight:750;letter-spacing:-1px;margin-top:2px" class="${bal > 0 ? 'pos' : bal < 0 ? 'neg' : 'mutedtxt'}">${money(bal)}</div>
      ${p.phone ? `<div class="row-s" style="margin-top:4px">${esc(p.phone)}</div>` : ''}
    </div>

    <div class="btn-row">
      <button class="btn" id="lNew">Add entry</button>
      ${bal !== 0 ? `<button class="btn ghost" id="lSettle">Settle up</button>` : ''}
    </div>

    <div class="card" style="margin-top:14px">
      <div class="kv"><span class="k">Total you lent</span><span class="v pos">${money(lent)}</span></div>
      <div class="kv"><span class="k">Total you borrowed</span><span class="v neg">${money(borrowed)}</span></div>
      <div class="kv"><span class="k">Entries</span><span class="v">${entries.length}</span></div>
    </div>

    <div class="sec-head" style="margin-top:18px"><h3>Ledger</h3></div>
    ${entries.length ? entries.map(e => {
      const s = ledgerSign(e);
      return `<button class="row" data-lid="${e.id}">
        <div class="row-ic" style="color:${s > 0 ? 'var(--green)' : 'var(--red)'}">${s > 0 ? '&#8593;' : '&#8595;'}</div>
        <div class="row-mid"><div class="row-t">${esc(e.note || DIRL[e.dir])}</div><div class="row-s">${DIRL[e.dir]} · ${fmtDate(e.date)}</div></div>
        <div class="row-r"><div class="row-amt ${s > 0 ? 'pos' : 'neg'}">${s > 0 ? '+' : '-'}${money(e.amt)}</div></div>
      </button>`;
    }).join('') : `<div class="row-s" style="padding:10px 2px">No entries yet.</div>`}

    <button class="btn ghost" id="lEditP" style="margin-top:12px">Edit person</button>
  `, () => {
    $('#lNew').addEventListener('click', () => ledgerForm(null, pid));
    $('#lEditP').addEventListener('click', () => personForm(pid));
    if ($('#lSettle')) $('#lSettle').addEventListener('click', () => {
      const amt = Math.abs(bal);
      const dir = bal > 0 ? 'received' : 'paid';
      if (!confirm(`${bal > 0 ? 'Mark ' + money(amt) + ' received from ' : 'Mark ' + money(amt) + ' paid back to '}${p.name}?`)) return;
      S.ledger.push({ id: uid('l'), pid, amt, dir, date: todayISO(), note: 'Settled up' });
      save(); render(); personDetail(pid); toast('Settled');
    });
    $('#sheetBody').querySelectorAll('[data-lid]').forEach(el =>
      el.addEventListener('click', () => ledgerForm(el.dataset.lid)));
  });
}

function ledgerForm(lid, presetPid) {
  const e = lid ? S.ledger.find(x => x.id === lid) : null;
  const pid = e ? e.pid : (presetPid || (S.people[0] && S.people[0].id));
  if (!pid) return personForm();
  const dir = e ? e.dir : 'lent';

  openSheet(e ? 'Edit ledger entry' : 'Add ledger entry', `
    <div class="f"><label>Person</label><select id="lPid">
      ${S.people.map(p => `<option value="${p.id}" ${p.id === pid ? 'selected' : ''}>${esc(p.name)}</option>`).join('')}
    </select></div>
    <div class="f"><div class="seg" id="lDir">
      <button data-val="lent" data-tone="green" class="${dir === 'lent' ? 'on' : ''}">I lent</button>
      <button data-val="borrowed" data-tone="red" class="${dir === 'borrowed' ? 'on' : ''}">I borrowed</button>
    </div></div>
    <div class="f"><div class="seg" id="lDir2">
      <button data-val="received" data-tone="green" class="${dir === 'received' ? 'on' : ''}">They repaid me</button>
      <button data-val="paid" data-tone="red" class="${dir === 'paid' ? 'on' : ''}">I repaid them</button>
    </div></div>
    <div class="f"><label>Amount</label>
      <input id="lAmt" class="amt-in" type="number" inputmode="decimal" step="0.01" placeholder="0" value="${e ? e.amt : ''}"></div>
    <div class="f"><label>Date</label><input id="lDate" type="date" value="${e ? e.date : todayISO()}"></div>
    <div class="f"><label>What for</label><input id="lNote" type="text" placeholder="e.g. movie tickets" value="${e ? esc(e.note || '') : ''}"></div>
    <button class="btn" id="lSave">${e ? 'Save changes' : 'Add entry'}</button>
    ${e ? `<button class="btn danger" id="lDel">Delete entry</button>` : ''}
  `, () => {
    const g1 = seg('#lDir'), g2 = seg('#lDir2');
    let active = ['lent', 'borrowed'].includes(dir) ? 1 : 2;
    $('#lDir').addEventListener('segchange', () => { active = 1; $('#lDir2').querySelectorAll('button').forEach(b => b.classList.remove('on')); });
    $('#lDir2').addEventListener('segchange', () => { active = 2; $('#lDir').querySelectorAll('button').forEach(b => b.classList.remove('on')); });
    if (active === 1) $('#lDir2').querySelectorAll('button').forEach(b => b.classList.remove('on'));
    else $('#lDir').querySelectorAll('button').forEach(b => b.classList.remove('on'));

    $('#lSave').addEventListener('click', () => {
      const amt = num($('#lAmt').value);
      if (amt <= 0) return toast('Enter an amount');
      const d = active === 1 ? g1() : g2();
      const rec = { id: e ? e.id : uid('l'), pid: $('#lPid').value, amt, dir: d, date: $('#lDate').value || todayISO(), note: $('#lNote').value.trim() };
      if (e) S.ledger[S.ledger.findIndex(x => x.id === e.id)] = rec; else S.ledger.push(rec);
      save(); render(); personDetail(rec.pid); toast('Saved');
    });
    if (e) $('#lDel').addEventListener('click', () => {
      if (!confirm('Delete this entry?')) return;
      const p = e.pid;
      S.ledger = S.ledger.filter(x => x.id !== e.id);
      save(); render(); personDetail(p); toast('Deleted');
    });
  });
}

/* ============================================================
   FORMS — bills & EMIs
   ============================================================ */
function billForm(id) {
  const b = id ? S.bills.find(x => x.id === id) : null;
  const kind = b ? b.kind : 'bill';
  const srcOpts = [['cash', 'Cash'], ['bank', 'Bank / UPI'], ...S.cards.map(c => [c.id, c.name + ' (credit card)'])];

  openSheet(b ? 'Edit recurring item' : 'Add bill or EMI', `
    <div class="f"><div class="seg" id="bKind">
      <button data-val="bill" class="${kind === 'bill' ? 'on' : ''}">Bill</button>
      <button data-val="subscription" class="${kind === 'subscription' ? 'on' : ''}">Subscription</button>
      <button data-val="emi" class="${kind === 'emi' ? 'on' : ''}">EMI</button>
    </div></div>
    <div class="f"><label>Name</label><input id="bName" type="text" placeholder="e.g. House rent" value="${b ? esc(b.name) : ''}"></div>
    <div class="f"><label>Amount per month</label>
      <input id="bAmt" class="amt-in" type="number" inputmode="decimal" step="0.01" placeholder="0" value="${b ? b.amt : ''}"></div>
    <div class="frow">
      <div class="f"><label>Due day of month</label><input id="bDay" type="number" inputmode="numeric" min="1" max="31" placeholder="5" value="${b ? b.dueDay : ''}"></div>
      <div class="f"><label>Category</label><select id="bCat">
        ${catsFor('expense').map(c => `<option value="${c.id}" ${b && b.cat === c.id ? 'selected' : (!b && c.id === 'bills' ? 'selected' : '')}>${esc(c.name)}</option>`).join('')}
      </select></div>
    </div>
    <div class="f"><label>Pay from</label><select id="bSrc">
      ${srcOpts.map(([v, l]) => `<option value="${v}" ${b && b.src === v ? 'selected' : ''}>${esc(l)}</option>`).join('')}
    </select></div>
    <div id="emiBox" class="${kind === 'emi' ? '' : 'hidden'}">
      <div class="frow">
        <div class="f"><label>Total installments</label><input id="bN" type="number" inputmode="numeric" placeholder="24" value="${b && b.emiN ? b.emiN : ''}"></div>
        <div class="f"><label>First installment</label><input id="bStart" type="month" value="${b && b.emiStart ? b.emiStart : ymOf(new Date())}"></div>
      </div>
    </div>
    <button class="btn" id="bSave">${b ? 'Save changes' : 'Add'}</button>
    ${b ? `<button class="btn danger" id="bDel">Delete</button>` : ''}
  `, () => {
    const getKind = seg('#bKind');
    $('#bKind').addEventListener('segchange', ev => $('#emiBox').classList.toggle('hidden', ev.detail !== 'emi'));
    $('#bSave').addEventListener('click', () => {
      const name = $('#bName').value.trim();
      const amt = num($('#bAmt').value);
      const day = num($('#bDay').value);
      if (!name) return toast('Give it a name');
      if (amt <= 0) return toast('Enter an amount');
      if (day < 1 || day > 31) return toast('Due day must be 1–31');
      const k = getKind();
      const rec = {
        id: b ? b.id : uid('b'), name, amt, dueDay: day, kind: k,
        cat: $('#bCat').value, src: $('#bSrc').value, active: b ? b.active !== false : true,
        paid: b ? (b.paid || {}) : {},
        start: b ? b.start : todayISO(),
        emiN: k === 'emi' ? num($('#bN').value) || null : null,
        emiStart: k === 'emi' ? ($('#bStart').value || ymOf(new Date())) : null
      };
      if (b) S.bills[S.bills.findIndex(x => x.id === b.id)] = rec; else S.bills.push(rec);
      save(); closeSheet(); render(); toast('Saved');
    });
    if (b) $('#bDel').addEventListener('click', () => {
      if (!confirm(`Delete ${b.name}? Transactions already recorded stay in your history.`)) return;
      S.bills = S.bills.filter(x => x.id !== b.id);
      save(); closeSheet(); render(); toast('Deleted');
    });
  });
}

function billDetail(id, month) {
  const b = S.bills.find(x => x.id === id); if (!b) return;
  const ym = month || cur;
  const paidMonths = Object.keys(b.paid || {}).sort().reverse();
  const isPaid = !!(b.paid && b.paid[ym]);
  const due = occurrence(b.dueDay, ym);
  const d = daysUntil(due);
  const total = paidMonths.reduce((a, m) => a + (b.paid[m].amt || 0), 0);

  openSheet(b.name, `
    <div class="card" style="text-align:center;padding:16px">
      <div class="cc-lab">${monthLabel(ym)} · due ${fmtDate(due)}</div>
      <div style="font-size:32px;font-weight:750;letter-spacing:-1px;margin-top:2px">${money(b.amt)}</div>
      <div style="margin-top:8px"><span class="pill ${isPaid ? 'g' : d < 0 ? 'r' : 'a'}">${isPaid ? 'Paid' : d < 0 ? (-d) + ' days overdue' : d === 0 ? 'Due today' : 'Due in ' + d + ' days'}</span></div>
    </div>

    ${isPaid
      ? `<button class="btn ghost" id="bUnpay" style="margin-top:14px">Undo payment for ${monthLabel(ym)}</button>`
      : `<button class="btn" id="bPay" style="margin-top:14px">Mark paid for ${monthLabel(ym)}</button>`}

    <div class="card" style="margin-top:14px">
      <div class="kv"><span class="k">Type</span><span class="v">${b.kind === 'emi' ? 'EMI' : b.kind === 'subscription' ? 'Subscription' : 'Bill'}</span></div>
      <div class="kv"><span class="k">Pay from</span><span class="v">${esc(srcLabel(b.src))}</span></div>
      <div class="kv"><span class="k">Category</span><span class="v">${esc(catOf(b.cat).name)}</span></div>
      ${b.kind === 'emi' && b.emiN ? `
      <div class="kv"><span class="k">Installments paid</span><span class="v">${paidMonths.length} of ${b.emiN}</span></div>
      <div class="kv"><span class="k">Remaining</span><span class="v">${money(Math.max(0, (b.emiN - paidMonths.length) * b.amt))}</span></div>` : ''}
      <div class="kv"><span class="k">Paid so far</span><span class="v pos">${money(total)}</span></div>
    </div>
    ${b.kind === 'emi' && b.emiN ? `<div class="bar" style="margin-top:10px"><i style="width:${Math.min(100, paidMonths.length / b.emiN * 100)}%;background:var(--green)"></i></div>` : ''}

    ${paidMonths.length ? `<div class="sec-head" style="margin-top:18px"><h3>Payment history</h3></div>` +
      paidMonths.slice(0, 12).map(m => `<div class="row" style="cursor:default">
        <div class="row-ic" style="color:var(--green)">&#10003;</div>
        <div class="row-mid"><div class="row-t">${monthLabel(m)}</div><div class="row-s">paid on ${fmtDate(b.paid[m].date)}</div></div>
        <div class="row-r"><div class="row-amt">${money(b.paid[m].amt)}</div></div>
      </div>`).join('') : ''}

    <button class="btn ghost" id="bEdit" style="margin-top:12px">Edit</button>
  `, () => {
    $('#bEdit').addEventListener('click', () => billForm(id));
    if ($('#bPay')) $('#bPay').addEventListener('click', () => {
      const date = daysUntil(due) <= 0 ? due : todayISO();
      const t = { id: uid('t'), kind: 'expense', amt: b.amt, cat: b.cat, src: b.src, date, note: b.name, ts: Date.now() };
      S.txns.push(t);
      b.paid = b.paid || {};
      b.paid[ym] = { date, amt: b.amt, txnId: t.id };
      save(); render(); billDetail(id, ym); toast('Marked paid');
    });
    if ($('#bUnpay')) $('#bUnpay').addEventListener('click', () => {
      const rec = b.paid[ym];
      if (rec && rec.txnId) S.txns = S.txns.filter(t => t.id !== rec.txnId);
      delete b.paid[ym];
      save(); render(); billDetail(id, ym); toast('Payment undone');
    });
  });
}

/* ============================================================
   BACKUP / RESTORE
   ============================================================ */
function exportData() {
  const stamp = new Date().toISOString().slice(0, 10);
  const name = `paisa-book-backup-${stamp}.json`;
  const json = JSON.stringify(S, null, 2);
  const P = window.Capacitor && window.Capacitor.Plugins;

  if (P && P.Filesystem) {
    P.Filesystem.writeFile({ path: name, data: json, directory: 'DOCUMENTS', encoding: 'utf8' })
      .then(res => {
        toast('Saved to Documents');
        if (P.Share) P.Share.share({ title: 'Paisa Book backup', url: res.uri, dialogTitle: 'Share backup' }).catch(() => {});
      })
      .catch(err => { console.error(err); browserDownload(name, json); });
    return;
  }
  browserDownload(name, json);
}
function browserDownload(name, json) {
  try {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' }));
    a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    toast('Backup downloaded');
  } catch (e) { console.error(e); toast('Export failed'); }
}
function importData() {
  const inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'application/json,.json';
  inp.addEventListener('change', () => {
    const f = inp.files && inp.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => {
      try {
        const d = JSON.parse(r.result);
        if (!d || typeof d !== 'object' || !Array.isArray(d.txns)) throw new Error('not a Paisa Book backup');
        if (!confirm(`Replace everything on this device with this backup?\n\n${d.txns.length} transactions, ${(d.cards||[]).length} cards, ${(d.people||[]).length} people.`)) return;
        S = d;
        for (const k in BLANK) if (S[k] === undefined) S[k] = clone(BLANK[k]);
        save(); render(); toast('Backup restored');
      } catch (e) { console.error(e); toast('Could not read that file'); }
    };
    r.readAsText(f);
  });
  inp.click();
}
function resetData() {
  if (!confirm('Erase every transaction, card, person and bill on this device?\n\nThis cannot be undone. Export a backup first if unsure.')) return;
  if (!confirm('Really erase everything?')) return;
  S = clone(BLANK);
  save(); render(); toast('All data erased');
}

/* ============================================================
   ACTION MAP
   ============================================================ */
const ACT = {
  openTxn: d => txnForm(d.id),
  openCard: d => cardDetail(d.id),
  openPerson: d => personDetail(d.id),
  openBill: d => billDetail(d.id, d.m),
  newTxn: () => txnForm(),
  newCard: () => cardForm(),
  newPerson: () => personForm(),
  newBill: () => billForm(),
  goCards: () => setTab('cards'),
  goBills: () => setTab('bills'),
  goFriends: () => setTab('friends'),
  goSpends: () => setTab('spends'),
  setSrc: d => { srcFilter = d.v; render(); },
  exportData, importData, resetData
};

/* ---------------- boot ---------------- */
render();
