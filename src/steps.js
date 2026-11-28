// Step counting needs a native plugin and I could not verify one offline.
// To enable: read steps from a Capacitor plugin and call update() to write
// { steps: { 'YYYY-MM-DD': count } }, then set STEPS_AVAILABLE to true.
export const STEPS_AVAILABLE = false;
