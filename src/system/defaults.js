export const DEF = {
  lang: "en", dateFmt: "system", timeFmt: "system", start: "home", weekStart: 1,
  notif: { on: false, checkin: { on: false, time: "20:00" }, habit: { freq: "off", time: "09:00" }, mood: { on: false, time: "18:00" }, sound: true, vibrate: true, quiet: { on: false, from: "22:00", to: "07:00" } },
  theme: "system", font: 100, cb: false, contrast: "standard", motion: "system", haptics: true, fx: "on", lock: { on: false }, hapticLevel: "medium", tap: "standard", pd: "",
  dash: { order: [], hidden: [], sizes: {} }, // dashboard layout (sizes: id -> "s"|"m"|"l")
  accent: { id: "moss", h: 200, c: 0.09 }, bg: { id: "aura", blur: 14 }, // 1.5: accent colour (preset id, or "custom" + hue/vividness) and background treatment (+ photo blur in px)
};
export const deepMerge = (a, b) => {
  const o = Array.isArray(a) ? [...a] : { ...a };
  for (const k in b) o[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a && typeof a[k] === "object" ? deepMerge(a[k], b[k]) : b[k];
  return o;
};
