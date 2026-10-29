// Splits the SpriteCook base sprite (spritecook/rookie-idle.png) into dress-up layers and writes every item of every
// slot. The app stacks the layers in LAYER_ORDER to draw an avatar (FE `AvatarSprite`).
// Run: node minigame-sprites/build-layers.mjs
// Output: FE/public/avatar/ (PNG files + manifest.json, served as /avatar/...), the generated item lists
// BE/src/data/avatar-items.ts and FE/src/modules/avatar/data/avatar-manifest.ts, and preview.png + catalog.png here.
import { deflateSync, inflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..');
const OUT = join(ROOT, 'FE', 'public', 'avatar');
// Start clean so a removed item does not leave its old image behind.
rmSync(OUT, { recursive: true, force: true });
const INK = '#010000';
const MOUTH = '#7d322f';
const LASH = '#3b1812';

/**
 * Bottom to top. `hairBack` is the part of a hair item behind the body (long hair, ponytail); `fx` is not a slot:
 * it holds the pose props (keyboard, sparkles, sweat).
 */
const LAYER_ORDER = ['back', 'hairBack', 'bottom', 'shoes', 'top', 'body', 'accessory', 'hair', 'headwear', 'effect', 'fx'];
const POSES = ['idle', 'typing', 'win', 'lose'];

// ---- slot items ---------------------------------------------------------------------------------------------------
// `null` keeps the colors of the SpriteCook sprite.
const SKINS = { peach: null, porcelain: '#ffe0c8', sand: '#e0ac84', tan: '#d39a70', bronze: '#b67a52', umber: '#a8714a' };
const HAIRS = { brown: null, pink: '#ff5fa2', ginger: '#ff9a3c', midnight: '#3a3150', silver: '#e9ecf5', espresso: '#3a2418' };
const TOPS = {
  red: null,
  violet: '#7c5cff',
  yellow: '#ffd23f',
  navy: '#2b3a67',
  green: '#2fbf71',
  orange: '#ff7a2f',
  pink: '#ff8fb8',
  mint: '#6fd6b4',
  brown: '#8a5a3b',
};
/** Plain trousers in one color; the `tights-*` ones are worn under dresses. */
const BOTTOMS = {
  navy: null,
  ink: '#1f2a44',
  brown: '#5b3a29',
  night: '#1a1f3a',
  slate: '#3b4252',
  graphite: '#3a3a4a',
  'tights-white': '#eef0f5',
  'tights-black': '#2a2a30',
  'tights-pink': '#ffb3cf',
};
/** Skirt and trouser styles: `{style}-{color}` items of the bottom slot. */
const SKIRTS = {
  'skirt-navy': ['pleated', '#324265'],
  'skirt-rose': ['pleated', '#e86a92'],
  'skirt-plum': ['pleated', '#7a4fb5'],
  'plaid-red': ['plaid', '#c0392b'],
  'plaid-green': ['plaid', '#2f7d5b'],
  'tutu-pink': ['tutu', '#ffb3cf'],
  'tutu-lilac': ['tutu', '#c9b3ff'],
  'midi-cream': ['midi', '#e9dcc0'],
  'midi-olive': ['midi', '#6f7d4a'],
  'jeans-blue': ['jeans', '#3d6fb6'],
  'jeans-black': ['jeans', '#2b2d35'],
  'cargo-khaki': ['cargo', '#8c7a55'],
  'cargo-olive': ['cargo', '#5d6b3f'],
  'shorts-denim': ['shorts', '#4f7fc4'],
  'shorts-black': ['shorts', '#2b2d35'],
  'joggers-gray': ['joggers', '#8a8f9c'],
  'joggers-black': ['joggers', '#2b2d35'],
  'ripped-blue': ['ripped', '#3d6fb6'],
  'ripped-light': ['ripped', '#7ea6dc'],
  'denim-skirt': ['denim', '#4f7fc4'],
  'denim-skirt-black': ['denim', '#2b2d35'],
  'tiered-pink': ['tiered', '#e8789a'],
  'tiered-white': ['tiered', '#ece6dc'],
  'buttoned-navy': ['buttoned', '#2f4878'],
  'buttoned-brown': ['buttoned', '#8a5a3b'],
  'frilly-lilac': ['frilly', '#b79ce6'],
  'frilly-pink': ['frilly', '#ffb3cf'],
};
/** Hair styles; every style comes in every hair color as `{style}-{color}`. */
const HAIR_STYLES = ['short', 'twintails', 'long', 'ponytail', 'bob', 'buns', 'braid', 'curly'];
/** Top styles: every style comes in every top color as `{style}-{color}` (the hoodie keeps the plain color name). */
const TOP_STYLES = ['hoodie', 'sweater', 'stripes', 'jacket', 'varsity'];
/** One-piece dresses: items of the top slot that also cover the hips (wear `tights-*` under them). */
const DRESS_STYLES = ['dress', 'dress-collar', 'dress-polka', 'dress-sailor', 'dress-pinafore', 'dress-belted', 'dress-princess'];
/** Shoes: `{style}-{color}` items. `null` keeps the SpriteCook shoes. */
const SHOES = {
  'sneakers-brown': ['sneakers', null],
  'sneakers-white': ['sneakers', '#e9e9ee'],
  'sneakers-black': ['sneakers', '#2a2a30'],
  'sneakers-red': ['sneakers', '#d64545'],
  'boots-brown': ['boots', '#7a4a2c'],
  'boots-black': ['boots', '#2a2a30'],
  'boots-white': ['boots', '#ececf0'],
  'maryjanes-black': ['maryjanes', '#26232c'],
  'maryjanes-red': ['maryjanes', '#c8323a'],
  'maryjanes-pink': ['maryjanes', '#ff8fb8'],
  'hightops-red': ['hightops', '#d64545'],
  'hightops-blue': ['hightops', '#3a86ff'],
  'hightops-black': ['hightops', '#2a2a30'],
};
const HEADWEARS = [
  'cap', 'headband', 'cat-ears', 'headphones', 'glasses', 'bow', 'flower-clip',
  'beanie-red', 'beanie-navy', 'beret-red', 'beret-black', 'crown', 'tiara', 'halo', 'bunny-ears',
  'witch-hat', 'party-hat', 'sunglasses', 'flower-crown', 'star-pin',
];
const ACCESSORIES = [
  'scarf-red', 'scarf-cream', 'bag-crossbody', 'necklace-pearl', 'brooch-star',
  'tie-red', 'bowtie-black', 'belt-brown', 'medal-gold', 'suspenders-red', 'name-tag', 'heart-locket',
];
/** Face styles of the body layer: classic (dot eyes) or cute (big shiny eyes with lashes, blush). */
const FACES = ['classic', 'cute'];
const bodyFile = (look, pose) => `body/${look.skin}${look.face === 'cute' ? '-cute' : ''}-${pose}.png`;
/** Worn behind the body. */
const BACKS = ['angel-wings', 'bat-wings', 'fairy-wings', 'cape-red', 'cape-purple'];
/** Cosmetic effects floating around the avatar, in every pose. */
const EFFECTS = ['hearts', 'stars', 'notes', 'snow', 'bubbles', 'flames', 'leaves'];

/** The starter characters, as slot choices (missing keys: SpriteCook sneakers, nothing on the back, no effect). */
const PRESETS = {
  rookie: { skin: 'peach', hair: 'short-brown', top: 'red', bottom: 'navy' },
  beat: { skin: 'tan', hair: 'short-pink', top: 'violet', bottom: 'ink', shoes: 'hightops-black', headwear: 'headphones', effect: 'notes' },
  kitty: { skin: 'porcelain', hair: 'curly-ginger', top: 'sweater-yellow', bottom: 'brown', headwear: 'cat-ears' },
  shadow: { skin: 'sand', hair: 'short-midnight', top: 'jacket-navy', bottom: 'jeans-black', shoes: 'boots-black', headwear: 'headband', back: 'bat-wings' },
  prof: { skin: 'umber', hair: 'short-silver', top: 'stripes-green', bottom: 'slate', headwear: 'glasses', accessory: 'bowtie-black' },
  ace: { skin: 'bronze', hair: 'short-espresso', top: 'varsity-orange', bottom: 'cargo-khaki', shoes: 'sneakers-white', headwear: 'cap', accessory: 'medal-gold' },
  mimi: { face: 'cute', skin: 'porcelain', hair: 'buns-pink', top: 'pink', bottom: 'tutu-pink', shoes: 'maryjanes-pink', accessory: 'necklace-pearl', effect: 'hearts' },
  luna: { face: 'cute', skin: 'tan', hair: 'long-midnight', top: 'sweater-mint', bottom: 'midi-cream', headwear: 'flower-clip', accessory: 'scarf-cream' },
  sora: { face: 'cute', skin: 'bronze', hair: 'twintails-ginger', top: 'yellow', bottom: 'plaid-red', shoes: 'boots-brown', headwear: 'cat-ears', accessory: 'bag-crossbody' },
  nana: { face: 'cute', skin: 'sand', hair: 'ponytail-espresso', top: 'jacket-red', bottom: 'shorts-denim', shoes: 'hightops-red', headwear: 'bow' },
  yui: { face: 'cute', skin: 'umber', hair: 'braid-silver', top: 'stripes-violet', bottom: 'skirt-navy', headwear: 'beret-red', accessory: 'scarf-red', effect: 'snow' },
  bea: { face: 'cute', skin: 'peach', hair: 'bob-brown', top: 'varsity-pink', bottom: 'plaid-green', shoes: 'maryjanes-black', headwear: 'glasses', accessory: 'bag-crossbody' },
  hana: { face: 'cute', skin: 'porcelain', hair: 'long-silver', top: 'dress-collar-pink', bottom: 'tights-white', shoes: 'maryjanes-red', headwear: 'tiara', back: 'angel-wings', effect: 'stars' },
  kiki: { face: 'cute', skin: 'tan', hair: 'twintails-midnight', top: 'dress-polka-violet', bottom: 'tights-black', shoes: 'boots-black', headwear: 'witch-hat', back: 'bat-wings' },
  rin: { face: 'cute', skin: 'sand', hair: 'buns-ginger', top: 'dress-mint', bottom: 'tights-pink', shoes: 'maryjanes-pink', headwear: 'flower-crown', back: 'fairy-wings', effect: 'leaves' },
  max: { skin: 'umber', hair: 'curly-espresso', top: 'orange', bottom: 'joggers-black', shoes: 'hightops-blue', headwear: 'beanie-navy', back: 'cape-red', effect: 'flames' },
};

// ---- color helpers ------------------------------------------------------------------------------------------------
const rgb = (hex) => [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16));
const toHex = (c) => '#' + c.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => toHex(rgb(a).map((v, i) => v + (rgb(b)[i] - v) * t));

