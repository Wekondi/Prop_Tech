// dashboard.js - state manager for the Buyer and Developer dashboards.
// Each page calls its own init function. All user data is inserted with textContent
// (never innerHTML) so a malicious listing title or file name can't inject HTML.
import { api } from './api.js';
import { requireAuth, signOut } from './auth.js';

// ---------- Small helpers ----------
const $ = (id) => document.getElementById(id);

function el(tag, { className, text, attrs } = {}, children = []) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  if (attrs) Object.entries(attrs).forEach(([k, v]) => node.setAttribute(k, v));
  children.forEach((c) => node.appendChild(c));
  return node;
}

export const formatKES = (n) => 'KES ' + Number(n || 0).toLocaleString('en-KE');
const formatDate = (d) => (d ? new Date(d).toLocaleDateString('en-KE', { dateStyle: 'medium' }) : '');
const prettify = (s) => String(s || '').replace(/_/g, ' ').replace(/^\w/, (c) => c.toUpperCase());

function setState(container, kind, message) {
  container.replaceChildren(el('div', { className: `state ${kind === 'error' ? 'error' : ''}`, text: message }));
}

function renderHeader(user) {
  $('who').textContent = user.user_metadata?.full_name || user.email;
  $('logout').addEventListener('click', signOut);
}

// ---------- Buyer dashboard ----------
const PURCHASE_STEPS = ['reserved', 'deposit_paid', 'in_progress', 'completed'];

function renderPurchase(p) {
  const percent = p.price ? Math.min(100, Math.round((p.amount_paid / p.price) * 100)) : 0;
  const currentIndex = Math.max(0, PURCHASE_STEPS.indexOf(p.status));

  const steps = el('ol', { className: 'steps' },
    PURCHASE_STEPS.map((s, i) => el('li', {
      className: [i <= currentIndex ? 'done' : '', i === currentIndex ? 'current' : ''].join(' ').trim(),
      text: prettify(s),
    })));

  const bar = el('span');
  bar.style.width = `${percent}%`;

  const card = el('article', { className: 'card' }, [
    el('div', { className: 'purchase-top' }, [
      el('div', {}, [
        el('h3', { text: p.property_title }),
        el('div', { className: 'muted', text: `Price: ${formatKES(p.price)}` }),
      ]),
      el('span', { className: `badge ${p.status}`, text: prettify(p.status) }),
    ]),
    el('div', { className: 'progress-wrap' }, [
      el('div', { className: 'progress-label' }, [
        el('span', { text: `Paid ${formatKES(p.amount_paid)}` }),
        el('span', { text: `${percent}% · Balance ${formatKES(p.price - p.amount_paid)}` }),
      ]),
      el('div', { className: 'progress', attrs: { role: 'progressbar', 'aria-valuenow': percent, 'aria-valuemin': 0, 'aria-valuemax': 100 } }, [bar]),
    ]),
    steps,
  ]);

  const custom = Object.entries(p.customizations || {});
  if (custom.length) {
    card.appendChild(el('h3', { text: 'Your customizations', attrs: { style: 'margin-top:20px;font-size:.95rem' } }));
    card.appendChild(el('div', { className: 'chips' },
      custom.map(([k, v]) => el('span', { className: 'chip', text: `${prettify(k)}: ${v}` }))));
  }
  return card;
}

function renderDocuments(docs) {
  if (!docs.length) return el('div', { className: 'state', text: 'No documents uploaded yet.' });
  return el('ul', { className: 'list' }, docs.map((d) => {
    const link = el('a', { className: 'btn secondary', text: 'Download', attrs: { href: d.url, target: '_blank', rel: 'noopener' } });
    return el('li', {}, [
      el('div', {}, [el('strong', { text: d.name }), el('div', { className: 'muted', text: `Uploaded ${formatDate(d.uploaded_at)}` })]),
      link,
    ]);
  }));
}

export async function initBuyerDashboard() {
  const user = await requireAuth('buyer');
  if (!user) return;
  renderHeader(user);

  const purchasesBox = $('purchases');
  const docsBox = $('documents');
  setState(purchasesBox, 'loading', 'Loading your purchases…');
  setState(docsBox, 'loading', 'Loading documents…');

  // Load both sections independently so one failure doesn't blank the page
  const [purchases, docs] = await Promise.allSettled([api.getMyPurchases(), api.getMyDocuments()]);

  if (purchases.status === 'rejected') {
    setState(purchasesBox, 'error', purchases.reason.message);
  } else if (!purchases.value.length) {
    setState(purchasesBox, 'empty', 'You have no purchases yet. Browse the catalog to get started.');
  } else {
    purchasesBox.replaceChildren(...purchases.value.map(renderPurchase));
  }

  if (docs.status === 'rejected') {
    setState(docsBox, 'error', docs.reason.message);
  } else {
    docsBox.replaceChildren(renderDocuments(docs.value));
  }
}

// ---------- Page router ----------
// Each dashboard page sets <body data-page="buyer"> or data-page="developer".
const page = document.body.dataset.page;
if (page === 'buyer') initBuyerDashboard();
// Developer dashboard init is added in the next step.