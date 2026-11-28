// One set: 24px grid, 1.75 stroke, round caps. Every icon in the app comes from here.
const P = {
  summary: '<path d="M12 3a9 9 0 109 9h-9z"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  browse: '<path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01"/>',
  zen: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/>',
  mood: '<circle cx="12" cy="12" r="9"/><path d="M8.5 14.5c1 1.4 2.2 2 3.5 2s2.5-.6 3.5-2M9 9.5h.01M15 9.5h.01"/>',
  steps: '<path d="M8 4c-2 0-3 2-3 4.5S6 12 8 12s3-1 3-3.5S10 4 8 4zM16 12c-2 0-3 2-3 4.5S14 20 16 20s3-1 3-3.5S18 12 16 12z"/>',
  diary: '<path d="M4 20l1-4L16.5 4.5a2.1 2.1 0 013 3L8 19zM14 7l3 3"/>',
  habit: '<path d="M17 2l3 3-3 3M4 11V9a4 4 0 014-4h12M7 22l-3-3 3-3M20 13v2a4 4 0 01-4 4H4"/>',
  task: '<circle cx="12" cy="12" r="9"/><path d="M8 12.5l3 3 5-6"/>',
  calendar: '<rect x="3.5" y="5" width="17" height="15.5" rx="3"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  settings: '<path d="M4 7h10M18 7h2M4 17h2M10 17h10"/><circle cx="16" cy="7" r="2"/><circle cx="8" cy="17" r="2"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  next: '<path d="M9 5l7 7-7 7"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
  down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
  minus: '<path d="M5 12h14"/>',
  lock: '<rect x="5" y="11" width="14" height="9.5" rx="2.5"/><path d="M8 11V8a4 4 0 018 0v3"/>',
  check: '<path d="M6 12.5l4 4 8-9"/>',
};
export default function Icon({ n, size = 24 }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" dangerouslySetInnerHTML={{ __html: P[n] }} />;
}
