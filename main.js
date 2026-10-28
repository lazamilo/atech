import { createHero } from './hero-gl.js';
import { createSolutions } from './solutions-slider.js';

const { gsap, ScrollTrigger, Lenis } = window;
gsap.registerPlugin(ScrollTrigger);

const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

/* ---------------------------------------------------------
   Smooth scroll
--------------------------------------------------------- */
let lenis = null;
if (!reduced) {
  lenis = new Lenis({ lerp: 0.085, wheelMultiplier: 1 });
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add((t) => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);
  lenis.stop();
  window.__lenis = lenis;
}
const scrollTo = (target) => {
  if (lenis) lenis.scrollTo(target, { duration: 1.6, easing: (t) => 1 - Math.pow(1 - t, 4) });
  else (typeof target === 'number' ? window.scrollTo({ top: target }) : target.scrollIntoView());
};

/* ---------------------------------------------------------
   Hero WebGL
--------------------------------------------------------- */
const probeEl = $('[data-probe]');
const hero = createHero($('.hero__gl'), {
  onProbe: (p) => {
    if (!probeEl) return;
    const f = (n) => (n * 10).toFixed(1).padStart(6, '0');
    probeEl.textContent = `${f(p.x)} , ${f(p.y)}`;
  },
});
if (!hero) $('.hero').classList.add('no-gl');
if (hero) {
  new IntersectionObserver(([e]) => hero.setRunning(e.isIntersecting)).observe($('.hero'));
  ScrollTrigger.create({
    trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true,
    onUpdate: (self) => { hero.state.scroll = self.progress; },
  });
}
gsap.to('.hero__content', {
  yPercent: -30, opacity: 0, ease: 'none',
  scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true },
});

/* ---------------------------------------------------------
   Loader → intro
--------------------------------------------------------- */
function runIntro() {
  const tl = gsap.timeline();
  const count = $('[data-count]');
  const n = { v: 0 };
  const fontsReady = document.fonts ? document.fonts.ready : Promise.resolve();

  gsap.set('.hero__title .line > span', { yPercent: 110 });
  gsap.set(['.hero .eyebrow', '.hero__cta', '.hero__hud'], { opacity: 0, y: 20 });

  tl.to(n, {
    v: 100, duration: reduced ? 0.2 : 2.2, ease: 'power2.inOut',
    onUpdate: () => {
      count.textContent = String(Math.round(n.v)).padStart(3, '0');
      gsap.set('.loader__bar i', { scaleX: n.v / 100 });
    },
  })
    .add(() => fontsReady)
    .to('.loader__inner', { opacity: 0, y: -30, duration: 0.6, ease: 'power3.in' })
    .to('.loader', { clipPath: 'inset(0 0 100% 0)', duration: 1.1, ease: 'expo.inOut' }, '-=0.1')
    .add(() => {
      document.body.classList.remove('is-loading');
      $('.loader').style.display = 'none';
      lenis && lenis.start();
    })
    .to(hero ? hero.state : {}, { intro: 1, duration: 3, ease: 'expo.out' }, '-=0.9')
    .to('.hero__title .line > span', { yPercent: 0, duration: 1.4, stagger: 0.09, ease: 'expo.out' }, '<0.15')
    .to(['.hero .eyebrow', '.hero__cta', '.hero__hud'], { opacity: 1, y: 0, duration: 1.2, stagger: 0.1, ease: 'expo.out' }, '<0.4');
}
window.scrollTo(0, 0);
runIntro();

