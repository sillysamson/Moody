// What home-screen widgets may show: counts and up to two habit names. Never diary text, never mood notes. Written by the app after every change.
import { sched, isDone } from "../core/logic.js";
export function snapshot(S, td) {
  const hs = S.habits.filter((x) => sched(x, td)), left = hs.filter((x) => !isDone(x, td));
  return { date: td, total: hs.length, done: hs.length - left.length, moods: S.moods.filter((m) => m.date === td).length, next: left.slice(0, 2).map((x) => x.name).join(", ").slice(0, 60) };
}
