import { get, commit } from "./store.js";
import { dt, ago, today } from "./dates.js";
export const sched = (x, s) => x.status === "active" && x.start <= s && x.days.includes(dt(s).getDay());
export const isDone = (x, s) => !!get().done[x.id + "|" + s];
export function toggle(x, s = today()) { const d = get().done, k = x.id + "|" + s; d[k] ? delete d[k] : (d[k] = 1); return commit(); }
export function stat(x, days = 30) {
  let n = 0, c = 0;
  for (let i = 0; i < days; i++) { const s = ago(i); if (sched(x, s)) { n++; if (isDone(x, s)) c++; } }
  return { n, c };
}
export function dayInfo(date) {
  const s = get();
  return { habits: s.habits.filter((x) => sched(x, date)), moods: s.moods.filter((m) => m.date === date).sort((a, b) => a.ts - b.ts), diary: s.diary.filter((e) => e.date === date) };
}
export function monthMarks(prefix) {
  const s = get(), out = {}, at = (d) => out[d] || (out[d] = { h: 0, m: 0, d: 0 });
  for (const k in s.done) { const [id, d] = k.split("|"); if (d && d.startsWith(prefix) && s.habits.some((x) => x.id === id)) at(d).h++; }
  s.moods.forEach((m) => m.date.startsWith(prefix) && at(m.date).m++);
  s.diary.forEach((e) => e.date.startsWith(prefix) && at(e.date).d++);
  return out;
}
