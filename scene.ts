// scene.ts — "Excited crochet baby dragon bursting from a gold frame".
// One big cute hero, high contrast, saturated colours, diagonal energy.
// All coordinates are design space (1024x1024). Deterministic (seeded RNG).
// Written as plain JavaScript (no TypeScript annotations) so that both
// `node --check` and `node main.ts` work on stock Node 22/24.
import { Canvas, mulberry32, shade } from "./raster.ts";

const BG_TOP = [13, 47, 63];
const BG_BOT = [10, 74, 94];
const GLOW = [255, 209, 102];
const TEAL = [46, 196, 182];
const TEAL_DARK = [20, 120, 110];
const TEAL_DEEP = [16, 92, 86];
const CREAM = [255, 243, 214];
const CORAL = [255, 107, 107];
const CORAL_SOFT = [255, 142, 114];
const CORAL_DARK = [214, 74, 74];
const GOLD = [255, 209, 102];
const GOLD_DARK = [186, 138, 20];
const GOLD_DEEP = [122, 94, 10];
const GOLD_LIGHT = [255, 233, 168];
const EYE = [26, 42, 58];
const MOUTH = [96, 32, 62];
const TONGUE = [255, 120, 140];
const BLUSH = [255, 143, 163];
const WHITE = [255, 255, 255];
const BUBBLE = [180, 235, 240];

const CONFETTI = [
  [255, 107, 107],
  [255, 209, 102],
  [255, 143, 163],
  [127, 240, 224],
  [255, 255, 255],
  [179, 136, 255],
  [255, 142, 114],
  [120, 220, 255],
];

function mirrorX(pts) {
  return pts.map(([x, y]) => [1024 - x, y]);
}

/** Tapered tube along a polyline (tail, arms, horns). Radii per control point. */
function tube(cv, pts, radii, c, opts = {}) {
  const draw = (rad, col, o) => {
    for (let s = 0; s + 1 < pts.length; s++) {
      const [x1, y1] = pts[s];
      const [x2, y2] = pts[s + 1];
      const segLen = Math.hypot(x2 - x1, y2 - y1);
      const steps = Math.max(2, Math.ceil(segLen / 4));
      for (let i = 0; i <= steps; i++) {
        const t = i / steps;
        const x = x1 + (x2 - x1) * t;
        const y = y1 + (y2 - y1) * t;
        const r = rad[s] + (rad[s + 1] - rad[s]) * t;
        cv.circle(x, y, r, col, { alpha: o.alpha, mask: o.mask });
      }
    }
  };
  if (opts.outline && opts.outlineW) {
    draw(
      radii.map((r) => r + opts.outlineW),
      opts.outline,
      { alpha: opts.alpha, mask: opts.mask },
    );
  }
  draw(radii, c, { alpha: opts.alpha, mask: opts.mask });
}

