import { createContext, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { dayKey, empty, inPeriod, uid, useStore } from './store';
import { STEPS_AVAILABLE } from './steps';
import { haptic, setHapticPrefs } from './haptics';
import { Back, syncReminders } from './native';
import { LANGS, localeOf, makeT } from './i18n';
import { makeSpring, reduced, useRubber, vt } from './fx';
import { Glass } from './glass';
import Icon from './Icon';

const Ctx = createContext({ t: (k) => k, loc: 'en' });
const useL = () => useContext(Ctx);
const when = (at, loc) => new Date(at).toLocaleString(loc);

/* ---------- shared bits ---------- */
function Page({ title, back, right, cls = '', foot, children }) {
  const { t } = useL();
  const ref = useRef();
  useRubber(ref);
  return (
    <div className={'screen ' + cls}>
      <div className="page" ref={ref}>
        <div className="inner">
          <header>
            <div className="bar">
              {back ? <button className="link ico" onClick={back} aria-label={t('back')}><span className="flip"><Icon n="back" /></span>{t('back')}</button> : <span />}
              {right}
            </div>
            <h1 data-hero={back ? '' : undefined}>{title}</h1>
          </header>
          <div className="body">{children}</div>
        </div>
      </div>
      {foot && <div className="foot">{foot}</div>}
    </div>
  );
}
const Row = ({ title, sub, icon, left, onClick, onDel, clamp, vtKey }) => (
  <div className="row">
    {icon ? <span className="lead"><Icon n={icon} /></span> : left}
    <button className="main" onClick={onClick} disabled={!onClick} data-vt={vtKey}>
      <span className={clamp ? 'clamp' : ''}>{title}</span>
      {sub && <small>{sub}</small>}
    </button>
    {onDel ? <button className="x" aria-label="Delete" onClick={onDel}><Icon n="x" /></button> : onClick && <span className="chev flip"><Icon n="next" /></span>}
  </div>
);
const Check = ({ on, label, onClick }) => (
  <button role="checkbox" aria-checked={on} aria-label={label} className={'check' + (on ? ' on' : '')} onClick={onClick}>{on && <Icon n="check" size={18} />}</button>
);
const Empty = ({ t }) => <p className="muted">{t}</p>;
const rm = (up, k, id) => up((x) => ({ ...x, [k]: x[k].filter((y) => y.id !== id) }));
const GBtn = ({ children, ...p }) => <Glass as="button" className="btn" r="pill" h={14} a={14} blur={6} {...p}>{children}</Glass>;
const Seg = ({ opts, value, onChange }) => (
  <span className="seg">{opts.map(([v, l]) => <button key={v} aria-pressed={value === v} onClick={() => onChange(v)}>{l}</button>)}</span>
);

function GSwitch({ on, onChange, label }) {
  return (
    <button role="switch" aria-checked={on} aria-label={label} className={'sw' + (on ? ' on' : '')} data-h="none" onClick={() => { onChange(!on); haptic('toggle', !on); }}>
      <Glass className="thumb" r="pill" h={9} a={10} blur={2} />
    </button>
  );
}
function GSlider({ value, max, onChange, label, text }) {
  const ref = useRef();
  const set = (e) => {
    const r = ref.current.getBoundingClientRect();
    let f = (e.clientX - r.left) / r.width;
    if (document.documentElement.dir === 'rtl') f = 1 - f;
    const v = Math.round(Math.max(0, Math.min(1, f)) * max);
    if (v !== value) onChange(v);
  };
  return (
    <div ref={ref} className="gs" role="slider" tabIndex={0} aria-label={label} aria-valuemin={0} aria-valuemax={max} aria-valuenow={value} aria-valuetext={text}
      onPointerDown={(e) => { e.currentTarget.setPointerCapture(e.pointerId); set(e); }}
      onPointerMove={(e) => { if (e.buttons) set(e); }}
      onKeyDown={(e) => { if (e.key === 'ArrowRight' || e.key === 'ArrowUp') onChange(Math.min(max, value + 1)); if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') onChange(Math.max(0, value - 1)); }}>
      <div className="gt" />
      <Glass className="gth" r="pill" h={11} a={12} blur={2} style={{ insetInlineStart: `calc((100% - 46px) * ${value / max})` }} />
    </div>
  );
}
function Sheet({ onClose, children }) {
  return createPortal(
    <div className="scrim" onClick={onClose}>
      <Glass className="sheet" r={28} h={20} a={18} blur={10} data-pop="" onClick={(e) => e.stopPropagation()}>{children}</Glass>
    </div>, document.body);
}
const popOpen = (set, val, key) => vt('pop', () => set(val), key, false, 'pop');
const popClose = (set, key) => vt('popx', () => set(null), key, true, 'pop');

function dayLines(s, day, t, loc) {
  const moods = s.moods.filter((x) => x.day === day).map((x) => x.mood).join(', ');
  const zen = s.zen.filter((x) => x.day === day).reduce((a, x) => a + x.sec, 0);
  const diary = s.diary.filter((x) => x.day === day).length;
  const habits = s.habits.filter((h) => h.done.includes(day)).map((h) => h.name).join(', ');
  const steps = s.steps[day] || 0;
  const n = (v) => v.toLocaleString(loc);
  return [moods && `${t('mood')}: ${moods}`, zen && `${t('zen')}: ${Math.floor(zen / 60)}m ${zen % 60}s`, diary && `${t('diary')}: ${n(diary)}`, habits && `${t('habits')}: ${habits}`, steps && `${t('steps')}: ${n(steps)}`].filter(Boolean);
}

/* ---------- History calendar ---------- */
function MonthGrid({ s }) {
  const { t, loc } = useL();
  const now = new Date();
  const [m, setM] = useState(new Date(now.getFullYear(), now.getMonth(), 1));
  const [dir, setDir] = useState(0);
  const [day, setDay] = useState(null);
  const x0 = useRef(null);
  const y = m.getFullYear(), mo = m.getMonth();
  const mk = {};
  const add = (d, k) => { (mk[d] = mk[d] || new Set()).add(k); };
  s.moods.forEach((x) => add(x.day, 'm')); s.habits.forEach((h) => h.done.forEach((d) => add(d, 'h')));
  s.zen.forEach((x) => add(x.day, 'z')); s.diary.forEach((x) => add(x.day, 'd'));
  const cells = [...Array(m.getDay()).fill(null), ...Array.from({ length: new Date(y, mo + 1, 0).getDate() }, (_, i) => dayKey(new Date(y, mo, i + 1)))];
  const go = (d) => { setDir(d); setM(new Date(y, mo + d, 1)); haptic('select'); };
  const wd = (i) => new Intl.DateTimeFormat(loc, { weekday: 'narrow' }).format(new Date(2023, 0, 1 + i));
  const lines = day ? dayLines(s, day, t, loc) : [];
  return (
    <>
      <div className="monthbar">
        <button className="mini flip" aria-label="Previous month" onClick={() => go(-1)}><Icon n="back" /></button>
        <b>{m.toLocaleString(loc, { month: 'long', year: 'numeric' })}</b>
        <button className="mini flip" aria-label="Next month" onClick={() => go(1)}><Icon n="next" /></button>
      </div>
      <div className="cal" key={y * 12 + mo} data-slide={dir} onPointerDown={(e) => { x0.current = e.clientX; }}
        onPointerUp={(e) => { if (x0.current != null) { const dx = e.clientX - x0.current; if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1); } x0.current = null; }}>
        {Array.from({ length: 7 }, (_, i) => <span key={i} className="wd">{wd(i)}</span>)}
        {cells.map((d, i) => d ? (
          <button key={i} data-vt={'day-' + d} aria-label={d} className={'day' + (d === dayKey() ? ' today' : '')} onClick={() => popOpen(setDay, d, 'day-' + d)}>
            <span>{Number(d.slice(8))}</span>
            <span className="dots">{[...(mk[d] || [])].map((k) => <i key={k} className={'dt ' + k} />)}</span>
          </button>
        ) : <span key={i} />)}
      </div>
      {day && (
        <Sheet onClose={() => popClose(setDay, 'day-' + day)}>
          <h3 className="sh">{new Date(day + 'T00:00').toLocaleDateString(loc, { dateStyle: 'full' })}</h3>
          {lines.length ? lines.map((l) => <div key={l} className="line">{l}</div>) : <small>{t('nothing')}</small>}
          <GBtn onClick={() => popClose(setDay, 'day-' + day)}>{t('close')}</GBtn>
        </Sheet>
      )}
    </>
  );
}

/* ---------- Summary ---------- */
const KICON = { zen: 'zen', mood: 'mood', steps: 'steps', diary: 'diary', calendar: 'calendar' };
const KEYS = ['zen', 'mood', 'steps', 'diary', 'calendar'];
const PER = [['day', 'day'], ['week', 'week'], ['month', 'month']];
const LBL = { day: 'today', week: 'last7', month: 'last30' };

function stat(k, s, p, t, loc) {
  if (k === 'zen') {
    const z = s.zen.filter((x) => inPeriod(x.day, p));
    return [`${Math.round(z.reduce((a, x) => a + x.sec, 0) / 60)} ${t('min')}`, `${z.length} ${t('sessions')}`];
  }
  if (k === 'mood') {
    const m = s.moods.filter((x) => inPeriod(x.day, p));
    return [m.length ? m[0].mood : '—', `${m.length} ${t('checkins')}`];
  }
  if (k === 'steps') {
    if (!STEPS_AVAILABLE) return ['—', t('notSet')];
    return [Object.entries(s.steps).filter(([d]) => inPeriod(d, p)).reduce((a, [, v]) => a + v, 0).toLocaleString(loc), t('steps')];
  }
  return [String(s.diary.filter((x) => inPeriod(x.day, p)).length), t('entries')];
}
function detail(k, s, p, t, loc) {
  const f = (a) => a.filter((x) => inPeriod(x.day, p));
  let r;
  if (k === 'zen') r = f(s.zen).slice(0, 6).map((z) => `${Math.floor(z.sec / 60)}m ${z.sec % 60}s · ${new Date(z.at).toLocaleDateString(loc)}`);
  else if (k === 'mood') r = f(s.moods).slice(0, 6).map((m) => `${m.mood} · ${when(m.at, loc)}`);
  else if (k === 'steps') r = STEPS_AVAILABLE ? Object.entries(s.steps).filter(([d]) => inPeriod(d, p)).sort().reverse().slice(0, 7).map(([d, n]) => `${d} · ${n.toLocaleString(loc)}`) : [];
  else if (k === 'diary') r = f(s.diary).slice(0, 3).map((e) => e.text);
  else r = dayLines(s, dayKey(), t, loc);
  return r.length ? r : [t('nothing')];
}

function Summary({ s, up }) {
  const { t, loc } = useL();
  const [edit, setEdit] = useState(false);
  const [focus, setFocus] = useState(null);
  const hold = useRef(0);
  const held = useRef(false);
  const setCards = (f) => up((x) => ({ ...x, cards: f(x.cards) }));
  const move = (i, d) => setCards((c) => { const j = i + d; if (j < 0 || j >= c.length) return c; const n = [...c]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  const rest = KEYS.filter((k) => !s.cards.some((c) => c.k === k));

  const down = (c) => {
    held.current = false;
    if (edit) return;
    clearTimeout(hold.current);
    hold.current = setTimeout(() => { held.current = true; haptic('toggle', true); popOpen(setFocus, c, 'card-' + c.k); }, 450);
  };
  const cancel = () => clearTimeout(hold.current);
  useEffect(() => {
    if (!focus) return;
    const end = () => popClose(setFocus, 'card-' + focus.k);
    window.addEventListener('pointerup', end, { once: true });
    window.addEventListener('pointercancel', end, { once: true });
    return () => { window.removeEventListener('pointerup', end); window.removeEventListener('pointercancel', end); };
  }, [focus]);

  return (
    <Page title={t('summary')} right={<button className="link" onClick={() => setEdit(!edit)}>{edit ? t('done') : t('edit')}</button>}>
      {!s.cards.length && <Empty t={t('noCards')} />}
      {s.cards.map((c, i) => {
        const [v, u] = c.k === 'calendar' ? [] : stat(c.k, s, c.p, t, loc);
        return (
          <div key={c.k} className="rise" style={{ '--n': i }}>
            <div data-vt={'card-' + c.k} className={'card' + (edit ? ' shake' : '') + (focus?.k === c.k ? ' dim' : '')}
              style={{ '--d': `${-i * 47}ms`, '--tm': `${130 + (i % 3) * 25}ms` }}
              onPointerDown={() => down(c)} onPointerUp={cancel} onPointerLeave={cancel} onPointerCancel={cancel}
              onContextMenu={(e) => e.preventDefault()}
              onClickCapture={(e) => { if (held.current) { e.stopPropagation(); e.preventDefault(); held.current = false; } }}>
              <div className="top">
                <span className="name"><Icon n={KICON[c.k]} />{c.k === 'calendar' ? t('calendar') : t(c.k)}</span>
                {edit ? (
                  <span>
                    <button className="mini" aria-label="Move up" onClick={() => move(i, -1)}><Icon n="up" /></button>
                    <button className="mini" aria-label="Move down" onClick={() => move(i, 1)}><Icon n="down" /></button>
                    <button className="mini" aria-label="Remove card" onClick={() => setCards((x) => x.filter((y) => y.k !== c.k))}><Icon n="minus" /></button>
                  </span>
                ) : c.k !== 'calendar' && <Seg opts={PER.map(([p, l]) => [p, t(l)])} value={c.p} onChange={(p) => setCards((x) => x.map((y) => (y.k === c.k ? { ...y, p } : y)))} />}
              </div>
              {c.k === 'calendar' ? <MonthGrid s={s} /> : (<><div className="big">{v}</div><small>{u} · {t(LBL[c.p])}</small></>)}
            </div>
          </div>
        );
      })}
      {edit && rest.length > 0 && (
        <>
          <p className="add">{t('addCard')}</p>
          {rest.map((k) => <Row key={k} title={k === 'calendar' ? t('calendar') : t(k)} icon={KICON[k]} onClick={() => setCards((c) => [...c, { k, p: 'day' }])} />)}
        </>
      )}
      {focus && createPortal(
        <div className="stage" role="dialog" aria-label={focus.k}>
          <div className="card lifted" data-pop="">
            <div className="top"><span className="name"><Icon n={KICON[focus.k]} />{focus.k === 'calendar' ? t('calendar') : t(focus.k)}</span><small>{focus.k === 'calendar' ? t('today') : t(LBL[focus.p])}</small></div>
            {focus.k !== 'calendar' && <div className="big">{stat(focus.k, s, focus.p, t, loc)[0]}</div>}
            <div className="details">{detail(focus.k, s, focus.p, t, loc).map((l, i) => <div key={i} className="line clamp">{l}</div>)}</div>
          </div>
        </div>, document.body)}
    </Page>
  );
}

/* ---------- Do: the workplace ---------- */
const ADD = [['zen', 'zen', 'newZen'], ['habit', 'newHabit', 'newHabit'], ['task', 'newTask', 'newTask'], ['diary', 'newDiary', 'newDiary'], ['mood', 'mood', 'mood']];

function DoPage({ s, up, go }) {
  const { t, loc } = useL();
  const [sheet, setSheet] = useState(false);
  const day = dayKey();
  const open = s.tasks.filter((k) => !k.done);
  const togT = (id) => up((x) => ({ ...x, tasks: x.tasks.map((k) => (k.id === id ? { ...k, done: !k.done } : k)) }));
  const togH = (id) => up((x) => ({ ...x, habits: x.habits.map((h) => (h.id !== id ? h : { ...h, done: h.done.includes(day) ? h.done.filter((d) => d !== day) : [...h.done, day] })) }));
  const zen = Math.round(s.zen.filter((x) => x.day === day).reduce((a, x) => a + x.sec, 0) / 60);
  const diary = s.diary.filter((x) => x.day === day).length;
  const mood = s.moods[0]?.mood || '—';
  const closeSheet = () => popClose(setSheet, 'plus');
  const Stat = ({ ic, big, label, to }) => (
    <button className="card stat" data-vt={'stat-' + to} onClick={() => go(to, 'stat-' + to)}><Icon n={ic} /><b>{big}</b><small>{label}</small></button>
  );
  return (
    <Page title={t('do')} right={
      <Glass as="button" className="plus" data-vt="plus" aria-label={t('add')} r="pill" h={14} a={14} blur={6} onClick={() => popOpen(setSheet, true, 'plus')}><Icon n="plus" /></Glass>}>
      <h3 className="sec">{t('openTasks')}</h3>
      <div className="card list">
        {open.length ? open.map((k) => <Row key={k.id} left={<Check on={k.done} label={k.title} onClick={() => { togT(k.id); haptic('success'); }} />} title={k.title} />) : <small>{t('allClear')}</small>}
      </div>
      <h3 className="sec">{t('habitsToday')}</h3>
      <div className="card list">
        {s.habits.length ? s.habits.map((h) => <Row key={h.id} left={<Check on={h.done.includes(day)} label={h.name} onClick={() => { togH(h.id); haptic(h.done.includes(day) ? 'select' : 'success'); }} />} title={h.name} />) : <small>{t('emptyHabits')}</small>}
      </div>
      <div className="stats">
        <Stat ic="zen" big={`${zen} ${t('min')}`} label={t('zen')} to="zen" />
        <Stat ic="diary" big={diary.toLocaleString(loc)} label={t('diary')} to="diary" />
        <Stat ic="mood" big={mood} label={t('mood')} to="mood" />
      </div>
      {sheet && (
        <Sheet onClose={closeSheet}>
          <h3 className="sh">{t('add')}</h3>
          {ADD.map(([ic, route, label]) => <Row key={route} title={t(label)} icon={ic} onClick={() => go(route, null, () => setSheet(false))} />)}
        </Sheet>
      )}
    </Page>
  );
}

/* ---------- Browse ---------- */
const FEATURES = [['zen', 'zen'], ['mood', 'mood'], ['steps', 'steps'], ['diary', 'diary'], ['habits', 'habit'], ['tasks', 'task'], ['calendar', 'calendar'], ['settings', 'settings']];
function Browse({ go }) {
  const { t } = useL();
  const [q, setQ] = useState('');
  return (
    <Page title={t('browse')}>
      <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder={t('search')} aria-label={t('search')} />
      {FEATURES.filter(([id]) => t(id).toLowerCase().includes(q.trim().toLowerCase())).map(([id, ic]) => <Row key={id} title={t(id)} icon={ic} vtKey={'row-' + id} onClick={() => go(id, 'row-' + id)} />)}
    </Page>
  );
}

/* ---------- Zen ---------- */
function Zen({ s, up, back }) {
  const { t, loc } = useL();
  const [dur, setDur] = useState(3);
  const [end, setEnd] = useState(null);
  const [now, setNow] = useState(0);
  const run = end !== null;
  const left = run ? Math.max(0, Math.ceil((end - now) / 1000)) : 0;
  const stop = () => {
    const sec = dur * 60 - left;
    if (sec >= 5) { up((x) => ({ ...x, zen: [{ id: uid(), day: dayKey(), at: Date.now(), sec }, ...x.zen] })); haptic('success'); }
    setEnd(null);
  };
  useEffect(() => { if (!run) return; const id = setInterval(() => setNow(Date.now()), 250); return () => clearInterval(id); }, [run]);
  useEffect(() => { if (run && left === 0) stop(); }, [left, run]);
  const phase = run ? Math.floor((dur * 60 - left) / 4) : -1;
  useEffect(() => { if (phase >= 0) haptic('select'); }, [phase]);
  const start = () => { setNow(Date.now()); setEnd(Date.now() + dur * 60000); };
  return (
    <Page title={t('zen')} back={back} foot={run ? <GBtn onClick={stop}>{t('stop')}</GBtn> : <GBtn onClick={start}>{t('start')}</GBtn>}>
      {run ? (
        <div className="center">
          <div className="breathe" aria-hidden="true" />
          <div style={{ fontSize: 22 }} aria-live="polite">{t(phase % 2 === 0 ? 'breatheIn' : 'breatheOut')}</div>
          <div className="muted">{Math.floor(left / 60)}:{String(left % 60).padStart(2, '0')}</div>
        </div>
      ) : (
        <>
          <div className="chips">{[1, 3, 5].map((m) => <button key={m} className="chip" aria-pressed={dur === m} onClick={() => setDur(m)}>{m} {t('min')}</button>)}</div>
          {!s.zen.length && <Empty t={t('noSessions')} />}
          {s.zen.map((z) => <Row key={z.id} title={`${Math.floor(z.sec / 60)}m ${z.sec % 60}s`} sub={when(z.at, loc)} onDel={() => rm(up, 'zen', z.id)} />)}
        </>
      )}
    </Page>
  );
}

/* ---------- State of Mind ---------- */
function useEase(target) {
  const [v, setV] = useState(target);
  const cur = useRef(target);
  useEffect(() => {
    if (reduced()) { cur.current = target; setV(target); return; }
    let id;
    const f = () => { cur.current += (target - cur.current) * 0.14; if (Math.abs(target - cur.current) < 0.003) cur.current = target; setV(cur.current); if (cur.current !== target) id = requestAnimationFrame(f); };
    id = requestAnimationFrame(f);
    return () => cancelAnimationFrame(id);
  }, [target]);
  return v;
}
const blob = (R, a, n, ph) => {
  let d = '';
  for (let i = 0; i <= 120; i++) { const th = (i / 120) * 2 * Math.PI, r = R * (1 + a * Math.cos(n * th + ph)); d += (i ? 'L' : 'M') + (100 + r * Math.cos(th)).toFixed(1) + ' ' + (100 + r * Math.sin(th)).toFixed(1); }
  return d + 'Z';
};
function Flower({ x, label }) {
  const a = 0.03 + (0.11 * x) / 6, h = 236 - (24 * x) / 6, l = 36 + (26 * x) / 6;
  return (
    <svg className="flower" viewBox="0 0 200 200" role="img" aria-label={label}>
      {[0, 1, 2, 3].map((i) => (
        <g key={i} className="spin" style={{ animationDuration: `${50 + i * 20}s`, animationDirection: i % 2 ? 'reverse' : 'normal' }}>
          <path d={blob(92 - i * 20, a, 8, i * 0.4)} fill={`hsl(${h} ${62 + i * 5}% ${Math.max(l + 22 - i * 8, 14)}%)`} opacity="0.92" />
        </g>
      ))}
      <circle cx="100" cy="100" r="3" fill="#fff" />
    </svg>
  );
}
function Mood({ s, up, back }) {
  const { t, loc } = useL();
  const [v, setV] = useState(3);
  const [saved, setSaved] = useState(false);
  const x = useEase(v);
  const lbl = t('l' + v);
  const save = () => {
    up((st) => ({ ...st, moods: [{ id: uid(), day: dayKey(), at: Date.now(), mood: lbl, v }, ...st.moods] }));
    haptic('success'); setSaved(true); setTimeout(() => setSaved(false), 1600);
  };
  return (
    <Page title={t('mood')} back={back} cls="mood" foot={<GBtn onClick={save}>{saved ? t('saved') : t('save')}</GBtn>}>
      <p className="prompt">{t('prompt')}</p>
      <Flower x={x} label={lbl} />
      <h2 aria-live="polite">{lbl}</h2>
      <GSlider value={v} max={6} label={t('mood')} text={lbl} onChange={(n) => { setV(n); haptic('slider'); }} />
      <div className="caps"><span>{t('l0')}</span><span>{t('l6')}</span></div>
      <div style={{ height: 16 }} />
      {s.moods.map((m) => <Row key={m.id} title={m.mood} sub={when(m.at, loc)} onDel={() => rm(up, 'moods', m.id)} />)}
    </Page>
  );
}

/* ---------- Steps / Diary / Habits / Tasks ---------- */
function Steps({ s, back }) {
  const { t, loc } = useL();
  const rows = Object.entries(s.steps).sort().reverse().slice(0, 7);
  return (
    <Page title={t('steps')} back={back}>
      {STEPS_AVAILABLE ? (<>
        <div className="big" style={{ fontSize: 48, fontWeight: 700 }}>{(s.steps[dayKey()] || 0).toLocaleString(loc)}</div>
        {rows.map(([d, n]) => <Row key={d} title={d} sub={`${n.toLocaleString(loc)}`} />)}
      </>) : <Empty t={t('stepsOff')} />}
    </Page>
  );
}
function Diary({ s, up, back }) {
  const { t, loc } = useL();
  const [o, setO] = useState(null);
  return (
    <Page title={t('diary')} back={back}>
      {!s.diary.length && <Empty t={t('emptyDiary')} />}
      {s.diary.map((e) => <Row key={e.id} title={e.text} clamp={o !== e.id} sub={when(e.at, loc)} onClick={() => setO(o === e.id ? null : e.id)} onDel={() => rm(up, 'diary', e.id)} />)}
    </Page>
  );
}
function Habits({ s, up, back }) {
  const { t, loc } = useL();
  const d0 = dayKey();
  const tog = (id) => up((x) => ({ ...x, habits: x.habits.map((h) => (h.id !== id ? h : { ...h, done: h.done.includes(d0) ? h.done.filter((d) => d !== d0) : [...h.done, d0] })) }));
  return (
    <Page title={t('habits')} back={back}>
      {!s.habits.length && <Empty t={t('emptyHabits')} />}
      {s.habits.map((h) => <Row key={h.id} left={<Check on={h.done.includes(d0)} label={h.name} onClick={() => { tog(h.id); haptic(h.done.includes(d0) ? 'select' : 'success'); }} />} title={h.name} sub={`${h.done.length.toLocaleString(loc)} ${t('daysDone')}`} onDel={() => rm(up, 'habits', h.id)} />)}
    </Page>
  );
}
function Tasks({ s, up, back }) {
  const { t } = useL();
  const tog = (id) => up((x) => ({ ...x, tasks: x.tasks.map((k) => (k.id === id ? { ...k, done: !k.done } : k)) }));
  return (
    <Page title={t('tasks')} back={back}>
      {!s.tasks.length && <Empty t={t('emptyTasks')} />}
      {s.tasks.map((k) => <Row key={k.id} left={<Check on={k.done} label={k.title} onClick={() => { tog(k.id); haptic(k.done ? 'select' : 'success'); }} />} title={k.title} onDel={() => rm(up, 'tasks', k.id)} />)}
    </Page>
  );
}
const Cal = ({ s, back }) => { const { t } = useL(); return <Page title={t('calendar')} back={back}><MonthGrid s={s} /></Page>; };

/* ---------- Coming soon ---------- */
const LEAVES = [[40, 280, 20, 0], [78, 286, -35, 1], [112, 279, 50, 0], [152, 288, 10, 2], [190, 281, -60, 1], [226, 287, 30, 0], [262, 280, -15, 2], [96, 270, 80, 2], [208, 272, -80, 0], [60, 292, 140, 1]];
function Soon({ back }) {
  const { t } = useL();
  const col = ['var(--sub)', 'var(--line)', 'var(--blue)'];
  return (
    <Page title={t('soon')} back={back}>
      <svg className="tree" viewBox="0 0 300 300" role="img" aria-label={t('soon')}>
        <defs><path id="leaf" d="M0 0C6-9 16-9 22 0C16 9 6 9 0 0Z" /></defs>
        <g fill="none" stroke="var(--sub)" strokeLinecap="round">
          <path d="M150 276C148 230 152 200 148 160" strokeWidth="11" />
          <path d="M148 165C142 130 120 106 94 88" strokeWidth="6" />
          <path d="M148 165C162 132 188 112 216 96" strokeWidth="6" />
          <path d="M150 205C170 190 192 182 214 160" strokeWidth="5" />
          <path d="M147 190C130 176 112 168 90 150" strokeWidth="5" />
          <path d="M120 106C112 92 106 80 104 66M188 112C196 98 204 90 214 80" strokeWidth="3" />
        </g>
        <g className="sway" style={{ color: 'var(--blue)' }}><use href="#leaf" fill="currentColor" transform="translate(216 96) rotate(-35)" /></g>
        {LEAVES.map(([x, y, r, c], i) => <use key={i} href="#leaf" fill={col[c]} opacity={c === 1 ? 0.9 : 0.7} transform={`translate(${x} ${y}) rotate(${r})`} />)}
        <path d="M20 292H280" stroke="var(--line)" strokeWidth="2" strokeLinecap="round" />
      </svg>
      <p className="center muted">{t('soonText')}</p>
    </Page>
  );
}

/* ---------- Settings ---------- */
const RKEYS = [['task', 'tasks'], ['habit', 'habits'], ['walk', 'walk'], ['diary', 'diary'], ['mood', 'mood']];
function Settings({ s, up, back, go }) {
  const { t } = useL();
  const p = s.prefs;
  const set = (k, v) => up((x) => ({ ...x, prefs: { ...x.prefs, [k]: v } }));
  const setRem = (k, patch) => up((x) => ({ ...x, prefs: { ...x.prefs, rem: { ...x.prefs.rem, [k]: { ...x.prefs.rem[k], ...patch } } } }));
  return (
    <Page title={t('settings')} back={back}>
      <h3 className="sec">{t('language')}</h3>
      {LANGS.map(([c, name]) => <Row key={c} title={name} left={<span className="lead">{p.lang === c && <Icon n="check" />}</span>} onClick={() => { set('lang', c); haptic('select'); }} />)}
      <h3 className="sec">{t('display')}</h3>
      <Seg opts={[['system', t('system')], ['light', t('light')], ['dark', t('dark')]]} value={p.theme} onChange={(v) => { set('theme', v); haptic('select'); }} />
      <h3 className="sec">{t('notifications')}</h3>
      {RKEYS.map(([k, label]) => (
        <div className="row" key={k}>
          <span className="grow">{t(label)}</span>
          <input type="time" className="time" aria-label={t(label)} value={p.rem[k].time} disabled={!p.rem[k].on} onChange={(e) => setRem(k, { time: e.target.value || p.rem[k].time })} />
          <GSwitch on={p.rem[k].on} label={t(label)} onChange={(on) => setRem(k, { on })} />
        </div>
      ))}
      <h3 className="sec">{t('haptics')}</h3>
      <div className="row"><span className="grow">{t('haptics')}</span><GSwitch on={p.haptics} label={t('haptics')} onChange={(v) => set('haptics', v)} /></div>
      {p.haptics && <div className="row"><Seg opts={[['light', t('light')], ['medium', t('medium')], ['strong', t('strong')]]} value={p.level} onChange={(v) => { set('level', v); setTimeout(() => haptic('button'), 30); }} /></div>}
      <div style={{ height: 12 }} />
      <Row title={t('biometric')} icon="lock" onClick={() => go('soon', null)} />
      <Row title={t('deleteAll')} onClick={() => { haptic('warning'); if (window.confirm(t('deleteQ'))) up((x) => ({ ...empty, prefs: x.prefs })); }} />
    </Page>
  );
}

/* ---------- Create form ---------- */
function Form({ title, ph, multi, onSave, back }) {
  const { t } = useL();
  const [v, setV] = useState('');
  const P = { value: v, onChange: (e) => setV(e.target.value), placeholder: ph, 'aria-label': ph };
  return (
    <Page title={title} back={back} foot={<GBtn disabled={!v.trim()} onClick={() => { onSave(v.trim()); haptic('success'); back(); }}>{t('save')}</GBtn>}>
      {multi ? <textarea rows={9} {...P} /> : <input {...P} />}
    </Page>
  );
}

/* ---------- Glass tab bar with draggable lens ---------- */
const TABS = [['summary', 'summary'], ['do', 'plus'], ['browse', 'browse']];
function TabBar({ tab, setTab }) {
  const { t } = useL();
  const ref = useRef(), ind = useRef(), sp = useRef();
  const drag = useRef({ on: false, idx: tab });
  const [press, setPress] = useState(false);
  const btns = () => [...ref.current.querySelectorAll('button')];
  useEffect(() => {
    sp.current = makeSpring(0, (x, v) => {
      const s = Math.min(0.2, Math.abs(v) / 5000), d = drag.current.on;
      ind.current.style.transform = `translateX(${x}px) scale(${1 + s + (d ? 0.14 : 0)}, ${1 - s * 0.5 + (d ? 0.08 : 0)})`;
    });
    sp.current.snap(btns()[tab].offsetLeft);
    return () => sp.current.stop();
  }, []);
  useEffect(() => { if (!drag.current.on) sp.current.to(btns()[tab].offsetLeft); }, [tab]);
  const move = (e) => {
    if (!drag.current.on) return;
    const bs = btns(), r = ref.current.getBoundingClientRect(), w = bs[0].offsetWidth, px = e.clientX - r.left;
    const lo = Math.min(bs[0].offsetLeft, bs[2].offsetLeft), hi = Math.max(bs[0].offsetLeft, bs[2].offsetLeft);
    sp.current.to(Math.max(lo, Math.min(hi, px - w / 2)));
    let n = 0, best = 1e9;
    bs.forEach((b, i) => { const dd = Math.abs(b.offsetLeft + w / 2 - px); if (dd < best) { best = dd; n = i; } });
    if (n !== drag.current.idx) { drag.current.idx = n; haptic('select'); }
  };
  const down = (e) => { drag.current = { on: true, idx: tab }; setPress(true); ref.current.setPointerCapture(e.pointerId); move(e); };
  const up = () => {
    if (!drag.current.on) return;
    const i = drag.current.idx;
    drag.current.on = false; setPress(false);
    if (i !== tab) setTab(i); else sp.current.to(btns()[tab].offsetLeft);
    sp.current.to(btns()[i].offsetLeft);
  };
  return (
    <nav className={'tabs' + (press ? ' press' : '')} role="tablist" ref={ref} onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
      <Glass className="bar" r="pill" h={24} a={24} blur={8} />
      <div className="ind" ref={ind}><div className="tint" /><Glass className="lens" r="pill" h={14} a={16} blur={2} /></div>
      {TABS.map(([k, ic], i) => (
        <button key={k} role="tab" data-h="none" aria-selected={tab === i} onClick={(e) => { if (e.detail === 0) setTab(i); }}><Icon n={ic} />{t(k)}</button>
      ))}
    </nav>
  );
}

/* ---------- App ---------- */
export default function App() {
  const [s, up] = useStore();
  const [tab, setTab] = useState(0);
  const [stack, setStack] = useState([]);
  const p = s.prefs;
  const t = makeT(p.lang), loc = localeOf(p.lang);

  const go = (r, key, pre) => vt('fwd', () => { if (pre) pre(); setStack((a) => [...a, { r, key }]); }, key);
  const back = () => { const top = stack[stack.length - 1]; if (top) vt('back', () => setStack((a) => a.slice(0, -1)), top.key, true); };
  const changeTab = (i) => { if (i === tab) return; haptic('nav'); vt(i > tab ? 'tabN' : 'tabP', () => setTab(i)); };

  useEffect(() => {
    const m = matchMedia('(prefers-color-scheme: dark)');
    const ap = () => { document.documentElement.dataset.theme = p.theme === 'system' ? (m.matches ? 'dark' : 'light') : p.theme; };
    ap(); m.addEventListener('change', ap);
    return () => m.removeEventListener('change', ap);
  }, [p.theme]);
  useEffect(() => { document.documentElement.lang = p.lang; document.documentElement.dir = p.lang === 'ar' ? 'rtl' : 'ltr'; }, [p.lang]);
  useEffect(() => { setHapticPrefs({ on: p.haptics, level: p.level }); }, [p.haptics, p.level]);
  useEffect(() => { syncReminders(p.rem, t); }, [JSON.stringify(p.rem), p.lang]);

  // Predictive back: the native plugin streams the swipe progress to the open screen
  useEffect(() => { Back.setActive({ active: stack.length > 0 }).catch(() => {}); }, [stack.length]);
  useEffect(() => {
    const subs = [];
    const el = () => document.querySelector('.pushed');
    const on = (n, f) => { try { Back.addListener(n, f).then((h) => subs.push(h)).catch(() => {}); } catch {} };
    on('backStart', () => { const e = el(); if (e) e.style.transition = 'none'; });
    on('backProgress', (d) => {
      const e = el(); if (!e) return;
      const q = d.progress || 0, dirn = d.edge === 1 ? -1 : 1;
      e.style.transform = `translateX(${dirn * q * 32}px) scale(${1 - 0.1 * q})`; e.style.borderRadius = `${q * 32}px`;
    });
    on('backCancel', () => { const e = el(); if (!e) return; e.style.transition = 'transform 320ms cubic-bezier(0.34,1.4,0.64,1), border-radius 320ms'; e.style.transform = ''; e.style.borderRadius = ''; });
    on('backCommit', () => {
      const e = el(); if (!e) return;
      haptic('nav');
      e.style.transition = 'transform 240ms cubic-bezier(0.4,0,1,1)'; e.style.transform = 'translateX(100%) scale(0.9)';
      setTimeout(() => setStack((a) => a.slice(0, -1)), 240);
    });
    return () => subs.forEach((h) => h.remove());
  }, []);

  const q = { s, up, back, go };
  const add = (k, v) => up((x) => ({ ...x, [k]: [{ id: uid(), day: dayKey(), at: Date.now(), ...v }, ...x[k]] }));
  const screens = {
    zen: <Zen {...q} />, mood: <Mood {...q} />, steps: <Steps {...q} />, diary: <Diary {...q} />, habits: <Habits {...q} />,
    tasks: <Tasks {...q} />, calendar: <Cal {...q} />, settings: <Settings {...q} />, soon: <Soon {...q} />,
    newHabit: <Form title={t('createHabit')} ph={t('habitName')} back={back} onSave={(name) => add('habits', { name, done: [] })} />,
    newTask: <Form title={t('createTask')} ph={t('newTask')} back={back} onSave={(title) => add('tasks', { title, done: false })} />,
    newDiary: <Form title={t('writeDiary')} ph={t('writeHere')} multi back={back} onSave={(text) => add('diary', { text })} />,
  };
  const top = stack[stack.length - 1];

  return (
    <Ctx.Provider value={{ t, loc }}>
      <div className="shell" onClickCapture={(e) => { const b = e.target.closest('button:not(:disabled)'); if (b && b.dataset.h !== 'none') haptic(b.dataset.h || 'button'); }}>
        {[<Summary {...q} />, <DoPage {...q} />, <Browse {...q} />][tab]}
        <TabBar key={p.lang} tab={tab} setTab={changeTab} />
        {top && <div className="pushed" key={stack.length + top.r}>{screens[top.r]}</div>}
      </div>
    </Ctx.Provider>
  );
}
