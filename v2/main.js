import { createField } from './field.js';
import { sound } from './sound.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const pad = (n, l = 2) => String(n).padStart(l, '0');

/* ---------------------------------------------------------
   Smooth scroll
--------------------------------------------------------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.09 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
}
$$('a[href^="#"]').forEach((a) => a.addEventListener('click', (e) => {
  const t = $(a.getAttribute('href'));
  if (!t) return;
  e.preventDefault();
  if (lenis) lenis.scrollTo(t, { duration: 1.8, easing: (x) => 1 - Math.pow(1 - x, 4) });
  else t.scrollIntoView();
}));

/* ---------------------------------------------------------
   Text scramble — the signature micro-interaction
--------------------------------------------------------- */
const GLYPHS = '01<>/\\_-+=#*[]{}ATECH';
const rnd = () => GLYPHS[(Math.random() * GLYPHS.length) | 0];
function scramble(el, text = el.dataset.text || el.textContent, dur = 0.6) {
  el.dataset.text = text;
  if (reduced) { el.textContent = text; return; }
  const o = { p: 0 };
  gsap.killTweensOf(el.__scr || {});
  el.__scr = o;
  gsap.to(o, {
    p: 1, duration: dur, ease: 'none',
    onUpdate: () => {
      const n = Math.floor(o.p * text.length);
      let out = text.slice(0, n);
      for (let i = n; i < text.length; i++) out += text[i] === ' ' ? ' ' : (i < n + 4 ? rnd() : text[i]);
      el.textContent = out;
    },
    onComplete: () => { el.textContent = text; },
  });
}
// leaf text nodes only, so arrows/markup inside links survive
const scrambleTarget = (el) => {
  if (el.children.length === 0) return el;
  return [...el.querySelectorAll('*')].find((c) => c.children.length === 0 && c.textContent.trim()) || null;
};
if (finePointer) {
  $$('[data-scramble]').forEach((el) => {
    const t = scrambleTarget(el);
    if (!t) return;
    const text = t.textContent;
    (el.closest('a, button') || el).addEventListener('mouseenter', () => scramble(t, text, 0.45));
  });
}

/* ---------------------------------------------------------
   Sound — clicks everywhere, HUD toggle, silence in background tabs
--------------------------------------------------------- */
document.addEventListener('click', (e) => {
  if (e.target.closest('a, button, label, .bq, .est, [role="button"]') && !e.target.closest('[data-snd]')) sound.click();
}, true);
{
  const btn = $('[data-snd]'), label = $('[data-snd-label]');
  const sync = () => {
    btn.setAttribute('aria-pressed', String(sound.enabled));
    label.textContent = sound.enabled ? 'sound on' : 'sound off';
  };
  btn.addEventListener('click', async () => { await sound.toggle(); if (sound.enabled) sound.confirm(); });
  document.addEventListener('sound', sync);
  sync();
}
document.addEventListener('visibilitychange', () => (document.hidden ? sound.pause() : sound.resume()));
// sound starts off; a visitor who turned it on before gets it back at their first interaction
// (browsers only allow audio after a click, tap or key press)
if (sound.stored === 'on') {
  const wake = () => {
    ['pointerdown', 'keydown'].forEach((t) => window.removeEventListener(t, wake, true));
    if (!sound.enabled) sound.enable();
  };
  ['pointerdown', 'keydown'].forEach((t) => window.addEventListener(t, wake, true));
}

/* ---------------------------------------------------------
   Field
--------------------------------------------------------- */
const field = createField($('.field'));
if (!field) document.body.classList.add('no-gl');
else field.start();

