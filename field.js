/* ---------------------------------------------------------
   ATECH // SIGNAL FIELD
   One persistent GPU particle system: thousands of glowing filaments whose
   shape is computed in the vertex shader and morphs between six forms.
--------------------------------------------------------- */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

export const FORMS = { flux: 0, ring: 1, coil: 2, grid: 3, globe: 4, dust: 5 };

const PALETTE = {
  blue:   [new THREE.Color('#0b5f9c'), new THREE.Color('#8fd6ff')],
  ice:    [new THREE.Color('#1189ca'), new THREE.Color('#e6f6ff')],
  copper: [new THREE.Color('#c2410c'), new THREE.Color('#ffc58f')],
  cyan:   [new THREE.Color('#0e7490'), new THREE.Color('#7ff0ff')],
  dim:    [new THREE.Color('#1b3550'), new THREE.Color('#7f9cb8')],
};

const vertex = /* glsl */ `
  attribute float aStrand;
  attribute float aT;
  attribute vec3 aRand;
  uniform float uTime, uMix, uFrom, uTo, uSpin, uPulse, uPR, uIntro, uMouseK, uAlpha, uFade;
  uniform vec3 uMouse;
  varying float vT, vAlpha, vHead, vGlow;
  #define PI 3.14159265

  vec3 shape(float f, float t, vec3 r) {
    float tm = uTime;
    if (f < 0.5) {                       // FLUX — a sweeping bundle of fibres
      float u = r.x;
      vec3 root = vec3((u - 0.5) * 5.4, -1.7 + sin(u * 5.0) * 0.35, (r.z - 0.5) * 1.6);
      float len = 2.2 + r.y * 2.0;
      vec3 p = root;
      p.x += t * len * 0.55 + sin(t * 3.0 + tm * 0.7 + u * 9.0) * 0.32 * t;
      p.y += t * len * (0.75 + r.y * 0.3);
      p.z += cos(t * 2.4 + tm * 0.5 + r.z * 7.0) * 0.4 * t;
      return p;
    }
    if (f < 1.5) {                       // RING — radial burst + outer dashes
      float a = r.x * 2.0 * PI + t * 0.18 * sin(tm * 0.6 + r.x * 20.0);
      if (r.z > 0.93) {
        float k = floor(r.x * 64.0) / 64.0 * 2.0 * PI;
        float rr = 2.55 + t * 0.32;
        return vec3(cos(k) * rr, sin(k) * rr, 0.0);
      }
      float r0 = 1.35 + r.y * 0.25;
      float rr = r0 + t * (0.25 + r.z * 0.85);
      return vec3(cos(a) * rr, sin(a) * rr, (r.y - 0.5) * 0.5 * t + sin(tm + r.x * 30.0) * 0.04);
    }
    if (f < 2.5) {                       // COIL — a double-wound copper coil
      float y = (r.x - 0.5) * 5.6;
      float side = r.z > 0.5 ? PI : 0.0;
      float a = y * 3.2 + uSpin + tm * 0.25 + side + t * 0.9;
      float rad = 1.05 + (r.y - 0.5) * 0.18;
      vec3 p = vec3(cos(a) * rad, y + t * 0.06, sin(a) * rad);
      if (r.z > 0.965) p.xz *= 1.0 + t * 0.9 * r.y;   // sparks flying off the winding
      return p;
    }
    if (f < 3.5) {                       // GRID — PCB trace lattice with 45° doglegs
      float ix = floor(r.x * 26.0), iy = floor(r.y * 16.0);
      vec2 o = vec2((ix - 13.0) * 0.32, (iy - 8.0) * 0.32);
      bool hz = r.z < 0.5;
      vec2 d = hz ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
      float len = 0.32 * (2.0 + floor(r.z * 6.0));
      vec2 p = o + d * min(t, 0.6) * len;
      if (t > 0.6) p += normalize(d + (hz ? vec2(0.0, 1.0) : vec2(1.0, 0.0))) * (t - 0.6) * len * 0.8;
      vec3 q = vec3(p, 0.0);
      float c = cos(-0.95), s = sin(-0.95);
      return vec3(q.x, q.y * c, q.y * s) * 1.05;
    }
    if (f < 4.5) {                       // GLOBE — a hairy sphere
      float th = r.x * 2.0 * PI + tm * 0.12, ph = acos(2.0 * r.y - 1.0);
      vec3 n = vec3(sin(ph) * cos(th), cos(ph), sin(ph) * sin(th));
      return n * (1.55 + t * (0.12 + r.z * 0.45));
    }
    vec3 p = (r - 0.5) * vec3(11.0, 6.5, 4.0);      // DUST — slow drifting field
    p += vec3(sin(tm * 0.1 + r.y * 6.0), cos(tm * 0.13 + r.x * 6.0), 0.0) * 0.4;
    p.x += t * 0.25 * (r.z - 0.5);
    p.y += t * 0.25;
    return p;
  }

  void main() {
    vT = aT;
    float m = clamp(uMix * 1.5 - aRand.x * 0.5, 0.0, 1.0);
    m = m * m * (3.0 - 2.0 * m);
    vec3 a = shape(uFrom, aT, aRand);
    vec3 b = shape(uTo, aT, aRand);
    vec3 p = mix(a, b, m);
    p += vec3(sin(aRand.y * 40.0 + uTime), cos(aRand.z * 40.0 + uTime), 0.0) * sin(m * PI) * 0.6;

    // intro: filaments grow out from their roots
    p = mix(p * 0.2 + vec3(0.0, -3.0, 0.0) * (1.0 - aT), p, uIntro);

    // the probe: strands bend away from the cursor, tips most
    vec2 dv = p.xy - uMouse.xy;
    float d2 = dot(dv, dv);
    float push = exp(-d2 * 1.6) * uMouseK;
    p.xy += normalize(dv + 1e-4) * push * 0.55 * (0.35 + aT);
    p.z += push * 0.6;
    vGlow = push;

    vec4 mv = modelViewMatrix * vec4(p, 1.0);
    gl_Position = projectionMatrix * mv;
    vHead = step(0.965, aT);
    float pulse = uPulse * smoothstep(0.08, 0.0, abs(fract(aT - uTime * 0.6 + aRand.x * 3.0) - 0.5) - 0.42);
    vAlpha = (0.05 + aT * aT * 0.5 + pulse * 0.8 + push * 0.4) * uIntro * uAlpha * uFade;
    gl_PointSize = (3.2 + push * 4.0) * uPR * (8.0 / -mv.z);
  }
`;

