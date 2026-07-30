// Regenerates GeoGuessr manifest coordinates for the composed Wowhead map
// (Kalimdor left, Eastern Kingdoms right, 2048x1536 — see the compose step in
// the repo history). Source-pixel estimates are on the original 1024x683
// continent images; transforms mirror the compose rectangles.
// Run: node tools/gen-map-coords.mjs   (rewrites games/geoguessr/assets/manifest.json)
import fs from 'node:fs';

// compose transforms
const KA = { srcX: 250, srcY: 15, scaleX: 1005 / 460, scaleY: 1420 / 650, dstX: 30, dstY: 58 };
const EK = { srcX: 330, srcY: 10, scaleX: 737 / 340, scaleY: 1420 / 655, dstX: 1271, dstY: 58 };

// [continent, sourceX, sourceY] on the original 1024x683 continent maps
const ZONES = {
  'alterac-mountain': [EK, 505, 225],
  'arathi-highlands': [EK, 545, 275],
  'ashenvale': [KA, 490, 250],
  'azshara': [KA, 610, 235],
  'badlands': [EK, 575, 410],
  'blasted-lands': [EK, 565, 540],
  'burning-steppes': [EK, 520, 445],
  'darkshore': [KA, 430, 175],
  'darnassus': [KA, 310, 115],
  'desolace': [KA, 400, 420],
  'duskwood': [EK, 490, 520],
  'dustwallow': [KA, 580, 440],
  'eastern-plaguelands': [EK, 575, 175],
  'felwood': [KA, 480, 190],
  'feralas': [KA, 420, 510],
  'hilsbrad-foothills': [EK, 495, 265],
  'ironforge': [EK, 475, 375],
  'loch-modan': [EK, 560, 360],
  'moonglade': [KA, 555, 145],
  'orgrimmar': [KA, 595, 300],
  'redridge-mountains': [EK, 555, 475],
  'searing-gorge': [EK, 500, 410],
  'silithus': [KA, 420, 580],
  'silverpine-forest': [EK, 445, 230],
  'stonetalon': [KA, 430, 300],
  'stormwind': [EK, 470, 480],
  'stv': [EK, 470, 580],
  'stvboat': [EK, 452, 612],
  'swampof-sorrows': [EK, 585, 485],
  'tanaris': [KA, 555, 550],
  'the-barrens': [KA, 510, 360],
  'the-hinterlands': [EK, 585, 255],
  'thorium-verin': [EK, 505, 405],
  'thousand-needles': [KA, 510, 490],
  'thunder-bluff': [KA, 455, 385],
  'timbermaw': [KA, 520, 165],
  'un-goro': [KA, 470, 570],
  'undercity': [EK, 465, 175],
  'western-plaguelands': [EK, 520, 185],
  'westfall': [EK, 420, 510],
};

const file = new URL('../games/geoguessr/assets/manifest.json', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(file, 'utf8'));
manifest.map = { image: 'map/azeroth-map.jpg', width: 2048, height: 1536 };

let missing = 0;
for (const loc of manifest.locations) {
  const z = ZONES[loc.id];
  if (!z) { console.log('no coords for', loc.id); missing++; continue; }
  const [c, sx, sy] = z;
  loc.map = {
    x: Math.round(c.dstX + (sx - c.srcX) * c.scaleX),
    y: Math.round(c.dstY + (sy - c.srcY) * c.scaleY),
  };
}
fs.writeFileSync(file, JSON.stringify(manifest, null, 2) + '\n');
console.log(`updated ${manifest.locations.length - missing} locations, ${missing} missing`);
