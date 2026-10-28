// Hero WebGL scene — a living circuit board.
// Procedural fan-out traces from a central chip carry pulses of "signal";
// the pointer acts as a probe that lights up the copper around it.
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const V2 = THREE.Vector2;
const rand = (a, b) => a + Math.random() * (b - a);

export function createHero(canvas, { onProbe } = {}) {
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
  } catch (e) {
    return null;
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.75));
  renderer.setClearColor(0x05080b, 1);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 200);
  camera.position.set(0, 0, 40);

  const board = new THREE.Group();
  board.rotation.x = -0.95;
  scene.add(board);

  // ---------- board substrate ----------
  const plane = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 60),
    new THREE.MeshStandardMaterial({ color: 0x060c0e, roughness: 0.6, metalness: 0.35 })
  );
  board.add(plane);

  // ---------- trace geometry ----------
  const pos = [], aDist = [], aSide = [], aSeed = [], aLen = [], index = [];
  const vias = [];
  const chipHalf = 2.3;
  const chipKeepOut = (p) => Math.abs(p.x) < chipHalf + 0.1 && Math.abs(p.y) < chipHalf + 0.1;

  function addTrace(points, width, seed = Math.random()) {
    let total = 0;
    for (let i = 1; i < points.length; i++) total += points[i].distanceTo(points[i - 1]);
    let acc = 0;
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i];
      const dir = b.clone().sub(a);
      const l = dir.length();
      if (l < 1e-4) continue;
      dir.normalize();
      const n = new V2(-dir.y, dir.x).multiplyScalar(width / 2);
      const ext = dir.clone().multiplyScalar(width / 2);
      const a2 = a.clone().sub(ext), b2 = b.clone().add(ext);
      const base = pos.length / 3;
      for (const [p, s, d] of [
        [a2.clone().add(n), 1, acc - width / 2], [a2.clone().sub(n), -1, acc - width / 2],
        [b2.clone().add(n), 1, acc + l + width / 2], [b2.clone().sub(n), -1, acc + l + width / 2],
      ]) {
        pos.push(p.x, p.y, 0.012);
        aSide.push(s); aDist.push(d); aSeed.push(seed); aLen.push(total);
      }
      index.push(base, base + 1, base + 2, base + 2, base + 1, base + 3);
      acc += l;
    }
  }

  // offset a polyline sideways (miter joins) to build parallel buses
  function offsetPolyline(pts, off) {
    const out = [];
    for (let i = 0; i < pts.length; i++) {
      const dIn = i > 0 ? pts[i].clone().sub(pts[i - 1]).normalize() : null;
      const dOut = i < pts.length - 1 ? pts[i + 1].clone().sub(pts[i]).normalize() : null;
      const nIn = dIn && new V2(-dIn.y, dIn.x);
      const nOut = dOut && new V2(-dOut.y, dOut.x);
      if (nIn && nOut) {
        const m = nIn.clone().add(nOut).normalize();
        out.push(pts[i].clone().add(m.multiplyScalar(off / m.dot(nIn))));
      } else {
        out.push(pts[i].clone().add((nIn || nOut).clone().multiplyScalar(off)));
      }
    }
    return out;
  }

  // chip fan-out (classic QFP escape routing)
  const pinsPerSide = 14, pitch = 0.3;
  const pinSpots = [];
  for (let side = 0; side < 4; side++) {
    const ang = side * Math.PI / 2;
    const rot = (v) => v.rotateAround(new V2(0, 0), ang);
    for (let i = 0; i < pinsPerSide; i++) {
      const o = (i - (pinsPerSide - 1) / 2) * pitch;
      const t = Math.abs(o) * 1.4;
      const sg = Math.sign(o) || 1;
      const L1 = 0.7;
      const pts = [
        new V2(o, chipHalf + 0.2),
        new V2(o, chipHalf + L1),
        new V2(o + sg * t, chipHalf + L1 + t),
      ];
      const L3 = rand(1.5, 12);
      pts.push(new V2(pts[2].x, pts[2].y + L3));
      pts.forEach(rot);
      addTrace(pts, 0.065);
      vias.push(pts[pts.length - 1]);
      pinSpots.push({ p: rot(new V2(o, chipHalf + 0.12)), ang });
    }
  }

  // background buses
  const dirs = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => new V2(Math.cos(k * Math.PI / 4), Math.sin(k * Math.PI / 4)));
  for (let b = 0; b < 34; b++) {
    const start = new V2(rand(-34, 34), rand(-22, 22));
    if (start.length() < 8) continue;
    let di = Math.floor(Math.random() * 4) * 2; // start axis-aligned
    const pts = [start.clone()];
    let p = start.clone();
    const segs = 2 + Math.floor(Math.random() * 3);
    for (let s = 0; s < segs; s++) {
      const len = s % 2 === 0 ? rand(3, 12) : rand(0.8, 3);
      p = p.clone().add(dirs[di].clone().multiplyScalar(len));
      pts.push(p);
      di = (di + (Math.random() < 0.5 ? 1 : 7)) % 8;
    }
    if (pts.some(chipKeepOut)) continue;
    const lanes = 2 + Math.floor(Math.random() * 6);
    const w = rand(0.04, 0.09);
    const gap = w + rand(0.12, 0.22);
    for (let l = 0; l < lanes; l++) {
      const lp = offsetPolyline(pts, (l - (lanes - 1) / 2) * gap);
      addTrace(lp, w);
      if (Math.random() < 0.5) vias.push(lp[lp.length - 1]);
      if (Math.random() < 0.3) vias.push(lp[0]);
    }
  }

  const traceGeo = new THREE.BufferGeometry();
  traceGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  traceGeo.setAttribute('aDist', new THREE.Float32BufferAttribute(aDist, 1));
  traceGeo.setAttribute('aSide', new THREE.Float32BufferAttribute(aSide, 1));
  traceGeo.setAttribute('aSeed', new THREE.Float32BufferAttribute(aSeed, 1));
  traceGeo.setAttribute('aLen', new THREE.Float32BufferAttribute(aLen, 1));
  traceGeo.setIndex(index);

  const uniforms = {
    uTime: { value: 0 },
    uProbe: { value: new V2(100, 100) },
    uProbeK: { value: 0 },
    uPower: { value: 0 },
    uColA: { value: new THREE.Color(0.2, 0.3, 0.36) },
    uColB: { value: new THREE.Color(0.18, 0.62, 1.0) },
  };

  const traceMat = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: /* glsl */`
      attribute float aDist; attribute float aSide; attribute float aSeed; attribute float aLen;
      varying float vDist; varying float vSide; varying float vSeed; varying float vLen; varying vec2 vPos;
      void main(){
        vDist = aDist; vSide = aSide; vSeed = aSeed; vLen = aLen; vPos = position.xy;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime; uniform vec2 uProbe; uniform float uProbeK; uniform float uPower;
      uniform vec3 uColA; uniform vec3 uColB;
      varying float vDist; varying float vSide; varying float vSeed; varying float vLen; varying vec2 vPos;
      void main(){
        float edge = 1.0 - smoothstep(0.45, 1.0, abs(vSide));
        float speed = 3.0 + vSeed * 6.0;
        float cycle = vLen + 10.0 + vSeed * 20.0;
        float head = mod(uTime * speed + vSeed * 97.0, cycle) - 2.0;
        float d = head - vDist;
        float tail = 1.8 + vSeed * 3.0;
        float pulse = (d > 0.0 && d < tail) ? pow(1.0 - d / tail, 2.5) : 0.0;
        pulse += smoothstep(0.22, 0.0, abs(d)) * 1.4;
        float carrier = step(0.35, fract(vSeed * 13.7));
        pulse *= carrier * uPower;
        float pd = length(vPos - uProbe);
        float probe = exp(-pd * pd * 0.16) * uProbeK;
        float fade = 1.0 - smoothstep(10.0, 30.0, length(vPos * vec2(0.8, 1.0)));
        vec3 col = uColA * (0.22 + 0.35 * uPower + probe * 2.4)
                 + uColB * (pulse * 2.0 + probe * 0.9)
                 + vec3(0.85, 0.95, 1.0) * pulse * pulse * 0.5;
        float a = edge * fade;
        gl_FragColor = vec4(col * a, a);
      }`,
  });
  board.add(new THREE.Mesh(traceGeo, traceMat));

  // ---------- vias ----------
  const viaGeo = new THREE.RingGeometry(0.07, 0.14, 20);
  const viaMat = new THREE.MeshBasicMaterial({ color: 0x2a86b8, transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false });
  const viaMesh = new THREE.InstancedMesh(viaGeo, viaMat, vias.length);
  const m4 = new THREE.Matrix4();
  vias.forEach((v, i) => { m4.makeTranslation(v.x, v.y, 0.015); viaMesh.setMatrixAt(i, m4); });
  board.add(viaMesh);

  // ---------- SMD parts ----------
  const smdGeo = new THREE.BoxGeometry(0.42, 0.2, 0.12);
  const smdMat = new THREE.MeshStandardMaterial({ color: 0x1b2127, roughness: 0.5, metalness: 0.4 });
  const smdCount = 160;
  const smd = new THREE.InstancedMesh(smdGeo, smdMat, smdCount);
  const q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), t = new THREE.Vector3();
  for (let i = 0; i < smdCount; i++) {
    let x, y;
    do { x = rand(-30, 30); y = rand(-20, 20); } while (Math.hypot(x, y) < 6);
    t.set(x, y, 0.06);
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.random() < 0.5 ? 0 : Math.PI / 2);
    s.setScalar(rand(0.7, 1.6));
    m4.compose(t, q, s);
    smd.setMatrixAt(i, m4);
  }
  board.add(smd);

  // ---------- the chip ----------
  const chipTex = (() => {
    const c = document.createElement('canvas');
    c.width = c.height = 1024;
    const g = c.getContext('2d');
    const draw = () => {
      g.fillStyle = '#0c1014'; g.fillRect(0, 0, 1024, 1024);
      for (let i = 0; i < 9000; i++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.025})`; g.fillRect(Math.random() * 1024, Math.random() * 1024, 2, 2); }
      g.fillStyle = 'rgba(232,238,242,.55)';
      g.font = '600 150px Archivo, sans-serif';
      g.textAlign = 'center';
      g.fillText('ATECH', 512, 520);
      g.font = '400 36px Michroma, sans-serif';
      g.fillStyle = 'rgba(232,238,242,.32)';
      g.fillText('AT-1990 · MATERIJA SI', 512, 610);
      g.fillText('REV 36 · ISO 9001/14001', 512, 670);
      g.beginPath(); g.arc(130, 130, 34, 0, Math.PI * 2); g.strokeStyle = 'rgba(232,238,242,.35)'; g.lineWidth = 6; g.stroke();
    };
    draw();
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    // redraw once the web fonts are in, so the markings don't stay in a fallback face
    if (document.fonts) Promise.all([document.fonts.load('36px Michroma'), document.fonts.load('600 150px Archivo')]).then(() => { draw(); tex.needsUpdate = true; });
    return tex;
  })();
  const chipSide = new THREE.MeshStandardMaterial({ color: 0x0b0e11, roughness: 0.5, metalness: 0.3 });
  const chipTop = new THREE.MeshStandardMaterial({ map: chipTex, roughness: 0.38, metalness: 0.25 });
  const chip = new THREE.Mesh(new THREE.BoxGeometry(chipHalf * 2 - 0.3, chipHalf * 2 - 0.3, 0.5), [chipSide, chipSide, chipSide, chipSide, chipTop, chipSide]);
  chip.position.z = 0.25;
  board.add(chip);

  const pinGeo = new THREE.BoxGeometry(0.11, 0.42, 0.05);
  const pinMat = new THREE.MeshStandardMaterial({ color: 0xc9d3da, roughness: 0.25, metalness: 1 });
  const pins = new THREE.InstancedMesh(pinGeo, pinMat, pinSpots.length);
  pinSpots.forEach(({ p, ang }, i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 0, 1), ang);
    m4.compose(new THREE.Vector3(p.x, p.y, 0.05), q, new THREE.Vector3(1, 1, 1));
    pins.setMatrixAt(i, m4);
  });
  board.add(pins);

  // ---------- light ----------
  scene.add(new THREE.AmbientLight(0x406080, 0.7));
  const key = new THREE.DirectionalLight(0xffffff, 0.9);
  key.position.set(-6, 10, 12);
  scene.add(key);
  const probeLight = new THREE.PointLight(0x3fb8ff, 0, 16, 1.4);
  board.add(probeLight);

  // ---------- dust ----------
  const dustN = 500;
  const dustPos = new Float32Array(dustN * 3);
  for (let i = 0; i < dustN; i++) { dustPos[i * 3] = rand(-30, 30); dustPos[i * 3 + 1] = rand(-16, 16); dustPos[i * 3 + 2] = rand(-10, 14); }
  const dustGeo = new THREE.BufferGeometry();
  dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({ color: 0x6fc8ff, size: 0.05, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }));
  scene.add(dust);

  // ---------- post ----------
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new V2(1, 1), 1.05, 0.55, 0.12);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  // ---------- interaction ----------
  const mouse = new V2(0, 0), mouseS = new V2(0, 0);
  let hasPointer = false;
  const ray = new THREE.Raycaster();
  const probeTarget = new V2(100, 100);
  window.addEventListener('pointermove', (e) => {
    mouse.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
    hasPointer = true;
  }, { passive: true });

  const state = { scroll: 0, intro: 0 };
  const layout = { x: 0, y: 0 };

  function resize() {
    const w = canvas.clientWidth, h = canvas.clientHeight;
    renderer.setSize(w, h, false);
    composer.setSize(w, h);
    bloom.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const wide = w / h > 1.1;
    layout.x = wide ? 3.2 : 0;
    layout.y = wide ? 1.2 : 2.6;
  }
  resize();
  window.addEventListener('resize', resize);

  let running = true, raf = 0;
  const clock = new THREE.Clock();
  const tmp = new THREE.Vector3();

  function frame() {
    raf = requestAnimationFrame(frame);
    if (!running) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const time = clock.elapsedTime;
    uniforms.uTime.value = time;
    mouseS.lerp(mouse, 1 - Math.pow(0.001, dt));

    const sp = state.scroll, intro = state.intro;
    uniforms.uPower.value = intro * (1 + sp * 0.8);

    board.position.set(layout.x * (1 - sp), layout.y * (1 - sp), 0);
    board.rotation.x = -0.95 + sp * 0.55 + mouseS.y * 0.05;
    board.rotation.z = -0.18 + mouseS.x * 0.07 + Math.sin(time * 0.15) * 0.02;
    camera.position.set(mouseS.x * 1.4, mouseS.y * 0.8, THREE.MathUtils.lerp(40, 26, intro) - sp * 13);
    camera.lookAt(0, 0, 0);

    // pointer probe → board-local coordinates
    if (hasPointer) {
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObject(plane, false)[0];
      if (hit) {
        board.worldToLocal(tmp.copy(hit.point));
        probeTarget.set(tmp.x, tmp.y);
      }
    }
    uniforms.uProbe.value.lerp(probeTarget, 1 - Math.pow(0.0005, dt));
    uniforms.uProbeK.value += ((hasPointer ? 1 : 0) * intro - uniforms.uProbeK.value) * 0.05;
    probeLight.position.set(uniforms.uProbe.value.x, uniforms.uProbe.value.y, 2.2);
    probeLight.intensity = 22 * uniforms.uProbeK.value;
    if (hasPointer && onProbe) onProbe(uniforms.uProbe.value);

    dust.rotation.y = time * 0.01;
    dust.position.y = Math.sin(time * 0.2) * 0.3;
    bloom.strength = 0.9 + sp * 0.6;

    composer.render();
  }
  frame();

  return {
    state,
    setRunning(v) { if (v && !running) clock.getDelta(); running = v; },
    destroy() { cancelAnimationFrame(raf); renderer.dispose(); },
  };
}