// Base colors of each region -> how to derive them from a new base color.
const ramps = {
  hair: (b) => ({
    '#1e0c0a': mix(b, '#000000', 0.75),
    '#3b1812': mix(b, '#000000', 0.5),
    '#51281f': mix(b, '#000000', 0.3),
    '#724132': b,
    '#9e5f46': mix(b, '#ffffff', 0.3),
  }),
  skin: (b) => ({ '#f9c7a4': b, '#e59d81': mix(b, '#7a2e1e', 0.22), '#c7785b': mix(b, '#7a2e1e', 0.42) }),
  top: (b) => ({
    '#d94540': b,
    '#bb3f3c': mix(b, '#000000', 0.12),
    '#a72934': mix(b, '#000000', 0.25),
    '#7d322f': mix(b, '#000000', 0.45),
    '#3b1812': mix(b, '#000000', 0.55),
    '#1e0c0a': mix(b, '#000000', 0.7),
  }),
  bottom: (b) => ({ '#324265': b, '#192a4b': mix(b, '#000000', 0.4) }),
};
const recolor = (g, ramp) => g.map((row) => row.map((c) => (c && ramp?.[c]) || c));

// ---- PNG read / write ---------------------------------------------------------------------------------------------
const readPng = (file) => {
  const buf = readFileSync(file);
  let pos = 8;
  let w = 0;
  let h = 0;
  const idat = [];
  while (pos < buf.length) {
    const len = buf.readUInt32BE(pos);
    const type = buf.toString('ascii', pos + 4, pos + 8);
    const data = buf.subarray(pos + 8, pos + 8 + len);
    if (type === 'IHDR') {
      w = data.readUInt32BE(0);
      h = data.readUInt32BE(4);
    }
    if (type === 'IDAT') idat.push(data);
    pos += 12 + len;
  }
  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * 4;
  const px = Buffer.alloc(h * stride);
  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    for (let x = 0; x < stride; x++) {
      const a = raw[y * (stride + 1) + 1 + x];
      const left = x >= 4 ? px[y * stride + x - 4] : 0;
      const up = y > 0 ? px[(y - 1) * stride + x] : 0;
      const ul = x >= 4 && y > 0 ? px[(y - 1) * stride + x - 4] : 0;
      let pred = 0;
      if (filter === 1) pred = left;
      else if (filter === 2) pred = up;
      else if (filter === 3) pred = (left + up) >> 1;
      else if (filter === 4) {
        const p = left + up - ul;
        const pa = Math.abs(p - left);
        const pb = Math.abs(p - up);
        const pc = Math.abs(p - ul);
        pred = pa <= pb && pa <= pc ? left : pb <= pc ? up : ul;
      }
      px[y * stride + x] = (a + pred) & 255;
    }
  }
  return Array.from({ length: h }, (_, y) =>
    Array.from({ length: w }, (_, x) => {
      const o = y * stride + x * 4;
      return px[o + 3] < 128 ? null : toHex([px[o], px[o + 1], px[o + 2]]);
    }),
  );
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
};
const toPng = (grid, scale = 1) => {
  const w = grid[0].length * scale;
  const h = grid.length * scale;
  const raw = Buffer.alloc((w * 4 + 1) * h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const c = grid[Math.floor(y / scale)][Math.floor(x / scale)];
      if (c) raw.set([...rgb(c), 255], y * (w * 4 + 1) + 1 + x * 4);
    }
  const head = Buffer.alloc(13);
  head.writeUInt32BE(w, 0);
  head.writeUInt32BE(h, 4);
  head.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', head),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ]);
};