/* ---------------------------------------------------------
   Cursor
--------------------------------------------------------- */
if (finePointer) {
  const cursor = $('.cursor');
  const ring = $('.cursor__ring'), dot = $('.cursor__dot'), label = $('.cursor__label');
  const rx = gsap.quickTo(ring, 'x', { duration: 0.5, ease: 'power3' });
  const ry = gsap.quickTo(ring, 'y', { duration: 0.5, ease: 'power3' });
  const dx = gsap.quickTo(dot, 'x', { duration: 0.08 });
  const dy = gsap.quickTo(dot, 'y', { duration: 0.08 });
  window.addEventListener('pointermove', (e) => { rx(e.clientX); ry(e.clientY); dx(e.clientX); dy(e.clientY); });
  document.addEventListener('pointerover', (e) => {
    const lab = e.target.closest('[data-cursor]');
    const hov = e.target.closest('a, button, [data-hover], input, textarea, label');
    if (lab && !hov) {
      label.textContent = lab.dataset.cursor;
      cursor.classList.add('is-label'); cursor.classList.remove('is-hover');
    } else if (hov) {
      cursor.classList.add('is-hover'); cursor.classList.remove('is-label');
    } else {
      cursor.classList.remove('is-hover', 'is-label');
    }
  });
  document.addEventListener('pointerleave', () => gsap.to(cursor, { opacity: 0 }));
  document.addEventListener('pointerenter', () => gsap.to(cursor, { opacity: 1 }));

  /* magnetic */
  $$('[data-magnetic]').forEach((el) => {
    const xTo = gsap.quickTo(el, 'x', { duration: 0.6, ease: 'power3' });
    const yTo = gsap.quickTo(el, 'y', { duration: 0.6, ease: 'power3' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      xTo((e.clientX - (r.left + r.width / 2)) * 0.3);
      yTo((e.clientY - (r.top + r.height / 2)) * 0.35);
    });
    el.addEventListener('pointerleave', () => { gsap.to(el, { x: 0, y: 0, duration: 1, ease: 'elastic.out(1, 0.4)' }); });
  });
}

/* ---------------------------------------------------------
   Header + menu + anchors
--------------------------------------------------------- */
const header = $('.header');
const menu = $('.menu');
const burger = $('.burger');
const setMenu = (open) => {
  menu.classList.toggle('is-open', open);
  menu.setAttribute('aria-hidden', String(!open));
  burger.setAttribute('aria-expanded', String(open));
  $$('.menu__links a').forEach((a, i) => { a.style.transitionDelay = open ? `${0.25 + i * 0.05}s` : '0s'; });
  if (lenis) open ? lenis.stop() : lenis.start();
};
burger.addEventListener('click', () => setMenu(!menu.classList.contains('is-open')));

let lastY = 0;
const onScroll = (y) => {
  const down = y > lastY;
  header.classList.toggle('is-hidden', down && y > 240 && !menu.classList.contains('is-open'));
  lastY = y;
};
if (lenis) lenis.on('scroll', ({ scroll }) => onScroll(scroll));
else window.addEventListener('scroll', () => onScroll(window.scrollY), { passive: true });

document.addEventListener('click', (e) => {
  const a = e.target.closest('a[href^="#"]');
  if (!a) return;
  const id = a.getAttribute('href');
  const el = id === '#top' ? 0 : $(id);
  if (el === null) return;
  e.preventDefault();
  setMenu(false);
  scrollTo(el);
});
$('.totop').addEventListener('click', () => scrollTo(0));

/* ---------------------------------------------------------
   Text splitting helpers
--------------------------------------------------------- */
function splitWords(el) {
  const words = el.textContent.trim().split(/\s+/);
  el.innerHTML = words.map((w) => `<span class="w">${w}</span>`).join(' ');
  return $$('.w', el);
}
function splitChars(el) {
  const out = [];
  const walk = (node) => {
    [...node.childNodes].forEach((child) => {
      if (child.nodeType === 3) {
        const frag = document.createDocumentFragment();
        [...child.textContent].forEach((c) => {
          if (c === ' ') { frag.append(' '); return; }
          const s = document.createElement('span');
          s.className = 'ch'; s.textContent = c;
          frag.append(s); out.push(s);
        });
        child.replaceWith(frag);
      } else if (child.nodeType === 1 && child.tagName !== 'BR') walk(child);
    });
  };
  walk(el);
  return out;
}

/* ---------- process (pinned stepper) state ---------- */
const steps = $$('.steps li');
const figs = $$('.process__stack figure');
const lit = $('.process__trace .lit');
const litLen = lit.getTotalLength();
lit.style.strokeDasharray = litLen;
lit.style.strokeDashoffset = litLen;
let current = -1;
const setStep = (i) => {
  if (i === current) return;
  current = i;
  steps.forEach((s, k) => s.classList.toggle('is-active', k === i));
  figs.forEach((f, k) => { f.classList.toggle('is-active', k === i); f.classList.toggle('was-active', k < i); });
};
setStep(0);

/* ---------- solutions slider ---------- */
createSolutions($('#solutions'));