/* ---------------------------------------------------------
   Boot
--------------------------------------------------------- */
const LOG = [
  'ATECH/OS 2.0 — signal field',
  '<b>[ok]</b> materija · slovenia · cet',
  '<b>[ok]</b> spinning up filament array',
  '<b>[ok]</b> calibrating probe',
  '<b>[ok]</b> iso 9001 · iso 14001',
  '<b>[ok]</b> since 1990 — handshake',
];
function boot() {
  const logEl = $('[data-boot]');
  const bar = $('[data-boot-bar]');
  const pct = $('[data-boot-pct]');
  const fonts = document.fonts ? document.fonts.ready : Promise.resolve();
  const tl = gsap.timeline();
  const n = { v: 0 };
  LOG.forEach((line, i) => tl.call(() => { logEl.innerHTML += (i ? '\n' : '') + line; }, null, i * (reduced ? 0 : 0.22)));
  tl.to(n, { v: 100, duration: reduced ? 0.2 : 1.7, ease: 'power2.inOut', onUpdate: () => { pct.textContent = pad(Math.round(n.v), 3); bar.style.transform = `scaleX(${n.v / 100})`; } }, 0);
  tl.add(() => fonts);
  tl.to('.boot', { autoAlpha: 0, duration: 0.7, ease: 'power2.inOut' }, '+=0.15');
  tl.call(() => {
    document.body.classList.remove('is-booting');
    if (lenis) lenis.start();
    if (field) field.intro(reduced ? 0.1 : 2.8);
    ScrollTrigger.refresh();
  });
  tl.from('[data-intro-lines] .ln > span', { yPercent: 110, duration: 1.2, ease: 'expo.out', stagger: 0.08 }, '-=0.1');
  tl.from('[data-intro-fade]', { autoAlpha: 0, y: 20, duration: 1, ease: 'power3.out', stagger: 0.1 }, '<0.4');
  tl.from('.hud', { autoAlpha: 0, duration: 1 }, '<');
}
boot();

/* ---------------------------------------------------------
   HUD: pointer coordinates
--------------------------------------------------------- */
const xyEl = $('[data-xy]');
window.addEventListener('pointermove', (e) => {
  xyEl.textContent = `X ${pad(Math.round(e.clientX), 4)} · Y ${pad(Math.round(e.clientY), 4)}`;
});


/* ---------------------------------------------------------
   Crosshair cursor
--------------------------------------------------------- */
if (finePointer) {
  const x = $('.xhair'), box = $('.xhair__box'), lab = $('[data-xlabel]');
  const bx = gsap.quickTo(box, 'x', { duration: 0.12, ease: 'power3' });
  const by = gsap.quickTo(box, 'y', { duration: 0.12, ease: 'power3' });
  // the lines move with the square so they always cross at its centre
  const hy = gsap.quickTo('.xhair__h', 'y', { duration: 0.12, ease: 'power3' });
  const vx = gsap.quickTo('.xhair__v', 'x', { duration: 0.12, ease: 'power3' });
  const lx = gsap.quickTo(lab, 'x', { duration: 0.5, ease: 'power3' });
  const ly = gsap.quickTo(lab, 'y', { duration: 0.5, ease: 'power3' });
  window.addEventListener('pointermove', (e) => {
    x.classList.add('on');
    bx(e.clientX); by(e.clientY); lx(e.clientX); ly(e.clientY); hy(e.clientY); vx(e.clientX);
  });
  document.addEventListener('pointerleave', () => x.classList.remove('on'));
  let hovered = null;
  document.addEventListener('pointerover', (e) => {
    const t = e.target.closest('a, button, input, textarea, label, [data-cursor]');
    if (t && t !== hovered) sound.hover();
    hovered = t;
    x.classList.toggle('hover', !!t);
    const text = t ? (t.dataset.cursor || (t.matches('a') ? 'open' : t.matches('button') ? 'press' : '')) : '';
    if (text !== lab.dataset.text) { if (text) scramble(lab, text, 0.3); else { lab.textContent = ''; lab.dataset.text = ''; } }
  });

  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.25);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
    });
    el.addEventListener('pointerleave', () => gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)' }));
  });
}

