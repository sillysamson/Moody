// Dashboard layout resolution (pure). Saved layout can mention modules that no longer exist, miss new ones, or contain duplicates.
// Returns { order, hidden } using only ids in `ids`. First run (nothing saved) = `defaults` visible, rest hidden.
export function resolveLayout(saved, ids, defaults = ids) {
  const s = saved || {}, so = Array.isArray(s.order) ? s.order : [], sh = Array.isArray(s.hidden) ? s.hidden : [];
  const ok = (id) => typeof id === "string" && ids.includes(id), uniq = (a) => a.filter((x, i) => a.indexOf(x) === i);
  const order = uniq(so.filter(ok)), hidden = uniq(sh.filter(ok)).filter((id) => !order.includes(id));
  const known = new Set([...so, ...sh]), fresh = !so.length && !sh.length;
  for (const id of ids) {
    if (order.includes(id) || hidden.includes(id)) continue;
    // a module introduced after the layout was saved: visible if it is a default one, otherwise offered in the add list
    (fresh || !known.has(id)) && defaults.includes(id) ? order.push(id) : hidden.push(id);
  }
  return { order, hidden };
}
export const move = (order, from, to) => { const a = [...order]; if (from < 0 || from >= a.length) return a; to = Math.max(0, Math.min(a.length - 1, to)); a.splice(to, 0, a.splice(from, 1)[0]); return a; };
// ---- 1.5 bento ----
// Module sizes: "s" = half width, "m" = full width, "l" = full width and taller (more content). The grid has two columns.
// A saved size the module does not support (or a corrupt value) falls back to the module's default.
export const resolveSize = (saved, allowed, def) => (allowed.includes(saved) ? saved : def);
// Column span per module, in order. Two "s" in a row share a line; an "s" with no "s" partner would leave a hole beside it, so it takes the full width.
export function spans(sizes) {
  const out = [];
  for (let i = 0; i < sizes.length; i++) { if (sizes[i] === "s" && sizes[i + 1] === "s") { out.push(1, 1); i++; } else out.push(2); }
  return out;
}
// Next size in `allowed`, wrapping (used by keyboard/one-tap resizing).
export const nextSize = (cur, allowed) => allowed[(Math.max(0, allowed.indexOf(cur)) + 1) % allowed.length];
