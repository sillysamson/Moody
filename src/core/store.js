import { DEF, deepMerge } from "../system/defaults.js";
const K = "interception.v1";
const def = () => ({ habits: [], done: {}, moods: [], diary: [], prefs: structuredClone(DEF) });
let S = def(), hook = () => {};
export let loadError = false;
export const get = () => S;
export const onCommit = (f) => { hook = f; };
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export function load() {
  let raw = null;
  try { raw = localStorage.getItem(K); S = { ...def(), ...(JSON.parse(raw || "null") || {}) }; }
  catch { S = def(); loadError = true; try { if (raw) localStorage.setItem(K + ".corrupt", raw); } catch {} }
  S.prefs = deepMerge(DEF, S.prefs || {});
}
export function commit() {
  try { localStorage.setItem(K, JSON.stringify(S)); } catch { return false; }
  try { hook(); } catch {}
  return true;
}
export function wipe() { S = { ...def(), prefs: S.prefs }; return commit(); }
export function setData(d) { S = { ...def(), habits: d.habits, done: d.done, moods: d.moods, diary: d.diary, prefs: S.prefs }; return commit(); }