/* ---------------------------------------------------------
   Pinned sections first (DOM order), so later triggers measure correctly
--------------------------------------------------------- */
const sols = $$('.sol');
const solIdx = $$('.sol-index li');
const solImgs = $$('.sol-photo img');
const solCap = $('[data-sol-cap]');
const CAPS = ['R&D LAB · MATERIJA', 'SMT LINE · MATERIJA', 'SUPPLY CHAIN · SINCE 1990'];
let solCur = 0;
function setSol(i) {
  if (i === solCur) return;
  sound.glitch();
  const prev = sols[solCur];
  solCur = i;
  gsap.to(prev, { autoAlpha: 0, y: -24, duration: 0.4, ease: 'power2.in', onComplete: () => prev.classList.remove('on') });
  const next = sols[i];
  next.classList.add('on');
  gsap.fromTo(next, { autoAlpha: 0, y: 32 }, { autoAlpha: 1, y: 0, duration: 0.8, delay: 0.25, ease: 'power3.out' });
  $$('.sol__t span', next).forEach((s, k) => {
    const html = s.innerHTML;
    const leaf = s.querySelector('s') ? null : s;
    if (leaf) setTimeout(() => scramble(leaf, leaf.textContent, 0.7), 250 + k * 120);
    else s.innerHTML = html;
  });
  solIdx.forEach((li, k) => li.classList.toggle('on', k === i));
  solImgs.forEach((im, k) => im.classList.toggle('on', k === i));
  scramble(solCap, CAPS[i], 0.5);
}

const stages = $$('.stages li');
let stageCur = 0;
function setStage(i) {
  if (i === stageCur) return;
  sound.beep(i);
  stageCur = i;
  stages.forEach((s, k) => s.classList.toggle('on', k === i));
  const b = $('b', stages[i]);
  scramble(b, b.dataset.text || b.textContent, 0.6);
}

const mm = gsap.matchMedia();
mm.add('(min-width: 761px) and (prefers-reduced-motion: no-preference)', () => {
  ScrollTrigger.create({
    trigger: '.solutions', start: 'top top', end: '+=260%', pin: '.solutions__pin', scrub: true,
    onUpdate: (self) => {
      setSol(Math.min(2, Math.floor(self.progress * 3)));
      if (field) field.uniforms.uSpin.value = self.progress * 7;
    },
  });
  ScrollTrigger.create({
    trigger: '.process', start: 'top top', end: '+=380%', pin: '.process__pin', scrub: true,
    onUpdate: (self) => {
      setStage(Math.min(4, Math.floor(self.progress * 5)));
    },
  });
  return () => { sols.forEach((s) => gsap.set(s, { clearProps: 'all' })); };
});

/* ---------------------------------------------------------
   Section → field form + HUD
--------------------------------------------------------- */
const secs = $$('.sec');
const menuLinks = $$('.menu a');
function activate(sec, i) {
  const d = sec.dataset;
  if (field) field.setForm(d.form, { x: +(d.x || 0), y: +(d.y || 0), scale: +(d.scale || 1), tilt: +(d.tilt || 0), color: d.color, pulse: +(d.pulse || 0), fade: +(d.fade || 1) });
  menuLinks.forEach((a) => a.classList.toggle('on', a.getAttribute('href') === `#${sec.id}`));
}
secs.forEach((sec, i) => {
  ScrollTrigger.create({
    trigger: sec, start: 'top 55%', end: 'bottom 55%',
    onToggle: (self) => { if (self.isActive) activate(sec, i); },
  });
});
// on narrow screens the field sits centred behind the copy
if (window.innerWidth < 761) secs.forEach((s) => { s.dataset.x = '0'; s.dataset.y = '0.15'; s.dataset.scale = '0.8'; });

/* ---------------------------------------------------------
   Reveals
--------------------------------------------------------- */
if (!reduced) {
  gsap.from('[data-reveal]', {
    autoAlpha: 0, y: 40, scale: 0.96, duration: 1.1, ease: 'power3.out', stagger: 0.08,
    scrollTrigger: { trigger: '.signal', start: 'top 60%' },
  });
  $$('.big, .process__h').forEach((h) => gsap.from(h, { autoAlpha: 0, y: 40, duration: 1.1, ease: 'power3.out', scrollTrigger: { trigger: h, start: 'top 85%' } }));
  gsap.from('.clients li', { autoAlpha: 0, x: -30, duration: 0.8, ease: 'power3.out', stagger: 0.06, scrollTrigger: { trigger: '.clients', start: 'top 80%' } });
  gsap.from('.log__list li', { autoAlpha: 0, x: 30, duration: 0.7, ease: 'power3.out', stagger: 0.05, clearProps: 'all', scrollTrigger: { trigger: '.log__list', start: 'top 80%' } });
  gsap.from('.news > *', { autoAlpha: 0, y: 50, duration: 1, ease: 'power3.out', stagger: 0.1, clearProps: 'transform,opacity,visibility', scrollTrigger: { trigger: '.news', start: 'top 85%' } });
  gsap.from('.contact__h span', { yPercent: 60, autoAlpha: 0, duration: 1.2, ease: 'expo.out', stagger: 0.1, scrollTrigger: { trigger: '.contact__h', start: 'top 80%' } });
  gsap.from('.contact__grid > *', { autoAlpha: 0, y: 40, duration: 1, ease: 'power3.out', stagger: 0.12, scrollTrigger: { trigger: '.contact__grid', start: 'top 85%' } });
}

