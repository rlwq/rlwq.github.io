// The "lamp" layer: behaviour for the effects in styles/lamp.css. Each part checks its
// html.lamp-<feature> class (set in Base.astro) and does nothing without it.
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/vt323/400.css';
import '../styles/lamp.css';

const root = document.documentElement;
const has = (feature: string) => root.classList.contains(`lamp-${feature}`);

/* ---------------------------------------------------------------------------
   ui: dithered lines. A line is a strip of 2px cells lit by a 4×4 Bayer
   threshold against a density profile, so it fades out in a dither instead of
   a smooth gradient. Painted per element and repainted on resize/theme change.
--------------------------------------------------------------------------- */
const CELL = 2;
const BAYER4 = [
  [0, 8, 2, 10],
  [12, 4, 14, 6],
  [3, 11, 1, 9],
  [15, 7, 13, 5],
].map((row) => row.map((v) => (v + 0.5) / 16));

type Profile = (t: number) => number;
/** solid in the middle, dithering out towards both ends */
const fadeEnds: Profile = (t) => Math.min(1, Math.min(t, 1 - t) / 0.28);

function strip(len: number, thick: number, vertical: boolean, color: string, profile: Profile, peak = 1, cell = CELL, flip = false) {
  const n = Math.max(1, Math.round(len / cell));
  const m = Math.max(1, Math.round(thick / cell));
  const c = document.createElement('canvas');
  c.width = vertical ? m : n;
  c.height = vertical ? n : m;
  const ctx = c.getContext('2d')!;
  ctx.fillStyle = color;
  for (let i = 0; i < n; i++) {
    const a = profile(n === 1 ? 0.5 : i / (n - 1)) * peak;
    for (let j = 0; j < m; j++) {
      const bj = flip ? m - 1 - j : j;
      const x = vertical ? j : i;
      const y = vertical ? i : j;
      const bx = vertical ? bj : i;
      const by = vertical ? i : bj;
      if (a > BAYER4[by & 3][bx & 3]) ctx.fillRect(x, y, 1, 1);
    }
  }
  return c.toDataURL();
}

const cssVar = (name: string) => getComputedStyle(root).getPropertyValue(name).trim();

interface LineSpec {
  el: HTMLElement;
  side: 'top' | 'bottom' | 'left' | 'right';
  thick: number;
  color: () => string;
  peak?: number;
  cell?: number;
  flip?: boolean;
}

function lineSpecs(): LineSpec[] {
  const specs: LineSpec[] = [];
  const header = document.querySelector<HTMLElement>('[data-site-header]');
  if (header) specs.push({ el: header, side: 'bottom', thick: 2, cell: 1, color: () => cssVar('--border'), peak: 0.9 });

  document.querySelectorAll<HTMLElement>('main hr').forEach((el) =>
    specs.push({ el, side: 'top', thick: 4, color: () => cssVar('--primary'), peak: 0.9 }),
  );
  document.querySelectorAll<HTMLElement>('main blockquote').forEach((el) =>
    specs.push({ el, side: 'left', thick: 4, color: () => cssVar('--muted-foreground'), peak: 0.8 }),
  );
  document.querySelectorAll<HTMLElement>('main .sidenote').forEach((el) => {
    // only while the sidenote sits under the line with a left rule (not floated in the margin)
    if (parseFloat(getComputedStyle(el).borderLeftWidth) > 0)
      specs.push({ el, side: 'left', thick: CELL, color: () => cssVar('--primary'), peak: 0.75 });
  });
  // the fold-out CONTENTS on narrow screens: its bar is a .code-bar, same line under it
  document.querySelectorAll<HTMLElement>('details[data-toc-fold][open] > summary').forEach((el) =>
    specs.push({ el, side: 'bottom', thick: 2, cell: 1, flip: true, color: () => cssVar('--border'), peak: 0.9 }),
  );
  document.querySelectorAll<HTMLElement>('main .code-bar').forEach((el) =>
    specs.push({ el, side: 'bottom', thick: 2, cell: 1, flip: true, color: () => cssVar('--border'), peak: 0.9 }),
  );
  document.querySelectorAll<HTMLElement>('main thead').forEach((el) =>
    specs.push({ el, side: 'bottom', thick: 2, cell: 1, color: () => cssVar('--border'), peak: 0.9 }),
  );
  document.querySelectorAll<HTMLElement>('main tbody tr:not(:last-child)').forEach((el) =>
    specs.push({ el, side: 'bottom', thick: 1, cell: 1, color: () => cssVar('--border'), peak: 0.72 }),
  );
  const homeAbout = document.querySelector<HTMLElement>('[data-home-about]');
  if (homeAbout) {
    if (innerWidth >= 1024) {
      specs.push({ el: homeAbout, side: 'right', thick: 2, cell: 1, color: () => cssVar('--border'), peak: 0.9 });
    } else {
      homeAbout.style.backgroundImage = '';
      delete homeAbout.dataset.lampLine;
    }
  }
  document.querySelectorAll<HTMLElement>('ul.grid article nav').forEach((el) => {
    const onCover = !!el.closest('article')?.querySelector('img');
    const s = getComputedStyle(el);
    const side = parseFloat(s.borderLeftWidth) > 0 ? 'left' : 'top';
    specs.push({ el, side, thick: 2, cell: 1, color: () => (onCover ? 'rgba(255,255,255,0.22)' : cssVar('--border')), peak: 0.9 });
  });
  return specs;
}

