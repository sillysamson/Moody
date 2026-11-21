// Single source of truth for geometry, spacing, type, motion, springs and shared-element ids.
// Colour and elevation live in styles/tokens.css (light-dark()).
export const T = {
  dur: { micro: 140, control: 160, component: 280, dialog: 300, complex: 420 },
  ease: "cubic-bezier(0.4, 0, 0.2, 1)",
  spring: { sheet: { k: 280, c: 30, m: 1 } }, // zeta ~0.9: near-critical, <1% overshoot
  space: { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32 },
  // Geometry classes (one place to change them): ctl = compact controls/inputs, std = buttons + cards, lg = large cards/sheets/dialogs.
  // float = pill (nav, chips, switches), circle = icon-only buttons. float/circle are true round shapes, never squircle.
  radius: { ctl: 14, std: 22, lg: 30 },
  // Liquid Glass parameters, taken from the reference's defaults (container.js): blur 5, edge .01/.15, rim .05/.8, base .01/.1, corner .02, ripple .1, tint .2.
  // ref = the reference's page-size unit (its offsets are fractions of the page texture); cap keeps the lens inside small shapes.
  glass: { blur: 5, edge: [0.01, 0.15], rim: [0.05, 0.8], base: [0.01, 0.1], corner: 0.02, ripple: 0.1, tint: 0.2, ref: 900, cap: 0.34, sat: 1.6, maxArea: 260000, ca: 0.06 },
  navM: 10, // nav bar margin to screen edges (px)
  font: { sans: '"Avenir Next","Segoe UI",Roboto,system-ui,sans-serif', serif: '"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif' },
  tap: { standard: 46, large: 56 },
  sid: { habit: (id) => "habit:" + id, mood: (m) => "mood:" + m, day: (d) => "day:" + d, entry: (id) => "entry:" + id, fab: (n) => "fab:" + n /* panel id only: the static button has no shared element */, set: (k) => "set:" + k },
};
export function applyTokens() {
  const s = document.documentElement.style;
  for (const [k, v] of Object.entries(T.dur)) s.setProperty("--dur-" + k, v + "ms");
  s.setProperty("--ease", T.ease);
  for (const [k, v] of Object.entries(T.space)) s.setProperty("--sp-" + k, v + "px");
  for (const [k, v] of Object.entries(T.radius)) s.setProperty("--r-" + k, v + "px");
  s.setProperty("--r-float", "9999px"); s.setProperty("--r-circle", "50%");
  s.setProperty("--glass-blur", T.glass.blur * 0.5 + "px"); s.setProperty("--glass-sat", String(T.glass.sat));
  s.setProperty("--sans", T.font.sans); s.setProperty("--serif", T.font.serif);
}
