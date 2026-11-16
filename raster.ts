// raster.ts — tiny software rasterizer (Node stdlib only, no dependencies).
// Renders into a supersampled RGB buffer so edges come out smooth, then
// box-downsamples to the final size. All coordinates are in DESIGN space
// (1024x1024); the canvas multiplies by the supersample factor internally.
// Written as plain JavaScript (no TypeScript annotations) so that both
// `node --check` and `node main.ts` work on stock Node 22/24.
// Colours are [r, g, b] arrays.

export function clamp(v, lo, hi) {
  return v < lo ? lo : v > hi ? hi : v;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

export function mix(c1, c2, t) {
  return [lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t)];
}

/** Multiply a colour by f (f>1 lightens, f<1 darkens), clamped to 0..255. */
export function shade(c, f) {
  return [
    clamp(Math.round(c[0] * f), 0, 255),
    clamp(Math.round(c[1] * f), 0, 255),
    clamp(Math.round(c[2] * f), 0, 255),
  ];
}

/** Deterministic PRNG (mulberry32). Same seed => same sequence, every run. */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Shape options: { alpha (0..1, default 1), outline (colour), outlineW
// (thickness in design px), mask (also mark pixels in the dragon mask) }.
export class Canvas {
  constructor(w, h, ss = 2) {
    this.w = w;
    this.h = h;
    this.S = ss;
    this.W = w * ss;
    this.H = h * ss;
    this.buf = new Uint8Array(this.W * this.H * 3); // RGB, device resolution
    this.mask = new Uint8Array(this.W * this.H); // 1 where the dragon body is
  }

  /** Blend one device pixel. */
  dpx(dx, dy, r, g, b, a, mask = false) {
    if (dx < 0 || dy < 0 || dx >= this.W || dy >= this.H) return;
    const i = (dy * this.W + dx) * 3;
    if (a >= 1) {
      this.buf[i] = r;
      this.buf[i + 1] = g;
      this.buf[i + 2] = b;
    } else if (a > 0) {
      const ia = 1 - a;
      this.buf[i] = Math.round(r * a + this.buf[i] * ia);
      this.buf[i + 1] = Math.round(g * a + this.buf[i + 1] * ia);
      this.buf[i + 2] = Math.round(b * a + this.buf[i + 2] * ia);
    }
    if (mask) this.mask[dy * this.W + dx] = 1;
  }

  /** Vertical gradient + a soft radial glow, in one pass over the buffer. */
  fillBackground(top, bottom, glow) {
    const S = this.S;
    const W = this.W;
    const H = this.H;
    const buf = this.buf;
    const gcx = glow.cx * S;
    const gcy = glow.cy * S;
    const gr = glow.r * S;
    const gr2 = gr * gr;
    const gc = glow.color;
    for (let y = 0; y < H; y++) {
      const t = y / (H - 1);
      const br = lerp(top[0], bottom[0], t);
      const bg = lerp(top[1], bottom[1], t);
      const bb = lerp(top[2], bottom[2], t);
      const dy = y + 0.5 - gcy;
      const dy2 = dy * dy;
      let row = y * W * 3;
      for (let x = 0; x < W; x++) {
        const dx = x + 0.5 - gcx;
        const d2 = (dx * dx + dy2) / gr2;
        const g = Math.exp(-d2 * 2.1) * glow.strength;
        buf[row] = clamp(Math.round(br + gc[0] * g), 0, 255);
        buf[row + 1] = clamp(Math.round(bg + gc[1] * g), 0, 255);
        buf[row + 2] = clamp(Math.round(bb + gc[2] * g), 0, 255);
        row += 3;
      }
    }
  }

  /** Filled circle. */
  circle(cx, cy, r, c, o = {}) {
    if (o.outline && o.outlineW) {
      this.circle(cx, cy, r + o.outlineW, o.outline, { alpha: o.alpha, mask: o.mask });
    }
    const S = this.S;
    const R = r * S;
    const cxD = cx * S;
    const cyD = cy * S;
    const a = o.alpha ?? 1;
    const x0 = Math.max(0, Math.floor(cxD - R));
    const x1 = Math.min(this.W - 1, Math.ceil(cxD + R));
    const y0 = Math.max(0, Math.floor(cyD - R));
    const y1 = Math.min(this.H - 1, Math.ceil(cyD + R));
    const R2 = R * R;
    const buf = this.buf;
    const W = this.W;
    const cr = c[0];
    const cg = c[1];
    const cb = c[2];
    const doMask = !!o.mask;
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cyD;
      const dy2 = dy * dy;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cxD;
        if (dx * dx + dy2 <= R2) {
          const i = (y * W + x) * 3;
          if (a >= 1) {
            buf[i] = cr;
            buf[i + 1] = cg;
            buf[i + 2] = cb;
          } else {
            const ia = 1 - a;
            buf[i] = Math.round(cr * a + buf[i] * ia);
            buf[i + 1] = Math.round(cg * a + buf[i + 1] * ia);
            buf[i + 2] = Math.round(cb * a + buf[i + 2] * ia);
          }
          if (doMask) this.mask[y * W + x] = 1;
        }
      }
    }
  }

  /** Filled axis-aligned ellipse. */
  ellipse(cx, cy, rx, ry, c, o = {}) {
    this.ellipseRot(cx, cy, rx, ry, 0, c, o);
  }

  /** Filled rotated ellipse. angle in radians. */
  ellipseRot(cx, cy, rx, ry, angle, c, o = {}) {
    if (o.outline && o.outlineW) {
      this.ellipseRot(cx, cy, rx + o.outlineW, ry + o.outlineW, angle, o.outline, { alpha: o.alpha, mask: o.mask });
    }
    const S = this.S;
    const RX = rx * S;
    const RY = ry * S;
    const cxD = cx * S;
    const cyD = cy * S;
    const a = o.alpha ?? 1;
    const cos = Math.cos(-angle);
    const sin = Math.sin(-angle);
    const br = Math.sqrt(RX * RX * cos * cos + RY * RY * sin * sin);
    const br2 = Math.sqrt(RX * RX * sin * sin + RY * RY * cos * cos);
    const x0 = Math.max(0, Math.floor(cxD - br));
    const x1 = Math.min(this.W - 1, Math.ceil(cxD + br));
    const y0 = Math.max(0, Math.floor(cyD - br2));
    const y1 = Math.min(this.H - 1, Math.ceil(cyD + br2));
    const buf = this.buf;
    const W = this.W;
    const cr = c[0];
    const cg = c[1];
    const cb = c[2];
    const doMask = !!o.mask;
    const invRX2 = 1 / (RX * RX);
    const invRY2 = 1 / (RY * RY);
    for (let y = y0; y <= y1; y++) {
      const dy = y + 0.5 - cyD;
      for (let x = x0; x <= x1; x++) {
        const dx = x + 0.5 - cxD;
        const lx = dx * cos - dy * sin;
        const ly = dx * sin + dy * cos;
        if (lx * lx * invRX2 + ly * ly * invRY2 <= 1) {
          const i = (y * W + x) * 3;
          if (a >= 1) {
            buf[i] = cr;
            buf[i + 1] = cg;
            buf[i + 2] = cb;
          } else {
            const ia = 1 - a;
            buf[i] = Math.round(cr * a + buf[i] * ia);
            buf[i + 1] = Math.round(cg * a + buf[i + 1] * ia);
            buf[i + 2] = Math.round(cb * a + buf[i + 2] * ia);
          }
          if (doMask) this.mask[y * W + x] = 1;
        }
      }
    }
  }

  /** Filled polygon (even-odd scanline fill). Points in design space. */
  polygon(pts, c, o = {}) {
    if (pts.length < 3) return;
    const S = this.S;
    const a = o.alpha ?? 1;
    const dpts = pts.map(([x, y]) => [x * S, y * S]);
    let minY = Infinity;
    let maxY = -Infinity;
    let minX = Infinity;
    let maxX = -Infinity;
    for (const [x, y] of dpts) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (y < minY) minY = y;
      if (y > maxY) maxY = y;
    }
    const y0 = Math.max(0, Math.floor(minY));
    const y1 = Math.min(this.H - 1, Math.ceil(maxY));
    const x0 = Math.max(0, Math.floor(minX));
    const x1 = Math.min(this.W - 1, Math.ceil(maxX));
    const buf = this.buf;
    const W = this.W;
    const cr = c[0];
    const cg = c[1];
    const cb = c[2];
    const doMask = !!o.mask;
    const n = dpts.length;
    const xs = [];
    for (let y = y0; y <= y1; y++) {
      const yc = y + 0.5;
      xs.length = 0;
      for (let i = 0; i < n; i++) {
        const [x1p, y1p] = dpts[i];
        const [x2p, y2p] = dpts[(i + 1) % n];
        if ((y1p <= yc && y2p > yc) || (y2p <= yc && y1p > yc)) {
          const t = (yc - y1p) / (y2p - y1p);
          xs.push(x1p + t * (x2p - x1p));
        }
      }
      xs.sort((p, q) => p - q);
      for (let k = 0; k + 1 < xs.length; k += 2) {
        const xa = Math.max(x0, Math.ceil(xs[k] - 0.5));
        const xb = Math.min(x1, Math.floor(xs[k + 1] - 0.5));
        for (let x = xa; x <= xb; x++) {
          const i = (y * W + x) * 3;
          if (a >= 1) {
            buf[i] = cr;
            buf[i + 1] = cg;
            buf[i + 2] = cb;
          } else {
            const ia = 1 - a;
            buf[i] = Math.round(cr * a + buf[i] * ia);
            buf[i + 1] = Math.round(cg * a + buf[i + 1] * ia);
            buf[i + 2] = Math.round(cb * a + buf[i + 2] * ia);
          }
          if (doMask) this.mask[y * W + x] = 1;
        }
      }
    }
  }

  /** Thick line with round caps. */
  thickLine(x1, y1, x2, y2, w, c, alpha = 1) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const nx = (-dy / len) * (w / 2);
    const ny = (dx / len) * (w / 2);
    this.polygon(
      [
        [x1 + nx, y1 + ny],
        [x2 + nx, y2 + ny],
        [x2 - nx, y2 - ny],
        [x1 - nx, y1 - ny],
      ],
      c,
      { alpha },
    );
    this.circle(x1, y1, w / 2, c, { alpha });
    this.circle(x2, y2, w / 2, c, { alpha });
  }

  /** Rotated rectangle (as a polygon). angle in radians. */
  rotRect(cx, cy, w, h, angle, c, o = {}) {
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const hw = w / 2;
    const hh = h / 2;
    const corners = [
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ].map(([x, y]) => [cx + x * cos - y * sin, cy + x * sin + y * cos]);
    this.polygon(corners, c, o);
  }

  /** Four-point sparkle star. */
  star4(cx, cy, r, c, alpha = 1) {
    const inner = r * 0.22;
    const pts = [];
    for (let k = 0; k < 8; k++) {
      const ang = (k * Math.PI) / 4 - Math.PI / 2;
      const rad = k % 2 === 0 ? r : inner;
      pts.push([cx + Math.cos(ang) * rad, cy + Math.sin(ang) * rad]);
    }
    this.polygon(pts, c, { alpha });
    this.circle(cx, cy, r * 0.16, c, { alpha });
  }

  /** Small "V" crochet stitch centred at (cx, cy), size s (design px). */
  stitchV(cx, cy, s, c, alpha = 1) {
    const w = s * 0.5;
    const h = s * 0.42;
    const lw = Math.max(1.6, s * 0.16);
    this.thickLine(cx - w, cy - h, cx, cy + h, lw, c, alpha);
    this.thickLine(cx + w, cy - h, cx, cy + h, lw, c, alpha);
  }

  /** Box-downsample the supersampled buffer to design resolution RGB. */
  toRGB() {
    const S = this.S;
    const out = new Uint8Array(this.w * this.h * 3);
    const n = S * S;
    for (let y = 0; y < this.h; y++) {
      for (let x = 0; x < this.w; x++) {
        let r = 0;
        let g = 0;
        let b = 0;
        for (let sy = 0; sy < S; sy++) {
          for (let sx = 0; sx < S; sx++) {
            const i = ((y * S + sy) * this.W + (x * S + sx)) * 3;
            r += this.buf[i];
            g += this.buf[i + 1];
            b += this.buf[i + 2];
          }
        }
        const o = (y * this.w + x) * 3;
        out[o] = Math.round(r / n);
        out[o + 1] = Math.round(g / n);
        out[o + 2] = Math.round(b / n);
      }
    }
    return out;
  }
}
