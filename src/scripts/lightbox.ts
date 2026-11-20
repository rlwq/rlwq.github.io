// Click-to-zoom lightbox for article figures (raster images and inline SVGs).
const article = document.querySelector('article');

if (article) {
  let dialog: HTMLDialogElement | null = null;

  function ensureDialog(): HTMLDialogElement {
    if (dialog) return dialog;
    dialog = document.createElement('dialog');
    dialog.className = 'lightbox';
    dialog.setAttribute('aria-label', 'Expanded figure');
    dialog.addEventListener('click', (e) => {
      const target = e.target as Element;
      if (target.closest('a, .lightbox-caption')) return;
      dialog?.close();
    });
    document.body.appendChild(dialog);
    return dialog;
  }

  function openMedia(target: HTMLImageElement | SVGSVGElement) {
    const dlg = ensureDialog();
    dlg.innerHTML = '';

    const bar = document.createElement('div');
    bar.className = 'lightbox-bar';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'lightbox-btn lightbox-close';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = 'Close <kbd>Esc</kbd>';
    close.addEventListener('click', () => dlg.close());

    bar.append(close);

    const wrap = document.createElement('div');
    wrap.className = 'lightbox-inner';

    const frame = document.createElement('div');
    frame.className = 'lightbox-frame';

    if (target instanceof HTMLImageElement) {
      const img = document.createElement('img');
      img.src = target.currentSrc || target.src;
      img.alt = target.alt;
      img.className = 'lightbox-img';
      frame.appendChild(img);
    } else {
      const svg = target.cloneNode(true) as SVGSVGElement;
      const vb = target.viewBox?.baseVal;
      const rect = target.getBoundingClientRect();
      const natW = vb && vb.width > 0 ? vb.width : rect.width || 600;
      const natH = vb && vb.height > 0 ? vb.height : rect.height || 400;
      const scale = Math.min((window.innerWidth * 0.88) / natW, (window.innerHeight * 0.76) / natH, 2.4);
      svg.style.width = `${Math.round(natW * scale)}px`;
      svg.style.height = `${Math.round(natH * scale)}px`;
      svg.classList.add('lightbox-svg');
      frame.appendChild(svg);
    }

    wrap.appendChild(frame);

    const caption = target.closest('figure')?.querySelector('figcaption');
    if (caption?.textContent?.trim()) {
      const cap = document.createElement('p');
      cap.className = 'lightbox-caption';
      cap.innerHTML = caption.innerHTML;
      wrap.appendChild(cap);
    }

    dlg.append(bar, wrap);
    if (!dlg.open) dlg.showModal();
  }

  article.addEventListener('click', (event) => {
    const el = event.target as Element | null;
    if (!el || el.closest('a')) return;
    const img = el.closest<HTMLImageElement>('figure img');
    if (img) {
      openMedia(img);
      return;
    }
    const svg = el.closest<SVGSVGElement>('figure .svg-figure svg');
    if (svg) {
      openMedia(svg);
    }
  });
}
