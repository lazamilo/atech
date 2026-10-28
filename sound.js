/* ---------------------------------------------------------
   ATECH // SIGNAL FIELD — synthesized UI sound (Web Audio, no files)
   Everything is generated on the fly: short blips, ticks and glitches
   for interactions.
--------------------------------------------------------- */
const KEY = 'atech-v2-sound';

let ctx = null, master = null, sfx = null, noiseBuf = null;
let on = false;
const last = {};

// rate-limit per sound so fast pointer movement never turns into noise
const gate = (name, ms) => {
  const t = performance.now();
  if (last[name] && t - last[name] < ms) return false;
  last[name] = t;
  return true;
};

function init() {
  if (ctx) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  const comp = ctx.createDynamicsCompressor();
  comp.threshold.value = -18; comp.ratio.value = 4;
  master = ctx.createGain(); master.gain.value = 0;
  master.connect(comp).connect(ctx.destination);
  sfx = ctx.createGain(); sfx.gain.value = 0.55; sfx.connect(master);

  noiseBuf = ctx.createBuffer(1, ctx.sampleRate * 2, ctx.sampleRate);
  const d = noiseBuf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;

}

function env(g, t, a, peak, dec) {
  g.gain.cancelScheduledValues(t);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(peak, t + a);
  g.gain.exponentialRampToValueAtTime(0.0001, t + a + dec);
}

function tone(freq, { type = 'sine', dur = 0.06, vol = 0.12, glide = 0, delay = 0 } = {}) {
  if (!on || !ctx) return;
  const t = ctx.currentTime + delay;
  const o = ctx.createOscillator(); o.type = type;
  o.frequency.setValueAtTime(freq, t);
  if (glide) o.frequency.exponentialRampToValueAtTime(Math.max(20, freq * glide), t + dur);
  const g = ctx.createGain();
  env(g, t, 0.004, vol, dur);
  o.connect(g).connect(sfx);
  o.start(t); o.stop(t + dur + 0.05);
}

function noise({ dur = 0.05, vol = 0.1, freq = 3000, q = 1, type = 'bandpass', sweepTo = 0, delay = 0 } = {}) {
  if (!on || !ctx) return;
  const t = ctx.currentTime + delay;
  const src = ctx.createBufferSource(); src.buffer = noiseBuf;
  const f = ctx.createBiquadFilter(); f.type = type; f.Q.value = q;
  f.frequency.setValueAtTime(freq, t);
  if (sweepTo) f.frequency.exponentialRampToValueAtTime(sweepTo, t + dur);
  const g = ctx.createGain();
  env(g, t, Math.min(0.02, dur * 0.3), vol, dur);
  src.connect(f).connect(g).connect(sfx);
  src.start(t, Math.random()); src.stop(t + dur + 0.05);
}

export const sound = {
  get enabled() { return on; },
  get stored() { try { return localStorage.getItem(KEY); } catch (e) { return null; } },

  async enable() {
    init();
    if (!ctx) return;
    on = true;
    // resume() can stay pending when the device has no audio output; never let the UI wait on it
    if (ctx.state === 'suspended') await Promise.race([ctx.resume(), new Promise((r) => setTimeout(r, 300))]);
    try { localStorage.setItem(KEY, 'on'); } catch (e) { /* storage blocked */ }
    const t = ctx.currentTime;
    master.gain.cancelScheduledValues(t);
    master.gain.setTargetAtTime(0.9, t, 0.15);
    document.dispatchEvent(new CustomEvent('sound', { detail: true }));
  },
  disable() {
    on = false;
    try { localStorage.setItem(KEY, 'off'); } catch (e) { /* storage blocked */ }
    if (ctx) { master.gain.setTargetAtTime(0, ctx.currentTime, 0.12); }
    document.dispatchEvent(new CustomEvent('sound', { detail: false }));
  },
  toggle() { return on ? this.disable() : this.enable(); },
  pause() { if (ctx && ctx.state === 'running') ctx.suspend(); },
  resume() { if (ctx && on) ctx.resume(); },

  /* --- vocabulary --- */
  hover() { if (gate('hover', 45)) tone(2400 + Math.random() * 400, { type: 'square', dur: 0.025, vol: 0.025 }); },
  click() {
    if (!gate('click', 60)) return;
    tone(880, { type: 'square', dur: 0.04, vol: 0.05 });
    tone(1320, { type: 'square', dur: 0.05, vol: 0.04, delay: 0.045 });
  },
  glitch() {
    if (!gate('glitch', 90)) return;
    noise({ dur: 0.05, vol: 0.05, freq: 3000 + Math.random() * 3000, q: 8 });
    tone(4000 + Math.random() * 2000, { type: 'square', dur: 0.015, vol: 0.015, delay: 0.03 });
  },
  key() { if (gate('key', 28)) noise({ dur: 0.018, vol: 0.05, freq: 4500 + Math.random() * 2500, q: 3, type: 'highpass' }); },
  tick(i = 0) { if (gate('tick', 18)) tone(1600 + (i % 12) * 60, { type: 'sine', dur: 0.02, vol: 0.03 }); },
  beep(i = 0) { tone(660 + i * 110, { type: 'square', dur: 0.06, vol: 0.04 }); },
  confirm() {
    [523, 784, 1046].forEach((f, k) => tone(f, { type: 'triangle', dur: 0.12, vol: 0.06, delay: k * 0.07 }));
  },
};
