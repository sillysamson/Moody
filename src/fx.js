import { useEffect } from 'react';
import { flushSync } from 'react-dom';

export const reduced = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// Shared-element View Transition. The element marked data-vt="key" morphs into the [data-hero] element
// of the incoming state (and back again). Root animations never fade out: they shrink or slide.
export function vt(dir, fn, key, reverse = false, name = 'hero') {
  const de = document.documentElement;
  if (!document.startViewTransition || reduced()) { fn(); return; }
  const marked = [];
  const mark = (el) => { if (el) { el.style.viewTransitionName = name; marked.push(el); } };
  const find = () => (key ? document.querySelector(`[data-vt="${key}"]`) : null);
  de.dataset.dir = dir;
  if (!reverse) mark(find());
  const t = document.startViewTransition(() => {
    flushSync(fn);
    marked.forEach((e) => { e.style.viewTransitionName = ''; });
    if (reverse) mark(find());
  });
  t.finished.finally(() => { marked.forEach((e) => { e.style.viewTransitionName = ''; }); delete de.dataset.dir; });
}

// Rubber-band overscroll at the top and bottom of a scroller (first child is the moving layer)
export function useRubber(ref) {
  useEffect(() => {
    const sc = ref.current;
    if (!sc) return;
    const inner = sc.firstChild;
    let y0 = 0, on = false;
    const ts = (e) => { y0 = e.touches[0].clientY; on = false; inner.style.transition = 'none'; };
    const tm = (e) => {
      const d = e.touches[0].clientY - y0;
      const top = sc.scrollTop <= 0, bot = sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 1;
      if ((d > 0 && top) || (d < 0 && bot)) {
        on = true;
        if (e.cancelable) e.preventDefault();
        inner.style.transform = `translateY(${Math.sign(d) * Math.pow(Math.abs(d), 0.8) * 0.9}px)`;
      } else if (on) { on = false; inner.style.transform = ''; }
    };
    const te = () => { inner.style.transition = 'transform 520ms cubic-bezier(0.2, 1.2, 0.3, 1)'; inner.style.transform = ''; };
    sc.addEventListener('touchstart', ts, { passive: true });
    sc.addEventListener('touchmove', tm, { passive: false });
    sc.addEventListener('touchend', te);
    sc.addEventListener('touchcancel', te);
    return () => { sc.removeEventListener('touchstart', ts); sc.removeEventListener('touchmove', tm); sc.removeEventListener('touchend', te); sc.removeEventListener('touchcancel', te); };
  }, []);
}

// Damped spring (Compose spring(0.5, 300)) driven by rAF
export function makeSpring(x0, apply, { k = 300, z = 0.5 } = {}) {
  let x = x0, v = 0, t = x0, raf = 0, last = 0;
  const c = 2 * z * Math.sqrt(k);
  const step = (ts) => {
    const dt = Math.min(0.032, (ts - last) / 1000 || 0.016);
    last = ts;
    const n = Math.ceil(dt / 0.004), h = dt / n;
    for (let i = 0; i < n; i++) { v += (-k * (x - t) - c * v) * h; x += v * h; }
    apply(x, v);
    if (Math.abs(x - t) < 0.05 && Math.abs(v) < 0.5) { x = t; v = 0; apply(x, 0); raf = 0; return; }
    raf = requestAnimationFrame(step);
  };
  return {
    to(n) { t = n; if (!raf) { last = performance.now(); raf = requestAnimationFrame(step); } },
    snap(n) { x = t = n; v = 0; apply(x, 0); },
    stop() { cancelAnimationFrame(raf); raf = 0; },
  };
}