/** Search dialog lines; its results are rendered on the fly, so search.ts asks for a
 *  repaint (lamp:search-lines) after each render and when the dialog opens. */
function searchLineSpecs(): LineSpec[] {
  const specs: LineSpec[] = [];
  const bar = document.querySelector<HTMLElement>('[data-search-bar]');
  // the bezel's lower edge, as under .code-bar on code blocks
  if (bar) specs.push({ el: bar, side: 'bottom', thick: 2, cell: 1, flip: true, color: () => cssVar('--border'), peak: 0.9 });
  // between hits, as between table rows
  document.querySelectorAll<HTMLElement>('[data-search-results] li + li').forEach((el) =>
    specs.push({ el, side: 'top', thick: 1, cell: 1, color: () => cssVar('--border'), peak: 0.72 }),
  );
  return specs;
}

function paintLines(specs: LineSpec[] = [...lineSpecs(), ...searchLineSpecs()]) {
  if (!has('ui')) return;
  for (const { el, side, thick, color, peak, cell = CELL, flip = false } of specs) {
    const vertical = side === 'left' || side === 'right';
    // layout size, not the on-screen box: a dialog mid-way through its open animation is scaled
    const len = vertical ? el.offsetHeight : el.offsetWidth;
    if (len < 4) continue;
    const url = strip(len, thick, vertical, color(), fadeEnds, peak, cell, flip);
    // keep any existing background colour (the header has one); the line is an extra image layer
    el.dataset.lampLine = '';
    el.style.backgroundImage = `url(${url})`;
    el.style.backgroundSize = vertical ? `${thick}px ${Math.round(len / cell) * cell}px` : `${Math.round(len / cell) * cell}px ${thick}px`;
    el.style.backgroundPosition = side === 'bottom' ? 'left bottom' : side === 'right' ? 'right top' : 'left top';
  }
}

/* ---------------------------------------------------------------------------
   tape: reading progress on article pages, filled one 8px cell at a time
--------------------------------------------------------------------------- */
function setupTape() {
  if (!has('tape') || !/^\/blog\/[^/]+\/?$/.test(location.pathname)) return;
  const bar = document.createElement('div');
  bar.className = 'lamp-tape-bar';
  bar.setAttribute('aria-hidden', 'true');
  document.body.appendChild(bar);
  const update = () => {
    const max = document.documentElement.scrollHeight - innerHeight;
    const p = max > 0 ? Math.min(1, Math.max(0, scrollY / max)) : 0;
    bar.style.width = p >= 0.995 ? '100%' : `${Math.floor((p * innerWidth) / 8) * 8}px`;
  };
  addEventListener('scroll', update, { passive: true });
  addEventListener('resize', update);
  update();
}

