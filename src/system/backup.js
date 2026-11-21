import { get } from "../core/store.js";
export const toJSON = () => JSON.stringify({ app: "Interception", version: typeof __APP_VERSION__ === "undefined" ? "dev" : __APP_VERSION__, exported: new Date().toISOString(), data: get() }, null, 2);
const A = Array.isArray, S = (x) => typeof x === "string", N = (x) => typeof x === "number";
export function validate(o) {
  const d = o && o.data;
  if (!d || typeof d !== "object") return { error: "This file isn’t an Interception backup." };
  if (!A(d.habits) || !d.habits.every((h) => h && S(h.id) && S(h.name) && A(h.days) && h.days.every((n) => Number.isInteger(n) && n >= 0 && n <= 6) && S(h.start) && (h.status === "active" || h.status === "archived"))) return { error: "The habits in this file are invalid." };
  if (!A(d.moods) || !d.moods.every((m) => m && S(m.id) && N(m.ts) && S(m.date) && S(m.mood) && (m.feels === undefined || (A(m.feels) && m.feels.every(S))))) return { error: "The mood entries in this file are invalid." };
  if (!A(d.diary) || !d.diary.every((e) => e && S(e.id) && S(e.title) && S(e.body) && S(e.date) && N(e.updated))) return { error: "The diary entries in this file are invalid." };
  if (!d.done || typeof d.done !== "object" || A(d.done) || !Object.values(d.done).every((v) => v === 1)) return { error: "The completion records in this file are invalid." };
  return { data: { habits: d.habits, moods: d.moods, diary: d.diary, done: d.done } };
}
export const sizes = () => {
  const s = get(), b = (x) => new TextEncoder().encode(JSON.stringify(x)).length;
  return { diary: b(s.diary), mood: b(s.moods), habits: b(s.habits), calendar: b(s.done) };
};
export const fmtBytes = (n) => (n < 1024 ? n + " B" : n < 1048576 ? (n / 1024).toFixed(1) + " KB" : (n / 1048576).toFixed(2) + " MB");
