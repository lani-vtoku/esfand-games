// Generates the built-in SVG art for both games. Safe to re-run; overwrites files.
// Run: node tools/make-placeholders.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

function write(rel, content) {
  const file = path.join(ROOT, rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content.trim() + '\n');
  console.log('wrote', rel);
}

const svg = (w, h, body) =>
  `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;

// ---------- Onyxia Run: rideable drake, 2 wing frames ----------
// Side view facing right, saddle + rider. 128x128 canvas, dragon centered.

const drake = wing => svg(128, 128, `
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#3f3540"/><stop offset="1" stop-color="#191218"/>
    </linearGradient>
    <linearGradient id="wingg" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#4a3550"/><stop offset="1" stop-color="#241a2b"/>
    </linearGradient>
  </defs>
  <!-- tail -->
  <path d="M38 74 Q16 78 6 70 Q14 82 4 88 Q20 90 30 82 Q36 78 40 78 Z" fill="url(#body)"/>
  <path d="M10 71 l-8 -4 6 10 z" fill="#d8c9a8"/>
  ${wing === 'down' ? wingDown() : wingUp()}
  <!-- body -->
  <ellipse cx="62" cy="74" rx="28" ry="17" fill="url(#body)"/>
  <ellipse cx="66" cy="82" rx="20" ry="9" fill="#8a7a66"/>
  <!-- rear leg tucked -->
  <path d="M52 86 q-6 8 2 12 q8 2 10 -4 q-6 -2 -12 -8 z" fill="#221a26"/>
  <!-- neck + head -->
  <path d="M78 66 Q90 60 93 46 L105 48 Q102 64 92 72 Q86 76 79 73 Z" fill="url(#body)"/>
  <path d="M91 36 q6 -5 14 -5 l16 6 q3 1 2 4 l-3 3 -12 2 q-4 5 -11 3 q-8 -2 -8 -7 q0 -4 2 -6 z" fill="#332a38"/>
  <path d="M104 44 l14 2 -3 5 -12 -3 z" fill="#191218"/>
  <path d="M117 39 l5 1 -2 3 z" fill="#0e0910"/>
  <circle cx="101" cy="38" r="2.6" fill="#ff9a2b"/>
  <circle cx="101.8" cy="37.6" r="1.2" fill="#1a0c08"/>
  <!-- horns swept back -->
  <path d="M95 33 q-6 -10 -13 -13 q10 0 16 8 z" fill="#d8c9a8"/>
  <path d="M100 32 q-2 -12 -7 -17 q9 3 12 13 z" fill="#d8c9a8"/>
  <!-- neck spikes -->
  <path d="M90 48 l-7 -2 5 6 z M87 56 l-7 -1 5 5 z" fill="#d8c9a8" opacity=".9"/>
  <!-- saddle + rider -->
  <path d="M50 60 q12 -6 24 0 l-2 8 q-10 -4 -20 0 z" fill="#5c3a1e"/>
  <path d="M49 62 q-4 6 0 10 M75 60 q4 6 1 10" stroke="#3d2712" stroke-width="3" fill="none"/>
  <path d="M56 44 q6 -6 12 0 l2 14 q-8 4 -16 0 z" fill="#2e4a6b"/>
  <circle cx="64" cy="40" r="6" fill="#e8c49a"/>
  <path d="M58 38 q6 -8 12 0 q-6 -3 -12 0 z" fill="#4a3020"/>
  <!-- front leg tucked -->
  <path d="M74 86 q0 9 8 10 q7 0 7 -6 q-8 0 -15 -4 z" fill="#221a26"/>