/* ---------------------------------------------------------------------------
   caret: a block caret drawn over the search input (native caret is hidden)
--------------------------------------------------------------------------- */
function setupCaret() {
  if (!has('caret')) return;
  const input = document.querySelector<HTMLInputElement>('[data-search-input]');
  if (!input?.parentElement) return;
  const host = input.parentElement;
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  const block = document.createElement('span');
  block.className = 'lamp-caret-block';
  block.hidden = true;
  host.appendChild(block);
  const measure = document.createElement('canvas').getContext('2d')!;

  const place = () => {
    const focused = document.activeElement === input;
    const start = input.selectionStart ?? 0;
    if (!focused || start !== input.selectionEnd) {
      block.hidden = true;
      return;
    }
    const s = getComputedStyle(input);
    measure.font = `${s.fontWeight} ${s.fontSize} ${s.fontFamily}`;
    const text = input.value.slice(0, start);
    const ir = input.getBoundingClientRect();
    const hr = host.getBoundingClientRect();
    const x = ir.left - hr.left + parseFloat(s.paddingLeft) + measure.measureText(text).width - input.scrollLeft;
    block.style.fontSize = s.fontSize;
    block.style.left = `${Math.min(x, ir.right - hr.left - 4)}px`;
    block.style.top = `${ir.top - hr.top + (ir.height - parseFloat(s.fontSize) * 1.15) / 2}px`;
    block.hidden = false;
    // restart the blink so the caret is visible right after typing
    block.style.animation = 'none';
    void block.offsetWidth;
    block.style.animation = '';
  };
  for (const ev of ['input', 'focus', 'blur', 'keyup', 'click', 'select']) input.addEventListener(ev, place);
  document.addEventListener('selectionchange', place);
}

/* ---------------------------------------------------------------------------
   hover: a sync fault on the CRT cover while the pointer is on the card.
   - a bright refresh band rolls top to bottom; inside it the scanlines slip
     sideways by whole phosphor stripes (so the colours fringe) and twitch;
   - the red and blue beams drift apart by a pixel (misconvergence), so
     contrasty edges get colour fringes;
   - with "afterglow" on, it all dies out slowly after the pointer leaves.
   Works on the canvas covers.ts painted: snapshot on enter, restore at the end.
--------------------------------------------------------------------------- */
const ROLL_MS = 2400; // one pass of the band
const BAND = 0.42; // band height, share of the card
const SLIP = 3; // max sideways slip, CSS px
const TWITCH_MS = 70; // how often the jitter changes
const SPLIT = 1; // red/blue beam offset at full power, CSS px
const RISE_MS = 140; // fault comes on this fast…
const FADE_MS = 1100; // …and with afterglow dies out this slowly