const fragment = /* glsl */ `
  uniform vec3 uColA, uColB;
  varying float vT, vAlpha, vHead, vGlow;
  void main() {
    float a = 1.0;
    #ifdef HEAD
      float d = length(gl_PointCoord - 0.5);
      a = smoothstep(0.5, 0.05, d);
    #endif
    vec3 c = mix(uColA, uColB, vT);
    c = mix(c, vec3(1.0), vHead * 0.55 + vGlow * 0.4);
    gl_FragColor = vec4(c * a * vAlpha, 1.0);
  }
`;

export function createField(canvas) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance' });
  } catch (e) { return null; }
  const small = window.innerWidth < 760;
  const STRANDS = small ? 800 : 1500;
  const PER = small ? 28 : 40;
  const PR = Math.min(window.devicePixelRatio, small ? 1.5 : 1.75);
  renderer.setPixelRatio(PR);
  renderer.setClearColor(0x000000, 1); // encoded to sRGB by OutputPass, so anything above 0 lifts to grey

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 100);
  camera.position.set(0, 0, 8);

  const n = STRANDS * PER;
  const aStrand = new Float32Array(n), aT = new Float32Array(n), aRand = new Float32Array(n * 3);
  for (let s = 0, k = 0; s < STRANDS; s++) {
    const r1 = Math.random(), r2 = Math.random(), r3 = Math.random();
    for (let i = 0; i < PER; i++, k++) {
      aStrand[k] = s; aT[k] = i / (PER - 1);
      aRand[k * 3] = r1; aRand[k * 3 + 1] = r2; aRand[k * 3 + 2] = r3;
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
  geo.setAttribute('aStrand', new THREE.BufferAttribute(aStrand, 1));
  geo.setAttribute('aT', new THREE.BufferAttribute(aT, 1));
  geo.setAttribute('aRand', new THREE.BufferAttribute(aRand, 3));
  const idx = new Uint32Array(STRANDS * (PER - 1) * 2);
  for (let s = 0, j = 0; s < STRANDS; s++) for (let i = 0; i < PER - 1; i++) { idx[j++] = s * PER + i; idx[j++] = s * PER + i + 1; }
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 50);

  // glowing tips: one point per strand, at t = 1
  const hGeo = new THREE.BufferGeometry();
  const hT = new Float32Array(STRANDS).fill(1), hS = new Float32Array(STRANDS), hR = new Float32Array(STRANDS * 3);
  for (let s = 0; s < STRANDS; s++) { hS[s] = s; hR.set(aRand.subarray(s * PER * 3, s * PER * 3 + 3), s * 3); }
  hGeo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(STRANDS * 3), 3));
  hGeo.setAttribute('aStrand', new THREE.BufferAttribute(hS, 1));
  hGeo.setAttribute('aT', new THREE.BufferAttribute(hT, 1));
  hGeo.setAttribute('aRand', new THREE.BufferAttribute(hR, 3));
  hGeo.boundingSphere = geo.boundingSphere;

  const u = {
    uTime: { value: 0 }, uMix: { value: 1 }, uFrom: { value: 0 }, uTo: { value: 0 },
    uSpin: { value: 0 }, uPulse: { value: 0 }, uPR: { value: PR }, uIntro: { value: 0 }, uFade: { value: 1 },
    uMouse: { value: new THREE.Vector3(99, 99, 0) }, uMouseK: { value: 0 },
    uColA: { value: PALETTE.blue[0].clone() }, uColB: { value: PALETTE.blue[1].clone() },
  };
  const mk = (alpha, head) => new THREE.ShaderMaterial({
    uniforms: { ...u, uAlpha: { value: alpha } }, vertexShader: vertex, fragmentShader: fragment,
    defines: head ? { HEAD: 1 } : {}, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const lines = new THREE.LineSegments(geo, mk(0.32, false));
  const heads = new THREE.Points(hGeo, mk(1.1, true));
  lines.frustumCulled = heads.frustumCulled = false;
  const group = new THREE.Group();
  group.add(lines, heads);
  scene.add(group);

  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.9, 0.35, 0.18);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* ---------- state driven from outside ---------- */
  const st = {
    form: 0, x: 0.25, y: 0, scale: 1, tilt: 0,
    targetX: 0.25, targetY: 0, targetScale: 1, targetTilt: 0,
    mouse: new THREE.Vector2(), mouseOn: false, k: 0,
    colA: PALETTE.blue[0].clone(), colB: PALETTE.blue[1].clone(),
    scroll: 0, running: true,
  };

  function setForm(name, { x = 0, y = 0, scale = 1, tilt = 0, color = 'blue', pulse = 0, fade = 1 } = {}) {
    const f = FORMS[name] ?? 0;
    st.targetX = x; st.targetY = y; st.targetScale = scale; st.targetTilt = tilt;
    const [a, b] = PALETTE[color] || PALETTE.blue;
    window.gsap.to(st.colA, { r: a.r, g: a.g, b: a.b, duration: 1.6, ease: 'power2.inOut' });
    window.gsap.to(st.colB, { r: b.r, g: b.g, b: b.b, duration: 1.6, ease: 'power2.inOut' });
    window.gsap.to(u.uPulse, { value: pulse, duration: 1.2 });
    window.gsap.to(u.uFade, { value: fade, duration: 1.4, ease: 'power2.inOut' });
    if (f === st.form) return;
    // morph from wherever we visually are now
    u.uFrom.value = u.uMix.value > 0.5 ? u.uTo.value : u.uFrom.value;
    u.uTo.value = f;
    st.form = f;
    window.gsap.fromTo(u.uMix, { value: 0 }, { value: 1, duration: 2.2, ease: 'power2.inOut', overwrite: true });
  }

  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w * PR * 0.5, h * PR * 0.5);
    camera.aspect = w / h;
    camera.position.z = w < 760 ? 11 : 8;
    camera.updateProjectionMatrix();
  }
  resize();
  window.addEventListener('resize', resize);

  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  const hit = new THREE.Vector3();
  const inv = new THREE.Matrix4();
  window.addEventListener('pointermove', (e) => {
    st.mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    st.mouseOn = true;
  });
  document.addEventListener('pointerleave', () => { st.mouseOn = false; });

  const clock = new THREE.Clock();
  let raf = 0;
  function frame() {
    raf = requestAnimationFrame(frame);
    const dt = Math.min(clock.getDelta(), 0.05);
    u.uTime.value += dt;
    const e = 1 - Math.pow(0.0025, dt);
    st.x += (st.targetX - st.x) * e * 0.9;
    st.y += (st.targetY - st.y) * e * 0.9;
    st.scale += (st.targetScale - st.scale) * e * 0.9;
    st.tilt += (st.targetTilt - st.tilt) * e * 0.9;
    u.uColA.value.copy(st.colA); u.uColB.value.copy(st.colB);

    const halfW = Math.tan((camera.fov * Math.PI) / 360) * camera.position.z * camera.aspect;
    group.position.set(st.x * halfW, st.y * halfW * 0.5, 0);
    group.scale.setScalar(st.scale);
    group.rotation.set(st.mouse.y * 0.12 + st.tilt, st.mouse.x * 0.22 + Math.sin(u.uTime.value * 0.1) * 0.08, 0);
    group.updateMatrixWorld();

    // cursor → field-local coordinates on the z=0 plane
    ray.setFromCamera(st.mouse, camera);
    if (ray.ray.intersectPlane(plane, hit)) {
      inv.copy(group.matrixWorld).invert();
      hit.applyMatrix4(inv);
      u.uMouse.value.lerp(hit, 0.18);
    }
    st.k += ((st.mouseOn ? 1 : 0) - st.k) * 0.06;
    u.uMouseK.value = st.k;
    composer.render();
  }

  return {
    uniforms: u,
    bloom,
    state: st,
    setForm,
    intro(duration = 2.6) { window.gsap.to(u.uIntro, { value: 1, duration, ease: 'power3.out' }); },
    setRunning(on) {
      if (on && !st.running) { clock.getDelta(); frame(); }
      if (!on) cancelAnimationFrame(raf);
      st.running = on;
    },
    start() { frame(); },
  };
}