// counters
$$('[data-count]').forEach((el) => {
  const to = +el.dataset.count;
  ScrollTrigger.create({
    trigger: el, start: 'top 85%', once: true,
    onEnter: () => {
      const o = { v: to > 1000 ? 1900 : 0 };
      gsap.to(o, { v: to, duration: reduced ? 0.01 : 2, ease: 'power3.out', onUpdate: () => { el.textContent = Math.round(o.v); } });
    },
  });
});

/* ---------------------------------------------------------
   Newsroom — tilt + spotlight on cards, the job offer types itself out
--------------------------------------------------------- */
{
  if (finePointer && !reduced) {
    $$('.news__item').forEach((card) => {
      card.addEventListener('pointermove', (e) => {
        const r = card.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        card.style.setProperty('--mx', `${px * 100}%`);
        card.style.setProperty('--my', `${py * 100}%`);
        card.style.transform = `rotateX(${(0.5 - py) * 6}deg) rotateY(${(px - 0.5) * 8}deg) translateZ(0)`;
      });
      card.addEventListener('pointerleave', () => { card.style.transform = ''; });
    });
  }
  const job = $('[data-job]');
  const text = job.textContent;
  if (!reduced) {
    job.textContent = '';
    ScrollTrigger.create({
      trigger: job, start: 'top 85%', once: true,
      onEnter: () => {
        job.classList.add('typing');
        let k = 0;
        const t = setInterval(() => {
          job.textContent = text.slice(0, ++k);
          if (k % 2 === 0) sound.key();
          if (k >= text.length) clearInterval(t);
        }, 32);
      },
    });
  }
}

/* ---------------------------------------------------------
   Milestones — focus the row under the pointer (or nearest the middle on touch)
--------------------------------------------------------- */
{
  const list = $('.log__list');
  const rows = $$('li', list);
  if (finePointer) {
    rows.forEach((li) => {
      const t = $('time', li);
      const year = t.textContent;
      li.addEventListener('mouseenter', () => {
        scramble(t, year, 0.4);
        sound.tick(rows.indexOf(li) * 2);
        if (field) gsap.to(field.uniforms.uPulse, { value: 1, duration: 0.5, overwrite: true });
      });
    });
    list.addEventListener('mouseleave', () => {
      if (field) gsap.to(field.uniforms.uPulse, { value: 0, duration: 1.2, overwrite: true });
    });
  } else {
    list.classList.add('reading');
    rows.forEach((li) => ScrollTrigger.create({
      trigger: li, start: 'top 55%', end: 'bottom 55%',
      onToggle: (self) => li.classList.toggle('near', self.isActive),
    }));
  }
}

