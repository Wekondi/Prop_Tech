// api.js - shared fetch helper for the Buyer and Developer dashboards.
// Usage: <script type="module"> import { api } from './api.js'; </script>
// Expects ./supabaseClient.js to export a initialised client: export const supabase = createClient(...)
import { supabase } from './supabaseClient.js';

const API_BASE = 'http://localhost:3000/api'; // change to Member 1's server URL
const USE_MOCK = true; // set to false once the backend routes are ready

// Gets the current Supabase access token (refreshed automatically by supabase-js)
async function getToken() {
  const { data } = await supabase.auth.getSession();
  return data?.session?.access_token || null;
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' };
  if (auth) {
    const token = await getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  let res;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    throw new Error('Cannot reach the server. Check your connection and try again.');
  }

  if (res.status === 401) {
    // Session expired or not logged in
    window.location.href = 'login.html';
    throw new Error('Please log in again.');
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || `Request failed (${res.status})`);
  return data;
}

// ---------- Mock data (used while USE_MOCK is true) ----------
const mock = {
  purchases: [
    {
      id: 1,
      property_title: '3BR Maisonette, Athi River',
      price: 8500000,
      status: 'deposit_paid', // reserved | deposit_paid | in_progress | completed
      amount_paid: 850000,
      customizations: { flooring: 'Porcelain tiles', paint: 'Soft white' },
    },
  ],
  documents: [
    { id: 1, name: 'Sale Agreement.pdf', url: '#', uploaded_at: '2026-11-10' },
    { id: 2, name: 'Title Deed Copy.pdf', url: '#', uploaded_at: '2026-11-12' },
  ],
  listings: [
    { id: 1, title: '3BR Maisonette, Athi River', price: 8500000, status: 'available' },
    { id: 2, title: '2BR Apartment, Syokimau', price: 5200000, status: 'reserved' },
  ],
};

const wait = (ms = 300) => new Promise((r) => setTimeout(r, ms));
const fromMock = async (data) => { await wait(); return structuredClone(data); };

// ---------- Public API ----------
export const api = {
  // Buyer dashboard
  getMyPurchases: () => USE_MOCK ? fromMock(mock.purchases) : request('/purchases/me'),
  getMyDocuments: () => USE_MOCK ? fromMock(mock.documents) : request('/documents/me'),

  // Developer dashboard
  getMyListings: () => USE_MOCK ? fromMock(mock.listings) : request('/properties/mine'),
  createListing: (listing) => USE_MOCK
    ? fromMock({ ...listing, id: Date.now() })
    : request('/properties', { method: 'POST', body: listing }),
  updateListing: (id, changes) => USE_MOCK
    ? fromMock({ id, ...changes })
    : request(`/properties/${id}`, { method: 'PUT', body: changes }),
  deleteListing: (id) => USE_MOCK
    ? fromMock({ success: true })
    : request(`/properties/${id}`, { method: 'DELETE' }),
};