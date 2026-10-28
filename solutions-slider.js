/* ---------------------------------------------------------
   Solutions — cinematic conveyor slider
   One rAF loop owns the live motion (bg parallax, conveyor, hover tilt,
   FLIP expand, autoplay). GSAP owns only the entrance + counter roll.
--------------------------------------------------------- */
import { SLIDES } from './solutions-data.js';

const { gsap, ScrollTrigger } = window;

const N = SLIDES.length;
const CARD_GAP = 16;
const CARD_INSET = 14;
const EXPAND_MS = 1250;
const CONTENT_SWAP = 0.5;
const BG_SCALE = 1.08;
const PARALLAX_X = 26;
const PARALLAX_Y = 15;
const BG_LERP = 0.055;
const CARD_TILT = 9;
const CARD_LERP = 0.13;
const AUTOPLAY_MS = 4000;
const AUTOPLAY_SUPPRESS = 4000;
const HOVER_SUPPRESS = 1500;
const DRAG_THRESHOLD = 66;
const DRAG_MOVE_EPS = 6;
const DRAG_BG_FACTOR = 0.12;
const ENTRANCE_HANDOFF = 1700;
const BLANK = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));
const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const pad = (n) => String(n).padStart(2, '0');

const ARROW = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const PREV = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6"/></svg>';
const NEXT = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
const CHIP = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><rect x="6" y="6" width="12" height="12" rx="1.5"/><path d="M9 2v4M15 2v4M9 18v4M15 18v4M2 9h4M2 15h4M18 9h4M18 15h4"/></svg>';

function markup() {
  const s = SLIDES[0];
  const cards = SLIDES.map((d, i) => `
    <button class="nova-card" type="button" data-control data-cursor="Open" data-i="${i}" aria-label="${d.card}">
      <span class="nova-card-inner">
        <img src="${d.img}" alt="${d.card}" draggable="false" />
        <span class="nova-card-shade"></span>
        <span class="nova-card-region"><i></i><span>${d.region}</span></span>
        <span class="nova-card-title">${d.card}</span>
      </span>
    </button>`).join('');
  return `
    <div class="nova-bg"><img data-bg src="${s.img}" alt="${s.card} — ${s.region}" draggable="false" /></div>
    <div class="nova-tile" data-tile><img data-tile-img src="${BLANK}" alt="" draggable="false" /></div>
    <div class="nova-scrim" aria-hidden="true"></div>
    <p class="label nova-label" data-copy>[ 01 ] — Solutions</p>
    <div class="nova-copy" data-content>
      <p class="nova-eyebrow" data-copy><i></i><span data-region>${s.region}</span></p>
      <h2 class="nova-title">
        <span class="nova-tmask"><span class="nova-tline" data-t0>${s.titleLines[0]}</span></span>
        <span class="nova-tmask"><span class="nova-tline" data-t1>${s.titleLines[1]}</span></span>
      </h2>
      <p class="nova-desc" data-copy data-desc>${s.description}</p>
      <div class="nova-cta" data-copy>
        <a class="nova-cta__circle" data-control data-href href="${s.href}" aria-label="Explore solution">${ARROW}</a>
        <a class="nova-cta__text" data-control data-href href="${s.href}">Explore solution</a>
      </div>
      <p class="nova-meta" data-copy>${CHIP}<span data-meta>${s.meta}</span></p>
    </div>
    <div class="nova-bottom">
      <div class="nova-nav" data-copy>
        <button type="button" class="nova-arrow" data-control data-prev aria-label="Previous">${PREV}</button>
        <button type="button" class="nova-arrow" data-control data-next aria-label="Next">${NEXT}</button>
      </div>
      <div class="nova-progress" data-copy><i class="nova-progress-fill" data-fill></i></div>
      <div class="nova-counter" data-copy aria-live="polite">
        <span class="nova-digits"><span class="nova-win"><span data-d0>0</span></span><span class="nova-win"><span data-d1>1</span></span></span>
        <span class="nova-total">/ ${pad(N)}</span>
      </div>
    </div>
    <div class="nova-rail" data-rail>${cards}</div>`;
}

