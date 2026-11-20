// Article-card covers on /blog/ drawn as a CRT screen: each image pixel becomes an R+G+B
// aperture-grille triad, with dark scanline gaps and a soft phosphor bloom on top.
//
// The <img class="card-cover"> stays in the page only as the source (CSS keeps it invisible;
// <noscript> shows it dimmed instead). A <canvas class="card-crt"> is painted over each card
// when it comes near the viewport, and repainted when the card changes size.

const PITCH = 3; // CSS px per image pixel (one R+G+B triad); snapped to whole device pixels below
const LIT = 0.72; // share of each triad row that glows; the rest is the dark scanline gap
const GAP = 0.12; // brightness left in the gap
const BLEED = 0.18; // how much a phosphor stripe picks up its neighbours' colours
const GAIN = 2.4; // overall drive
const BLOOM = 0.55; // strength of the blurred copy added on top
const BLOOM_PX = 2.5; // its blur radius, CSS px

const painted = new WeakMap<HTMLCanvasElement, string>();
const nativeBlur = typeof CanvasRenderingContext2D !== 'undefined' && 'filter' in CanvasRenderingContext2D.prototype;

const lin = (c: number) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const ENC = new Uint8ClampedArray(4096).map((_, i) => {
  const v = i / 4095;
  return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
});
const enc = (v: number) => ENC[v >= 1 ? 4095 : (v * 4095) | 0];
const pos = (v: string) => (v.endsWith('%') ? parseFloat(v) / 100 : 0.5);

/** The object-fit: cover crop of the image at w×h, downscaled in halving steps so it doesn't alias. */
function sample(img: HTMLImageElement, w: number, h: number, px: number, py: number) {
  const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);
  const target = img.naturalWidth * s;
  let src: CanvasImageSource = img;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  while (sw / 2 >= target && sw > 64) {
    const c = document.createElement('canvas');
    c.width = Math.ceil(sw / 2);
    c.height = Math.ceil(sh / 2);
    const x = c.getContext('2d')!;
    x.imageSmoothingQuality = 'high';
    x.drawImage(src, 0, 0, c.width, c.height);
    src = c;
    sw = c.width;
    sh = c.height;
  }
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.imageSmoothingQuality = 'high';
  const dw = img.naturalWidth * s;
  const dh = img.naturalHeight * s;
  ctx.drawImage(src, (w - dw) * px, (h - dh) * py, dw, dh);
  return ctx.getImageData(0, 0, w, h).data;
}

/** Linear-light RGB per image pixel, warmed up; bright pictures get their lightness flipped. */
function phosphor(d: Uint8ClampedArray, n: number) {
  const rgb = new Float32Array(n * 3);
  let sum = 0;
  for (let i = 0; i < n; i++) {
    for (let c = 0; c < 3; c++) rgb[i * 3 + c] = lin(d[i * 4 + c] / 255);
    sum += 0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2];
  }
  // a white picture (a chart on paper) would light up the whole card: show its negative lightness instead
  const invert = sum / n > 0.45;
  const warm = [1.25, 1.149, 1.014]; // slightly amber phosphor, with headroom that clips like a real tube
  for (let i = 0; i < n; i++) {
    const Y = 0.2126 * rgb[i * 3] + 0.7152 * rgb[i * 3 + 1] + 0.0722 * rgb[i * 3 + 2];
    for (let c = 0; c < 3; c++) {
      let v = rgb[i * 3 + c];
      // paper -> black, coloured ink -> glowing ink of the same hue, black ink -> light
      if (invert) v = Math.max(0, 0.8 * (1 - Y) ** 1.5 + 1.4 * (v - Y) - 0.03);
      rgb[i * 3 + c] = Math.min(1, v * warm[c]);
    }
  }
  return rgb;
}

/** Soft glow: native canvas blur where it exists, otherwise a down-and-up rescale (Safari). */
function bloom(cv: HTMLCanvasElement, ctx: CanvasRenderingContext2D, dpr: number) {
  const W = cv.width;
  const H = cv.height;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.globalAlpha = BLOOM;
  if (nativeBlur) {
    const copy = document.createElement('canvas');
    copy.width = W;
    copy.height = H;
    copy.getContext('2d')!.drawImage(cv, 0, 0);
    ctx.filter = `blur(${BLOOM_PX * dpr}px)`;
    ctx.drawImage(copy, 0, 0);
  } else {
    const f = Math.max(2, Math.round(BLOOM_PX * dpr * 2));
    const half = document.createElement('canvas');
    half.width = Math.ceil(W / 2);
    half.height = Math.ceil(H / 2);
    const hx = half.getContext('2d')!;
    hx.imageSmoothingQuality = 'high';
    hx.drawImage(cv, 0, 0, half.width, half.height);
    const small = document.createElement('canvas');
    small.width = Math.max(1, Math.ceil(W / f));
    small.height = Math.max(1, Math.ceil(H / f));
    const sx = small.getContext('2d')!;
    sx.imageSmoothingQuality = 'high';
    sx.drawImage(half, 0, 0, small.width, small.height);
    hx.clearRect(0, 0, half.width, half.height);
    hx.drawImage(small, 0, 0, half.width, half.height);
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(half, 0, 0, W, H);
  }
  ctx.restore();
}

