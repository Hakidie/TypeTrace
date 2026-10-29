// Draws Ping, the TypeTrace mascot (the guide of the tutorials): a chibi cyberpunk kid drawn pixel by pixel, no image
// tools, on 64x88 frames (the avatars use a 64x64 body). Each move is a strip of 4 frames, played with CSS steps(4).
// Run: node minigame-sprites/draw-ping.mjs
// Output: FE/public/mascot/ping-<move>.png (served as /mascot/...), moves: idle, talk, happy, sad, point, typing.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

const W = 64;
const H = 88;
/** Room above the head for the hair spikes. */
const OY = 6;
const PAL = {
  K: [20, 6, 8], // outline
  H: [46, 31, 36], // hoodie
  h: [30, 20, 24], // hoodie shadow
  j: [64, 44, 50], // hoodie light
  R: [255, 46, 69], // neon red
  r: [150, 18, 30], // dark red
  W: [240, 236, 242], // hair
  w: [180, 170, 188], // hair shadow
  x: [138, 128, 148], // hair deep shadow
  S: [246, 204, 172], // skin
  s: [220, 160, 130], // skin shadow
  v: [58, 6, 12], // visor glass
  q: [86, 12, 22], // visor scanline
  E: [255, 234, 238], // light glyphs
  P: [58, 58, 68], // headphones
  p: [118, 118, 132], // headphone light
  M: [196, 199, 209], // robot arm
  n: [150, 153, 165], // robot arm shadow
  m: [104, 107, 118], // robot joints
  B: [238, 238, 244], // sneakers
  b: [170, 170, 184], // sneaker shadow
  D: [62, 22, 28], // pants, mouth
  e: [92, 36, 44], // pants light
  d: [44, 14, 19], // pants shadow
  C: [255, 150, 162], // blush
};

const canvas = () => Array.from({ length: H }, () => Array(W).fill(null));
const inEll = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;

