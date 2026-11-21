// Should the nav pill be collapsed? Pure, so it is tested. y = scroll offset, dy = change since the last event.
// Collapses on a real downward scroll, expands on a real upward one or back at the top; small jitter keeps the current state (no flicker).
export const navMin = (min, y, dy) => (y <= 8 ? false : dy > 6 ? true : dy < -6 ? false : min);