/** deterministic 0..1 noise per scanline and time step */
const noise = (a: number, b: number) => {
  const x = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

/** a copy of the canvas with only one colour channel (0 red, 1 green, 2 blue) */
function channel(src: HTMLCanvasElement, keep: 0 | 1 | 2) {
  const out = document.createElement('canvas');
  out.width = src.width;
  out.height = src.height;
  const ctx = out.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(src, 0, 0);
  const img = ctx.getImageData(0, 0, out.width, out.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    if (keep !== 0) d[i] = 0;
    if (keep !== 1) d[i + 1] = 0;
    if (keep !== 2) d[i + 2] = 0;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

function setupCoverHover() {
  if (!has('hover')) return;
  const still = matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll<HTMLElement>('[data-post-cards] article').forEach((card) => {
    let cv: HTMLCanvasElement | null = null;
    let snap: HTMLCanvasElement | null = null; // the untouched screen
    let rgb: [HTMLCanvasElement, HTMLCanvasElement, HTMLCanvasElement] | null = null;
    let work: HTMLCanvasElement | null = null; // the screen with beams split, before slips
    let raf = 0;
    let t0 = 0;
    let last = 0;
    let power = 0; // 0 = calm screen, 1 = full fault
    let hovered = false;

    const sameSize = () => !!cv && !!snap && cv.width === snap.width && cv.height === snap.height;
    const restore = () => {
      if (!cv || !snap || !sameSize()) return;
      const ctx = cv.getContext('2d')!;
      ctx.save();
      ctx.globalCompositeOperation = 'copy';
      ctx.drawImage(snap, 0, 0);
      ctx.restore();
    };

    const stop = () => {
      cancelAnimationFrame(raf);
      raf = 0;
      restore();
      snap = rgb = work = null;
      power = 0;
    };

    const frame = (now: number) => {
      // covers.ts repainted the canvas (resize): our snapshot is stale, let it be
      if (!cv || !snap || !rgb || !work || !sameSize()) return stop();
      const dt = Math.min(64, now - (last || now));
      last = now;
      power = hovered
        ? Math.min(1, power + dt / RISE_MS)
        : Math.max(0, power - dt / (has('afterglow') ? FADE_MS : 1));
      if (!hovered && power <= 0) return stop();

      const ctx = cv.getContext('2d')!;
      const W = cv.width;
      const H = cv.height;
      const dpr = window.devicePixelRatio || 1;
      const Pd = Math.max(3, Math.round((3 * dpr) / 3) * 3); // scanline height, as in covers.ts
      const stripe = Pd / 3; // one phosphor stripe

      // misconvergence: green stays, red drifts right, blue drifts left
      const m = Math.round(SPLIT * dpr * power);
      const wx = work.getContext('2d')!;
      wx.globalCompositeOperation = 'copy';
      wx.drawImage(rgb[1], 0, 0);
      wx.globalCompositeOperation = 'lighter';
      wx.drawImage(rgb[0], m, 0);
      wx.drawImage(rgb[2], -m, 0);

      ctx.save();
      ctx.globalCompositeOperation = 'copy';
      ctx.drawImage(work, 0, 0);
      ctx.restore();

      const band = H * BAND;
      const yc = -band / 2 + (H + band) * (((now - t0) % ROLL_MS) / ROLL_MS);
      const step = Math.floor(now / TWITCH_MS);
      const top = Math.max(0, Math.floor((yc - band / 2) / Pd) * Pd);
      const bottom = Math.min(H, yc + band / 2);

      // scanlines inside the band slip sideways, whole lines at a time
      for (let y = top; y < bottom; y += Pd) {
        const d = (y + Pd / 2 - yc) / (band / 2); // -1..1 across the band
        if (d <= -1 || d >= 1) continue;
        const env = Math.cos((d * Math.PI) / 2) ** 2;
        const wave = Math.sin(y * 0.045 + now * 0.009);
        const twitch = noise(y, step) * 2 - 1;
        const dx = Math.round((SLIP * dpr * power * env * (0.55 * wave + 0.45 * twitch)) / stripe) * stripe;
        if (!dx) continue;
        const h = Math.min(Pd, H - y);
        ctx.drawImage(work, 0, y, W, h, dx, y, W, h);
      }

      // the refresh band itself: a little extra light where the beam is
      const g = ctx.createLinearGradient(0, yc - band / 2, 0, yc + band / 2);
      g.addColorStop(0, 'rgba(255, 236, 200, 0)');
      g.addColorStop(0.5, `rgba(255, 236, 200, ${0.09 * power})`);
      g.addColorStop(1, 'rgba(255, 236, 200, 0)');
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = g;
      ctx.fillRect(0, yc - band / 2, W, band);
      ctx.restore();

      raf = requestAnimationFrame(frame);
    };

    card.addEventListener('pointerenter', () => {
      hovered = true;
      if (still.matches) return;
      if (raf && snap) return; // still fading out: keep the clean snapshot we already have
      cv = card.querySelector<HTMLCanvasElement>('canvas.card-crt');
      if (!cv || !card.classList.contains('has-crt')) return;
      snap = document.createElement('canvas');
      snap.width = cv.width;
      snap.height = cv.height;
      snap.getContext('2d')!.drawImage(cv, 0, 0);
      rgb = [channel(snap, 0), channel(snap, 1), channel(snap, 2)];
      work = document.createElement('canvas');
      work.width = snap.width;
      work.height = snap.height;
      t0 = performance.now();
      last = 0;
      raf = requestAnimationFrame(frame);
    });
    card.addEventListener('pointerleave', () => {
      hovered = false;
    });
  });
}

/* ---------------------------------------------------------------------------
   toc: a vertical tape of cells along the side TOC that fills as you read,
   data-read on the sections you have already passed, and the current section
   kept in view in a long TOC.

   Two looks, picked by TOC_RAIL:
   - 'even':  the plain tape, 3px cells every 5px, filling at a steady pace from
              "first heading reaches the reading line" to the bottom of the page.
              Its tip does not track the highlighted entry.
   - 'scale': the rail is cut into sections, one per TOC entry (top of entry i to
              top of entry i+1). Section i starts filling exactly when toc.ts
              highlights entry i, so the lit tip always sits in the highlighted
              entry; cell density follows text length, like a non-linear dial
              scale, eased across entry boundaries. Kept for later; not in use.
--------------------------------------------------------------------------- */
const TOC_RAIL: 'even' | 'scale' = 'even';

type RailCell = { top: number; height: number; at: number }; // at: scrollY where it lights
const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

/** xs: scrollY where each section becomes current, plus page end; ys: rail y of each entry, plus rail height. */
function evenCells(xs: number[], _ys: number[], h: number): RailCell[] {
  const PITCH = 5; // 3px cell + 2px gap, as the top tape
  const [start, finish] = [xs[0], xs[xs.length - 1]];
  const cells: RailCell[] = [];
  // steady: a cell lights once that share of the reading is done (ys is not needed here)
  for (let top = 0; top + 3 <= h; top += PITCH) {
    cells.push({ top, height: 3, at: start + ((top + PITCH) / h) * (finish - start) });
  }
  return cells;
}

function scaleCells(xs: number[], ys: number[], h: number): RailCell[] {
  const MIN_PITCH = 6; // shortest cell 4px + 2px gap
  const BLUR = 20; // px of rail over which the pitch eases from one section to the next
  const m = xs.length - 1;
  // scroll per cell, so that an evenly spaced tape would have as many cells
  const step = Math.max(1, (xs[m] - xs[0]) / Math.floor(h / MIN_PITCH));

  // wanted pitch at every px of rail (log scale, so the blur eases evenly), then blurred
  const H = Math.ceil(h);
  const raw = new Float64Array(H);
  for (let i = 0, y = 0; y < H; y++) {
    while (i < m - 1 && y >= ys[i + 1]) i++;
    const span = ys[i + 1] - ys[i];
    const len = Math.max(1, xs[i + 1] - xs[i]);
    raw[y] = Math.log(clamp((span * step) / len, MIN_PITCH, Math.max(MIN_PITCH, span)));
  }
  const R = Math.ceil(BLUR * 1.5);
  const kern = Array.from({ length: 2 * R + 1 }, (_, j) => Math.exp(-(((j - R) / (BLUR / 2)) ** 2) / 2));
  const dens = new Float64Array(H + 1); // cells per px of rail
  for (let y = 0; y < H; y++) {
    let sum = 0, w = 0;
    for (let j = -R; j <= R; j++) {
      sum += raw[clamp(y + j, 0, H - 1)] * kern[j + R];
      w += kern[j + R];
    }
    dens[y] = Math.exp(-sum / w);
  }
  // N(y): cells from the top of the rail to y
  const N = new Float64Array(H + 1);
  for (let y = 0; y < H; y++) N[y + 1] = N[y] + dens[y];
  const cellsAt = (y: number) => {
    const y0 = clamp(Math.floor(y), 0, H - 1);
    return N[y0] + (y - y0) * dens[y0];
  };
  const yOf = (goal: number, lo: number, hi: number) => {
    // inverse of N on [lo, hi]
    for (let k = 0; k < 24; k++) {
      const mid = (lo + hi) / 2;
      if (cellsAt(mid) < goal) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };

  const cells: RailCell[] = [];
  for (let i = 0; i < m; i++) {
    const [y0, y1] = [ys[i], ys[i + 1]];
    const span = y1 - y0;
    if (span < MIN_PITCH - 2) continue;
    const [n0, n1] = [cellsAt(y0), cellsAt(y1)];
    const n = clamp(Math.round(n1 - n0), 1, Math.max(1, Math.floor(span / MIN_PITCH)));
    const bounds = Array.from({ length: n + 1 }, (_, k) =>
      k === 0 ? y0 : k === n ? y1 : yOf(n0 + ((n1 - n0) * k) / n, y0, y1),
    );
    const len = Math.max(0, xs[i + 1] - xs[i]);
    for (let k = 0; k < n; k++) {
      const top = Math.round(bounds[k]);
      const next = Math.round(bounds[k + 1]);
      // cells tile the section with a fixed 2px gap; the first lights as it becomes current
      cells.push({ top, height: Math.max(1, next - top - 2), at: xs[i] + ((bounds[k] - y0) / span) * len });
    }
  }
  return cells;
}

function setupToc() {
  if (!has('toc')) return;
  const nav = document.querySelector<HTMLElement>('[data-toc]');
  const list = nav?.querySelector('ol');
  const article = document.querySelector<HTMLElement>('main article');
  if (!nav || !list || !article) return;

  const rail = document.createElement('span');
  rail.className = 'lamp-toc-rail';
  rail.setAttribute('aria-hidden', 'true');
  list.prepend(rail);

  const links = [...list.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const heads = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))));

  let dots: { el: HTMLElement; at: number; on: boolean }[] = [];
  let finish = 0;
  const layout = () => {
    const line = innerHeight * 0.25;
    finish = Math.max(0, document.documentElement.scrollHeight - innerHeight);
    const railTop = rail.getBoundingClientRect().top;
    const h = rail.clientHeight;
    const secs = links.flatMap((a, i) =>
      heads[i]
        ? [{ s: Math.min(heads[i]!.getBoundingClientRect().top + scrollY - line, finish), y: clamp(a.getBoundingClientRect().top - railTop, 0, h) }]
        : [],
    );
    rail.replaceChildren();
    dots = [];
    if (!secs.length) return;
    const xs = [...secs.map((s) => s.s), finish];
    const ys = [...secs.map((s) => s.y), h];
    for (const c of (TOC_RAIL === 'scale' ? scaleCells : evenCells)(xs, ys, h)) {
      const el = document.createElement('i');
      el.style.top = `${c.top}px`;
      el.style.height = `${c.height}px`;
      rail.appendChild(el);
      dots.push({ el, at: c.at, on: false });
    }
    paint();
  };
  const paint = () => {
    // at the very bottom of the page light everything, even sections too short to reach the line
    const end = scrollY >= finish - 1;
    for (const d of dots) {
      const on = end || scrollY > d.at;
      if (on !== d.on) d.el.toggleAttribute('data-on', (d.on = on));
    }
  };

  const update = () => {
    const line = innerHeight * 0.25;
    links.forEach((a, i) => a.toggleAttribute('data-read', !!heads[i] && heads[i]!.getBoundingClientRect().top < line));
    paint();
    // keep the current section visible when the TOC is taller than its box
    const active = list.querySelector<HTMLElement>('a[data-active]');
    if (active && nav.scrollHeight > nav.clientHeight) {
      const a = active.getBoundingClientRect();
      const top = nav.scrollTop + (a.top - nav.getBoundingClientRect().top) - nav.clientHeight / 2 + a.height / 2;
      if (Math.abs(nav.scrollTop - top) > 24) nav.scrollTo({ top, behavior: 'smooth' });
    }
  };
  let ticking = false;
  addEventListener(
    'scroll',
    () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        update();
        ticking = false;
      });
    },
    { passive: true },
  );
  // re-space the dots whenever the page or the TOC changes height (resize, images, fonts)
  const ro = new ResizeObserver(() => {
    layout();
    update();
  });
  ro.observe(article);
  ro.observe(list);
  addEventListener('resize', layout); // a taller/shorter window moves the reading line
  layout(); // right away, not one frame later when the observer first reports
  update();
}

