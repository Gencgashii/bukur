import { API_URL } from '../config';

const BASE = API_URL.replace(/\/$/, '');

// CSRF token lives only in memory (never localStorage/sessionStorage). The JWT
// is in an HttpOnly cookie the browser sends automatically and JS cannot read.
let csrfToken = '';
export const setCsrf = (t) => { csrfToken = t || ''; };
export const getCsrf = () => csrfToken;

let onAuthLost = () => {};
export const setAuthLostHandler = (fn) => { onAuthLost = fn || (() => {}); };

async function request(path, { method = 'GET', body, formData, headers } = {}) {
  const opts = {
    method,
    credentials: 'include',
    headers: { ...(headers || {}) },
  };
  if (formData) {
    opts.body = formData; // browser sets multipart boundary
  } else if (body !== undefined) {
    opts.headers['Content-Type'] = 'application/json';
    opts.body = JSON.stringify(body);
  }
  if (method !== 'GET' && method !== 'HEAD') {
    opts.headers['X-CSRF-Token'] = csrfToken;
  }

  let res;
  try {
    res = await fetch(`${BASE}${path}`, opts);
  } catch (e) {
    const err = new Error('Could not reach the server. Check your connection and try again.');
    err.cause = e;
    throw err;
  }

  if (res.status === 401) {
    onAuthLost();
    const err = new Error('Your session has expired. Please sign in again.');
    err.status = 401;
    throw err;
  }

  let payload = null;
  try { payload = await res.json(); } catch { payload = null; }

  if (!res.ok) {
    const err = new Error(payload?.error?.message || payload?.message || `Request failed (${res.status}).`);
    err.status = res.status;
    err.code = payload?.error?.code;
    err.details = payload?.error?.details;
    throw err;
  }
  return payload;
}

export const api = {
  // auth
  session: () => request('/auth/session'),
  login: (email, password) => request('/auth/user/emailpass', { method: 'POST', body: { email, password } }),
  logout: () => request('/auth/session', { method: 'DELETE' }),

  // dashboard
  dashboard: () => request('/admin/dashboard'),

  // products
  products: (qs = '') => request(`/admin/products${qs}`),
  product: (id) => request(`/admin/products/${id}`),
  createProduct: (data) => request('/admin/products', { method: 'POST', body: data }),
  updateProduct: (id, data) => request(`/admin/products/${id}`, { method: 'PATCH', body: data }),
  archiveProduct: (id) => request(`/admin/products/${id}/archive`, { method: 'POST' }),
  unarchiveProduct: (id) => request(`/admin/products/${id}/unarchive`, { method: 'POST' }),
  deleteProduct: (id) => request(`/admin/products/${id}`, { method: 'DELETE' }),
  adjustInventory: (id, adjustment, reason) =>
    request(`/admin/products/${id}/inventory-adjustments`, { method: 'POST', body: { adjustment, reason } }),

  // inventory
  inventory: (qs = '') => request(`/admin/inventory${qs}`),
  adjustments: (qs = '') => request(`/admin/inventory/adjustments${qs}`),

  // orders
  orders: (qs = '') => request(`/admin/orders${qs}`),
  order: (id) => request(`/admin/orders/${id}`),
  updateOrder: (id, data) => request(`/admin/orders/${id}`, { method: 'PATCH', body: data }),

  // payments
  payments: (qs = '') => request(`/admin/payments${qs}`),
  confirmPayment: (id, status = 'paid') =>
    request(`/admin/payments/${id}/confirm`, { method: 'POST', body: { status } }),

  // customers
  customers: (qs = '') => request(`/admin/customers${qs}`),
  customer: (email) => request(`/admin/customers/${encodeURIComponent(email)}`),

  // categories
  categories: () => request('/admin/categories'),
  createCategory: (name) => request('/admin/categories', { method: 'POST', body: { name } }),
  updateCategory: (id, name) => request(`/admin/categories/${id}`, { method: 'PATCH', body: { name } }),
  archiveCategory: (id) => request(`/admin/categories/${id}/archive`, { method: 'POST' }),
  unarchiveCategory: (id) => request(`/admin/categories/${id}/unarchive`, { method: 'POST' }),

  // settings
  settings: () => request('/admin/settings'),
  saveSettings: (data) => request('/admin/settings', { method: 'PUT', body: data }),

  // audit
  auditLog: (qs = '') => request(`/admin/audit-log${qs}`),

  // uploads
  upload: (files) => {
    const fd = new FormData();
    [...files].forEach((f) => fd.append('files', f));
    return request('/admin/uploads', { method: 'POST', formData: fd });
  },
};