/** Draws one frame of Ping. */
const ping = ({ dy = 0, jump = 0, eyes = 'dot', mouth = 'line', arms = 'down', keys = -1, sparks = false, sweat = false }) => {
  const c = canvas();
  const px = (x, y, col, glow = false) => {
    y += jump + OY;
    if (x >= 0 && x < W && y >= 0 && y < H) c[y][x] = { col, glow };
  };
  const rect = (x0, y0, x1, y1, col, glow) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) px(x, y, col, glow);
  };
  const ell = (cx, cy, rx, ry, col, maxY = Infinity) => {
    for (let y = -OY; y < H; y++) for (let x = 0; x < W; x++) if (y <= maxY && inEll(x, y, cx, cy, rx, ry)) px(x, y, col);
  };
  const tri = (a, b, d, col) => {
    const side = (p, q, r) => (p[0] - r[0]) * (q[1] - r[1]) - (q[0] - r[0]) * (p[1] - r[1]);
    for (let y = -OY; y < H; y++)
      for (let x = 0; x < W; x++) {
        const p = [x + 0.5, y + 0.5];
        const s1 = side(p, a, b), s2 = side(p, b, d), s3 = side(p, d, a);
        if ((s1 >= 0 && s2 >= 0 && s3 >= 0) || (s1 <= 0 && s2 <= 0 && s3 <= 0)) px(x, y, col);
      }
  };
  const T = (p) => [p[0], p[1] + t];
  const t = dy; // the upper body bobs, the feet stay

  // Legs: cargo joggers with a lit edge, a side pocket, a red strap on the thigh and ribbed cuffs.
  for (const [x0, outer] of [[22, 'left'], [34, 'right']]) {
    rect(x0, 66, x0 + 7, 71, 'D');
    rect(x0 + 6, 66, x0 + 7, 71, 'd');
    rect(x0, 66, x0, 71, 'e');
    const pocket = outer === 'left' ? x0 + 1 : x0 + 4;
    rect(pocket, 67, pocket + 2, 69, 'd');
    rect(pocket, 67, pocket + 2, 67, 'e');
    rect(x0, 68, x0 + 7, 68, 'r');
    px(outer === 'left' ? x0 + 6 : x0 + 1, 68, 'R', true); // buckle light
    for (let x = x0; x <= x0 + 7; x++) px(x, 72, x % 2 ? 'h' : 'd');
  }
  // High-top sneakers: a red collar, a stripe on the side, crossed laces, a toe cap and a two-layer glowing sole.
  for (const [x0, x1, toeLeft] of [[17, 30, true], [33, 46, false]]) {
    rect(x0 + 3, 72, x1 - 3, 73, 'r');
    rect(x0, 73, x1, 77, 'B');
    rect(x0, 76, x1, 77, 'b');
    const toe = toeLeft ? [x0, x0 + 3] : [x1 - 3, x1];
    rect(toe[0], 74, toe[1], 76, 'b');
    for (let i = 0; i < 6; i++) px(x0 + 4 + i, 75 - (i % 2), 'R');
    [[x0 + 6, 73], [x0 + 7, 74], [x0 + 8, 73], [x0 + 9, 74]].forEach(([x, y]) => px(x, y, 'x'));
    rect(x0, 78, x1, 78, 'W');
    rect(x0, 79, x1, 79, 'R', true);
    rect(x0 + 1, 80, x1 - 1, 80, 'r', true);
  }

  // Hoodie: wider at the hem, shaded on the right, folds, drawstrings, the T logo, a pocket and a neon hem.
  for (let y = 44; y <= 65; y++) {
    const half = 11 + Math.round(((y - 44) / 21) * 4);
    rect(32 - half, y + t, 31 + half, y + t, 'H');
    rect(31 + half - 3, y + t, 31 + half, y + t, 'h');
    rect(32 - half, y + t, 32 - half + 1, y + t, 'j');
  }
  ell(31.5, 45 + t, 14, 4, 'h');
  ell(31.5, 44 + t, 9, 2.5, 'S'); // neck
  for (const x of [27, 36]) {
    rect(x, 47 + t, x, 54 + t, 'W');
    rect(x, 55 + t, x, 56 + t, 'R', true);
  }
  rect(26, 50 + t, 37, 51 + t, 'R');
  rect(26, 52 + t, 37, 52 + t, 'r');
  rect(30, 52 + t, 33, 58 + t, 'R');
  rect(33, 52 + t, 33, 58 + t, 'r');
  // Kangaroo pocket with a lit top edge and a dark inside.
  rect(22, 59 + t, 41, 63 + t, 'h');
  rect(23, 60 + t, 40, 63 + t, 'H');
  rect(22, 59 + t, 41, 59 + t, 'j');
  rect(24, 60 + t, 25, 62 + t, 'h');
  rect(38, 60 + t, 39, 62 + t, 'h');
  // Raglan seams, folds and a neon circuit running down the right side.
  for (let i = 0; i < 6; i++) (px(20 + i, 46 + i + t, 'h'), px(43 - i, 46 + i + t, 'h'));
  rect(19, 57 + t, 20, 57 + t, 'h');
  rect(43, 55 + t, 44, 55 + t, 'h');
  rect(42, 49 + t, 42, 58 + t, 'r');
  rect(42, 58 + t, 45, 58 + t, 'r');
  [[42, 49], [42, 54], [45, 58]].forEach(([x, y]) => px(x, y + t, 'R', true));
  // Ribbed neon hem.
  for (let x = 16; x <= 47; x++) (px(x, 64 + t, x % 2 ? 'R' : 'r'), px(x, 65 + t, 'r'));

  // Arms: a hoodie sleeve on the left, a robot arm with joints and a glowing wrist on the right.
  const sleeve = (x0, y0, y1, handY, handUp = false) => {
    rect(x0, y0, x0 + 5, y1, 'H');
    rect(x0 + 4, y0, x0 + 5, y1, 'h');
    rect(x0, Math.round((y0 + y1) / 2), x0 + 3, Math.round((y0 + y1) / 2), 'h');
    const cuff = handUp ? y0 : y1 - 1;
    for (let x = x0; x <= x0 + 5; x++) (px(x, cuff, x % 2 ? 'R' : 'r'), px(x, cuff + 1, x % 2 ? 'r' : 'R'));
    rect(x0, handY, x0 + 5, handY + 3, 'S');
    rect(x0 + 4, handY, x0 + 5, handY + 3, 's');
  };
  const robot = (x0, y0, y1, handY, handUp = false) => {
    rect(x0, y0, x0 + 5, y1, 'M');
    rect(x0 + 4, y0, x0 + 5, y1, 'n');
    rect(x0 + 1, y0 + 1, x0 + 1, y1 - 1, 'E');
    const joint = Math.round((y0 + y1) / 2);
    rect(x0, joint, x0 + 5, joint + 1, 'm');
    px(x0 + 2, joint, 'p');
    const wrist = handUp ? y0 : y1 - 1;
    rect(x0, wrist, x0 + 5, wrist, 'R', true);
    rect(x0, handY, x0 + 5, handY + 3, 'm');
    rect(x0 + 2, handY + (handUp ? 0 : 3), x0 + 2, handY + (handUp ? 0 : 3), 'K');
  };
  /** A thick arm (5 px) along shoulder → elbow → hand points, shaded on its right edge. */
  const limb = (pts, fill, shade) => {
    for (let s = 0; s < pts.length - 1; s++)
      for (let i = 0; i <= 20; i++) {
        const cx = Math.round(pts[s][0] + ((pts[s + 1][0] - pts[s][0]) * i) / 20);
        const cy = Math.round(pts[s][1] + ((pts[s + 1][1] - pts[s][1]) * i) / 20);
        rect(cx - 2, cy - 2, cx + 2, cy + 2, fill);
        rect(cx + 2, cy - 2, cx + 2, cy + 2, shade);
      }
  };
  /** The hoodie arm raised from the shoulder, bent at the elbow, ribbed cuff and a fist at the top. */
  const sleeveUp = (shoulder, elbow, hand) => {
    limb([shoulder, elbow, hand], 'H', 'h');
    for (let x = hand[0] - 2; x <= hand[0] + 2; x++) (px(x, hand[1] + 2, x % 2 ? 'R' : 'r'), px(x, hand[1] + 3, x % 2 ? 'r' : 'R'));
    rect(hand[0] - 3, hand[1] - 4, hand[0] + 2, hand[1] + 1, 'S');
    rect(hand[0] + 1, hand[1] - 4, hand[0] + 2, hand[1] + 1, 's');
    rect(hand[0] - 3, hand[1] - 2, hand[0], hand[1] - 2, 's'); // knuckles
  };
  /** The robot arm raised from the shoulder: a joint at the elbow, a glowing wrist, a light metal fist. */
  const robotUp = (shoulder, elbow, hand, finger = false) => {
    limb([shoulder, elbow, hand], 'M', 'n');
    rect(elbow[0] - 2, elbow[1] - 1, elbow[0] + 2, elbow[1] + 1, 'm');
    px(elbow[0], elbow[1], 'p');
    rect(hand[0] - 2, hand[1] + 2, hand[0] + 2, hand[1] + 2, 'R', true);
    rect(hand[0] - 3, hand[1] - 4, hand[0] + 2, hand[1] + 1, 'M');
    rect(hand[0] + 1, hand[1] - 4, hand[0] + 2, hand[1] + 1, 'n');
    rect(hand[0] - 3, hand[1] - 2, hand[0], hand[1] - 2, 'm');
    if (finger) (rect(hand[0] - 3, hand[1] - 8, hand[0] - 2, hand[1] - 5, 'M'), px(hand[0] - 2, hand[1] - 7, 'n'));
  };
  /** The robot arm pointing up and to the right (at a falling word), the fingertip glowing; `pulse` 0..3 sizes the glow. */
  const pointer = (pulse) => {
    limb([[42, 49 + t], [52, 43 + t], [57, 33 + t]], 'M', 'n');
    rect(50, 42 + t, 54, 44 + t, 'm'); // elbow
    px(52, 43 + t, 'p');
    rect(54, 32 + t, 59, 33 + t, 'R', true); // wrist light
    // A light metal hand with its own outline, so it stands out over the dark headphone cup.
    rect(54, 26 + t, 61, 32 + t, 'K');
    rect(58, 21 + t, 61, 26 + t, 'K');
    rect(55, 27 + t, 60, 31 + t, 'M'); // hand
    rect(59, 27 + t, 60, 31 + t, 'n');
    rect(55, 29 + t, 57, 29 + t, 'm'); // folded fingers
    rect(59, 22 + t, 60, 26 + t, 'M'); // finger
    px(60, 23 + t, 'n');
    const glow = pulse % 2 ? 2 : 1;
    rect(60 - glow + 1, 20 + t - glow, 59 + glow, 20 + t, 'R', true);
    px(59, 20 + t, 'E', true);
  };
  const drawArms = () => {
  // The arms hang from the hoodie's shoulders (x 16–21 and 42–47 at the top), with no gap to the body.
  if (arms === 'point') {
    sleeve(15, 47 + t, 61 + t, 62 + t);
    pointer(keys);
  } else if (arms === 'up') {
    sleeveUp([20, 49 + t], [12, 41 + t], [11, 27 + t]);
    robotUp([43, 49 + t], [51, 41 + t], [53, 27 + t]);
  } else if (arms === 'type') {
    const k = keys % 2;
    sleeve(15, 48 + t, 57 + t, 58 + t + k);
    robot(43, 48 + t, 57 + t, 58 + t + (1 - k));
  } else if (arms === 'talk') {
    sleeve(15, 47 + t, 61 + t, 62 + t);
    robotUp([43, 49 + t], [52, 45 + t], [55, 33 + t], true);
  } else {
    sleeve(15, 47 + t, 61 + t, 62 + t);
    robot(43, 47 + t, 61 + t, 62 + t);
  }
  };
  // Raised arms go in front of the head and headphones, the others behind.
  const raised = arms === 'up' || arms === 'talk' || arms === 'point';
  if (!raised) drawArms();

  // Face with a soft shadow on the lower right.
  ell(31.5, 30.5 + t, 16, 15, 'S');
  for (let y = 15; y <= 46; y++)
    for (let x = 15; x <= 48; x++)
      if (inEll(x, y, 31.5, 30.5 + t, 16, 15) && !inEll(x, y, 29.5, 28.5 + t, 16, 15)) px(x, y, 's');

  // Hair: a white mass with spikes, deep shadow underneath, one neon red spike in the middle.
  ell(31.5, 21 + t, 19, 9.5, 'W', 25 + t);
  rect(14, 23 + t, 49, 25 + t, 'w');
  const spikes = [
    [[8, 22], [10, 4], [20, 16], [11, 20], [12, 8], [17, 16]],
    [[16, 16], [22, -4], [30, 14], [20, 14], [22, 2], [25, 14]],
    [[36, 15], [45, -2], [48, 17], [40, 15], [45, 3], [45, 16]],
    [[44, 18], [53, 5], [55, 24], [47, 19], [52, 9], [52, 22]],
  ];
  for (const [a, b, d, e, f, g] of spikes) {
    tri(T(a), T(b), T(d), 'W');
    tri(T(e), T(f), T(g), 'w');
  }
  tri(T([28, 14]), T([36, -6]), T([40, 14]), 'R');
  tri(T([33, 14]), T([36, 0]), T([37, 14]), 'r');
  [[24, 12], [25, 11], [42, 13], [43, 12], [14, 17], [50, 20]].forEach(([x, y]) => px(x, y + t, 'E'));

  // Visor: a neon rim, dark glass with scanlines, a reflection; the eyes are glyphs that light up on it.
  rect(15, 26 + t, 48, 26 + t, 'R');
  rect(15, 27 + t, 48, 33 + t, 'v');
  for (let y = 28; y <= 33; y += 2) rect(16, y + t, 47, y + t, 'q');
  rect(15, 34 + t, 48, 34 + t, 'r');
  [[44, 28], [45, 28], [43, 29], [44, 29], [46, 31]].forEach(([x, y]) => px(x, y + t, 'E', true));
  const glyph = (pts) => pts.forEach(([x, y]) => px(x, y + t, 'E', true));
  const box = (x0, y0, x1, y1) => {
    const pts = [];
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) pts.push([x, y]);
    return pts;
  };
  const chevron = (cx, up) => [0, 1, 2, 3].flatMap((i) => [[cx - i, (up ? 28 : 31) + (up ? i : -i)], [cx + 1 + i, (up ? 28 : 31) + (up ? i : -i)]]);
  const arrow = (x0, dir) => [0, 1, 2, 3].flatMap((i) => [[x0 + dir * (i < 2 ? i : 3 - i), 28 + i], [x0 + dir * (i < 2 ? i : 3 - i) + dir, 28 + i]]);
  if (eyes === 'look') glyph([...box(25, 27, 28, 30), ...box(41, 27, 44, 30)]);
  if (eyes === 'dot') glyph([...box(22, 28, 25, 31), ...box(38, 28, 41, 31)]);
  if (eyes === 'blink') glyph([...box(22, 30, 25, 31), ...box(38, 30, 41, 31)]);
  if (eyes === 'happy') glyph([...chevron(23, true), ...chevron(39, true)]);
  if (eyes === 'sad') glyph([...arrow(22, 1), ...arrow(41, -1)]);

  // Bangs over the visor rim, mouth and blush.
  tri(T([17, 22]), T([20, 29]), T([24, 22]), 'W');
  tri(T([17, 22]), T([19, 27]), T([19, 22]), 'w');
  tri(T([39, 22]), T([43, 29]), T([46, 22]), 'W');
  tri(T([39, 22]), T([41, 27]), T([41, 22]), 'w');
  if (mouth === 'line') rect(29, 40 + t, 34, 40 + t, 'D');
  if (mouth === 'open') (rect(28, 39 + t, 35, 42 + t, 'D'), rect(30, 41 + t, 33, 42 + t, 'r'), rect(29, 39 + t, 34, 39 + t, 'E'));
  if (mouth === 'small') rect(30, 39 + t, 33, 41 + t, 'D');
  if (mouth === 'sad') (rect(29, 40 + t, 34, 40 + t, 'D'), px(28, 41 + t, 'D'), px(35, 41 + t, 'D'));
  rect(17, 36 + t, 21, 37 + t, 'C');
  rect(42, 36 + t, 46, 37 + t, 'C');

  // Over-ear headphones: a two-pixel band over the hair, padded cups with a red light, a mic on the left.
  for (let a = Math.PI; a <= 2 * Math.PI + 0.001; a += 0.01)
    for (const r of [22, 21]) {
      const x = Math.round(31.5 + Math.cos(a) * r - 0.5);
      const y = Math.round(24 + t + Math.sin(a) * r);
      px(x, y, r === 22 ? 'p' : 'P');
    }
  for (const [x0, ledX] of [[4, 7], [50, 55]]) {
    rect(x0, 22 + t, x0 + 9, 38 + t, 'P');
    rect(x0 + 1, 21 + t, x0 + 8, 21 + t, 'P');
    rect(x0 + 1, 39 + t, x0 + 8, 39 + t, 'P');
    rect(x0 + 2, 23 + t, x0 + 2, 36 + t, 'p');
    rect(x0 === 4 ? x0 + 8 : x0, 24 + t, x0 === 4 ? x0 + 9 : x0 + 1, 36 + t, 'h');
    rect(ledX, 28 + t, ledX + 2, 31 + t, 'r');
    rect(ledX + 1, 29 + t, ledX + 1, 30 + t, 'R', true);
  }
  for (let i = 0; i <= 10; i++) px(9 + i, 38 + t + Math.round(i * 0.4), 'm');
  rect(19, 42 + t, 21, 43 + t, 'R', true);

  if (raised) drawArms();

  // Extras: a holographic keyboard, sparks, a sweat drop.
  if (arms === 'type')
    for (let y = 61; y <= 65; y++)
      for (let x = 10; x <= 53; x++) {
        const key = Math.floor((x - 10) / 4) + Math.floor((y - 61) / 3) * 11;
        const gap = (x - 10) % 4 === 3 || (y - 61) % 3 === 2;
        if (!gap) px(x, y + t, key % 7 === keys * 2 % 7 ? 'E' : 'R', true);
      }
  if (sparks)
    [[3, 10], [59, 8], [1, 44], [61, 46], [8, 0], [55, -2]].forEach(([x, y], i) => {
      if ((i + jump / 4) % 2 !== 0) return;
      [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([dx, dyy]) => px(x + dx, y + dyy, dx || dyy ? 'R' : 'E', true));
    });
  if (sweat) (rect(51, 12 + t, 52, 14 + t, 'E', true), px(50, 14 + t, 'E', true), px(53, 14 + t, 'E', true));

  // A dark outline around everything that is not light.
  const out = c.map((row) => row.slice());
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      if (c[y][x]) continue;
      if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dyy]) => c[y + dyy]?.[x + dx] && !c[y + dyy][x + dx].glow)) out[y][x] = { col: 'K' };
    }
  return out;
};