/* ---------------------------------------------------------------------------
   grille: a non-selectable blurred bloom clone of <code> layered under the
   pixel-grid overlay, plus a custom cell-tape horizontal scrollbar on
   overflowing code blocks (matching lamp-toc-rail / lamp-tape).
--------------------------------------------------------------------------- */
function setupCodeGlow() {
  if (!has('grille')) return;
  document.querySelectorAll<HTMLPreElement>('.code-block pre').forEach((pre) => {
    const code = pre.querySelector<HTMLElement>(':scope > code:not(.code-glow)');
    if (!code || pre.querySelector(':scope > code.code-glow')) return;
    const glow = code.cloneNode(true) as HTMLElement;
    glow.classList.add('code-glow');
    glow.setAttribute('aria-hidden', 'true');
    pre.appendChild(glow);
  });
}

function setupCodeScroll() {
  if (!has('grille')) return;
  document.querySelectorAll<HTMLElement>('.code-block').forEach((block) => {
    const pre = block.querySelector<HTMLPreElement>('pre');
    if (!pre || block.querySelector('.lamp-code-scroll')) return;

    const rail = document.createElement('div');
    rail.className = 'lamp-code-scroll';
    rail.setAttribute('aria-hidden', 'true');
    rail.hidden = true;
    const thumb = document.createElement('i');
    rail.appendChild(thumb);
    block.appendChild(rail);

    const update = () => {
      const max = pre.scrollWidth - pre.clientWidth;
      if (max <= 1) {
        rail.hidden = true;
        return;
      }
      rail.hidden = false;
      const trackW = rail.clientWidth;
      const thumbW = Math.min(trackW, Math.max(24, (pre.clientWidth / pre.scrollWidth) * trackW));
      const x = (pre.scrollLeft / max) * (trackW - thumbW);
      thumb.style.width = `${thumbW}px`;
      thumb.style.transform = `translateX(${x}px)`;
    };

    const scrub = (clientX: number) => {
      const max = pre.scrollWidth - pre.clientWidth;
      if (max <= 1) return;
      const r = rail.getBoundingClientRect();
      const thumbW = thumb.offsetWidth || 20;
      const ratio = Math.min(1, Math.max(0, (clientX - r.left - thumbW / 2) / Math.max(1, r.width - thumbW)));
      pre.scrollLeft = ratio * max;
    };

    rail.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      rail.setPointerCapture(e.pointerId);
      scrub(e.clientX);
    });
    rail.addEventListener('pointermove', (e) => {
      if (rail.hasPointerCapture(e.pointerId)) scrub(e.clientX);
    });

    pre.addEventListener('scroll', update, { passive: true });
    new ResizeObserver(update).observe(pre);
    document.fonts?.ready.then(update);
    update();
  });
}

