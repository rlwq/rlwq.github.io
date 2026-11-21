// Search dialog: ⌘K / Ctrl+K or "/" opens it. The index is a small JSON file
// built with the site (/search.json), loaded the first time search opens.

// t title, u url, g tags (space-separated), d date (YYYY-MM-DD), m minutes to read, x text
type Doc = { t: string; u: string; g: string; d: string; m: number; x: string };

const loadDocs = () => fetch('/search.json').then((r) => r.json() as Promise<Doc[]>);

const dialog = document.querySelector<HTMLDialogElement>('[data-search]');
if (dialog) initSearch(dialog);

function initSearch(dialog: HTMLDialogElement) {
  const input = dialog.querySelector<HTMLInputElement>('[data-search-input]')!;
  const results = dialog.querySelector<HTMLUListElement>('[data-search-results]')!;
  const empty = dialog.querySelector<HTMLElement>('[data-search-empty]')!;
  let docs: Promise<Doc[]> | null = null;
  let selected = 0;

  const escape = (s: string) => s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]!);
  const norm = (s: string) => s.toLowerCase().replace(/ё/g, 'е');

  function highlight(text: string, words: string[]) {
    let html = escape(text);
    for (const w of words) {
      const re = new RegExp(`(${w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
      html = html.replace(re, '<mark class="bg-transparent text-primary">$1</mark>');
    }
    return html;
  }

  function snippet(text: string, word: string) {
    const i = norm(text).indexOf(word);
    if (i < 0) return text.slice(0, 140) + (text.length > 140 ? '…' : '');
    let start = Math.max(0, i - 50);
    // start on a word boundary, not halfway through a word
    if (start > 0) {
      const space = text.indexOf(' ', start);
      if (space >= 0 && space < i) start = space + 1;
    }
    return (start > 0 ? '…' : '') + text.slice(start, start + 150) + (start + 150 < text.length ? '…' : '');
  }

  // empty query: just the hint
  function idle() {
    results.innerHTML = '';
    empty.hidden = false;
    empty.textContent = 'Type to search titles, tags and article text.';
  }

  let runs = 0;
  async function run() {
    const q = norm(input.value.trim());
    const words = q.split(/\s+/).filter(Boolean);
    docs ??= loadDocs();
    const turn = ++runs;
    const all = await docs;
    if (turn !== runs) return; // a newer keystroke already ran
    if (!words.length) return idle();
    const textWords = words.filter((w) => !w.startsWith('#'));
    const scored = all
      .map((d) => {
        const title = norm(d.t);
        const tags = norm(d.g);
        const tagList = tags.split(/\s+/).filter(Boolean);
        const body = norm(d.x);
        let score = 0;
        for (const w of words) {
          if (w.startsWith('#')) {
            const needle = w.slice(1);
            if (!needle) continue;
            const exact = tagList.includes(needle);
            const partial = !exact && tagList.some((t) => t.includes(needle));
            if (!exact && !partial) return null;
            score += exact ? 12 : 6;
            continue;
          }
          const s = (title.includes(w) ? 10 : 0) + (tags.includes(w) ? 4 : 0) + (body.includes(w) ? 1 : 0);
          if (!s) return null;
          score += s + (title.startsWith(w) ? 5 : 0);
        }
        return { d, score };
      })
      .filter((r): r is { d: Doc; score: number } => !!r)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    selected = 0;
    empty.hidden = scored.length > 0;
    empty.textContent = 'Nothing found.';
    const hl = textWords.length ? textWords : [];
    const snipWord = textWords[0] ?? '';
    results.innerHTML = scored
      .map(({ d }, i) => {
        const text = snipWord ? snippet(d.x, snipWord) : d.x.slice(0, 140) + (d.x.length > 140 ? '…' : '');
        const tags = d.g.split(/\s+/).filter(Boolean).map((t) => `<span class="search-tag">${escape(t)}</span>`).join('');
        return `<li><a class="grid grid-cols-[24px_1fr] gap-x-2 rounded-[3px] px-3 py-3" href="${d.u}" role="option" aria-selected="${i === 0}">
          <span class="search-n pt-px font-mono text-[12px] leading-5" aria-hidden="true">${String(i + 1).padStart(2, '0')}</span>
          <span class="min-w-0">
            <strong class="block font-mono text-[13.5px] leading-5 font-medium">${highlight(d.t, hl)}</strong>
            <span class="search-meta mt-1 flex flex-wrap items-center gap-x-3.5 gap-y-1 font-mono text-[10.5px] leading-4 tracking-[0.06em] text-muted-foreground uppercase"><span>${escape(d.d)}<span class="mx-2 opacity-50">·</span>${d.m} min read</span>${tags}</span>
            <span class="search-snip mt-1.5 line-clamp-2 font-mono text-[12px] leading-[19px] text-muted-foreground">${highlight(text, hl)}</span>
          </span>
        </a></li>`;
      })
      .join('');
    document.dispatchEvent(new Event('lamp:search-lines'));
  }

  function move(delta: number) {
    const items = [...results.querySelectorAll('a')];
    if (!items.length) return;
    selected = (selected + delta + items.length) % items.length;
    items.forEach((a, i) => a.setAttribute('aria-selected', String(i === selected)));
    items[selected].scrollIntoView({ block: 'nearest' });
  }

  function show(initialQuery?: string) {
    if (!dialog.open) dialog.showModal();
    document.dispatchEvent(new Event('lamp:search-lines'));
    docs ??= loadDocs();
    if (initialQuery !== undefined) {
      input.value = initialQuery;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input'));
    } else {
      input.select();
      void run();
    }
  }

  input.addEventListener('input', run);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'ArrowDown') (e.preventDefault(), move(1));
    if (e.key === 'ArrowUp') (e.preventDefault(), move(-1));
    if (e.key === 'Enter') {
      const a = results.querySelectorAll('a')[selected];
      if (a) location.href = a.href;
    }
  });
  results.addEventListener('pointermove', (e) => {
    const a = (e.target as Element).closest('a');
    const items = [...results.querySelectorAll('a')];
    const i = a ? items.indexOf(a) : -1;
    if (i >= 0 && i !== selected) {
      selected = i;
      items.forEach((el, j) => el.setAttribute('aria-selected', String(j === i)));
    }
  });
  dialog.addEventListener('click', (e) => {
    if (e.target === dialog) dialog.close();
  });
  dialog.querySelector('[data-search-close]')?.addEventListener('click', () => dialog.close());

  document.querySelectorAll('[data-search-open]').forEach((b) => b.addEventListener('click', () => show()));
  // tags (in article headers and on cards) open the search filtered to that tag
  document.addEventListener('click', (e) => {
    const tag = (e.target as Element).closest<HTMLElement>('[data-tag]')?.dataset.tag?.trim();
    if (!tag) return;
    e.preventDefault();
    show(`#${tag}`);
  });
  document.addEventListener('keydown', (e) => {
    const typing = (e.target as HTMLElement).closest?.('input, textarea, [contenteditable="true"]');
    if ((e.key === 'k' || e.key === 'л') && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      show();
    } else if (e.key === '/' && !typing && !dialog.open) {
      e.preventDefault();
      show();
    }
  });
}