function paint(img: HTMLImageElement) {
  const card = img.closest<HTMLElement>('article');
  if (!card || !img.naturalWidth) return;
  let cv = card.querySelector<HTMLCanvasElement>('canvas.card-crt');
  if (!cv) {
    cv = document.createElement('canvas');
    cv.className = 'card-crt';
    cv.setAttribute('aria-hidden', 'true');
    img.after(cv);
  }
  const dpr = window.devicePixelRatio || 1;
  const W = card.clientWidth;
  const H = card.clientHeight;
  // whole device pixels per phosphor stripe, so the grille stays crisp at any zoom / DPR
  const Pd = Math.max(3, Math.round((PITCH * dpr) / 3) * 3);
  const key = [W, H, dpr].join('|');
  if (!W || !H || painted.get(cv) === key) return;
  painted.set(cv, key);

  const DW = Math.round(W * dpr);
  const DH = Math.round(H * dpr);
  const w = Math.ceil(DW / Pd);
  const h = Math.ceil(DH / Pd);
  const [px, py] = getComputedStyle(img).objectPosition.split(' ').map(pos);
  const rgb = phosphor(sample(img, w, h, px, py), w * h);

  cv.width = DW;
  cv.height = DH;
  cv.style.width = `${W}px`;
  cv.style.height = `${H}px`;
  const ctx = cv.getContext('2d')!;
  const out = ctx.createImageData(DW, DH);
  const o = out.data;
  const col = new Int32Array(DW);
  const sub = new Uint8Array(DW);
  for (let X = 0; X < DW; X++) {
    col[X] = Math.min(w - 1, Math.floor(X / Pd)) * 3;
    sub[X] = Math.min(2, Math.floor(((X % Pd) / Pd) * 3)); // which phosphor stripe
  }
  const litRows = Math.max(1, Math.ceil(Pd * LIT));
  for (let Y = 0; Y < DH; Y++) {
    const row = Math.min(h - 1, Math.floor(Y / Pd)) * w * 3;
    const g = GAIN * (Y % Pd < litRows ? 1 : GAP);
    const gb = g * BLEED;
    let j = Y * DW * 4;
    for (let X = 0; X < DW; X++, j += 4) {
      const i = row + col[X];
      const s = sub[X];
      o[j] = enc(rgb[i] * (s === 0 ? g : gb));
      o[j + 1] = enc(rgb[i + 1] * (s === 1 ? g : gb));
      o[j + 2] = enc(rgb[i + 2] * (s === 2 ? g : gb));
      o[j + 3] = 255;
    }
  }
  ctx.putImageData(out, 0, 0);
  bloom(cv, ctx, dpr);

  // switch on in the next frame, so the screen fades in instead of popping
  if (!card.classList.contains('has-crt')) requestAnimationFrame(() => card.classList.add('has-crt'));
}

function paintSafely(img: HTMLImageElement) {
  try {
    paint(img);
  } catch {
    // no canvas, tainted image, out of memory…: fall back to the dimmed photo
    img.closest('article')?.classList.add('crt-failed');
  }
}

function whenReady(img: HTMLImageElement) {
  if (img.complete && img.naturalWidth) return paintSafely(img);
  img.addEventListener('load', () => paintSafely(img), { once: true });
  img.addEventListener('error', () => img.closest('article')?.classList.add('crt-failed'), { once: true });
  // the <img> is invisible, and browsers may never fetch an invisible lazy image: ask for it now
  img.loading = 'eager';
}

const list = document.querySelector<HTMLElement>('[data-post-cards]');
const imgs = [...document.querySelectorAll<HTMLImageElement>('[data-post-cards] img.card-cover')];
if (list && imgs.length) {
  const near = new Set<HTMLImageElement>();
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const img = e.target as HTMLImageElement;
        if (e.isIntersecting) {
          near.add(img);
          whenReady(img);
        } else near.delete(img);
      }
    },
    { rootMargin: '400px 0px' },
  );
  imgs.forEach((img) => io.observe(img));

  // cards change size with the window and when web fonts land: repaint the ones near the viewport
  let t = 0;
  new ResizeObserver(() => {
    clearTimeout(t);
    t = window.setTimeout(() => near.forEach(whenReady), 120);
  }).observe(list);
}