export function drawScene() {
  const cv = new Canvas(1024, 1024, 2);
  const rng = mulberry32(20261116);
  const CX = 512;
  const CY = 512;

  // ---------- 1. background: deep teal gradient + golden radial glow ----------
  cv.fillBackground(BG_TOP, BG_BOT, { cx: CX, cy: 520, r: 520, color: GLOW, strength: 0.55 });

  // ---------- 2. golden light rays bursting from behind the dragon ----------
  for (let i = 0; i < 12; i++) {
    const a0 = (i * Math.PI * 2) / 12 + 0.13;
    const a1 = a0 + 0.21;
    const R = 820;
    cv.polygon(
      [
        [CX, 520],
        [CX + Math.cos(a0) * R, 520 + Math.sin(a0) * R],
        [CX + Math.cos(a1) * R, 520 + Math.sin(a1) * R],
      ],
      GOLD,
      { alpha: i % 2 === 0 ? 0.13 : 0.07 },
    );
  }

  // ---------- 3. back bubbles (soft, behind everything) ----------
  for (let i = 0; i < 12; i++) {
    const x = 60 + rng() * 904;
    const y = 60 + rng() * 904;
    if (Math.hypot(x - CX, y - 520) < 330) continue;
    const r = 13 + rng() * 22;
    cv.circle(x, y, r, BUBBLE, { alpha: 0.2 });
    cv.circle(x - r * 0.35, y - r * 0.35, r * 0.22, WHITE, { alpha: 0.45 });
  }

  // ---------- 4. back confetti (muted, at the edges) ----------
  for (let i = 0; i < 42; i++) {
    const x = 30 + rng() * 964;
    const y = 30 + rng() * 964;
    if (Math.hypot(x - CX, y - 520) < 350) continue;
    const c = CONFETTI[Math.floor(rng() * CONFETTI.length)];
    const s = 7 + rng() * 9;
    const kind = rng();
    if (kind < 0.45) {
      cv.rotRect(x, y, s * 1.5, s, rng() * Math.PI, c, { alpha: 0.85 });
    } else if (kind < 0.75) {
      cv.circle(x, y, s * 0.55, c, { alpha: 0.85 });
    } else {
      const a = rng() * Math.PI * 2;
      cv.polygon(
        [
          [x + Math.cos(a) * s, y + Math.sin(a) * s],
          [x + Math.cos(a + 2.4) * s, y + Math.sin(a + 2.4) * s],
          [x + Math.cos(a + 4.8) * s, y + Math.sin(a + 4.8) * s],
        ],
        c,
        { alpha: 0.85 },
      );
    }
  }

  // ---------- 5. ornate gold frame, tilted -7 degrees, cracked ----------
  const FANG = -0.12217; // -7 degrees
  const FH = 300; // frame outer half-size
  const FT = 44; // frame thickness
  const IH = FH - FT; // inner half-size
  const rot = (x, y) => {
    const cos = Math.cos(FANG);
    const sin = Math.sin(FANG);
    return [CX + x * cos - y * sin, CY + x * sin + y * cos];
  };
  const outer = {
    tl: rot(-FH, -FH),
    tr: rot(FH, -FH),
    br: rot(FH, FH),
    bl: rot(-FH, FH),
  };
  const inner = {
    tl: rot(-IH, -IH),
    tr: rot(IH, -IH),
    br: rot(IH, IH),
    bl: rot(-IH, IH),
  };
  const sides = [
    [outer.tl, outer.tr, inner.tr, inner.tl], // top
    [outer.tr, outer.br, inner.br, inner.tr], // right
    [outer.br, outer.bl, inner.bl, inner.br], // bottom
    [outer.bl, outer.tl, inner.tl, inner.bl], // left
  ];
  for (const side of sides) {
    cv.polygon(side, GOLD);
    // dark edge lines + light centre highlight for a carved look
    for (let e = 0; e < 4; e++) {
      const [x1, y1] = side[e];
      const [x2, y2] = side[(e + 1) % 4];
      cv.thickLine(x1, y1, x2, y2, 3, GOLD_DEEP, 0.9);
    }
    const [ax, ay] = side[0];
    const [bx, by] = side[1];
    const [cx2, cy2] = side[2];
    const [dx, dy] = side[3];
    cv.thickLine((ax + dx) / 2, (ay + dy) / 2, (bx + cx2) / 2, (by + cy2) / 2, 4, GOLD_LIGHT, 0.75);
  }
  // corner medallions (ornate scrolls)
  for (const p of [outer.tl, outer.tr, outer.br, outer.bl]) {
    cv.circle(p[0], p[1], 26, GOLD, { outline: GOLD_DEEP, outlineW: 3 });
    cv.circle(p[0], p[1], 13, GOLD_DARK);
    cv.circle(p[0], p[1], 5, GOLD_LIGHT);
  }
  // crack across the top edge near the right corner + burst lines
  const crack = [
    [688, 196],
    [712, 216],
    [698, 236],
    [724, 252],
    [706, 272],
  ];
  for (let i = 0; i + 1 < crack.length; i++) {
    cv.thickLine(crack[i][0], crack[i][1], crack[i + 1][0], crack[i + 1][1], 6, GOLD_DEEP, 0.95);
  }
  for (let i = 0; i < 5; i++) {
    const a = -0.9 + i * 0.35;
    cv.thickLine(706, 234, 706 + Math.cos(a) * 34, 234 + Math.sin(a) * 34, 3, GOLD_LIGHT, 0.9);
  }

  // ---------- 6. tail (behind body), spikes, spade tip ----------
  tube(
    cv,
    [
      [640, 730],
      [720, 770],
      [790, 830],
      [825, 890],
    ],
    [40, 34, 26, 18],
    TEAL,
    { outline: TEAL_DEEP, outlineW: 5, mask: true },
  );
  // tail spikes
  for (const [sx, sy, sa] of [
    [700, 742, -0.5],
    [762, 798, -0.35],
    [806, 852, -0.2],
  ]) {
    const h = 26;
    const w = 15;
    const tip = [sx + Math.cos(sa - Math.PI / 2) * h, sy + Math.sin(sa - Math.PI / 2) * h];
    const b1 = [sx + Math.cos(sa) * w, sy + Math.sin(sa) * w];
    const b2 = [sx - Math.cos(sa) * w, sy - Math.sin(sa) * w];
    cv.polygon([tip, b1, b2], CORAL, {});
  }
  // spade tail tip
  cv.polygon(
    [
      [830, 872],
      [858, 906],
      [830, 940],
      [802, 906],
    ],
    CORAL,
    {},
  );
  cv.circle(830, 906, 10, CORAL_DARK);

  // ---------- 7. wings (behind body), coral membrane + bones ----------
  const wingL = [
    [395, 605],
    [305, 505],
    [150, 492],
    [222, 618],
    [272, 572],
    [298, 682],
    [344, 622],
    [400, 715],
  ];
  const wingR = mirrorX(wingL);
  for (const wing of [wingL, wingR]) {
    cv.polygon(wing, CORAL_SOFT, { outline: TEAL_DEEP, outlineW: 5 });
    // soft highlight along the upper membrane
    const hx = wing[0][0] < 512 ? 300 : 724;
    cv.ellipse(hx, 568, 78, 24, [255, 190, 165], { alpha: 0.4 });
    // wing bones from the shoulder to the tip and lobe tips
    const shoulder = wing[0][0] < 512 ? [395, 645] : [629, 645];
    for (const tip of [wing[2], wing[3], wing[5]]) {
      cv.thickLine(shoulder[0], shoulder[1], tip[0], tip[1], 6, CORAL_DARK, 0.85);
    }
    cv.circle(wing[2][0], wing[2][1], 9, GOLD);
  }

  // ---------- 8. body + cream belly ----------
  cv.ellipse(CX, 700, 175, 130, TEAL, { outline: TEAL_DEEP, outlineW: 6, mask: true });
  cv.ellipse(CX, 735, 115, 92, CREAM, { mask: true });

  // ---------- 9. arms reaching toward the viewer + little claws ----------
  for (const sgn of [-1, 1]) {
    const ax0 = CX + sgn * -80;
    const ax1 = CX + sgn * -112;
    const ax2 = CX + sgn * -140;
    tube(
      cv,
      [
        [ax0, 712],
        [ax1, 762],
        [ax2, 798],
      ],
      [30, 26, 22],
      TEAL,
      { outline: TEAL_DEEP, outlineW: 5, mask: true },
    );
    const clawX = CX + sgn * -142;
    const clawY = 812;
    cv.circle(clawX, clawY, 26, CREAM, { outline: TEAL_DEEP, outlineW: 4, mask: true });
    for (const [tx, ty] of [
      [clawX - 23, 828],
      [clawX, 840],
      [clawX + 23, 828],
    ]) {
      cv.circle(tx, ty, 10, CREAM, { mask: true });
    }
  }

  // ---------- 10. feet ----------
  for (const sgn of [-1, 1]) {
    const fx = CX + sgn * -64;
    cv.ellipse(fx, 862, 44, 26, TEAL, { outline: TEAL_DEEP, outlineW: 5, mask: true });
    for (const [tx, ty] of [
      [fx - 28, 882],
      [fx, 888],
      [fx + 28, 882],
    ]) {
      cv.circle(tx, ty, 10, CREAM, { mask: true });
    }
  }

  // ---------- 11. head ----------
  // ears first (head overlaps their base)
  for (const sgn of [-1, 1]) {
    const ex = CX + sgn * -168;
    cv.polygon(
      [
        [ex + sgn * 22, 335],
        [ex + sgn * -14, 375],
        [ex + sgn * 15, 420],
      ],
      TEAL,
      { outline: TEAL_DEEP, outlineW: 4, mask: true },
    );
    cv.polygon(
      [
        [ex + sgn * 16, 355],
        [ex + sgn * 0, 378],
        [ex + sgn * 12, 400],
      ],
      CORAL_SOFT,
      {},
    );
  }
  // big round head
  cv.circle(CX, 405, 188, TEAL, { outline: TEAL_DEEP, outlineW: 6, mask: true });
  // soft top-light on the head
  cv.ellipse(CX - 40, 330, 120, 70, [127, 240, 224], { alpha: 0.35 });
  // gold horns
  for (const sgn of [-1, 1]) {
    tube(
      cv,
      [
        [CX + sgn * -90, 252],
        [CX + sgn * -118, 204],
        [CX + sgn * -152, 158],
      ],
      [22, 14, 7],
      GOLD,
      { outline: GOLD_DEEP, outlineW: 4 },
    );
  }
  // cream muzzle
  cv.ellipse(CX, 500, 100, 58, CREAM, { mask: true });
  // nostrils
  cv.circle(CX - 34, 492, 6, EYE);
  cv.circle(CX + 34, 492, 6, EYE);
  // wide open happy mouth + tongue + tiny fangs
  cv.ellipse(CX, 548, 75, 45, MOUTH);
  cv.ellipse(CX, 568, 46, 24, TONGUE);
  cv.polygon(
    [
      [CX - 54, 518],
      [CX - 34, 518],
      [CX - 44, 536],
    ],
    WHITE,
  );
  cv.polygon(
    [
      [CX + 34, 518],
      [CX + 54, 518],
      [CX + 44, 536],
    ],
    WHITE,
  );
  // big glossy eyes
  for (const sgn of [-1, 1]) {
    const ex = CX + sgn * -74;
    cv.ellipse(ex, 392, 36, 52, EYE);
    cv.circle(ex - 12, 372, 13, WHITE);
    cv.circle(ex + 14, 414, 5, WHITE);
    // lashes
    cv.thickLine(ex - 28, 344, ex - 38, 328, 5, EYE);
    cv.thickLine(ex - 8, 340, ex - 12, 322, 5, EYE);
    cv.thickLine(ex + 12, 342, ex + 14, 324, 5, EYE);
    // happy raised brow
    cv.thickLine(ex - 33, 330, ex, 318, 5, TEAL_DEEP);
    cv.thickLine(ex, 318, ex + 32, 326, 5, TEAL_DEEP);
  }
  // blush cheeks
  cv.circle(CX - 150, 498, 26, BLUSH, { alpha: 0.55 });
  cv.circle(CX + 150, 498, 26, BLUSH, { alpha: 0.55 });

  // ---------- 12. crochet stitch texture over the dragon ----------
  // V-stitches on a brick grid, only where the mask says "dragon body".
  // The stitch colour is a darker shade of whatever the pixel already is,
  // so teal parts get teal stitches and cream parts get cream stitches.
  // Face features (eyes, mouth, blush) are skipped by colour test.
  const cellW = 24;
  const cellH = 18;
  const isBody = (r, g, b) => {
    const tealish = g > 120 && b > 120 && r < 180;
    const creamish = r > 225 && g > 200 && b > 150;
    return tealish || creamish;
  };
  let row = 0;
  for (let gy = 130; gy <= 930; gy += cellH, row++) {
    const xOff = row % 2 === 0 ? 0 : cellW / 2;
    for (let gx = 120 + xOff; gx <= 910; gx += cellW) {
      const dx = Math.round(gx * cv.S);
      const dy = Math.round(gy * cv.S);
      if (dx < 0 || dy < 0 || dx >= cv.W || dy >= cv.H) continue;
      if (cv.mask[dy * cv.W + dx] !== 1) continue;
      const bi = (dy * cv.W + dx) * 3;
      const pr = cv.buf[bi];
      const pg = cv.buf[bi + 1];
      const pb = cv.buf[bi + 2];
      if (!isBody(pr, pg, pb)) continue;
      const vary = (gx * 7 + gy * 13) % 3 === 0 ? 0.62 : 0.7;
      const sc = shade([pr, pg, pb], vary);
      cv.stitchV(gx, gy, 15, sc, 0.9);
    }
  }

  // ---------- 13. gold frame shards flying off the crack ----------
  for (let i = 0; i < 6; i++) {
    const sx = 700 + rng() * 170;
    const sy = 150 + rng() * 150;
    const s = 13 + rng() * 16;
    const a = rng() * Math.PI * 2;
    const pts = [
      [sx + Math.cos(a) * s, sy + Math.sin(a) * s],
      [sx + Math.cos(a + 2.1) * s * 0.7, sy + Math.sin(a + 2.1) * s * 0.7],
      [sx + Math.cos(a + 4.2) * s * 0.7, sy + Math.sin(a + 4.2) * s * 0.7],
    ];
    cv.polygon(pts, GOLD, {});
    cv.circle(sx, sy, 3, GOLD_LIGHT);
  }
  for (let i = 0; i < 3; i++) {
    const sx = 200 + rng() * 120;
    const sy = 780 + rng() * 110;
    const s = 11 + rng() * 12;
    const a = rng() * Math.PI * 2;
    cv.polygon(
      [
        [sx + Math.cos(a) * s, sy + Math.sin(a) * s],
        [sx + Math.cos(a + 2.1) * s * 0.7, sy + Math.sin(a + 2.1) * s * 0.7],
        [sx + Math.cos(a + 4.2) * s * 0.7, sy + Math.sin(a + 4.2) * s * 0.7],
      ],
      GOLD,
      {},
    );
  }

  // ---------- 14. front confetti + sparkles (bright, in front) ----------
  for (let i = 0; i < 52; i++) {
    const x = 30 + rng() * 964;
    const y = 30 + rng() * 964;
    if (Math.hypot(x - CX, y - 405) < 205) continue; // keep the face clean
    const c = CONFETTI[Math.floor(rng() * CONFETTI.length)];
    const s = 8 + rng() * 10;
    const kind = rng();
    if (kind < 0.45) {
      cv.rotRect(x, y, s * 1.5, s, rng() * Math.PI, c, { alpha: 0.95 });
    } else if (kind < 0.75) {
      cv.circle(x, y, s * 0.55, c, { alpha: 0.95 });
    } else {
      const a = rng() * Math.PI * 2;
      cv.polygon(
        [
          [x + Math.cos(a) * s, y + Math.sin(a) * s],
          [x + Math.cos(a + 2.4) * s, y + Math.sin(a + 2.4) * s],
          [x + Math.cos(a + 4.8) * s, y + Math.sin(a + 4.8) * s],
        ],
        c,
        { alpha: 0.95 },
      );
    }
  }
  for (let i = 0; i < 34; i++) {
    const x = 40 + rng() * 944;
    const y = 40 + rng() * 944;
    if (Math.hypot(x - CX, y - 405) < 210) continue;
    const r = 6 + rng() * 14;
    cv.star4(x, y, r, rng() < 0.6 ? WHITE : GOLD_LIGHT, 0.95);
  }

  return cv.toRGB();
}
