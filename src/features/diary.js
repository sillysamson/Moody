import { h } from "../ui/dom.js";
import { ic } from "../ui/icons.js";
import { btn, card, empty, toast, confirmBox } from "../ui/components.js";
import { openPanel } from "../system/shared.js";
import { haptic } from "../system/haptics.js";
import { T } from "../system/tokens.js";
import { t } from "../system/i18n.js";
import { get, commit, uid } from "../core/store.js";
import { today, long, short } from "../core/dates.js";
import { app } from "../core/app.js";

let D = null, Q = "", timer, st = "", bad = false;
const blank = (d) => !d.title.trim() && !d.body.trim();
const setSt = (m, e = false) => { st = m; bad = e; const el = document.getElementById("ds"); if (el) { el.textContent = m; el.classList.toggle("er", e); } };
export function flush() {
  clearTimeout(timer);
  if (!D || blank(D)) return true;
  const e = { ...D, updated: Date.now() }, a = get().diary, i = a.findIndex((x) => x.id === D.id);
  i < 0 ? a.push(e) : (a[i] = e);
  const ok = commit();
  setSt(ok ? t("Saved") : t("Couldn’t save. Your text is still here; try again."), !ok);
  if (ok && !bad && e.body.length > 0) haptic("success");
  return ok;
}
export function leave() { flush(); D = null; st = ""; }
const start = () => { D = { id: uid(), title: "", body: "", date: today() }; st = ""; };

const editor = (ctx) => {
  const q = () => { setSt(t("Saving…")); clearTimeout(timer); timer = setTimeout(flush, 700); };
  return h("div", { class: "pbody" },
    h("div", { class: "top2" }, h("p", { class: "eyebrow" }, long(D.date)), h("span", { id: "ds", class: "mu sm" + (bad ? " er" : ""), role: "status", "aria-live": "polite" }, st)),
    h("input", { class: "dtitle", type: "text", placeholder: t("Title"), "aria-label": t("Title"), value: D.title, autocomplete: "off", oninput: (e) => { D.title = e.target.value; q(); } }),
    h("textarea", { class: "dbody", placeholder: t("Start with a thought, a sentence, or nothing at all."), "aria-label": t("Entry"), oninput: (e) => { D.body = e.target.value; q(); } }, D.body),
    btn(t("Delete entry"), { kind: "danger", sm: true, icon: "trash", onclick: async () => {
      if (!(await confirmBox({ title: t("Delete this entry?"), body: t("This can’t be undone."), ok: t("Delete entry"), keep: t("Keep entry"), danger: true }))) return;
      clearTimeout(timer); const a = get().diary, i = a.findIndex((x) => x.id === D.id); if (i >= 0) a.splice(i, 1);
      D = null; commit() ? toast(t("Entry deleted.")) : toast(t("Couldn’t save. Please try again."), true); ctx.close();
    } }));
};
export const openEntry = (e) => { D = { ...e }; st = ""; openEditor(T.sid.entry(e.id)); };
const openEditor = (sid) => openPanel({ sid, mode: "full", label: t("Diary entry"), render: editor, onClose: () => { flush(); clearTimeout(timer); D = null; st = ""; } });

const list = () => {
  const q = Q.trim().toLowerCase(), all = get().diary;
  const l = all.filter((e) => !q || (e.title + " " + e.body).toLowerCase().includes(q)).sort((a, b) => b.updated - a.updated);
  if (!l.length) return card(null, empty("diary", all.length ? t("No entries match your search.") : t("Start with a thought, a sentence, or nothing at all.")));
  return h("div", { class: "stack" }, l.map((e) => h("button", { type: "button", class: "card entry", "data-sid": T.sid.entry(e.id), onclick: () => { haptic("select"); openEntry(e); } },
    h("b", {}, e.title || t("Untitled")), h("span", { class: "mu sm" }, short(e.date)), h("span", { class: "pv" }, e.body.slice(0, 90) + (e.body.length > 90 ? "…" : "")))));
};
export function diary(arg) {
  const box = h("div", { id: "dlist" }, list());
  const page = h("div", { class: "page" },
    h("div", {}, h("p", { class: "eyebrow" }, t("Reflect")), h("h1", {}, t("Diary"))),
    h("label", { class: "card search" }, ic("search", 18), h("input", { type: "search", placeholder: t("Search entries"), "aria-label": t("Search entries"), value: Q, oninput: (e) => { Q = e.target.value; box.replaceChildren(list()); } })),
    box);
  app.primary = { label: t("New entry"), run: () => { start(); openEditor(T.sid.fab("diary")); }, sid: T.sid.fab("diary") };
  if (arg === "new") requestAnimationFrame(() => { start(); openEditor(T.sid.fab("diary")); });
  return page;
}