/* ---------------------------------------------------------
   Established card — milestone rail you can scrub with the pointer
--------------------------------------------------------- */
{
  const card = $('.est');
  const rail = $('.est__rail', card);
  const cur = $('[data-est-cur]', card);
  const yEl = $('[data-est-y]', card), tEl = $('[data-est-t]', card);
  const nowY = new Date().getFullYear();
  $('[data-est-now]', card).textContent = nowY;
  $('[data-est-age]', card).textContent = `${nowY - 1990} yrs`;
  // reuse the changelog below as the data source, oldest first
  const ms = $$('.log__list li').map((li) => ({ y: +$('time', li).textContent, t: $('span', li).textContent })).reverse();
  ms[0] = { y: 1990, t: 'Slovenian–Swiss joint venture, Materija' };
  const span = nowY - 1990;
  const dots = ms.map((m) => {
    const d = document.createElement('i');
    d.className = 'dot';
    d.style.left = `${((m.y - 1990) / span) * 100}%`;
    rail.appendChild(d);
    return d;
  });
  let at = -1;
  const show = (i) => {
    if (i === at) return;
    at = i;
    dots.forEach((d, k) => d.classList.toggle('on', k === i));
    yEl.textContent = ms[i].y;
    scramble(tEl, ms[i].t, 0.45);
  };
  const size = () => rail.style.setProperty('--rail-w', `${rail.offsetWidth}px`);
  size(); window.addEventListener('resize', size);
  card.addEventListener('pointermove', (e) => {
    const r = rail.getBoundingClientRect();
    const x = Math.min(Math.max(e.clientX - r.left, 0), r.width);
    cur.style.transform = `translateX(${x}px)`;
    const year = 1990 + (x / r.width) * span;
    let best = 0;
    ms.forEach((m, k) => { if (Math.abs(m.y - year) < Math.abs(ms[best].y - year)) best = k; });
    if (best !== at) sound.tick(best * 3);
    show(best);
  });
  card.addEventListener('pointerleave', () => show(0));
  // idle: step through the milestones while nobody is pointing at the card
  let hover = false;
  card.addEventListener('pointerenter', () => { hover = true; });
  card.addEventListener('pointerleave', () => { hover = false; });
  show(0);
  if (!reduced) setInterval(() => { if (!hover) show((at + 1) % ms.length); }, 2600);
}

/* ---------------------------------------------------------
   48h response dial — a comet sweeps the 48 hour ticks; hover fills them
--------------------------------------------------------- */
{
  const card = $('.sla');
  const g = $('[data-ticks]', card);
  const NS = 'http://www.w3.org/2000/svg';
  const ticks = Array.from({ length: 48 }, (_, i) => {
    const a = (i / 48) * Math.PI * 2 - Math.PI / 2;
    const major = i % 6 === 0;
    const r1 = major ? 72 : 76, r2 = 90;
    const l = document.createElementNS(NS, 'line');
    l.setAttribute('x1', 100 + Math.cos(a) * r1); l.setAttribute('y1', 100 + Math.sin(a) * r1);
    l.setAttribute('x2', 100 + Math.cos(a) * r2); l.setAttribute('y2', 100 + Math.sin(a) * r2);
    if (major) l.classList.add('major');
    g.appendChild(l);
    return l;
  });
  const hEl = $('[data-sla-h]', card), byEl = $('[data-sla-by]', card);
  const fmtBy = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Ljubljana', weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: false });
  const by = () => {
    const p = Object.fromEntries(fmtBy.formatToParts(new Date(Date.now() + 48 * 3600e3)).map((x) => [x.type, x.value]));
    return `${p.weekday} ${p.day} ${p.month} · ${p.hour}:${p.minute}`.toUpperCase();
  };
  let byText = by();
  byEl.textContent = byText;
  setInterval(() => { const t = by(); if (t !== byText) { byText = t; scramble(byEl, t, 0.5); } }, 15000);

  // idle: a comet with an 8-tick tail; hover: fill clockwise while the hours roll up
  let mode = 'idle', head = 0, fill = 0, last = 0;
  const paint = () => ticks.forEach((t, i) => {
    const on = mode === 'idle' ? ((head - i + 48) % 48) < 8 : i < fill;
    t.classList.toggle('on', on);
    t.style.opacity = mode === 'idle' && on ? String(1 - ((head - i + 48) % 48) / 8) : '';
  });
  const step = (now) => {
    requestAnimationFrame(step);
    if (now - last < (mode === 'idle' ? 70 : 22)) return;
    last = now;
    if (mode === 'idle') head = (head + 1) % 48;
    else if (fill < 48) { fill++; hEl.textContent = pad(fill); if (fill % 2 === 0) sound.tick(fill / 2); }
    paint();
  };
  if (!reduced) requestAnimationFrame(step);
  else { mode = 'fill'; fill = 48; paint(); }
  card.addEventListener('pointerenter', () => {
    if (reduced) return;
    mode = 'fill'; fill = 0; hEl.textContent = '00';
  });
  card.addEventListener('pointerleave', () => {
    if (reduced) return;
    mode = 'idle'; hEl.textContent = '48'; scramble(byEl, byText, 0.4);
  });
}