export function createSolutions(root) {
  if (!root) return null;
  root.innerHTML = markup();
  const q = (s) => root.querySelector(s);
  const bgImg = q('[data-bg]');
  const tile = q('[data-tile]');
  const tileImg = q('[data-tile-img]');
  const content = q('[data-content]');
  const rail = q('[data-rail]');
  const cardEls = [...root.querySelectorAll('.nova-card')];
  const digitEls = [q('[data-d0]'), q('[data-d1]')];
  const fill = q('[data-fill]');

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // preload every photo so a switch's background is already decoded
  SLIDES.forEach((d) => { const im = new Image(); im.src = d.img; });

  /* ---------- state ---------- */
  let active = 0;
  let ready = false;
  let visible = false;
  const riRest = SLIDES.map((_, s) => s - 1);
  let riFrom = riRest.slice();
  let riTo = riRest.slice();
  const slotTilt = SLIDES.map(() => ({ rx: 0, ry: 0, sc: 1, lift: 0 }));
  let hoveredSlot = null;
  let hiddenSlot = -1;
  let dir = 1;
  let dims = { w: 0, h: 0, cardW: 0, cardH: 0, pitch: 0, railLeft: 0, railTop: 0, railWidth: 0 };
  const cursor = { x: 0.5, y: 0.5, px: 0, py: 0 };
  const bgPos = { x: 0, y: 0 };
  const tr = { on: false, from: 0, to: 0, start: 0, origin: null, swapped: false };
  const autoplay = { last: 0, suppressUntil: 0 };
  const drag = { down: false, startX: 0, dx: 0, moved: false };

  /* ---------- layout ---------- */
  function measure() {
    const r = root.getBoundingClientRect();
    const w = r.width, h = r.height;
    const cardW = clamp(w * 0.132, 156, 188);
    const cardH = clamp(h * 0.375, 280, 340);
    const pitch = cardW + CARD_GAP;
    const contentRight = clamp(w * 0.06, 24, 88) + Math.min(440, w * 0.36) + 24;
    const rightMargin = clamp(w * 0.04, 20, 56);
    const available = w - contentRight - rightMargin;
    const vis = clamp(Math.floor((available - 2 * CARD_INSET + CARD_GAP) / pitch), 1, N - 1);
    const railWidth = 2 * CARD_INSET + vis * pitch - CARD_GAP;
    const railH = cardH + 96;
    rail.style.width = `${railWidth}px`;
    rail.style.right = `${rightMargin}px`;
    rail.style.height = `${railH}px`;
    cardEls.forEach((el) => { el.style.width = `${cardW}px`; el.style.height = `${cardH}px`; el.style.top = '48px'; });
    dims = { w, h, cardW, cardH, pitch, railLeft: w - rightMargin - railWidth, railTop: h / 2 - railH / 2, railWidth };
  }

  function rectOf(s) {
    const el = cardEls[s];
    if (!el) return null;
    const rr = root.getBoundingClientRect();
    const c = el.getBoundingClientRect();
    if (c.width < 2) return null;
    const x = c.left - rr.left, y = c.top - rr.top;
    if (x + c.width <= dims.railLeft - 4 || x >= dims.railLeft + dims.railWidth) return null;
    return { x, y, w: c.width, h: c.height };
  }

  const slideAt = (v) => riRest.indexOf(v);

  /* ---------- copy ---------- */
  function setActive(i) {
    active = i;
    const d = SLIDES[i];
    q('[data-region]').textContent = d.region;
    q('[data-t0]').textContent = d.titleLines[0];
    q('[data-t1]').textContent = d.titleLines[1];
    q('[data-desc]').textContent = d.description;
    q('[data-meta]').textContent = d.meta;
    root.querySelectorAll('[data-href]').forEach((a) => { a.href = d.href; });
    fill.style.width = `${((i + 1) / N) * 100}%`;
    rollCounter(pad(i + 1));
  }

  /* ---------- counter: per-digit rolling board ---------- */
  function rollCounter(str) {
    const d = dir >= 0 ? 1 : -1;
    digitEls.forEach((live, k) => {
      const next = str[k];
      const prev = live.textContent;
      if (next === prev) return;
      const win = live.parentNode;
      win.querySelectorAll('[data-clone]').forEach((c) => c.remove());
      gsap.killTweensOf(live);
      const clone = document.createElement('span');
      clone.dataset.clone = '';
      clone.setAttribute('aria-hidden', 'true');
      clone.className = 'nova-digit-out';
      clone.textContent = prev;
      win.appendChild(clone);
      gsap.to(clone, { yPercent: -128 * d, filter: 'blur(12px)', scale: 0.86, autoAlpha: 0, duration: 0.38, ease: 'power2.in', onComplete: () => clone.remove() });
      live.textContent = next;
      gsap.fromTo(live,
        { yPercent: 128 * d, filter: 'blur(12px)', scale: 0.86, autoAlpha: 0 },
        { yPercent: 0, filter: 'blur(0px)', scale: 1, autoAlpha: 1, duration: 0.58, ease: 'power3.out' });
    });
  }

  /* ---------- FLIP expand ---------- */
  function beginExpand(fromSlide, toSlide, origin, hideSlide) {
    const now = performance.now();
    autoplay.suppressUntil = now + AUTOPLAY_SUPPRESS;
    tileImg.src = SLIDES[toSlide].img;
    const ts = tile.style;
    if (origin) {
      ts.left = `${origin.x}px`; ts.top = `${origin.y}px`; ts.width = `${origin.w}px`; ts.height = `${origin.h}px`;
      ts.borderRadius = '20px'; ts.opacity = '1';
      tileImg.style.transform = 'scale(1)';
    } else {
      ts.left = '0px'; ts.top = '0px'; ts.width = `${dims.w}px`; ts.height = `${dims.h}px`;
      ts.borderRadius = '0px'; ts.opacity = '0'; ts.boxShadow = 'none';
      tileImg.style.transform = 'scale(1.16)';
    }
    ts.display = 'block';
    hiddenSlot = hideSlide;
    Object.assign(tr, { on: true, from: fromSlide, to: toSlide, start: now, origin, swapped: false });
  }

  function buildRi(mutate) {
    const from = riRest.slice();
    const to = riRest.slice();
    mutate(from, to);
    riFrom = from; riTo = to;
  }

  function promote(X, origin) {
    if (tr.on) return;
    const A = active;
    const k = riRest[X];
    if (X === A || k < 0) return;
    buildRi((from, to) => {
      for (let s = 0; s < N; s++) {
        if (s === X) to[s] = -1;
        else if (s === A) { from[s] = N - 1; to[s] = N - 2; }
        else if (from[s] > k) to[s] = from[s] - 1;
        else to[s] = from[s];
      }
    });
    dir = 1;
    beginExpand(A, X, origin, X);
  }

  function demote() {
    if (tr.on) return;
    const B = slideAt(N - 2);
    if (B < 0) return;
    const X = active;
    buildRi((from, to) => {
      for (let s = 0; s < N; s++) {
        if (s === B) to[s] = -1;
        else if (s === X) { from[s] = -1; to[s] = 0; }
        else to[s] = from[s] + 1;
      }
    });
    dir = -1;
    beginExpand(X, B, null, B);
  }

  function step(d) {
    if (tr.on) return;
    if (d > 0) {
      const X = slideAt(0);
      if (X >= 0) promote(X, rectOf(X));
    } else demote();
  }

  function reveal() {
    tile.style.display = 'none';
    content.style.opacity = '1';
    content.style.filter = 'blur(0px)';
    content.style.transform = 'translateY(-50%)';
    hiddenSlot = -1;
    autoplay.last = performance.now();
    bgImg.alt = `${SLIDES[tr.to].card} — ${SLIDES[tr.to].region}`;
  }

  /* ---------- the one rAF loop ---------- */
  function frame(now) {
    requestAnimationFrame(frame);
    if (!visible && !tr.on) return;
    const { pitch, cardW, cardH, railLeft, railTop, w: W, h: H } = dims;

    // 1. background parallax — GSAP owns it until the entrance hands off
    if (ready) {
      const tx = reduced ? 0 : (cursor.x - 0.5) * -2 * PARALLAX_X;
      const ty = reduced ? 0 : (cursor.y - 0.5) * -2 * PARALLAX_Y;
      const dxDrag = drag.down ? drag.dx * DRAG_BG_FACTOR : 0;
      bgPos.x = lerp(bgPos.x, tx + dxDrag, BG_LERP);
      bgPos.y = lerp(bgPos.y, ty, BG_LERP);
      bgImg.style.transform = `translate3d(${bgPos.x.toFixed(2)}px, ${bgPos.y.toFixed(2)}px, 0) scale(${BG_SCALE})`;
    }

    // 2. conveyor
    const moving = tr.on;
    const ce = moving ? easeInOutCubic(clamp((now - tr.start) / EXPAND_MS, 0, 1)) : 1;
    for (let s = 0; s < N; s++) {
      const idx = moving ? lerp(riFrom[s], riTo[s], ce) : riRest[s];
      const x = idx * pitch + CARD_INSET;
      let trx = 0, tryy = 0, tsc = 1, tlift = 0;
      if (hoveredSlot === s && !reduced && !moving) {
        const cx = railLeft + x + cardW / 2;
        const cy = railTop + 48 + cardH / 2;
        const lx = clamp((cursor.px - cx) / (cardW / 2), -1, 1);
        const ly = clamp((cursor.py - cy) / (cardH / 2), -1, 1);
        tryy = lx * CARD_TILT; trx = -ly * CARD_TILT; tsc = 1.05; tlift = -12;
      }
      const m = slotTilt[s];
      m.rx += (trx - m.rx) * CARD_LERP;
      m.ry += (tryy - m.ry) * CARD_LERP;
      m.sc += (tsc - m.sc) * CARD_LERP;
      m.lift += (tlift - m.lift) * CARD_LERP;
      const el = cardEls[s];
      el.style.transform = `translate3d(${x.toFixed(1)}px, ${m.lift}px, 0) perspective(1000px) rotateX(${m.rx.toFixed(2)}deg) rotateY(${m.ry.toFixed(2)}deg) scale(${m.sc.toFixed(3)})`;
      el.style.opacity = hiddenSlot === s && moving ? '0' : '1';
    }

    // 3. expand tween
    if (tr.on) {
      const p = clamp((now - tr.start) / EXPAND_MS, 0, 1);
      const e = easeInOutCubic(p);
      const ts = tile.style;
      if (tr.origin) {
        const o = tr.origin;
        ts.left = `${lerp(o.x, 0, e)}px`;
        ts.top = `${lerp(o.y, 0, e)}px`;
        ts.width = `${lerp(o.w, W, e)}px`;
        ts.height = `${lerp(o.h, H, e)}px`;
        ts.borderRadius = `${lerp(20, 0, e)}px`;
        ts.boxShadow = `0 ${lerp(30, 0, e)}px ${lerp(80, 0, e)}px rgba(0,0,0,${0.4 * (1 - e)})`;
        tileImg.style.transform = `translate3d(${bgPos.x * e}px, ${bgPos.y * e}px, 0) scale(${lerp(1, BG_SCALE, e)})`;
      } else {
        ts.opacity = String(easeOutExpo(clamp(p * 1.4, 0, 1)));
        tileImg.style.transform = `translate3d(${bgPos.x * e}px, ${bgPos.y * e}px, 0) scale(${lerp(1.16, BG_SCALE, e)})`;
      }

      if (p < CONTENT_SWAP) {
        const k = p / CONTENT_SWAP;
        content.style.opacity = String(1 - k);
        content.style.filter = `blur(${k * 8}px)`;
        content.style.transform = `translateY(-50%) translateY(${-k * 16}px)`;
      } else {
        if (!tr.swapped) { tr.swapped = true; setActive(tr.to); }
        const k = (p - CONTENT_SWAP) / (1 - CONTENT_SWAP);
        content.style.opacity = String(k);
        content.style.filter = `blur(${(1 - k) * 8}px)`;
        content.style.transform = `translateY(-50%) translateY(${(1 - k) * 16}px)`;
      }

      if (p >= 1) {
        tr.on = false;
        for (let s = 0; s < N; s++) riRest[s] = riTo[s];
        bgImg.src = SLIDES[tr.to].img;
        if (bgImg.decode) bgImg.decode().then(reveal).catch(reveal);
        else reveal();
      }
    }

    // 4. autoplay
    if (!autoplay.last) autoplay.last = now;
    if (ready && visible && !tr.on && !drag.down && now > autoplay.suppressUntil && now - autoplay.last > AUTOPLAY_MS) {
      autoplay.last = now;
      step(1);
    }
  }

  /* ---------- input ---------- */
  root.addEventListener('pointermove', (e) => {
    const r = root.getBoundingClientRect();
    cursor.px = e.clientX - r.left;
    cursor.py = e.clientY - r.top;
    cursor.x = cursor.px / r.width;
    cursor.y = cursor.py / r.height;
    if (drag.down) {
      drag.dx = e.clientX - drag.startX;
      if (Math.abs(drag.dx) > DRAG_MOVE_EPS) drag.moved = true;
    }
  });
  root.addEventListener('pointerdown', (e) => {
    if (e.target.closest('[data-control]')) return;
    Object.assign(drag, { down: true, startX: e.clientX, dx: 0, moved: false });
    autoplay.suppressUntil = performance.now() + AUTOPLAY_SUPPRESS;
  });
  const endDrag = () => {
    if (!drag.down) return;
    const { dx, moved } = drag;
    drag.down = false; drag.dx = 0;
    if (moved && Math.abs(dx) > DRAG_THRESHOLD) step(dx < 0 ? 1 : -1);
  };
  window.addEventListener('pointerup', endDrag);
  window.addEventListener('pointercancel', () => { drag.down = false; drag.dx = 0; });
  root.addEventListener('pointerenter', () => { autoplay.suppressUntil = performance.now() + HOVER_SUPPRESS; });
  root.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowRight') { e.preventDefault(); autoplay.suppressUntil = performance.now() + AUTOPLAY_SUPPRESS; step(1); }
    if (e.key === 'ArrowLeft') { e.preventDefault(); autoplay.suppressUntil = performance.now() + AUTOPLAY_SUPPRESS; step(-1); }
  });
  q('[data-prev]').addEventListener('click', () => step(-1));
  q('[data-next]').addEventListener('click', () => step(1));
  cardEls.forEach((el, i) => {
    el.addEventListener('click', () => promote(i, rectOf(i)));
    el.addEventListener('mouseenter', () => { hoveredSlot = i; });
    el.addEventListener('mouseleave', () => { if (hoveredSlot === i) hoveredSlot = null; });
  });

  measure();
  window.addEventListener('resize', measure);
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) autoplay.last = performance.now();
  }, { threshold: 0.35 }).observe(root);

  fill.style.width = `${(1 / N) * 100}%`;
  requestAnimationFrame(frame);

  /* ---------- entrance (plays once, when the section scrolls in) ---------- */
  const copyGroup = [...root.querySelectorAll('[data-copy]')];
  gsap.set(bgImg, { autoAlpha: 0, scale: 1.14, filter: 'brightness(0.72)' });
  gsap.set('.nova-tline', { yPercent: 118 });
  gsap.set(copyGroup, { autoAlpha: 0, y: 26 });
  gsap.set(root.querySelectorAll('.nova-card-inner'), { autoAlpha: 0, y: 46 });

  const entrance = () => {
    const tl = gsap.timeline({ defaults: { ease: 'power2.out' } });
    tl.fromTo(bgImg, { autoAlpha: 0, scale: 1.14, filter: 'brightness(0.72)' },
      { autoAlpha: 1, scale: BG_SCALE, filter: 'brightness(1)', duration: 1.25, clearProps: 'filter' }, 0);
    tl.fromTo(root.querySelectorAll('.nova-tline'), { yPercent: 118 }, { yPercent: 0, duration: 0.95, ease: 'power4.out', stagger: 0.08 }, 0.3);
    tl.fromTo(copyGroup, { autoAlpha: 0, y: 26, filter: 'blur(8px)' },
      { autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.9, ease: 'power3.out', stagger: 0.06, clearProps: 'filter' }, 0.42);
    tl.fromTo(root.querySelectorAll('.nova-card-inner'), { autoAlpha: 0, y: 46 },
      { autoAlpha: 1, y: 0, duration: 0.72, ease: 'back.out(1.7)', stagger: 0.2 }, 0.5);
    tl.from(fill, { scaleX: 0, transformOrigin: 'left center', duration: 0.8 }, 0.95);
    setTimeout(() => { ready = true; autoplay.last = performance.now(); }, ENTRANCE_HANDOFF);
  };
  ScrollTrigger.create({ trigger: root, start: 'top 65%', once: true, onEnter: entrance });

  return { step };
}