const MOVES = {
  idle: [{}, {}, { dy: 1 }, { dy: 1, eyes: 'blink' }],
  talk: [{ arms: 'talk', mouth: 'open' }, { arms: 'talk', mouth: 'small' }, { arms: 'talk', mouth: 'open', dy: 1 }, { arms: 'talk', mouth: 'line', dy: 1 }],
  happy: [0, -4, -8, -4].map((jump) => ({ jump, arms: 'up', eyes: 'happy', mouth: 'open', sparks: true })),
  sad: [{ dy: 2, eyes: 'sad', mouth: 'sad', sweat: true }, { dy: 2, eyes: 'sad', mouth: 'sad', sweat: true }, { dy: 3, eyes: 'sad', mouth: 'sad' }, { dy: 2, eyes: 'blink', mouth: 'sad' }],
  // Points at a word (up and to the right) while explaining it; the keyboard index pulses the fingertip.
  point: [0, 1, 2, 3].map((keys) => ({ arms: 'point', keys: keys + 10, eyes: 'look', mouth: keys % 2 ? 'small' : 'open', dy: keys < 2 ? 0 : 1 })),
  typing: [0, 1, 2, 3].map((keys) => ({ arms: 'type', keys, mouth: 'line', dy: keys % 2 })),
};

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
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
const png = (frames) => {
  const width = W * frames.length;
  const raw = Buffer.alloc((width * 4 + 1) * H);
  for (let y = 0; y < H; y++)
    frames.forEach((frame, f) =>
      frame[y].forEach((cell, x) => {
        if (!cell) return;
        const i = y * (width * 4 + 1) + 1 + (f * W + x) * 4;
        [raw[i], raw[i + 1], raw[i + 2]] = PAL[cell.col];
        raw[i + 3] = 255;
      }),
    );
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(H, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
};

const OUT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', 'FE', 'public', 'mascot');
// Start clean so a removed move does not leave its old image behind.
fs.rmSync(OUT, { recursive: true, force: true });
fs.mkdirSync(OUT, { recursive: true });
for (const [name, frames] of Object.entries(MOVES)) fs.writeFileSync(path.join(OUT, `ping-${name}.png`), png(frames.map(ping)));
console.log('drew', Object.keys(MOVES).join(', '));