`);

// Bat-style membrane wings: leading-edge arm to a wrist, finger bones fanning
// back, scalloped trailing edge sagging between fingertips.
const wingUp = () => `
  <path d="M64 60 Q58 32 54 8 Q47 12 40 6 Q42 16 34 12 Q34 22 24 20 Q34 34 30 46 Q44 40 50 50 Q58 52 64 60 Z"
        fill="url(#wingg)" opacity="0"/>
  <path d="M64 60
           Q60 30 54 6
           L38 2
           Q46 14 40 18
           L22 12
           Q32 24 27 30
           L12 30
           Q26 44 40 52
           Q54 58 64 60 Z" fill="url(#wingg)"/>
  <path d="M64 60 Q58 28 54 6 M64 60 Q50 30 40 18 M64 60 Q42 36 27 30"
        stroke="#140e18" stroke-width="2.4" fill="none" opacity=".7"/>`;

const wingDown = () => `
  <path d="M64 64
           Q58 92 50 116
           L34 120
           Q42 108 36 104
           L18 110
           Q28 98 23 92
           L8 92
           Q22 78 38 71
           Q54 66 64 64 Z" fill="url(#wingg)"/>
  <path d="M64 64 Q56 94 50 116 M64 64 Q48 92 36 104 M64 64 Q40 86 23 92"
        stroke="#140e18" stroke-width="2.4" fill="none" opacity=".7"/>`;

write('games/onyxia-run/assets/sprites/drake-1.svg', drake('up'));
write('games/onyxia-run/assets/sprites/drake-2.svg', drake('down'));

// ---------- Onyxia Run: obstacle pillars ----------

write('games/onyxia-run/assets/sprites/pillar-top.svg', svg(110, 800, `
  <defs>
    <linearGradient id="rock" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#2c2331"/><stop offset=".5" stop-color="#4a3b52"/><stop offset="1" stop-color="#241c29"/>
    </linearGradient>
  </defs>
  <rect x="10" y="0" width="90" height="775" fill="url(#rock)"/>
  <path d="M10 120 h90 M10 300 h90 M10 520 h90" stroke="#1d1622" stroke-width="6" opacity=".5"/>
  <path d="M0 730 h110 v50 q-28 12 -55 0 q-27 12 -55 0 z" fill="#584766"/>
  <path d="M0 786 q28 14 55 2 q27 12 55 -2 l0 14 h-110 z" fill="#ff7a2b"/>
  <path d="M20 792 q8 6 16 0 M70 794 q9 6 18 0" stroke="#ffc25e" stroke-width="4" fill="none"/>
`));
write('games/onyxia-run/assets/sprites/pillar-bottom.svg', svg(110, 800, `
  <defs>
    <linearGradient id="rock2" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0" stop-color="#2c2331"/><stop offset=".5" stop-color="#4a3b52"/><stop offset="1" stop-color="#241c29"/>
    </linearGradient>
  </defs>
  <rect x="10" y="25" width="90" height="775" fill="url(#rock2)"/>
  <path d="M10 200 h90 M10 430 h90 M10 640 h90" stroke="#1d1622" stroke-width="6" opacity=".5"/>
  <path d="M0 70 h110 v-50 q-28 -12 -55 0 q-27 -12 -55 0 z" fill="#584766"/>
  <path d="M0 14 q28 -14 55 -2 q27 -12 55 2 l0 -14 h-110 z" fill="#ff7a2b"/>
  <path d="M20 8 q8 -6 16 0 M70 6 q9 -6 18 0" stroke="#ffc25e" stroke-width="4" fill="none"/>
`));

// ---------- Onyxia Run: parallax backgrounds ----------
// The renderer mirror-tiles these, so edges do not need to match — but avoid
// text/asymmetric focal objects near edges.

write('games/onyxia-run/assets/sprites/bg-far.svg', svg(1280, 720, `
  <defs>
    <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1a0d26"/>
      <stop offset=".45" stop-color="#4a1830"/>
      <stop offset=".75" stop-color="#8a2e20"/>
      <stop offset="1" stop-color="#c85a1e"/>
    </linearGradient>
    <radialGradient id="glow" cx=".5" cy=".5" r=".5">
      <stop offset="0" stop-color="#ffb35e" stop-opacity=".9"/>
      <stop offset="1" stop-color="#ffb35e" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="1280" height="720" fill="url(#sky)"/>
  <circle cx="640" cy="430" r="220" fill="url(#glow)"/>
  <circle cx="640" cy="430" r="70" fill="#ffdca0" opacity=".9"/>
  <!-- smoke clouds -->
  <ellipse cx="240" cy="150" rx="180" ry="36" fill="#2a1430" opacity=".7"/>
  <ellipse cx="1000" cy="110" rx="220" ry="40" fill="#2a1430" opacity=".6"/>
  <ellipse cx="620" cy="220" rx="150" ry="26" fill="#3a1a34" opacity=".5"/>
  <!-- far mountain range -->
  <path d="M0 520 L90 420 L180 500 L290 380 L400 500 L520 400 L640 510 L760 390 L880 500 L990 410 L1110 510 L1200 430 L1280 520 L1280 720 L0 720 Z"
        fill="#33172e"/>
  <!-- ruined towers on ridges -->
  <path d="M285 380 l-12 -60 h10 l4 -18 4 18 h10 l-12 60 z" fill="#241022"/>
  <path d="M985 410 l-10 -52 h8 l4 -14 4 14 h8 l-10 52 z" fill="#241022"/>
  <!-- mid range with lava veins -->
  <path d="M0 600 L140 480 L300 590 L470 470 L640 600 L810 480 L980 590 L1140 490 L1280 600 L1280 720 L0 720 Z"
        fill="#221024"/>
  <path d="M140 486 q6 60 -8 110 M470 476 q8 66 -4 120 M810 486 q6 60 -10 116 M1140 496 q6 56 -8 104"
        stroke="#ff7a2b" stroke-width="5" fill="none" opacity=".8"/>
  <path d="M140 486 q6 60 -8 110 M470 476 q8 66 -4 120"
        stroke="#ffc25e" stroke-width="2" fill="none" opacity=".8"/>
`));

write('games/onyxia-run/assets/sprites/bg-near.svg', svg(1280, 720, `
  <defs>
    <linearGradient id="spire" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1f0f22"/><stop offset="1" stop-color="#160a18"/>
    </linearGradient>
  </defs>
  <!-- jagged near spires, transparent sky -->
  <path d="M0 720 L40 560 L90 640 L150 470 L210 660 L260 540 L330 700 L380 520 L450 680 L520 560 L600 720 Z" fill="url(#spire)"/>
  <path d="M680 720 L740 540 L800 660 L860 480 L930 680 L990 560 L1060 700 L1120 500 L1200 660 L1250 580 L1280 720 Z" fill="url(#spire)"/>
  <path d="M148 480 q4 40 -2 70 M858 492 q4 40 -2 66" stroke="#ff7a2b" stroke-width="4" fill="none" opacity=".7"/>
  <!-- drifting embers -->
  <circle cx="300" cy="420" r="3" fill="#ffb35e" opacity=".8"/>
  <circle cx="720" cy="360" r="2.4" fill="#ffb35e" opacity=".7"/>
  <circle cx="1080" cy="440" r="3.2" fill="#ff9a3e" opacity=".8"/>
  <circle cx="520" cy="300" r="2" fill="#ffd9a0" opacity=".6"/>
`));

write('games/onyxia-run/assets/sprites/lava.svg', svg(256, 90, `
  <defs>
    <linearGradient id="lava" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ff8a2b"/><stop offset=".4" stop-color="#d94a10"/><stop offset="1" stop-color="#7a1e06"/>
    </linearGradient>
  </defs>
  <rect width="256" height="90" fill="url(#lava)"/>
  <path d="M0 16 Q32 2 64 16 T128 16 T192 16 T256 16 L256 0 L0 0 Z" fill="#ffc25e"/>
  <path d="M0 30 Q40 20 80 30 T160 30 T256 30" stroke="#ffb35e" stroke-width="5" fill="none" opacity=".5"/>
  <circle cx="60" cy="52" r="9" fill="#ffd9a0" opacity=".8"/>
  <circle cx="180" cy="64" r="6" fill="#ffd9a0" opacity=".6"/>
  <circle cx="230" cy="44" r="4" fill="#ffe4b8" opacity=".7"/>
`));

// ---------- GeoGuessr map + sample screenshots ----------

write('games/geoguessr/assets/map/azeroth-map.svg', svg(2048, 1536, `
  <rect width="2048" height="1536" fill="#123c55"/>
  <!-- Kalimdor (west) -->
  <path d="M300 200 Q470 120 560 260 Q640 380 600 520 Q660 640 590 780
           Q640 920 560 1060 Q520 1220 400 1280 Q260 1330 220 1180
           Q140 1080 190 920 Q140 760 200 620 Q170 440 240 320 Z"
        fill="#3e6b2f" stroke="#2b4c20" stroke-width="10"/>
  <!-- Eastern Kingdoms (east) -->
  <path d="M1420 140 Q1580 100 1650 240 Q1740 340 1690 470 Q1780 560 1730 700
           Q1800 830 1720 960 Q1760 1100 1650 1200 Q1560 1320 1450 1250
           Q1360 1300 1310 1170 Q1250 1060 1310 940 Q1260 820 1320 700
           Q1280 560 1350 440 Q1330 280 1420 140 Z"
        fill="#4a6b33" stroke="#334b24" stroke-width="10"/>
  <text x="420" y="700" fill="#d8ecc0" font-family="Georgia" font-size="72" text-anchor="middle" opacity="0.85">KALIMDOR</text>
  <text x="1520" y="700" fill="#d8ecc0" font-family="Georgia" font-size="66" text-anchor="middle" opacity="0.85">EASTERN KINGDOMS</text>
  <text x="1024" y="1480" fill="#9fc4d8" font-family="Georgia" font-size="40" text-anchor="middle" opacity="0.6">PLACEHOLDER MAP — replace with real Azeroth map art (keep 2048×1536 or update manifest)</text>
`));

const shot = (name, sky, ground, detail) => svg(1600, 900, `
  <rect width="1600" height="900" fill="${sky}"/>
  <rect y="560" width="1600" height="340" fill="${ground}"/>
  ${detail}
  <text x="800" y="120" fill="#ffffff" opacity="0.85" font-family="Georgia" font-size="64" text-anchor="middle">${name}</text>
  <text x="800" y="190" fill="#ffffff" opacity="0.6" font-family="Georgia" font-size="34" text-anchor="middle">placeholder screenshot — replace with a real in-game capture</text>
`);
write('games/geoguessr/assets/screenshots/elwynn-01.svg',
  shot('Elwynn Forest', '#7fb2d9', '#3f6d2c', '<path d="M300 560 l60 -160 l60 160 z" fill="#2c5220"/><path d="M1150 560 l70 -190 l70 190 z" fill="#2c5220"/>'));
write('games/geoguessr/assets/screenshots/durotar-01.svg',
  shot('Durotar', '#d9a06a', '#a3542b', '<ellipse cx="1200" cy="500" rx="180" ry="60" fill="#8a3f1d"/><path d="M350 560 l50 -120 l50 120 z" fill="#7a3517"/>'));
write('games/geoguessr/assets/screenshots/westfall-01.svg',
  shot('Westfall', '#e8c87a', '#c9a44a', '<rect x="1100" y="380" width="30" height="180" fill="#6b4a22"/><path d="M1115 380 l90 30 l-90 30 z" fill="#8a6230"/>'));
write('games/geoguessr/assets/screenshots/tanaris-01.svg',
  shot('Tanaris', '#f0d9a0', '#d9b56a', '<ellipse cx="500" cy="620" rx="220" ry="40" fill="#e8cc8a"/>'));
write('games/geoguessr/assets/screenshots/winterspring-01.svg',
  shot('Winterspring', '#cfe4f0', '#e8f2f8', '<path d="M400 560 l80 -220 l80 220 z" fill="#b8d4e4"/><path d="M980 560 l100 -260 l100 260 z" fill="#b8d4e4"/>'));
write('games/geoguessr/assets/screenshots/stranglethorn-01.svg',
  shot('Stranglethorn Vale', '#5e9e6f', '#2c5c38', '<path d="M250 560 q40 -240 90 0 z" fill="#1f4228"/><path d="M1250 560 q50 -280 100 0 z" fill="#1f4228"/>'));

console.log('done');
