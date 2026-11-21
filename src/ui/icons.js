import { get } from "../core/store.js";
const P = {
  home: "M4 11l8-7 8 7v8a1 1 0 0 1-1 1h-4v-6H9v6H5a1 1 0 0 1-1-1z", habits: "M12 21v-8M12 13c0-4 3-6 7-6 0 4-3 6-7 6zM12 15c0-3-2-5-6-5 0 3 2 5 6 5z",
  mood: "M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z", diary: "M5 4h10a3 3 0 0 1 3 3v13H8a3 3 0 0 1-3-3zM5 17a3 3 0 0 1 3-3h10",
  settings: "M4 7h9M17 7h3M4 17h3M11 17h9M15 5v4M9 15v4", psi: "M12 3v18M5 4c0 6 2 9 7 9s7-3 7-9",
  plus: "M12 5v14M5 12h14", check: "M5 12.5l4.5 4.5L19 7.5", close: "M6 6l12 12M18 6L6 18", trash: "M5 7h14M10 7V5h4v2M7 7l1 12h8l1-12",
  edit: "M5 19l1-4L16 5l3 3L9 18zM14 7l3 3", archive: "M4 7h16v4H4zM6 11v8h12v-8M10 15h4", restore: "M5 12a7 7 0 1 0 2-5M5 5v4h4",
  search: "M11 18a7 7 0 1 1 0-14 7 7 0 0 1 0 14zM20 20l-4-4", back: "M15 5l-7 7 7 7", next: "M9 5l7 7-7 7", download: "M12 4v11M7 11l5 5 5-5M5 20h14",
  chevron: "M6 9l6 6 6-6", bell: "M6 16v-5a6 6 0 0 1 12 0v5l2 2H4zM10 20a2 2 0 0 0 4 0", eye: "M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12zM12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 0 1 8 0v3", db: "M5 6c0-1.7 3.1-3 7-3s7 1.3 7 3-3.1 3-7 3-7-1.3-7-3zM5 6v12c0 1.7 3.1 3 7 3s7-1.3 7-3V6M5 12c0 1.7 3.1 3 7 3s7-1.3 7-3",
  info: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18zM12 11v6M12 7.5v.01", calendar: "M5 6h14v14H5zM5 10h14M9 3v4M15 3v4", play: "M8 5l11 7-11 7z", pause: "M8 5v14M16 5v14", stop: "M6 6h12v12H6z",
  upload: "M12 16V5M7 9l5-5 5 5M5 20h14", copy: "M9 9h10v11H9zM5 15V4h10", grip: "M9 6h.01M15 6h.01M9 12h.01M15 12h.01M9 18h.01M15 18h.01", minus: "M5 12h14", layout: "M4 5h16v6H4zM4 14h7v5H4zM14 14h6v5h-6z", reset: "M4 12a8 8 0 1 0 3-6.2M4 4v5h5",
};
export const ic = (n, s = 22) => {
  const e = document.createElement("span");
  e.className = "ic"; e.setAttribute("aria-hidden", "true");
  e.innerHTML = `<svg width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="${P[n]}"/></svg>`;
  return e;
};
export const MOODS = {
  Happy: ["#efc66b", "smile"], Calm: ["#a9c49b", "smile", "c"], Content: ["#c9cf8a", "smile"], Grateful: ["#e6b38f", "smile", "c"], Hopeful: ["#b8d0b0", "smile"],
  Excited: ["#f0a87a", "open"], Tired: ["#b5a9d1", "flat", "c"], Sad: ["#9fb9d8", "frown"], Lonely: ["#a9b3cf", "frown", "c"], Anxious: ["#c5b0d8", "wavy"],
  Stressed: ["#d8a99b", "wavy"], Angry: ["#d98c80", "frown"], Overwhelmed: ["#cfa0a6", "open"], Mixed: ["#cdbf9c", "wavy"], "Not sure": ["#c4c1b4", "flat"],
};
// Colour-vision-safe palette (Okabe-Ito). Face shapes and text labels always carry the meaning too.
const CB = { Happy: "#F0E442", Calm: "#56B4E9", Content: "#009E73", Grateful: "#E69F00", Hopeful: "#56B4E9", Excited: "#F0E442", Tired: "#CC79A7", Sad: "#0072B2", Lonely: "#0072B2", Anxious: "#D55E00", Stressed: "#E69F00", Angry: "#D55E00", Overwhelmed: "#CC79A7", Mixed: "#999999", "Not sure": "#BBBBBB" };
const MOUTH = { smile: '<path d="M13 25q7 6 14 0" fill="none"/>', flat: '<path d="M14 26h12" fill="none"/>', frown: '<path d="M13 28q7-6 14 0" fill="none"/>', wavy: '<path d="M12 26q4-4 8 0t8 0" fill="none"/>', open: '<path d="M15 24q5 8 10 0z"/>' };
export function face(m, s = 40) {
  const [c0, mo, e] = MOODS[m] || MOODS["Not sure"], c = get().prefs.cb ? CB[m] || c0 : c0;
  const eyes = e === "c" ? '<path d="M11 18q3 3 6 0M23 18q3 3 6 0" fill="none"/>' : '<circle cx="14" cy="18" r="2" stroke="none"/><circle cx="26" cy="18" r="2" stroke="none"/>';
  const w = document.createElement("span");
  w.className = "ic"; w.setAttribute("aria-hidden", "true");
  w.innerHTML = `<svg width="${s}" height="${s}" viewBox="0 0 40 40"><circle cx="20" cy="20" r="19" fill="${c}"/><g fill="#3a3326" stroke="#3a3326" stroke-width="1.8" stroke-linecap="round">${eyes}${MOUTH[mo]}</g></svg>`;
  return w;
}