/* ---------------------------------------------------------------------------
   search scroll: the results on the search screen scroll with the same thin bar
   as code blocks (lamp-code-scroll), turned upright: a 1px guide and a 1.5px
   glowing thumb. Drag it or click the guide.
--------------------------------------------------------------------------- */
function setupSearchScroll() {
  if (!has('grille')) return;
  const list = document.querySelector<HTMLElement>('[data-search-results]');
  const screen = list?.closest<HTMLElement>('[data-search-screen]');
  if (!list || !screen) return;
  const INSET = 8; // rail inset from the top and bottom of the list

  const rail = document.createElement('div');
  rail.className = 'lamp-search-scroll';
  rail.setAttribute('aria-hidden', 'true');
  rail.hidden = true;
  const thumb = document.createElement('i');
  rail.appendChild(thumb);
  screen.appendChild(rail);

  const update = () => {
    const max = list.scrollHeight - list.clientHeight;
    const scrolls = max > 1;
    rail.hidden = !scrolls;
    screen.toggleAttribute('data-scrolls', scrolls);
    if (!scrolls) return;
    const track = list.clientHeight - 2 * INSET;
    rail.style.top = `${list.offsetTop + INSET}px`;
    rail.style.height = `${track}px`;
    const h = Math.min(track, Math.max(24, (list.clientHeight / list.scrollHeight) * track));
    thumb.style.height = `${h}px`;
    thumb.style.transform = `translateY(${(list.scrollTop / max) * (track - h)}px)`;
  };

  const scrub = (clientY: number) => {
    const max = list.scrollHeight - list.clientHeight;
    if (max <= 1) return;
    const r = rail.getBoundingClientRect();
    const h = thumb.offsetHeight || 20;
    list.scrollTop = clamp((clientY - r.top - h / 2) / Math.max(1, r.height - h), 0, 1) * max;
  };
  rail.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    rail.setPointerCapture(e.pointerId);
    scrub(e.clientY);
  });
  rail.addEventListener('pointermove', (e) => {
    if (rail.hasPointerCapture(e.pointerId)) scrub(e.clientY);
  });

  list.addEventListener('scroll', update, { passive: true });
  new ResizeObserver(update).observe(list);
  new MutationObserver(update).observe(list, { childList: true });
  document.addEventListener('lamp:search-lines', update);
  update();
}