/* ---------- responsive pinned sections (created in DOM order) ---------- */
const mm = gsap.matchMedia();
mm.add('(max-width: 680px), (prefers-reduced-motion: reduce)', () => {
  steps.forEach((s) => s.classList.add('is-active'));
  $$('.milestones__track li').forEach((li) => li.classList.add('on'));
  return () => { current = -1; setStep(0); };
});
mm.add('(min-width: 681px) and (prefers-reduced-motion: no-preference)', () => {
  // Process — pinned stepper
  ScrollTrigger.create({
    trigger: '.process', start: 'top top', end: '+=360%', pin: true, scrub: true,
    onUpdate: (self) => {
      const p = self.progress;
      setStep(Math.min(steps.length - 1, Math.floor(p * steps.length)));
      lit.style.strokeDashoffset = litLen * (1 - p);
    },
  });

  // Milestones — horizontal timeline
  const mTrack = $('.milestones__track');
  const mLine = $('.milestones__line');
  const items = $$('li', mTrack);
  const mDist = () => mTrack.scrollWidth - window.innerWidth;
  const sizeLine = () => { mLine.style.right = 'auto'; mLine.style.width = `${mTrack.scrollWidth}px`; };
  sizeLine();
  const mt = gsap.timeline({
    scrollTrigger: {
      trigger: '.milestones', pin: true, scrub: 1, end: () => `+=${mDist() + window.innerHeight * 0.3}`,
      invalidateOnRefresh: true, onRefresh: sizeLine,
      onUpdate: (self) => {
        const front = mDist() * self.progress + window.innerWidth * 0.6;
        items.forEach((li) => li.classList.toggle('on', li.offsetLeft < front));
        gsap.set('.milestones__line i', { scaleX: front / mTrack.scrollWidth });
      },
    },
  });
  mt.to([mTrack, mLine], { x: () => -mDist(), ease: 'none' });

  return () => { mLine.style.width = ''; mLine.style.right = ''; };
});

/* ---------------------------------------------------------
   Scroll choreography
--------------------------------------------------------- */
if (!reduced) {
  // manifesto words light up
  const words = splitWords($('[data-words]'));
  gsap.to(words, {
    opacity: 1, stagger: 0.1, ease: 'none',
    scrollTrigger: { trigger: '.manifesto__text', start: 'top 80%', end: 'bottom 45%', scrub: true },
  });

  // generic reveals
  ScrollTrigger.batch('.display, .mv__t, .lead, .num, .v, .post, .enews, .manifesto__beliefs li, .section-head .muted', {
    start: 'top 88%',
    onEnter: (els) => gsap.fromTo(els, { y: 60, opacity: 0 }, { y: 0, opacity: 1, duration: 1.3, stagger: 0.08, ease: 'expo.out', overwrite: true }),
  });
  gsap.set('.display, .mv__t, .lead, .num, .v, .post, .enews, .manifesto__beliefs li, .section-head .muted', { opacity: 0 });

  // clients list rows
  gsap.from('.clients li', {
    yPercent: 60, opacity: 0, stagger: 0.06, duration: 1.2, ease: 'expo.out',
    scrollTrigger: { trigger: '.clients', start: 'top 80%' },
  });

  // contact mega type
  const chars = splitChars($('[data-split-chars]'));
  gsap.from(chars, {
    yPercent: 120, rotate: 8, opacity: 0, stagger: 0.025, duration: 1.4, ease: 'expo.out',
    scrollTrigger: { trigger: '.mega', start: 'top 80%' },
  });

  // footer giant
  gsap.fromTo('.footer__giant', { yPercent: 50 }, { yPercent: 18, ease: 'none', scrollTrigger: { trigger: '.footer', start: 'top bottom', end: 'bottom bottom', scrub: true } });
}

/* ---------- numbers ---------- */
$$('[data-num]').forEach((el) => {
  const target = +el.dataset.num;
  const o = { v: target > 1000 ? 1900 : 0 };
  const set = () => { el.textContent = Math.round(o.v); };
  if (reduced) { o.v = target; set(); return; }
  set();
  ScrollTrigger.create({
    trigger: el, start: 'top 90%', once: true,
    onEnter: () => gsap.to(o, { v: target, duration: 2.2, ease: 'expo.out', onUpdate: set }),
  });
});

