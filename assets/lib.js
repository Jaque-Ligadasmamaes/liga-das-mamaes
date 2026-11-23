// supabase-js fica no próprio site (assets/vendor), carregado antes deste arquivo
const { createClient } = window.supabase;
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const sb = createClient(SUPABASE_URL, SUPABASE_KEY);

export const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const $ = (sel, el = document) => el.querySelector(sel);
export const $$ = (sel, el = document) => [...el.querySelectorAll(sel)];
export const brl = (v) => v == null || v === '' ? '' : Number(v).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
export const dataBR = (d) => {
  if (!d) return '';
  const [y, m, dd] = String(d).slice(0, 10).split('-');
  return `${dd}/${m}/${y}`;
};
export const dataLonga = (d) => {
  if (!d) return 'Data a definir';
  const dt = new Date(String(d).slice(0, 10) + 'T12:00:00');
  return dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });
};
// Só aceita links http(s), para evitar javascript: em dados enviados por terceiros
export const safeUrl = (u) => {
  if (!u) return '';
  let s = String(u).trim();
  if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
  try { const x = new URL(s); return (x.protocol === 'http:' || x.protocol === 'https:') ? x.href : ''; } catch { return ''; }
};
export const waLink = (num, texto = '') => {
  const d = String(num || '').replace(/\D/g, '');
  if (!d) return '';
  const full = d.length <= 11 ? '55' + d : d;
  return `https://wa.me/${full}${texto ? '?text=' + encodeURIComponent(texto) : ''}`;
};
export const instaLink = (h) => {
  if (!h) return '';
  if (/instagram\.com/i.test(h)) return safeUrl(h);
  return 'https://instagram.com/' + String(h).replace(/^@/, '').trim();
};
export function toast(msg) {
  let t = $('#toast');
  if (!t) { t = document.createElement('div'); t.id = 'toast'; document.body.appendChild(t); }
  t.textContent = msg; t.classList.add('show');
  clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove('show'), 3200);
}