function setupCardTocScroll() {
  if (!has('toc')) return;
  const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');

  document.querySelectorAll<HTMLElement>('[data-post-cards] .card-toc-monitor').forEach((nav) => {
    const scroller = nav.querySelector<HTMLElement>('ol');
    if (!scroller || nav.dataset.tocReady) return;
    nav.dataset.tocReady = '1';

    let max = 0;
    let pos = 0;
    let dir = 1; // 1 = down, -1 = up
    let pauseUntil = performance.now() + 1800;
    let paused = false;
    let visible = false;
    let last = 0;
    let raf = 0;

    const SPEED = 14; // px per second
    const PAUSE_MS = 1800;

    const update = () => {
      max = scroller.scrollHeight - scroller.clientHeight;
      scroller.toggleAttribute('data-scrollable', max > 1);
    };

    const tick = (now: number) => {
      raf = 0;
      if (!visible || reducedMotion.matches) return;
      const dt = last ? Math.min(64, now - last) : 0;
      last = now;

      if (!paused && max > 1 && now >= pauseUntil) {
        pos = Math.min(max, Math.max(0, pos + (dir * SPEED * dt) / 1000));
        scroller.scrollTop = pos;
        if (pos >= max) {
          dir = -1;
          pauseUntil = now + PAUSE_MS;
        } else if (pos <= 0) {
          dir = 1;
          pauseUntil = now + PAUSE_MS;
        }
      }
      raf = requestAnimationFrame(tick);
    };

    const start = () => {
      if (raf || !visible || reducedMotion.matches) return;
      last = 0;
      pos = scroller.scrollTop;
      raf = requestAnimationFrame(tick);
    };

    nav.addEventListener('pointerenter', () => {
      paused = true;
    });
    nav.addEventListener('pointerleave', () => {
      pos = scroller.scrollTop;
      paused = false;
      pauseUntil = performance.now() + 900;
    });
    scroller.addEventListener(
      'scroll',
      () => {
        if (paused) pos = scroller.scrollTop;
        update();
      },
      { passive: true },
    );

    const io = new IntersectionObserver((entries) => {
      visible = entries[0]?.isIntersecting ?? false;
      if (visible) start();
      else if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    });
    io.observe(nav);

    new ResizeObserver(update).observe(scroller);
    document.fonts?.ready.then(update);
    update();
  });
}

/* --------------------------------------------------------------------------- */
if ([...root.classList].some((c) => c.startsWith('lamp-'))) {
  setupTape();
  setupCaret();
  setupCoverHover();
  setupToc();
  setupCodeGlow();
  setupCodeScroll();
  setupSearchScroll();
  setupCardTocScroll();
  paintLines();
  let t = 0;
  const repaint = () => {
    clearTimeout(t);
    t = window.setTimeout(paintLines, 120);
  };
  addEventListener('resize', repaint);
  document.addEventListener('lamp:search-lines', () => paintLines(searchLineSpecs()));
  document.querySelectorAll<HTMLDetailsElement>('details[data-toc-fold]').forEach((d) =>
    d.addEventListener('toggle', () => {
      const bar = d.querySelector<HTMLElement>(':scope > summary');
      if (!bar) return;
      if (d.open) paintLines();
      else bar.style.backgroundImage = '';
    }),
  );
  new MutationObserver(repaint).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  document.fonts?.ready.then(repaint);
}
