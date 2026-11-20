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

function paintLines() {
  if (!has('ui')) return;
  for (const { el, side, thick, color, peak, cell = CELL, flip = false } of lineSpecs()) {
    const vertical = side === 'left' || side === 'right';
    const r = el.getBoundingClientRect();
    const len = vertical ? r.height : r.width;
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
--------------------------------------------------------------------------- */
function setupToc() {
  if (!has('toc')) return;
  const nav = document.querySelector<HTMLElement>('[data-toc]');
  const list = nav?.querySelector('ol');
  const article = document.querySelector<HTMLElement>('main article');
  if (!nav || !list || !article) return;

  const rail = document.createElement('span');
  rail.className = 'lamp-toc-rail';
  rail.setAttribute('aria-hidden', 'true');
  const fill = document.createElement('i');
  rail.appendChild(fill);
  list.prepend(rail);

  const links = [...list.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const heads = links.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))));

  const update = () => {
    const line = innerHeight * 0.25;
    links.forEach((a, i) => a.toggleAttribute('data-read', !!heads[i] && heads[i]!.getBoundingClientRect().top < line));
    // from "first section reaches the reading line" to "bottom of the page"
    const start = (heads[0]?.getBoundingClientRect().top ?? 0) + scrollY - line;
    const finish = document.documentElement.scrollHeight - innerHeight;
    const p = finish > start ? Math.min(1, Math.max(0, (scrollY - start) / (finish - start))) : 1;
    const h = rail.clientHeight;
    // whole cells only; at the very end light the last one too, even if the rail isn't a multiple of a cell
    fill.style.height = p >= 0.995 ? '100%' : `${Math.floor((p * h) / 5) * 5}px`;
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
  addEventListener('resize', update);
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
  setupCardTocScroll();
  paintLines();
  let t = 0;
  const repaint = () => {
    clearTimeout(t);
    t = window.setTimeout(paintLines, 120);
  };
  addEventListener('resize', repaint);
  new MutationObserver(repaint).observe(root, { attributes: true, attributeFilter: ['data-theme'] });
  document.fonts?.ready.then(repaint);
}
