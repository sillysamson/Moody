import { useCallback, useState } from 'react';
import { detectLang } from './i18n';

const KEY = 'moodys';
const rem = () => Object.fromEntries([['task', '09:00'], ['habit', '08:00'], ['walk', '17:00'], ['diary', '21:00'], ['mood', '12:00']].map(([k, time]) => [k, { on: false, time }]));
const defPrefs = () => ({ lang: detectLang(), theme: 'system', haptics: true, level: 'medium', rem: rem() });
export const empty = { cards: [], moods: [], zen: [], steps: {}, diary: [], habits: [], tasks: [], prefs: defPrefs() };
const pad = (n) => String(n).padStart(2, '0');
export const dayKey = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const inPeriod = (day, p) => {
  const n = { day: 0, week: 6, month: 29 }[p];
  const t = new Date();
  return day >= dayKey(new Date(t.getFullYear(), t.getMonth(), t.getDate() - n)) && day <= dayKey(t);
};

const load = () => {
  try {
    const v = JSON.parse(localStorage.getItem(KEY)) || {};
    const d = defPrefs();
    return { ...empty, ...v, prefs: { ...d, ...(v.prefs || {}), rem: { ...d.rem, ...(v.prefs?.rem || {}) } } };
  } catch { return { ...empty, prefs: defPrefs() }; }
};

export function useStore() {
  const [s, set] = useState(load);
  // shortcut: write errors are swallowed, upgrade to a visible "couldn't save" state
  const update = useCallback((fn) => set((p) => {
    const n = fn(p);
    try { localStorage.setItem(KEY, JSON.stringify(n)); } catch {}
    return n;
  }), []);
  return [s, update];
}