/* ---------------------------------------------------------
   Clients — floating image follows pointer
--------------------------------------------------------- */
if (finePointer) {
  const list = $('.clients');
  const fl = $('.float-img');
  const inner = $('.float-img__inner');
  const img = $('img', fl);
  const fx = gsap.quickTo(fl, 'x', { duration: 0.7, ease: 'power3' });
  const fy = gsap.quickTo(fl, 'y', { duration: 0.7, ease: 'power3' });
  let lastX = 0;
  list.addEventListener('pointermove', (e) => {
    fx(e.clientX); fy(e.clientY);
    gsap.to(inner, { rotate: gsap.utils.clamp(-12, 12, (e.clientX - lastX) * 0.6), duration: 0.6 });
    lastX = e.clientX;
  });
  $$('a', list).forEach((a) => a.addEventListener('pointerenter', () => {
    list.classList.add('has-hover');
    if (img.getAttribute('src') !== a.dataset.img) {
      img.src = a.dataset.img;
      gsap.fromTo(img, { scale: 1.5 }, { scale: 1.15, duration: 1, ease: 'expo.out' });
    }
    gsap.to(inner, { scale: 1, duration: 0.7, ease: 'expo.out' });
  }));
  list.addEventListener('pointerleave', () => {
    list.classList.remove('has-hover');
    gsap.to(inner, { scale: 0, duration: 0.5, ease: 'power3.in' });
  });
}

/* ---------------------------------------------------------
   Testimonials — bento grid (click a tile to feature it)
--------------------------------------------------------- */
{
  const tiles = $$('.bq');
  const count = $('[data-bq-count]');
  const AREAS = ['f', 's1', 's2', 's3', 's4', 's5', 's6'];
  let order = tiles.map((_, i) => i); // order[0] is featured, order[1..6] fill s1..s6
  let busy = false;
  const place = () => order.forEach((t, k) => {
    tiles[t].style.gridArea = AREAS[k];
    tiles[t].classList.toggle('is-feature', k === 0);
    tiles[t].setAttribute('aria-pressed', String(k === 0));
  });
  const feature = (t) => {
    if (busy || order[0] === t) return;
    busy = true;
    const prev = tiles[order[0]], next = tiles[t];
    const parts = (el) => el.querySelectorAll('.bq__co, .bq__ex, .bq__q, figcaption');
    gsap.to([...parts(prev), ...parts(next)], {
      autoAlpha: 0, y: -14, filter: 'blur(6px)', duration: 0.28, ease: 'power2.in',
      onComplete: () => {
        const k = order.indexOf(t);
        [order[0], order[k]] = [order[k], order[0]];
        place();
        count.textContent = String(t + 1).padStart(2, '0');
        gsap.fromTo([...parts(next), ...parts(prev)], { autoAlpha: 0, y: 18, filter: 'blur(6px)' }, {
          autoAlpha: 1, y: 0, filter: 'blur(0px)', duration: 0.6, ease: 'power3.out', stagger: 0.04,
          clearProps: 'filter,transform', onComplete: () => { busy = false; },
        });
      },
    });
  };
  tiles.forEach((el, i) => {
    el.tabIndex = 0;
    el.setAttribute('role', 'button');
    el.addEventListener('click', () => feature(i));
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); feature(i); } });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      el.style.setProperty('--mx', `${e.clientX - r.left}px`);
      el.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
  place();
  if (!reduced) {
    gsap.from(['.bento__head', ...tiles], {
      autoAlpha: 0, y: 40, duration: 1, ease: 'power3.out', stagger: 0.07,
      scrollTrigger: { trigger: '.bento', start: 'top 75%' },
    });
  }
}

/* ---------------------------------------------------------
   Values — tilt + spotlight
--------------------------------------------------------- */
if (finePointer) {
  $$('[data-tilt]').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
      card.style.setProperty('--mx', `${px * 100}%`);
      card.style.setProperty('--my', `${py * 100}%`);
      gsap.to(card, { rotateY: (px - 0.5) * 8, rotateX: (0.5 - py) * 8, duration: 0.6, ease: 'power3' });
    });
    card.addEventListener('pointerleave', () => gsap.to(card, { rotateX: 0, rotateY: 0, duration: 1, ease: 'elastic.out(1, 0.5)' }));
  });
}

/* ---------------------------------------------------------
   Forms → compose an e-mail to ATech
--------------------------------------------------------- */
$$('form[data-mailto]').forEach((form) => {
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const data = new FormData(form);
    const lines = [];
    for (const [k, v] of data.entries()) if (v) lines.push(`${k[0].toUpperCase() + k.slice(1)}: ${v}`);
    const href = `mailto:${form.dataset.mailto}?subject=${encodeURIComponent(form.dataset.subject)}&body=${encodeURIComponent(lines.join('\n'))}`;
    window.location.href = href;
    let note = $('.form-note', form);
    if (!note) { note = document.createElement('p'); note.className = 'form-note'; form.append(note); }
    note.textContent = 'Your e-mail client is opening with the message ready to send.';
  });
});

window.addEventListener('load', () => ScrollTrigger.refresh());
