// Pure reminder planner: which notifications should exist for the next N days.
import { addD, dt } from "../core/dates.js";
import { sched, isDone } from "../core/logic.js";
const CODE = { checkin: 1, mood: 2, habit: 3 };
const mins = (s) => { const [a, b] = s.split(":").map(Number); return a * 60 + b; };
export const inQuiet = (q, hm) => { if (!q.on) return false; const x = mins(hm), f = mins(q.from), e = mins(q.to); return f < e ? x >= f && x < e : x >= f || x < e; };
const pendingSince = (x, date) => { for (let k = 0; k < 7; k++) { const s = addD(date, -k); if (sched(x, s)) return !isDone(x, s); } return false; };
export function plan(P, S, now = new Date(), days = 14) {
  const n = P.notif, out = [];
  if (!n.on) return out;
  const base = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const hs = S.habits.filter((x) => x.status === "active");
  const add = (kind, date, time) => {
    if (inQuiet(n.quiet, time)) return;
    const [h, m] = time.split(":").map(Number), at = new Date(dt(date)); at.setHours(h, m, 0, 0);
    if (at <= now) return;
    out.push({ id: CODE[kind] * 1e8 + Number(date.replaceAll("-", "")), at, kind });
  };
  for (let i = 0; i < days; i++) {
    const date = addD(base, i);
    if (n.checkin.on) add("checkin", date, n.checkin.time);
    if (n.mood.on) add("mood", date, n.mood.time);
    const f = n.habit.freq;
    if (f === "day" && hs.some((x) => sched(x, date) && !isDone(x, date))) add("habit", date, n.habit.time);
    if (f === "before") { const nx = addD(date, 1); if (hs.some((x) => sched(x, nx) && !isDone(x, nx))) add("habit", date, n.habit.time); }
    if (f === "until" && hs.some((x) => pendingSince(x, date))) add("habit", date, n.habit.time);
  }
  return out;
}