// ---- drawing helpers ----------------------------------------------------------------------------------------------
const base = readPng(join(HERE, 'spritecook', 'rookie-idle.png'));
const SIZE = base.length;
const blank = () => Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
/** Every saved layer gets HEAD empty rows above (room for hats, ears, halos) and SIDE columns on each side. */
const HEAD = 12;
const SIDE = 6;
const OUT_W = SIZE + 2 * SIDE;
const OUT_H = SIZE + HEAD;
/** A layer that can also draw above the head: y from -HEAD up. */
const tall = () => Object.assign(Array.from({ length: OUT_H }, () => Array(SIZE).fill(null)), { oy: HEAD });
const clone = (g) => g.map((row) => row.slice());
const put = (g, x, y, c) => {
  const gy = y + (g.oy ?? 0);
  if (x >= 0 && gy >= 0 && x < SIZE && gy < g.length) g[gy][x] = c;
};
/** The first hair row of a column of the base sprite (where a hat touches the head). */
const hairTop = (x) => {
  for (let y = 0; y < SIZE; y++) if (base[y][x]) return y;
  return SIZE;
};
const rect = (g, x, y, w, h, c) => {
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) put(g, x + i, y + j, c);
};
const pts = (g, list, c) => list.forEach(([x, y]) => put(g, x, y, c));
const NEIGHBORS = [[1, 0], [-1, 0], [0, 1], [0, -1]];
const NEIGHBORS8 = [...NEIGHBORS, [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Outlines the colored pixels of a layer, only where `where(x, y)` allows (so layer seams stay clean). */
const outline = (g, where = () => true) => {
  const out = clone(g);
  for (let y = 0; y < g.length; y++)
    for (let x = 0; x < SIZE; x++) {
      if (g[y][x] || !where(x, y)) continue;
      if (NEIGHBORS.some(([dx, dy]) => g[y + dy]?.[x + dx] && g[y + dy][x + dx] !== INK)) out[y][x] = INK;
    }
  return out;
};
const outsideBase = (x, y) => !base[y][x];

// ---- 1. split the base sprite into layers -------------------------------------------------------------------------
const PANTS = ['#324265', '#192a4b'];
const SKIN = ['#f9c7a4', '#e59d81', '#c7785b'];
const inEyeZone = (x, y) => y >= 19 && y <= 24 && ((x >= 26 && x <= 31) || (x >= 38 && x <= 43));
const regionOf = (x, y, c) => {
  if (y >= 59) return 'shoes';
  if (PANTS.includes(c)) return 'bottom';
  if (SKIN.includes(c) || inEyeZone(x, y) || (y < 30 && c === MOUTH)) return 'body';
  if (y < 30) return 'hair';
  return 'top';
};

// Each outline pixel goes to every layer it borders, so each layer keeps its own outline.
let labels = base.map((row, y) => row.map((c, x) => (c && c !== INK ? new Set([regionOf(x, y, c)]) : null)));
for (let pass = 0; pass < 3; pass++) {
  const next = labels.map((row) => row.slice());
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      if (base[y][x] !== INK || labels[y][x]) continue;
      const near = new Set();
      for (const [dx, dy] of NEIGHBORS8) labels[y + dy]?.[x + dx]?.forEach((l) => near.add(l));
      if (near.size) next[y][x] = near;
    }
  labels = next;
}
const layerOf = (name) => base.map((row, y) => row.map((c, x) => (labels[y][x]?.has(name) ? c : null)));
const BASE_LAYERS = Object.fromEntries(['shoes', 'bottom', 'top', 'body', 'hair'].map((l) => [l, layerOf(l)]));

// ---- 2. poses -----------------------------------------------------------------------------------------------------
const SHOULDER_Y = 36;
const isArm = (x) => x <= 22 || x >= 42;
/** Flips the hanging arm pixels up around the shoulder row and leans them outwards (keeps the SpriteCook shading). */
const raiseArms = (g) => {
  const out = clone(g);
  const moved = [];
  for (let y = SHOULDER_Y; y <= 52; y++)
    for (let x = 0; x < SIZE; x++)
      if (isArm(x)) {
        if (g[y][x]) moved.push([x, y, g[y][x]]);
        out[y][x] = null;
      }
  for (const [x, y, c] of moved) {
    const ny = 2 * SHOULDER_Y - y;
    put(out, x + (x <= 22 ? -1 : 1) * Math.round((SHOULDER_Y - ny) * 0.6), ny, c);
  }
  return outline(out, (x, y) => y <= SHOULDER_Y && isArm(x));
};

/**
 * The cute face (big eyes with a white shine, lashes with a flick, blush, cat mouth) copies the eyes of the SpriteCook
 * girl sprite spritecook/girl-idle-raw.png, scaled to this frame.
 */
const CUTE_EYE = { L: INK, D: '#3a1f17', I: '#7a4630', H: '#c08060', W: '#ffffff' };
const CUTE_EYES = {
  open: [['LLLLL', 'DWWID', 'DWIID', 'DIIHD', '.DDD.'], ['LLLLL', 'DWWID', 'DWIID', 'DHIID', '.DDD.']],
  half: [['LLLLL', 'DIIHD', '.DDD.'], ['LLLLL', 'DHIID', '.DDD.']],
};
const drawCuteFace = (g, pose, skin) => {
  for (let y = 19; y <= 24; y++) for (let x = 26; x <= 43; x++) if (inEyeZone(x, y) && (g[y][x] === INK || g[y][x] === LASH)) g[y][x] = skin.h;
  for (let y = 25; y <= 29; y++) for (let x = 30; x <= 38; x++) if (g[y][x] === MOUTH) g[y][x] = skin.h;
  const eyes = (shape, y0) =>
    CUTE_EYES[shape].forEach((rows, side) =>
      rows.forEach((row, dy) => [...row].forEach((ch, dx) => CUTE_EYE[ch] && put(g, (side ? 39 : 26) + dx, y0 + dy, CUTE_EYE[ch]))),
    );
  const flick = (y) => pts(g, [[25, y], [44, y]], INK);
  pts(g, [[24, 25], [25, 25], [44, 25], [45, 25]], '#f08f9a');
  if (pose === 'idle') {
    eyes('open', 19);
    flick(18);
    pts(g, [[32, 26], [33, 27], [34, 26], [35, 27], [36, 26]], MOUTH);
  }
  if (pose === 'typing') {
    eyes('half', 21);
    flick(20);
    rect(g, 33, 27, 3, 1, MOUTH);
  }
  if (pose === 'win') {
    pts(g, [[26, 22], [27, 21], [28, 20], [29, 20], [30, 21], [31, 22]], INK);
    pts(g, [[38, 22], [39, 21], [40, 20], [41, 20], [42, 21], [43, 22]], INK);
    flick(23);
    rect(g, 32, 26, 5, 1, INK);
    rect(g, 31, 27, 7, 2, INK);
    rect(g, 32, 29, 5, 1, INK);
    rect(g, 33, 28, 3, 1, '#e5484d');
  }
  if (pose === 'lose') {
    for (const [x, y] of [[27, 19], [28, 20], [29, 21], [28, 22], [27, 23]]) rect(g, x, y, 2, 1, INK);
    for (const [x, y] of [[41, 19], [40, 20], [39, 21], [40, 22], [41, 23]]) rect(g, x, y, 2, 1, INK);
    pts(g, [[26, 24], [26, 25], [43, 24], [43, 25]], '#7fd4ff');
    pts(g, [[32, 28], [33, 27], [34, 28], [35, 27], [36, 28]], MOUTH);
  }
};

const drawFace = (g, pose, skin, face = 'classic') => {
  if (face === 'cute') return drawCuteFace(g, pose, skin);
  if (pose === 'idle') return;
  const clearEyes = (rows) => {
    for (const y of rows) for (let x = 26; x <= 43; x++) if (inEyeZone(x, y) && (g[y][x] === INK || g[y][x] === LASH)) g[y][x] = skin.h;
  };
  const clearMouth = () => {
    for (let y = 25; y <= 29; y++) for (let x = 30; x <= 38; x++) if (g[y][x] === MOUTH) g[y][x] = skin.h;
  };
  clearMouth();
  if (pose === 'typing') {
    clearEyes([20, 21]);
    rect(g, 33, 27, 4, 1, MOUTH);
  }
  if (pose === 'win') {
    clearEyes([19, 20, 21, 22, 23, 24]);
    pts(g, [[26, 22], [27, 21], [28, 20], [29, 20], [30, 21], [31, 22]], INK);
    pts(g, [[38, 22], [39, 21], [40, 20], [41, 20], [42, 21], [43, 22]], INK);
    rect(g, 32, 26, 5, 1, INK);
    rect(g, 31, 27, 7, 2, INK);
    rect(g, 32, 29, 5, 1, INK);
    rect(g, 33, 28, 3, 1, '#e5484d');
  }
  if (pose === 'lose') {
    clearEyes([19, 20, 21, 22, 23, 24]);
    for (const [x, y] of [[27, 19], [28, 20], [29, 21], [28, 22], [27, 23]]) rect(g, x, y, 2, 1, INK);
    for (const [x, y] of [[41, 19], [40, 20], [39, 21], [40, 22], [41, 23]]) rect(g, x, y, 2, 1, INK);
    rect(g, 33, 27, 3, 1, MOUTH);
    pts(g, [[32, 28], [36, 28]], MOUTH);
  }
};

const fxFor = (pose) => {
  const g = blank();
  if (pose === 'typing') {
    rect(g, 13, 43, 38, 1, INK);
    rect(g, 13, 44, 38, 7, '#3a3f4b');
    rect(g, 13, 44, 38, 1, '#5a6070');
    for (const y of [46, 48]) for (let x = 15; x <= 47; x += 3) rect(g, x, y, 2, 1, '#9aa3b5');
    rect(g, 13, 51, 38, 1, INK);
    rect(g, 12, 43, 1, 9, INK);
    rect(g, 51, 43, 1, 9, INK);
  }
  if (pose === 'win')
    for (const [x, y] of [[4, 6], [59, 6]]) {
      pts(g, [[x - 2, y], [x - 1, y], [x + 1, y], [x + 2, y], [x, y - 2], [x, y - 1], [x, y + 1], [x, y + 2]], '#ffe066');
      put(g, x, y, '#ffffff');
    }
  if (pose === 'lose') {
    pts(g, [[54, 8], [53, 9], [54, 9], [52, 10], [53, 10], [54, 10], [52, 11], [53, 11], [54, 11], [53, 12]], '#7fd4ff');
    put(g, 53, 10, '#e6f7ff');
    return outline(g);
  }
  return g;
};

// ---- 3. headwear (drawn on its own layer, outlined only outside the head) -----------------------------------------
const hairLayer = BASE_LAYERS.hair;
/**
 * Headwear that sits on the head: drawn along the top of the hair (hairTop) and reaching into the room above the
 * head, so it rests on the hair instead of floating over it.
 */
const drawTallHeadwear = (name) => {
  const g = tall();
  const mirror = (x0, x1, y0, y1, colorAt) => {
    for (let y = y0; y <= y1; y++)
      for (let x = x0; x <= x1; x++) {
        const c = colorAt(x, y);
        if (c) {
          put(g, x, y, c);
          put(g, 61 - x, y, c);
        }
      }
  };
  const band = (color, x0, x1, dy, rows = 2) => {
    for (let x = x0; x <= x1; x++) rect(g, x, hairTop(x) + dy, 1, rows, color);
  };
  if (name === 'cat-ears') {
    band('#2f2b36', 15, 47, 2);
    mirror(13, 26, -6, 3, (x, y) => {
      const t = (y + 6) / 9;
      const xl = Math.round(18 - 3 * t);
      const xr = Math.round(18 + 6 * t);
      if (x < xl || x > xr) return null;
      if (y >= -3 && y <= 2 && x > xl + 1 && x < xr - 1) return '#ff9bb5';
      return x === xr ? '#1d1a22' : '#2f2b36';
    });
    return outline(g);
  }
  if (name === 'bunny-ears') {
    band('#e6e8ee', 15, 47, 2);
    mirror(16, 25, -12, 4, (x, y) => {
      const lx = x + Math.round((4 - y) / 8);
      if (lx < 19 || lx > 23 || (y === -12 && (lx === 19 || lx === 23))) return null;
      if (lx >= 20 && lx <= 22 && y >= -10 && y <= 2) return '#ffb3cf';
      return lx === 23 ? '#d7dbe8' : '#f7f7fb';
    });
    return outline(g);
  }
  if (name === 'crown') {
    for (const c of [22, 27, 31, 32, 36, 41])
      for (let y = -5; y <= 0; y++) {
        const half = Math.round((y + 5) * 0.5);
        rect(g, c - half, y, half * 2 + 1, 1, y === -5 ? '#fff3a0' : '#ffd23f');
      }
    rect(g, 21, 1, 22, 4, '#ffd23f');
    rect(g, 21, 1, 22, 1, '#fff3a0');
    rect(g, 21, 4, 22, 1, '#c9a227');
    for (const [x, c] of [[25, '#e5484d'], [31, '#3a86ff'], [37, '#e5484d']]) rect(g, x, 2, 2, 2, c);
    return outline(g);
  }
  if (name === 'tiara') {
    for (let x = 20; x <= 43; x++) {
      put(g, x, hairTop(x) + 4, '#e6e8ee');
      put(g, x, hairTop(x) + 5, '#b9bfd0');
    }
    for (let y = -2; y <= 3; y++) {
      const half = Math.round((y + 2) * 0.7);
      rect(g, 31 - half, y, half * 2 + 2, 1, '#e6e8ee');
    }
    for (const x of [25, 38]) rect(g, x, hairTop(x) + 2, 1, 2, '#e6e8ee');
    rect(g, 31, 1, 2, 2, '#ff6b8b');
    return outline(g);
  }
  if (name === 'halo') {
    for (let y = -10; y <= -4; y++)
      for (let x = 20; x <= 43; x++) {
        const d = ((x - 31.5) / 10.5) ** 2 + ((y + 7) / 2.6) ** 2;
        if (d >= 0.5 && d <= 1) put(g, x, y, y <= -8 ? '#fff3a0' : '#ffd23f');
      }
    return g;
  }
  if (name === 'witch-hat') {
    for (let y = -12; y <= 6; y++) {
      const t = (y + 12) / 18;
      const cx = 31.5 + (1 - t) ** 2 * 10;
      const half = 0.5 + t * 10.5;
      for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++)
        put(g, x, y, x > cx + half - 2 ? '#33285a' : x < cx - half + 2 ? '#6a56a3' : '#4b3a7a');
    }
    rect(g, 22, 3, 20, 2, '#ffd23f');
    rect(g, 30, 3, 3, 2, '#c9a227');
    for (let y = 5; y <= 10; y++)
      for (let x = 6; x <= 57; x++)
        if (((x - 31.5) / 24) ** 2 + ((y - 7.5) / 2.6) ** 2 <= 1) put(g, x, y, y <= 6 ? '#6a56a3' : y >= 9 ? '#2a2050' : '#4b3a7a');
    return outline(g);
  }
  if (name === 'party-hat') {
    for (let y = -9; y <= 3; y++) {
      const t = (y + 9) / 12;
      const cx = 43 - t * 2;
      const half = t * 6;
      for (let x = Math.ceil(cx - half); x <= Math.floor(cx + half); x++)
        put(g, x, y, y === 3 ? '#ffffff' : (((x - y) % 6) + 6) % 6 < 3 ? '#ff6b8b' : '#ffd23f');
    }
    for (let y = -12; y <= -8; y++) for (let x = 41; x <= 45; x++) if ((x - 43) ** 2 + (y + 10) ** 2 <= 5) put(g, x, y, '#7fd4ff');
    return outline(g);
  }
  if (name.startsWith('beret')) {
    const felt = name === 'beret-red' ? '#c0392b' : '#2a2a30';
    const light = mix(felt, '#ffffff', 0.2);
    const dark = mix(felt, '#000000', 0.3);
    for (let y = -5; y <= 9; y++)
      for (let x = 12; x <= 54; x++) {
        const inside = ((x - 34) / 17) ** 2 + ((y - 2) / 6.5) ** 2 <= 1 && y <= 5 + (x > 42 ? Math.round((x - 42) * 0.5) : 0);
        if (inside) put(g, x, y, y <= -2 ? light : y >= 5 ? dark : felt);
      }
    rect(g, 33, -6, 2, 1, dark);
    return outline(g);
  }
  if (name === 'bow') {
    const pink = '#ff6b8b';
    const dark = mix(pink, '#000000', 0.3);
    for (let i = 0; i <= 5; i++) {
      const span = Math.floor(i * 0.8);
      rect(g, 38 - i, 3 - span, 1, 2 + span * 2, i === 5 ? dark : pink);
      rect(g, 43 + i, 3 - span, 1, 2 + span * 2, i === 5 ? dark : pink);
    }
    rect(g, 39, 2, 4, 4, dark);
    rect(g, 40, 3, 2, 2, pink);
    pts(g, [[39, 6], [38, 7], [37, 8], [42, 6], [43, 7], [44, 8]], dark);
    pts(g, [[35, 1], [36, 0], [46, 0], [47, 1]], '#ffc2d0');
    return outline(g);
  }
  if (name === 'flower-crown') {
    for (let x = 14; x <= 48; x++) {
      put(g, x, hairTop(x) + 3, '#4caf50');
      if (x % 4 === 0) put(g, x, hairTop(x) + 2, '#7fd47f');
    }
    [16, 21, 26, 31, 36, 41, 46].forEach((x, i) => {
      const y = hairTop(x) + 2;
      pts(g, [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]], ['#ff8fb8', '#ffd23f', '#c9b3ff'][i % 3]);
      put(g, x, y, '#ffffff');
    });
    return outline(g);
  }
  return null;
};

