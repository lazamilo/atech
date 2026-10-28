# ATech electronics — website redesign

Static redesign concepts for [atech.si](https://www.atech.si/).

- `/` — **V1**: dark editorial site with a WebGL circuit-board hero (Three.js), GSAP/ScrollTrigger choreography and Lenis smooth scroll.
- `/v2/` — **V2 · Signal Field**: one live GPU filament field that morphs per section, Space Mono typography, glass dashboard cards and synthesized UI sounds.

## Run locally

No build step. Serve the folder with any static server, e.g.

```bash
npx http-server -p 5173 -c-1
```

then open http://localhost:5173 (V1) or http://localhost:5173/v2/ (V2).