/* ---------------------------------------------------------
   About — the manifesto decodes as you scroll
--------------------------------------------------------- */
{
  const el = $('[data-decode]');
  const text = el.textContent.trim();
  el.textContent = '';
  const chars = [...text].map((c) => {
    const s = document.createElement('span');
    s.className = 'ch';
    s.textContent = c;
    s.style.color = 'var(--dim)';
    el.appendChild(s);
    return s;
  });
  const W = 14;
  let last = -1;
  const render = (p) => {
    const n = Math.floor(p * (chars.length + W));
    if (n === last) return;
    last = n;
    chars.forEach((s, i) => {
      const c = text[i];
      if (i < n - W) { s.textContent = c; s.style.color = 'var(--ink)'; }
      else if (i < n && c !== ' ') { s.textContent = rnd(); s.style.color = 'var(--blue-hi)'; }
      else { s.textContent = c; s.style.color = 'var(--dim)'; }
    });
  };
  if (reduced) render(1);
  else ScrollTrigger.create({ trigger: '.about', start: 'top 70%', end: 'center 45%', scrub: true, onUpdate: (self) => render(self.progress) });
}

/* ---------------------------------------------------------
   References — peek image follows the pointer
--------------------------------------------------------- */
if (finePointer) {
  const peek = $('.peek'), img = $('img', peek);
  const px = gsap.quickTo(peek, 'x', { duration: 0.6, ease: 'power3' });
  const py = gsap.quickTo(peek, 'y', { duration: 0.6, ease: 'power3' });
  $('.clients').addEventListener('pointermove', (e) => { px(e.clientX + 170); py(e.clientY); });
  $$('.clients a').forEach((a) => a.addEventListener('pointerenter', () => { img.src = a.dataset.img; }));
  $('.clients').addEventListener('pointerenter', () => gsap.to(peek, { scale: 1, duration: 0.5, ease: 'power3.out' }));
  $('.clients').addEventListener('pointerleave', () => gsap.to(peek, { scale: 0, duration: 0.4, ease: 'power3.in' }));
}

/* ---------------------------------------------------------
   Voices — a terminal that types each testimonial
--------------------------------------------------------- */
{
  const data = JSON.parse($('#voices-data').textContent);
  const tabs = $('.term__tabs'), q = $('[data-term-q]'), by = $('[data-term-by]'), file = $('[data-term-file]');
  let cur = -1, typing = null, auto = null, touched = false;
  const btns = data.map((d, i) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.setAttribute('role', 'tab');
    b.textContent = d.co;
    b.addEventListener('click', () => { touched = true; show(i); });
    tabs.appendChild(b);
    return b;
  });
  let termVisible = false;
  new IntersectionObserver(([e]) => { termVisible = e.isIntersecting; }).observe($('.term'));
  function show(i) {
    if (i === cur) return;
    cur = i;
    btns.forEach((b, k) => b.setAttribute('aria-selected', String(k === i)));
    const d = data[i];
    file.textContent = `${d.co.toLowerCase().replace(/[^a-z]+/g, '-')}.txt`;
    by.textContent = '';
    clearInterval(typing); clearTimeout(auto);
    const full = `“${d.q}”`;
    if (reduced) { q.textContent = full; by.textContent = d.by; return; }
    let k = 0;
    typing = setInterval(() => {
      k += 3;
      q.textContent = full.slice(0, k);
      if (termVisible) sound.key();
      if (k >= full.length) {
        clearInterval(typing);
        scramble(by, d.by, 0.5);
        if (!touched) auto = setTimeout(() => show((cur + 1) % data.length), 5200);
      }
    }, 16);
  }
  ScrollTrigger.create({ trigger: '.term', start: 'top 80%', once: true, onEnter: () => show(0) });
}

/* ---------------------------------------------------------
   Forms → prefilled e-mail draft
--------------------------------------------------------- */
$$('form[data-mailto]').forEach((form) => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const fd = new FormData(form);
    const topics = fd.getAll('topic').join(', ');
    const lines = [];
    for (const [k, v] of fd.entries()) if (k !== 'topic' && v) lines.push(`${k}: ${v}`);
    if (topics) lines.push(`interested in: ${topics}`);
    window.location.href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(form.dataset.subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
  });
});

window.addEventListener('load', () => ScrollTrigger.refresh());