const drawHeadwear = (name) => {
  const tallItem = drawTallHeadwear(name);
  if (tallItem) return tallItem;
  const g = blank();
  if (name === 'cap') {
    const cap = '#3a86ff';
    const shade = { '#1e0c0a': mix(cap, '#000000', 0.5), '#3b1812': mix(cap, '#000000', 0.5), '#51281f': mix(cap, '#000000', 0.3), '#9e5f46': mix(cap, '#ffffff', 0.3) };
    for (let y = 0; y <= 10; y++) for (let x = 0; x < SIZE; x++) if (hairLayer[y][x]) g[y][x] = hairLayer[y][x] === INK ? INK : shade[hairLayer[y][x]] ?? cap;
    rect(g, 29, 4, 6, 3, '#ffffff');
    rect(g, 30, 5, 4, 1, mix(cap, '#000000', 0.3));
    rect(g, 12, 11, 39, 2, mix(cap, '#000000', 0.3));
    rect(g, 14, 11, 35, 1, cap);
    rect(g, 12, 13, 39, 1, INK);
    return outline(g, (x, y) => y <= 13);
  }
  if (name === 'headband') {
    const band = '#e5484d';
    const dark = mix(band, '#000000', 0.3);
    for (let y = 9; y <= 12; y++) for (let x = 0; x < SIZE; x++) if (base[y][x] && base[y][x] !== INK) g[y][x] = y === 9 || y === 12 ? dark : band;
    rect(g, 28, 9, 8, 4, '#c9ced8');
    rect(g, 29, 10, 6, 2, '#e8ebf0');
    for (let i = 0; i < 7; i++) rect(g, 48 + i, 10 + i, 3, 2, i % 2 ? dark : band);
    return outline(g, outsideBase);
  }
  if (name === 'headphones') {
    const teal = '#2ec4b6';
    for (let x = 15; x <= 48; x++) {
      let top = 0;
      while (top < 20 && !base[top][x]) top++;
      if (top < 20) rect(g, x, top + 1, 1, 3, '#2b2b36');
    }
    for (const x0 of [10, 46]) {
      rect(g, x0, 14, 8, 12, INK);
      rect(g, x0 + 1, 15, 6, 10, teal);
      rect(g, x0 + 2, 17, 4, 6, mix(teal, '#000000', 0.45));
    }
    return g;
  }
  if (name === 'glasses') {
    const frame = '#22202a';
    for (const x0 of [24, 37]) {
      rect(g, x0, 18, 9, 1, frame);
      rect(g, x0, 25, 9, 1, frame);
      rect(g, x0, 18, 1, 8, frame);
      rect(g, x0 + 8, 18, 1, 8, frame);
      put(g, x0 + 2, 20, '#ffffff');
      put(g, x0 + 3, 20, '#dff1ff');
    }
    rect(g, 33, 20, 4, 1, frame);
    return g;
  }
  if (name === 'flower-clip') {
    for (const [x, y] of [[44, 6], [47, 9], [44, 12], [41, 9]]) {
      rect(g, x - 1, y - 1, 3, 3, '#ff8fb8');
      put(g, x - 1, y - 1, '#ffc2d6');
    }
    rect(g, 43, 8, 3, 3, '#ffd23f');
    rect(g, 47, 12, 3, 2, '#4caf50');
    return outline(g);
  }
  /** Covers the top of the hair with a knitted hat: the hair shape becomes the hat. */
  if (name.startsWith('beanie')) {
    const knit = name === 'beanie-red' ? '#d64545' : '#2b3a67';
    for (let y = 0; y <= 9; y++) for (let x = 0; x < SIZE; x++) if (hairLayer[y][x]) g[y][x] = hairLayer[y][x] === INK ? INK : x % 2 ? knit : mix(knit, '#000000', 0.2);
    for (let y = 10; y <= 12; y++) for (let x = 0; x < SIZE; x++) if (base[y][x] && base[y][x] !== INK) g[y][x] = x % 2 ? mix(knit, '#000000', 0.35) : mix(knit, '#000000', 0.2);
    for (let y = -2; y <= 2; y++) for (let x = -2; x <= 2; x++) if (x * x + y * y <= 5) put(g, 32 + x, 1 + y, y < 0 ? '#ffffff' : '#e6e8ee');
    return outline(g, (x, y) => y <= 13);
  }
  if (name === 'sunglasses') {
    for (const x0 of [24, 37]) {
      rect(g, x0, 19, 9, 6, '#1d1b24');
      pts(g, [[x0 + 2, 20], [x0 + 3, 20], [x0 + 2, 21]], '#6b6880');
    }
    rect(g, 33, 20, 4, 1, '#1d1b24');
    return g;
  }
  if (name === 'star-pin') {
    const star = ['..X..', 'XXXXX', '.XXX.', '.X.X.'];
    star.forEach((row, dy) => [...row].forEach((ch, dx) => ch === 'X' && put(g, 15 + dx, 9 + dy, '#ffd23f')));
    return outline(g);
  }
  throw new Error(`Unknown headwear ${name}`);
};

// ---- 3b. girl items, drawn on the shared frame (the SpriteCook girl sprite spritecook/girl-idle-raw.png is the
// reference: its own frame is bigger, so its pixels cannot be stacked on this body) ---------------------------------
const HAIR = { darkest: '#1e0c0a', darker: '#3b1812', dark: '#51281f', base: '#724132', light: '#9e5f46' };
/** Short hair plus two hanging tails with red bows. Drawn in the base hair colors so the hair ramps recolor it. */
const twinTails = () => {
  const g = clone(hairLayer);
  for (const side of [-1, 1]) {
    const cx = (x) => (side < 0 ? x : 61 - x);
    // A teardrop that hangs from the bow, swings out a little and ends in a point.
    for (let y = 12; y <= 33; y++) {
      const w = y < 17 ? 3 : Math.max(0, Math.round(3 - (3 * (y - 17)) / 16));
      const c = 9 - Math.round(2 * Math.sin((Math.PI * (y - 12)) / 24));
      for (let dx = -w; dx <= w; dx++) {
        let color = HAIR.base;
        if (dx === -w) color = HAIR.dark;
        if (dx === w) color = HAIR.darker;
        if (dx === -1 && w >= 2 && y % 4 !== 0) color = HAIR.light;
        put(g, cx(c + dx), y, color);
      }
    }
  }
  return g;
};
const tailBows = (g) => {
  for (const cx of [10, 51]) {
    rect(g, cx - 4, 9, 3, 4, '#e5484d');
    rect(g, cx + 2, 9, 3, 4, '#e5484d');
    rect(g, cx - 1, 10, 3, 2, '#a72934');
    pts(g, [[cx - 3, 10], [cx + 3, 10]], '#ff8a8f');
  }
  return outline(g, outsideBase);
};

/** Fills `inside` with hair colors: shadow on the right and bottom edges, a light streak near the left edge. */
const fillHair = (g, inside, [x0, x1, y0, y1]) => {
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      if (!inside(x, y)) continue;
      let c = HAIR.base;
      if (!inside(x + 1, y) || !inside(x, y + 1)) c = HAIR.darker;
      else if (!inside(x - 1, y)) c = HAIR.dark;
      else if (!inside(x - 2, y) && y % 4 !== 0) c = HAIR.light;
      put(g, x, y, c);
    }
};
/**
 * The hair SpriteCook drew on the base sprite (`spritecook/<file>`, an edit of rookie-idle at the same size and place):
 * its brown pixels that are new or were hair before, mapped to the nearest color of the hair ramp so it recolors like
 * every hair, plus the dark outline pixels touching them. The rest of the edit (face, hoodie) is left out. `dx` moves
 * an edit that SpriteCook drew a few pixels off back over the base (measured on the body and the eyes).
 */
