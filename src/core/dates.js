import { get } from "./store.js";
import { t } from "../system/i18n.js";
const P = () => get().prefs, p2 = (n) => String(n).padStart(2, "0");
export const loc = () => (P().lang === "id" ? "id-ID" : "en-US");
export const ymd = (d) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
export const today = () => ymd(new Date());
export const dt = (s) => new Date(s + "T00:00");
export const addD = (s, n) => { const d = dt(s); d.setDate(d.getDate() + n); return ymd(d); };
export const ago = (n) => addD(today(), -n);
export const dn = (i) => new Intl.DateTimeFormat(loc(), { weekday: "short" }).format(new Date(2024, 0, 7 + i)); // Sunday = 0
export const long = (s) => dt(s).toLocaleDateString(loc(), { weekday: "long", month: "long", day: "numeric" });
export const monthName = (y, m) => new Date(y, m, 1).toLocaleDateString(loc(), { month: "long", year: "numeric" });
export function short(s) {
  const f = P().dateFmt, d = dt(s);
  if (f === "dmy") return `${p2(d.getDate())}/${p2(d.getMonth() + 1)}/${d.getFullYear()}`;
  if (f === "mdy") return `${p2(d.getMonth() + 1)}/${p2(d.getDate())}/${d.getFullYear()}`;
  if (f === "ymd") return s;
  return d.toLocaleDateString(loc(), { month: "short", day: "numeric", year: "numeric" });
}
const h12 = () => { const f = P().timeFmt; return f === "system" ? undefined : f === "12"; };
export const clock = (ts) => new Date(ts).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit", hour12: h12() });
export const hm = (s) => { const [h, m] = s.split(":").map(Number); return new Date(2000, 0, 1, h, m).toLocaleTimeString(loc(), { hour: "2-digit", minute: "2-digit", hour12: h12() }); };
export const greet = () => { const h = new Date().getHours(); return t(h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening"); };
