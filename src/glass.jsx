// Clear liquid glass: backdrop blur + lens refraction (port of the pack's rounded-rect lens shader)
// + chromatic aberration (R, G, B displaced by slightly different amounts), as an SVG filter on backdrop-filter.
import { useLayoutEffect, useRef } from 'react';

const NS = 'http://www.w3.org/2000/svg';
export const SUPPORT = typeof CSS !== 'undefined' && !!CSS.supports && CSS.supports('backdrop-filter', 'url(#a)');
let n = 0;
const circle = (x) => 1 - Math.sqrt(Math.max(0, 1 - x * x));

function defs() {
  let s = document.getElementById('glass-defs');
  if (!s) {
    s = document.createElementNS(NS, 'svg');
    s.id = 'glass-defs';
    s.setAttribute('width', '0'); s.setAttribute('height', '0');
    s.style.cssText = 'position:absolute;pointer-events:none';
    document.body.appendChild(s);
  }
  return s;
}

// Displacement map: sample offset = -circleMap(depth) * amount along the SDF normal, packed into R,G around 128
function dispMap(w, h, r, H, A) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const g = c.getContext('2d'), im = g.createImageData(w, h), hx = w / 2, hy = h / 2;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const cx = x + 0.5 - hx, cy = y + 0.5 - hy;
      const qx = Math.abs(cx) - (hx - r), qy = Math.abs(cy) - (hy - r);
      const ox = Math.max(qx, 0), oy = Math.max(qy, 0), len = Math.hypot(ox, oy);
      const sd = len - r + Math.min(Math.max(qx, qy), 0);
      let dx = 0, dy = 0;
      if (-sd < H) {
        const d = circle(1 + Math.min(sd, 0) / H) * A;
        let gx, gy;
        if (qx >= 0 || qy >= 0) { const l = len || 1; gx = (Math.sign(cx) * ox) / l; gy = (Math.sign(cy) * oy) / l; }
        else if (qx > qy) { gx = Math.sign(cx); gy = 0; } else { gx = 0; gy = Math.sign(cy); }
        dx = -d * gx; dy = -d * gy;
      }
      const i = (y * w + x) * 4;
      im.data[i] = 128 + (127 * dx) / A; im.data[i + 1] = 128 + (127 * dy) / A; im.data[i + 2] = 128; im.data[i + 3] = 255;
    }
  }
  g.putImageData(im, 0, 0);
  return c.toDataURL();
}

const M = (r, g, b) => `${r} 0 0 0 0 0 ${g} 0 0 0 0 0 ${b} 0 0 0 0 0 1 0`;

export function useGlass(ref, { r, h, a, ab, blur }) {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !SUPPORT) return;
    const id = 'lg' + ++n;
    let f = null;
    const build = () => {
      const w = Math.round(el.offsetWidth), hh = Math.round(el.offsetHeight);
      if (w < 4 || hh < 4) return;
      const rad = r === 'pill' ? hh / 2 : Math.min(r, hh / 2, w / 2);
      const H = Math.min(h, Math.min(w, hh) / 2);
      const S = 2 * a, k = ab ? 0.2 : 0;
      const url = dispMap(w, hh, rad, H, a);
      const dm = (sc, res) => `<feDisplacementMap in="b" in2="m" scale="${sc}" xChannelSelector="R" yChannelSelector="G" result="${res}"/>`;
      if (f) f.remove();
      f = document.createElementNS(NS, 'filter');
      f.setAttribute('id', id);
      ['filterUnits', 'primitiveUnits'].forEach((k2) => f.setAttribute(k2, 'userSpaceOnUse'));
      f.setAttribute('x', '0'); f.setAttribute('y', '0'); f.setAttribute('width', w); f.setAttribute('height', hh);
      f.setAttribute('color-interpolation-filters', 'sRGB');
      f.innerHTML =
        `<feGaussianBlur in="SourceGraphic" stdDeviation="${blur}" result="b"/>` +
        `<feImage href="${url}" x="0" y="0" width="${w}" height="${hh}" preserveAspectRatio="none" result="m"/>` +
        dm(S * (1 + k), 'dr') + `<feColorMatrix in="dr" type="matrix" values="${M(1, 0, 0)}" result="r"/>` +
        dm(S, 'dg') + `<feColorMatrix in="dg" type="matrix" values="${M(0, 1, 0)}" result="g"/>` +
        dm(S * (1 - k), 'db') + `<feColorMatrix in="db" type="matrix" values="${M(0, 0, 1)}" result="bl"/>` +
        `<feBlend in="r" in2="g" mode="screen" result="rg"/><feBlend in="rg" in2="bl" mode="screen" result="o"/>` +
        `<feColorMatrix in="o" type="saturate" values="1.5"/>`;
      defs().appendChild(f);
      el.style.backdropFilter = el.style.webkitBackdropFilter = `url(#${id})`;
    };
    build();
    const ro = new ResizeObserver(build);
    ro.observe(el);
    return () => { ro.disconnect(); if (f) f.remove(); };
  }, [r, h, a, ab, blur]);
}

export function Glass({ as: Tag = 'div', r = 'pill', h = 24, a = 24, ab = true, blur = 8, className = '', children, ...p }) {
  const ref = useRef();
  useGlass(ref, { r, h, a, ab, blur });
  return <Tag ref={ref} className={'glass ' + className} {...p}>{children}</Tag>;
}