const hairFromEdit = (file, dx = 0) => {
  const drawn = readPng(join(HERE, 'spritecook', file));
  const edit = drawn.map((row) => row.map((_, x) => row[x - dx] ?? null));
  const ramp = Object.values(HAIR);
  const distance = (a, b) => rgb(a).reduce((sum, v, i) => sum + (v - rgb(b)[i]) ** 2, 0);
  const isBrown = (c) => {
    const [r, g, b] = rgb(c);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if (max === min || max !== r || g < b) return false;
    const hue = ((g - b) / (max - min)) * 60;
    // From 4°: the hoodie reds (under 3°) stay out, the reddish hair shadows come in.
    return hue >= 4 && hue <= 40 && max >= 50 && max <= 205 && (max - min) / max >= 0.2;
  };
  // The eyes, lashes, blush and mouth of both faces are dark or brownish too: never hair, or the hair layer (recolored
  // with the hair) would cover the face of the body layer.
  const isFace = (x, y) =>
    (y >= 18 && y <= 25 && ((x >= 24 && x <= 31) || (x >= 38 && x <= 45))) || (y >= 25 && y <= 29 && x >= 30 && x <= 38);
  const brownHere = (x, y) => {
    const c = edit[y]?.[x];
    return Boolean(c) && y < 56 && isBrown(c) && (c !== base[y][x] || hairLayer[y][x] === c);
  };
  // Only real hair: brown patches that reach the top of the head or are big (a braid behind its outline). SpriteCook
  // also redraws cuffs and hands a little, in small brown spots. Patches go through the face zone (a lock can pass
  // beside an eye); the face itself is left out after.
  const joined = blank();
  const seen = blank();
  for (let sy = 0; sy < SIZE; sy++)
    for (let sx = 0; sx < SIZE; sx++) {
      if (seen[sy][sx] || !brownHere(sx, sy)) continue;
      const patch = [];
      const stack = [[sx, sy]];
      while (stack.length) {
        const [x, y] = stack.pop();
        if (seen[y]?.[x] !== null || !brownHere(x, y)) continue;
        seen[y][x] = true;
        patch.push([x, y]);
        NEIGHBORS8.forEach(([dx, dy]) => stack.push([x + dx, y + dy]));
      }
      if (patch.length >= 15 || patch.some(([, y]) => y <= 8)) patch.forEach(([x, y]) => (joined[y][x] = true));
    }
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (isFace(x, y)) joined[y][x] = null;
  const g = blank();
  for (let y = 0; y < SIZE; y++)
    for (let x = 0; x < SIZE; x++) {
      const c = edit[y][x];
      if (joined[y][x]) g[y][x] = ramp.reduce((best, r) => (distance(c, r) < distance(c, best) ? r : best));
      else if (c && !isFace(x, y) && rgb(c).reduce((a, b) => a + b) < 70 && NEIGHBORS.some(([dx, dy]) => joined[y + dy]?.[x + dx])) g[y][x] = INK;
    }
  // Holes in the head: pixels with neither new hair nor skin that the outside cannot reach. The body layer has nothing
  // to show there, so the base hair (or a dark hair color) fills them.
  const body = BASE_LAYERS.body;
  const outside = blank();
  const open = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && !g[y][x] && !body[y][x];
  const reach = [];
  for (let i = 0; i < SIZE; i++) reach.push([i, 0], [0, i], [SIZE - 1, i]);
  for (let x = 0; x < SIZE; x++) reach.push([x, 30]);
  while (reach.length) {
    const [x, y] = reach.pop();
    if (y > 30 || !open(x, y) || outside[y][x]) continue;
    outside[y][x] = true;
    NEIGHBORS.forEach(([dx, dy]) => reach.push([x + dx, y + dy]));
  }
  for (let y = 0; y < 30; y++) for (let x = 0; x < SIZE; x++) if (open(x, y) && !outside[y][x]) g[y][x] = hairLayer[y][x] ?? HAIR.dark;
  return g;
};
const inDisc = (cx, cy, r) => (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r + r;
const sideHair = (x, y) => x <= 18 || x >= 43;

/** Each hair style: the front layer (over the face) and, for long styles, the back layer (behind the body). */
const HAIR_DRAW = {
  short: () => ({ front: clone(hairLayer) }),
  twintails: () => ({ front: twinTails() }),
  // Drawn by SpriteCook on the base sprite (spritecook/long-hair-edit.png): bangs, and straight locks that fall in front
  // of the shoulders to the hoodie hem. All of it is in front of the body, so there is no back layer (no cape).
  long: () => ({ front: hairFromEdit('long-hair-edit.png') }),
  // Drawn by SpriteCook on the base sprite (spritecook/ponytail-edit.png, 2 pixels to the right): a high tail tied on
  // the top of the head that arcs out to the left and curls at the chin. Its red tie is drawn in `finishHair`.
  ponytail: () => ({ front: hairFromEdit('ponytail-edit.png', -2) }),
  // Drawn by SpriteCook (spritecook/bob-edit.png, 1 pixel to the right): chin-length with blunt bangs and full sides.
  bob: () => ({ front: hairFromEdit('bob-edit.png', -1) }),
  buns: () => {
    const front = clone(hairLayer);
    for (const [cx, cy] of [[20, 5], [42, 5]]) fillHair(front, inDisc(cx, cy, 5), [cx - 6, cx + 6, 0, 11]);
    return { front };
  },
  // Drawn by SpriteCook (spritecook/braid-edit.png): side-swept bangs and one braid over the shoulder to the waist.
  braid: () => ({ front: hairFromEdit('braid-edit.png') }),
  // Drawn by SpriteCook (spritecook/curly-edit.png, 1 pixel to the right): a fluffy cloud of curls down to the jaw.
  curly: () => ({ front: hairFromEdit('curly-edit.png', -1) }),
};

/** Ties and bows in fixed colors (after the hair is recolored), then the outline. */
const finishHair = (style, front) => {
  if (style === 'twintails') return tailBows(front);
  if (style === 'ponytail') {
    // The tie of ponytail-edit.png: a short diagonal band where the tail leaves the head.
    pts(front, [[21, 7], [20, 8], [19, 9], [22, 7], [21, 8], [20, 9]], '#e5484d');
    pts(front, [[22, 7], [21, 7]], '#ff8a8f');
  }
  return outline(front, (x, y) => outsideBase(x, y) || (sideHair(x) && y >= 9) || y <= 11);
};

// ---- 3c. top styles: every style is the SpriteCook hoodie with its hood, pattern or sleeves changed --------------
const TOP_BASE = { k: '#d94540', l: '#bb3f3c', j: '#a72934', i: '#7d322f' };
const DRAWSTRING = '#fcfbfb';
const isSleeve = (x) => x <= 22 || x >= 42;
const topStyle = (style, color) => {
  const ramp = color ? ramps.top(color) : null;
  const c = Object.fromEntries(Object.entries(TOP_BASE).map(([k, v]) => [k, ramp?.[v] ?? v]));
  const g = recolor(BASE_LAYERS.top, ramp);
  if (style === 'hoodie') return g;
  const each = (fn) => {
    for (let y = 30; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (g[y][x] && g[y][x] !== INK) fn(x, y, g[y][x]);
  };
  if (style === 'jacket') {
    each((x, y, px) => {
      if (px === DRAWSTRING) g[y][x] = c.k;
      if (y >= 34 && y <= 49 && x >= 30 && x <= 34) g[y][x] = x === 30 || x === 34 ? c.i : y % 2 ? '#f1f1f4' : '#e2e3ea';
    });
    rect(g, 25, 43, 3, 2, c.i);
    rect(g, 37, 43, 3, 2, c.i);
    return g;
  }
  // Sweater, stripes and varsity: a crew neck with ribbed cuffs and hem instead of the hood.
  each((x, y, px) => {
    if (px === DRAWSTRING) g[y][x] = c.k;
    else if (y <= 31) g[y][x] = c.j;
    else if (y <= 35) g[y][x] = [c.j, c.i, '#3b1812', '#1e0c0a'].includes(px) ? c.l : c.k;
    if (y >= 46 && y <= 48) g[y][x] = x % 2 ? c.j : c.l;
  });
  if (style === 'sweater') each((x, y, px) => y >= 36 && y <= 45 && (x + y) % 4 === 0 && px === c.k && (g[y][x] = c.l));
  if (style === 'stripes') {
    const stripe = mix(color ?? TOP_BASE.k, '#ffffff', 0.78);
    each((x, y, px) => y >= 36 && y <= 45 && Math.floor((y - 36) / 2) % 2 === 1 && (g[y][x] = px === c.k ? stripe : mix(stripe, '#000000', 0.15)));
  }
  if (style === 'varsity') {
    const cream = { [c.k]: '#efe6d2', [c.l]: '#ddd2bb', [c.j]: '#c9bda3', [c.i]: '#a89c84' };
    each((x, y, px) => isSleeve(x) && y >= 34 && (g[y][x] = y >= 46 && y <= 48 ? (x % 2 ? c.j : c.k) : cream[px] ?? '#efe6d2'));
    rect(g, 25, 38, 4, 1, '#efe6d2');
    rect(g, 26, 39, 2, 4, '#efe6d2');
  }
  return g;
};

// ---- 3d. bottom styles --------------------------------------------------------------------------------------------
const PANTS_P = '#324265';
const PANTS_O = '#192a4b';
const socks = (g, from = 56) => {
  for (let y = from; y <= 58; y++)
    for (let x = 0; x < SIZE; x++) {
      if (g[y][x] === PANTS_P) g[y][x] = '#f4f5f8';
      if (g[y][x] === PANTS_O) g[y][x] = '#c9cdd6';
    }
};
const bottomStyle = (style, color) => {
  const dark = mix(color, '#000000', 0.3);
  const light = mix(color, '#ffffff', 0.3);
  if (['jeans', 'cargo', 'shorts', 'joggers', 'ripped'].includes(style)) {
    const g = recolor(BASE_LAYERS.bottom, { [PANTS_P]: color, [PANTS_O]: dark });
    if (style === 'joggers')
      for (let y = 52; y <= 58; y++) {
        const row = g[y].map((c, x) => (c && c !== INK ? x : -1)).filter((x) => x >= 0);
        if (y >= 57) row.forEach((x) => (g[y][x] = x % 2 ? dark : mix(color, '#000000', 0.15)));
        else if (row.length) for (const x of [row[0], row[row.length - 1]]) g[y][x] = '#f4f5f8';
      }
    if (style === 'ripped') {
      for (let x = 0; x < SIZE; x++) if (g[58][x] === color || g[58][x] === dark) g[58][x] = light;
      for (const x0 of [24, 36]) {
        rect(g, x0, 55, 4, 1, '#e3e9f2');
        pts(g, [[x0 + 1, 56], [x0 + 3, 56]], '#e3e9f2');
      }
    }
    if (style === 'jeans') {
      for (let x = 0; x < SIZE; x++) if (g[58][x] === color || g[58][x] === dark) g[58][x] = light;
      for (const x of [27, 38]) for (let y = 53; y <= 57; y++) if (g[y][x] === color) g[y][x] = '#d9a441';
    }
    if (style === 'cargo')
      for (const x0 of [22, 39]) {
        rect(g, x0, 54, 3, 3, dark);
        rect(g, x0, 54, 3, 1, mix(color, '#000000', 0.5));
      }
    if (style === 'shorts') {
      for (let y = 53; y <= 58; y++) for (let x = 0; x < SIZE; x++) if (g[y][x] === color || g[y][x] === dark) g[y][x] = y === 55 ? dark : y > 55 ? PANTS_P : g[y][x];
      socks(g);
    }
    return g;
  }
  const g = clone(BASE_LAYERS.bottom);
  const last = style === 'midi' ? 58 : style === 'tiered' || style === 'frilly' ? 56 : 55;
  for (let y = 50; y <= last; y++) for (let x = 0; x < SIZE; x++) if (y < 56 || g[y][x] !== INK || style === 'midi') g[y][x] = null;
  for (let y = 51; y <= last; y++) {
    const grow =
      style === 'midi'
        ? Math.round((y - 51) * 0.7)
        : style === 'tutu' || style === 'frilly'
          ? Math.min(4, y - 50) + 1
          : style === 'denim' || style === 'buttoned'
            ? Math.round((y - 51) * 0.5)
            : style === 'tiered'
              ? 1 + 2 * Math.floor((y - 51) / 2)
              : y - 51;
    const from = 22 - grow;
    const to = 42 + grow;
    for (let x = from; x <= to; x++) {
      let px = color;
      if (style === 'pleated') px = (x - from) % 4 === 0 ? dark : y === 55 ? mix(color, '#000000', 0.15) : color;
      if (style === 'plaid') px = x % 4 === 0 && y % 3 === 0 ? mix(color, '#000000', 0.45) : x % 4 === 0 ? dark : y % 3 === 0 ? light : color;
      if (style === 'tutu') px = y % 2 ? light : color;
      if (style === 'midi') px = (x - from) % 6 === 3 ? mix(color, '#000000', 0.15) : y === last ? dark : color;
      if (style === 'denim') px = x === 32 ? dark : y === 53 && x % 2 ? '#d9a441' : y === last ? light : color;
      if (style === 'tiered') px = (y - 51) % 2 ? dark : light;
      if (style === 'buttoned') px = x === 32 && y % 2 === 0 ? '#ffd23f' : color;
      if (style === 'frilly') px = y >= 55 ? '#f7f0f5' : color;
      g[y][x] = y === 51 ? dark : px;
    }
    put(g, from + 1, y, light);
  }
  if (style === 'tutu') for (let x = 16; x <= 48; x++) if (x % 3 !== 1) put(g, x, 56, light);
  if (style === 'tiered' || style === 'frilly') for (let x = 0; x < SIZE; x++) if (x % 3 === 1 && g[56][x]) g[56][x] = null;
  if (style === 'tiered') for (let y = 51; y <= 56; y += 2) for (let x = 0; x < SIZE; x++) if (g[y][x] === light) g[y][x] = color;
  if (style === 'frilly') {
    rect(g, 29, 52, 2, 2, dark);
    rect(g, 34, 52, 2, 2, dark);
    rect(g, 31, 52, 3, 1, dark);
  }
  if (style !== 'midi') socks(g);
  return outline(g, (x, y) => y >= 50 && y <= 58);
};

// ---- 3e. accessories (worn over the body, under the hair) ---------------------------------------------------------
const drawAccessory = (name) => {
  const g = blank();
  if (name.startsWith('scarf')) {
    const color = name === 'scarf-red' ? '#d64545' : '#efe3c8';
    const dark = mix(color, '#000000', 0.3);
    const light = mix(color, '#ffffff', 0.35);
    rect(g, 24, 31, 16, 1, light);
    rect(g, 22, 32, 20, 2, color);
    rect(g, 23, 34, 18, 1, dark);
    for (let x = 22; x <= 41; x += 3) pts(g, [[x, 32], [x, 33]], mix(color, '#000000', 0.12));
    rect(g, 32, 33, 4, 4, color);
    rect(g, 32, 36, 4, 1, dark);
    rect(g, 32, 37, 3, 8, color);
    rect(g, 36, 37, 3, 6, mix(color, '#000000', 0.12));
    for (const [x, y] of [[32, 45], [34, 45], [36, 43], [38, 43]]) put(g, x, y, light);
    return outline(g);
  }
  if (name === 'bag-crossbody') {
    for (let i = 0; i <= 14; i++) rect(g, 24 + i, 33 + Math.round(i * 0.8), 2, 1, '#5b3a29');
    rect(g, 31, 44, 10, 7, '#a0673d');
    rect(g, 31, 44, 10, 3, '#7c4a2a');
    rect(g, 40, 44, 1, 7, '#7c4a2a');
    rect(g, 35, 46, 2, 2, '#ffd23f');
    return outline(g);
  }
  if (name === 'necklace-pearl') {
    for (let x = 25; x <= 39; x += 2) {
      const y = 33 + Math.round(4 * Math.sin((Math.PI * (x - 25)) / 14));
      put(g, x, y, '#f7f3ea');
      put(g, x, y + 1, '#b9b2a6');
    }
    rect(g, 31, 38, 2, 2, '#ffd23f');
    put(g, 31, 38, '#fff3b0');
    return g;
  }
  if (name === 'brooch-star') {
    const star = ['..X..', 'XXXXX', '.XXX.', '.X.X.', 'X...X'];
    star.forEach((row, dy) => [...row].forEach((ch, dx) => ch === 'X' && put(g, 25 + dx, 38 + dy, dy >= 3 ? '#c9a227' : '#ffd23f')));
    put(g, 27, 39, '#ffffff');
    return outline(g);
  }
  if (name === 'tie-red') {
    rect(g, 31, 32, 3, 2, '#9e2424');
    for (let y = 34; y <= 46; y++) {
      const w = y >= 44 ? 46 - y : 1;
      for (let x = 32 - w; x <= 32 + w; x++) put(g, x, y, (x + y) % 3 === 0 ? '#e86060' : '#c63434');
    }
    return outline(g);
  }
  if (name === 'bowtie-black') {
    for (let i = 0; i <= 3; i++) {
      rect(g, 27 + i, 33 - Math.floor(i / 2), 1, 2 + Math.floor(i / 2) * 2, '#2a2a30');
      rect(g, 37 - i, 33 - Math.floor(i / 2), 1, 2 + Math.floor(i / 2) * 2, '#2a2a30');
    }
    rect(g, 31, 33, 3, 2, '#45454f');
    return outline(g);
  }
  if (name === 'belt-brown') {
    rect(g, 23, 47, 19, 2, '#5b3a29');
    rect(g, 30, 46, 4, 4, '#ffd23f');
    rect(g, 31, 47, 2, 2, '#5b3a29');
    return g;
  }
  if (name === 'medal-gold') {
    for (let i = 0; i <= 7; i++) {
      put(g, 27 + Math.round(i * 0.5), 32 + i, '#3a86ff');
      put(g, 37 - Math.round(i * 0.5), 32 + i, '#2f6fd6');
    }
    for (let y = -3; y <= 3; y++) for (let x = -3; x <= 3; x++) if (x * x + y * y <= 10) put(g, 32 + x, 43 + y, y < 0 ? '#ffe066' : '#e0b030');
    pts(g, [[32, 42], [31, 43], [32, 43], [33, 43], [32, 44]], '#fff6c2');
    return outline(g);
  }
  if (name === 'suspenders-red') {
    rect(g, 26, 33, 2, 15, '#c0392b');
    rect(g, 37, 33, 2, 15, '#c0392b');
    rect(g, 26, 46, 2, 2, '#ffd23f');
    rect(g, 37, 46, 2, 2, '#ffd23f');
    return g;
  }
  if (name === 'name-tag') {
    rect(g, 34, 38, 7, 6, '#ffffff');
    rect(g, 34, 38, 7, 2, '#e5484d');
    rect(g, 35, 41, 5, 1, '#9aa3b5');
    return outline(g);
  }
  if (name === 'heart-locket') {
    for (let x = 26; x <= 38; x++) put(g, x, 33 + Math.round(4 * Math.sin((Math.PI * (x - 26)) / 12)), '#e0b030');
    const heart = ['.X.X.', 'XXXXX', '.XXX.', '..X..'];
    heart.forEach((row, dy) => [...row].forEach((ch, dx) => ch === 'X' && put(g, 30 + dx, 38 + dy, '#ff5d8f')));
    put(g, 31, 39, '#ffc2d6');
    return g;
  }
  throw new Error(`Unknown accessory ${name}`);
};

// ---- 3f. shoes (their own layer, over the trousers) ---------------------------------------------------------------
const FEET = [[22, 28], [35, 42]];
const shoeStyle = (style, color) => {
  if (style === 'sneakers') return recolor(BASE_LAYERS.shoes, color && { '#724132': color, '#51281f': mix(color, '#000000', 0.25) });
  const g = blank();
  const dark = mix(color, '#000000', 0.3);
  const light = mix(color, '#ffffff', 0.35);
  for (const [x0, x1] of FEET) {
    const w = x1 - x0 + 1;
    if (style === 'boots') {
      rect(g, x0, 55, w, 7, color);
      rect(g, x0, 55, w, 1, light);
      rect(g, x1, 56, 1, 6, dark);
      rect(g, x0, 62, w, 1, '#2a2320');
    }
    if (style === 'maryjanes') {
      rect(g, x0, 60, w, 2, color);
      rect(g, x0, 62, w, 1, dark);
      rect(g, x0 + 1, 59, w - 2, 1, dark);
      put(g, x0 + 3, 59, '#ffd23f');
      put(g, x0 + 1, 60, light);
    }
    if (style === 'hightops') {
      rect(g, x0, 56, w, 5, color);
      rect(g, x0, 61, w, 1, '#f4f5f8');
      rect(g, x0, 62, w, 1, '#c9cdd6');
      for (const y of [57, 59]) put(g, x0 + 3, y, '#f4f5f8');
      put(g, x0 + 1, 57, light);
    }
  }
  return outline(g);
};

// ---- 3g. one-piece dresses: a crew-neck top with a flared skirt, built for both arm positions ---------------------
// The sailor, pinafore, belted and princess dresses copy the SpriteCook reference sheet spritecook/skirts-dresses-ref.png.
const WHITE = '#f4f5f8';
const CREAM = '#efe6d2';
const dressStyle = (style, color) => {
  const ramp = ramps.top(color);
  const k = ramp[TOP_BASE.k];
  const l = ramp[TOP_BASE.l];
  const j = ramp[TOP_BASE.j];
  const i = ramp[TOP_BASE.i];
  const pinafore = style === 'dress-pinafore';
  const princess = style === 'dress-princess';
  // Sleeves (they move with the arms): cuffs drawn before the arms are raised.
  const crew = topStyle('crew', pinafore ? CREAM : color);
  const cuff = { 'dress-sailor': WHITE, 'dress-belted': CREAM, 'dress-princess': CREAM }[style];
  if (cuff) for (let y = 44; y <= 45; y++) for (let x = 0; x < SIZE; x++) if (isSleeve(x) && crew[y][x] && crew[y][x] !== INK) crew[y][x] = cuff;
  // No hood: the hoodie's hood lies on the shoulders, so above the hanging arms only a sloping shoulder line is kept.
  // Cut before the arms are raised, or the raised arms (above the shoulders then) would be cut too.
  for (let y = 0; y <= 35; y++) for (let x = 0; x < SIZE; x++) if (crew[y][x] && Math.abs(x - 32) > 4 + (y - 30) * 2.6) crew[y][x] = null;
  const finish = (g) => {
    // A smooth fitted bodice: the hoodie pocket and seams go, the right side stays in shadow, a seam marks a high
    // waist. (The pinafore keeps its cream blouse here; the brown bib goes over it below.)
    const blouse = pinafore ? CREAM : k;
    for (let y = 33; y <= 41; y++)
      for (let x = 23; x <= 41; x++) {
        if (!g[y][x] || g[y][x] === INK) continue;
        g[y][x] = y === 41 && !pinafore ? j : x >= 40 ? mix(blouse, '#000000', 0.12) : blouse;
      }
    // A bell skirt gathered at the waist: it flares fast under the waist then falls straight, with soft folds that
    // fan out (light, then shadow), a darker hem and rounded hem corners. Hanging arms stay in front of it.
    const last = princess ? 58 : 56;
    const flare = princess ? 9 : 6;
    for (let y = 42; y <= last; y++) {
      const t = (y - 42) / (last - 42);
      const left = 23 - Math.round(flare * t ** 0.7);
      const right = 41 + Math.round(flare * t ** 0.7);
      const corner = y === last ? 1 : 0;
      for (let x = left + corner; x <= right - corner; x++) {
        if (isSleeve(x) && g[y][x] && y <= 51) continue;
        const u = (x - left) / (right - left);
        const fold = [0.2, 0.4, 0.6, 0.8].some((f) => Math.abs(u - f) * (right - left) < 0.5);
        const shade = [0.2, 0.4, 0.6, 0.8].some((f) => Math.abs(u - f - 1 / (right - left)) * (right - left) < 0.5);
        let c = x >= right - 1 ? l : k;
        if (y >= 44 && fold) c = mix(k, '#ffffff', 0.18);
        else if (y >= 44 && shade) c = l;
        if (y >= last - 1) c = y === last ? i : j;
        g[y][x] = c;
      }
    }
    if (style === 'dress-sailor') {
      rect(g, 22, 31, 21, 4, WHITE);
      rect(g, 23, 32, 19, 1, k);
      for (let y = 33; y <= 36; y++) rect(g, 30 + (y - 33), y, 5 - 2 * (y - 33) > 0 ? 5 - 2 * (y - 33) : 1, 1, k);
      rect(g, 28, 36, 3, 3, '#d64545');
      rect(g, 34, 36, 3, 3, '#d64545');
      rect(g, 31, 36, 3, 2, '#a72934');
      pts(g, [[31, 38], [33, 38], [30, 39], [34, 39]], '#d64545');
      for (const y of [52, 54]) for (let x = 0; x < SIZE; x++) if (g[y][x] && g[y][x] !== INK) g[y][x] = WHITE;
    }
    if (pinafore) {
      rect(g, 25, 36, 15, 6, k);
      rect(g, 25, 36, 15, 1, l);
      rect(g, 28, 38, 9, 2, l);
      for (const x of [26, 37]) {
        rect(g, x, 32, 2, 4, k);
        put(g, x, 36, '#ffd23f');
      }
    }
    if (style === 'dress-belted') {
      for (let x = 27; x <= 37; x++) rect(g, x, 31, 1, x === 27 || x === 37 ? 2 : 3, CREAM);
      for (const y of [35, 38]) put(g, 32, y, CREAM);
      rect(g, 23, 40, 19, 2, '#5b3a29');
      rect(g, 30, 39, 4, 4, '#ffd23f');
      rect(g, 31, 40, 2, 2, '#5b3a29');
      for (let x = 13; x <= 51; x++) if (g[56][x] === i && x % 2) g[56][x] = CREAM;
    }
    if (princess) {
      // A cream underskirt showing in a widening slit down the front, and a bow at the waist.
      for (let y = 46; y <= 58; y++) {
        const half = Math.round((y - 45) * 0.7);
        for (let x = 32 - half; x <= 32 + half; x++) if (g[y][x]) g[y][x] = y === 58 ? mix(CREAM, '#000000', 0.15) : CREAM;
      }
      rect(g, 29, 40, 7, 3, l);
      rect(g, 31, 40, 3, 3, i);
      rect(g, 31, 32, 2, 2, '#ffd23f');
    }
    if (style === 'dress-collar') {
      for (const x0 of [26, 33]) {
        rect(g, x0, 32, 6, 3, '#f7f7fb');
        rect(g, x0, 34, 6, 1, '#d7dbe8');
      }
      for (const y of [36, 39]) put(g, 32, y, '#f7f7fb');
    }
    if (style === 'dress-polka')
      for (let y = 36; y <= 55; y++) for (let x = 0; x < SIZE; x++) if ((g[y][x] === k || g[y][x] === l) && x % 5 === 0 && y % 4 === 0) g[y][x] = '#f7f7fb';
    // Outlined again where the hood was cut and around the skirt.
    return outline(g, (x, y) => y >= 42 || y <= 36);
  };
  return { down: finish(clone(crew)), up: finish(raiseArms(crew)) };
};

// ---- 3h. worn on the back: wings and capes ------------------------------------------------------------------------
const drawBack = (name) => {
  const g = blank();
  const both = (fn) => {
    for (let y = 0; y < SIZE; y++)
      for (let x = 0; x <= 17; x++) {
        const c = fn(x, y);
        if (c) {
          put(g, x, y, c);
          put(g, 61 - x, y, c);
        }
      }
  };
  if (name === 'angel-wings')
    both((x, y) => {
      const top = 26 - Math.round((16 - x) * 0.5);
      const bottom = 38 - Math.round((16 - x) * 0.2) - (x % 3 === 0 ? 2 : 0);
      if (x < 1 || x > 16 || y < top || y > bottom) return null;
      return y === bottom ? '#cfd3e3' : x % 3 === 0 && y > top + 2 ? '#dfe3ee' : '#f7f7fb';
    });
  if (name === 'bat-wings')
    both((x, y) => {
      const top = 24 - Math.round((16 - x) * 0.4);
      const bottom = 34 + (x % 5 === 0 ? 4 : x % 5 === 1 || x % 5 === 4 ? 2 : 0);
      if (x < 1 || x > 16 || y < top || y > bottom) return null;
      return x % 5 === 0 ? '#251a33' : y === top ? '#5a4673' : '#3b2a4f';
    });
  if (name === 'fairy-wings')
    both((x, y) => {
      const lobes = [[8, 26, 6], [10, 37, 4]];
      const inside = (px, py) => lobes.some(([cx, cy, r]) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r + r);
      if (x > 16 || !inside(x, y)) return null;
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1);
      return edge ? '#ff9bd2' : (x + y) % 5 === 0 ? '#e8f8ff' : '#bfe9ff';
    });
  if (name.startsWith('cape')) {
    const cloth = name === 'cape-red' ? '#c0392b' : '#6b3fa0';
    for (let y = 30; y <= 60; y++) {
      const half = 14 + Math.round((y - 30) * 0.3);
      for (let x = Math.ceil(30.5 - half); x <= Math.floor(30.5 + half); x++) {
        if (y > 59 + ((x % 6) < 3 ? 0 : 1)) continue;
        put(g, x, y, x % 5 === 0 ? mix(cloth, '#000000', 0.3) : cloth);
      }
    }
  }
  return outline(g);
};

// ---- 3i. effects: small glyphs floating around the avatar ---------------------------------------------------------
const GLYPHS = {
  hearts: [['.X.X.', 'XXXXX', 'XXXXX', '.XXX.', '..X..'], { X: '#ff5d8f' }],
  stars: [['..X..', '..X..', 'XXXXX', '.XXX.', '.X.X.'], { X: '#ffd23f' }],
  notes: [['.XXXX', '.X..X', '.X..X', 'XX.XX', 'XX.XX'], { X: '#c9b3ff' }],
  snow: [['X.X.X', '.XXX.', 'XXXXX', '.XXX.', 'X.X.X'], { X: '#e6f7ff' }],
  bubbles: [['.XX.', 'X..X', 'X..X', '.XX.'], { X: '#9fdcff' }],
  flames: [['..X..', '.XX..', '.XXX.', 'XXXXX', 'XXYXX', '.XYX.'], { X: '#ff7a2f', Y: '#ffd23f' }],
  leaves: [['..XX', '.XYX', 'XXX.', 'X...'], { X: '#4caf50', Y: '#7fd47f' }],
};
const EFFECT_SPOTS = [[3, 10], [56, 6], [1, 30], [58, 26], [5, 46], [55, 44]];
const FLAME_SPOTS = [[8, 50], [52, 50], [3, 56], [57, 56]];
const drawEffect = (name) => {
  const g = blank();
  const [rows, colors] = GLYPHS[name];
  for (const [x0, y0] of name === 'flames' ? FLAME_SPOTS : EFFECT_SPOTS)
    rows.forEach((row, dy) => [...row].forEach((ch, dx) => colors[ch] && put(g, x0 + dx, y0 + dy, colors[ch])));
  return name === 'bubbles' ? g : outline(g);
};

// ---- 4. write every item ------------------------------------------------------------------------------------------
const pad = (g) => [
  ...Array.from({ length: OUT_H - g.length }, () => Array(OUT_W).fill(null)),
  ...g.map((row) => [...Array(SIDE).fill(null), ...row, ...Array(SIDE).fill(null)]),
];
const save = (path, g) => {
  mkdirSync(dirname(join(OUT, path)), { recursive: true });
  writeFileSync(join(OUT, path), toPng(pad(g)));
};

for (const [name, color] of Object.entries(SKINS)) {
  const ramp = color && ramps.skin(color);
  const skin = { h: color ?? '#f9c7a4', g: ramp ? ramp['#e59d81'] : '#e59d81' };
  for (const face of FACES)
    for (const pose of POSES) {
      let g = recolor(BASE_LAYERS.body, ramp);
      drawFace(g, pose, skin, face);
      if (pose === 'typing')
        for (const x0 of [17, 41]) {
          rect(g, x0, 39, 7, 5, INK);
          rect(g, x0 + 1, 40, 5, 3, skin.h);
          rect(g, x0 + 1, 42, 5, 1, skin.g);
        }
      if (pose === 'win') g = raiseArms(g);
      save(bodyFile({ skin: name, face }, pose), g);
    }
}
const hairItems = [];
const hairWithBack = new Set();
for (const style of HAIR_STYLES) {
  const { front, back } = HAIR_DRAW[style]();
  for (const [name, color] of Object.entries(HAIRS)) {
    const ramp = color && ramps.hair(color);
    const id = `${style}-${name}`;
    hairItems.push(id);
    save(`hair/${id}.png`, finishHair(style, recolor(front, ramp)));
    if (back) {
      hairWithBack.add(id);
      save(`hair-back/${id}.png`, outline(recolor(back, ramp)));
    }
  }
}
const topItems = [];
for (const style of TOP_STYLES)
  for (const [name, color] of Object.entries(TOPS)) {
    const id = style === 'hoodie' ? name : `${style}-${name}`;
    topItems.push(id);
    const g = topStyle(style, color);
    save(`top/${id}-down.png`, g);
    save(`top/${id}-up.png`, raiseArms(g));
  }
for (const style of DRESS_STYLES)
  for (const [name, color] of Object.entries(TOPS)) {
    const id = `${style}-${name}`;
    topItems.push(id);
    const { down, up } = dressStyle(style, color ?? TOP_BASE.k);
    save(`top/${id}-down.png`, down);
    save(`top/${id}-up.png`, up);
  }
for (const [name, color] of Object.entries(BOTTOMS)) save(`bottom/${name}.png`, recolor(BASE_LAYERS.bottom, color && ramps.bottom(color)));
for (const [name, [style, color]] of Object.entries(SKIRTS)) save(`bottom/${name}.png`, bottomStyle(style, color));
for (const [name, [style, color]] of Object.entries(SHOES)) save(`shoes/${name}.png`, shoeStyle(style, color));
for (const name of HEADWEARS) save(`headwear/${name}.png`, drawHeadwear(name));
for (const name of ACCESSORIES) save(`accessory/${name}.png`, drawAccessory(name));
for (const name of BACKS) save(`back/${name}.png`, drawBack(name));
for (const name of EFFECTS) save(`effect/${name}.png`, drawEffect(name));
for (const pose of ['typing', 'win', 'lose']) save(`fx/${pose}.png`, fxFor(pose));

/** Which file each layer uses for one avatar in one pose: the same rule the app follows. */
const layerFiles = (look, pose) => ({
  back: look.back ? `back/${look.back}.png` : null,
  hairBack: hairWithBack.has(look.hair) ? `hair-back/${look.hair}.png` : null,
  bottom: `bottom/${look.bottom}.png`,
  shoes: `shoes/${look.shoes ?? 'sneakers-brown'}.png`,
  top: `top/${look.top}-${pose === 'win' ? 'up' : 'down'}.png`,
  body: bodyFile(look, pose),
  accessory: look.accessory ? `accessory/${look.accessory}.png` : null,
  hair: `hair/${look.hair}.png`,
  headwear: look.headwear ? `headwear/${look.headwear}.png` : null,
  effect: look.effect ? `effect/${look.effect}.png` : null,
  fx: pose === 'idle' ? null : `fx/${pose}.png`,
});

writeFileSync(
  join(OUT, 'manifest.json'),
  JSON.stringify(
    {
      size: { width: OUT_W, height: OUT_H, note: `the body frame is ${SIZE}x${SIZE}, offset ${SIDE}px right and ${HEAD}px down` },
      layerOrder: LAYER_ORDER,
      poses: POSES,
      files: {
        back: 'back/{back}.png (optional)',
        hairBack: 'hair-back/{hair}.png (only the hair items listed in hairWithBack)',
        bottom: 'bottom/{bottom}.png',
        shoes: 'shoes/{shoes}.png (default sneakers-brown)',
        top: 'top/{top}-{arms}.png (arms: up in the win pose, down otherwise; dress-* items also cover the hips)',
        body: 'body/{skin}-{pose}.png, or body/{skin}-cute-{pose}.png with the cute face',
        accessory: 'accessory/{accessory}.png (optional)',
        hair: 'hair/{hair}.png',
        headwear: 'headwear/{headwear}.png (optional)',
        effect: 'effect/{effect}.png (optional)',
        fx: 'fx/{pose}.png (not for idle)',
      },
      hairWithBack: [...hairWithBack],
      slots: {
        skin: Object.keys(SKINS),
        face: FACES,
        hair: hairItems,
        top: topItems,
        bottom: [...Object.keys(BOTTOMS), ...Object.keys(SKIRTS)],
        shoes: Object.keys(SHOES),
        headwear: HEADWEARS,
        accessory: ACCESSORIES,
        back: BACKS,
        effect: EFFECTS,
      },
      presets: PRESETS,
    },
    null,
    2,
  ) + '\n',
);

// ---- 4b. the item lists the app reads: one for the backend (which items exist in which slot), one for the frontend --
const manifest = JSON.parse(readFileSync(join(OUT, 'manifest.json'), 'utf8'));
const GENERATED = '// Generated by minigame-sprites/build-layers.mjs, do not edit: change the script and run it again.\n';
writeFileSync(
  join(ROOT, 'BE', 'src', 'data', 'avatar-items.ts'),
  `${GENERATED}// Every avatar item, by slot (the images are in FE/public/avatar).\nexport const AVATAR_SLOTS = ${JSON.stringify(manifest.slots, null, 2)} as const;\n`,
);
mkdirSync(join(ROOT, 'FE', 'src', 'modules', 'avatar', 'data'), { recursive: true });
writeFileSync(
  join(ROOT, 'FE', 'src', 'modules', 'avatar', 'data', 'avatar-manifest.ts'),
  `${GENERATED}// How to stack the avatar layers of /avatar (FE/public/avatar): see layers.ts.\nexport const AVATAR_MANIFEST = ${JSON.stringify(
    {
      width: manifest.size.width,
      height: manifest.size.height,
      layerOrder: manifest.layerOrder,
      poses: manifest.poses,
      hairWithBack: manifest.hairWithBack,
      slots: manifest.slots,
      presets: manifest.presets,
    },
    null,
    2,
  )} as const;\n`,
);

// ---- 5. preview: the presets in every pose, then a few mixed outfits ----------------------------------------------
const compose = (look, pose) => {
  const g = Array.from({ length: OUT_H }, () => Array(OUT_W).fill(null));
  for (const file of Object.values(layerFiles(look, pose))) {
    if (!file) continue;
    readPng(join(OUT, file)).forEach((row, y) => row.forEach((c, x) => c && (g[y][x] = c)));
  }
  return g;
};
const writeSheet = (file, rows, cols) => {
  const CW = OUT_W + 4;
  const CH = OUT_H + 4;
  const sheet = Array.from({ length: CH * rows.length }, () => Array(CW * cols).fill('#2a2140'));
  rows.forEach((row, r) =>
    row.forEach((g, col) => g.forEach((line, y) => line.forEach((c, x) => c && (sheet[r * CH + 2 + y][col * CW + 2 + x] = c)))),
  );
  writeFileSync(join(HERE, file), toPng(sheet, 2));
};
writeSheet('preview.png', Object.values(PRESETS).map((look) => POSES.map((pose) => compose(look, pose))), POSES.length);

// The catalog shows every style once on a plain avatar.
const plain = { skin: 'peach', hair: 'short-brown', top: 'red', bottom: 'navy' };
const hairColors = Object.keys(HAIRS);
const topColors = Object.keys(TOPS);
const COLS = 8;
const looks = [
  ...HAIR_STYLES.map((style, i) => ({ ...plain, skin: Object.keys(SKINS)[i % 6], hair: `${style}-${hairColors[i % 6]}` })),
  ...TOP_STYLES.map((style, i) => ({ ...plain, top: style === 'hoodie' ? 'mint' : `${style}-${topColors[i + 1]}` })),
  ...DRESS_STYLES.map((style, i) => ({
    ...plain,
    hair: 'long-brown',
    top: `${style}-${['orange', 'pink', 'mint', 'navy', 'brown', 'green', 'pink'][i]}`,
    bottom: 'tights-white',
    shoes: 'maryjanes-black',
  })),
  ...['tiered-pink', 'buttoned-navy', 'frilly-lilac', 'skirt-rose', 'plaid-red', 'tutu-lilac', 'midi-olive', 'denim-skirt', 'jeans-blue', 'ripped-light', 'cargo-khaki', 'shorts-denim', 'joggers-gray', 'tights-black', 'navy'].map(
    (bottom) => ({ ...plain, bottom }),
  ),
  ...['sneakers-red', 'boots-brown', 'boots-white', 'maryjanes-red', 'maryjanes-pink', 'hightops-blue', 'hightops-black', 'sneakers-white'].map((shoes) => ({ ...plain, shoes })),
  ...ACCESSORIES.map((accessory) => ({ ...plain, top: 'navy', accessory })),
  ...HEADWEARS.map((headwear) => ({ ...plain, headwear })),
  ...BACKS.map((back) => ({ ...plain, back })),
  ...EFFECTS.map((effect) => ({ ...plain, effect })),
];
const catalog = [];
for (let i = 0; i < looks.length; i += COLS) catalog.push(looks.slice(i, i + COLS).map((look) => compose(look, 'idle')));
writeSheet('catalog.png', catalog, COLS);
console.log(`Wrote layers to ${OUT}`);
