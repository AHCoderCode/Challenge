# Abbas Bhai ki Chaat Lo — 3D City Runner

A fast, original three-lane endless runner made with Three.js and vanilla JavaScript. It is a static Vercel site with no server or account requirement.

## Controls

**Mobile and tablet:** Swipe left/right to switch lanes, swipe up to jump, and swipe down to slide. Double-tap during a run to activate a collected hoverboard.

**Desktop:** A/D or Left/Right to switch lanes, W/Up/Space to jump, S/Down to slide, Shift or B for a hoverboard, and P/Escape to pause.

## Gameplay

- Real-time 3D city road, buildings, lights and perspective camera.
- A more detailed teen runner with face, clothing, shoe and contact-shadow details, plus a taller adult pursuer.
- Three lanes, smooth lane transitions, jumping and sliding.
- Crates, low barriers, overhead gates and traffic.
- Coins, magnet, score multiplier, shield and hoverboard pickups.
- Increasing speed, score, distance and saved personal best.
- Original synthesized intro tune, run beat, movement/coin/power-up effects, and a repeating browser text-to-speech Abbas Bhai catchphrase while running. Game volume and chant can be adjusted or muted.
- Responsive touch and keyboard input, fullscreen support and offline app caching.

## Performance

The renderer uses WebGL with high-performance preference, capped device pixel ratio on mobile, no real-time shadow maps, and lightweight shared materials/geometries to keep draw cost controlled.

## Deploy

The repository is a static site. Vercel should use the repository root as the project root. No build command, package installation, or environment variables are required. Three.js is loaded from jsDelivr and cached by the service worker where supported.

## Originality

Chaat Rush is an original arcade runner inspired by the general endless-runner genre. It does not use Subway Surfers characters, artwork, logos, music, or source code.
