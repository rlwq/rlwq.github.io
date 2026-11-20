// Search dialog: ⌘K / Ctrl+K or "/" opens it. The index is a small JSON file
// built with the site (/search.json), loaded the first time search opens.

type Doc = { t: string; u: string; g: string; x: string };

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
    const start = Math.max(0, i - 50);
    return (start > 0 ? '…' : '') + text.slice(start, start + 150) + (start + 150 < text.length ? '…' : '');
  }

  async function run() {
    const q = norm(input.value.trim());
    const words = q.split(/\s+/).filter(Boolean);
    if (!words.length) {
      results.innerHTML = '';
      empty.hidden = false;
      empty.textContent = 'Start typing — search covers titles, tags and article text.';
      return;
    }
    docs ??= fetch('/search.json').then((r) => r.json());
    const all = await docs;
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
      .map(
        ({ d }, i) =>
          `<li><a class="block rounded-sm px-3 py-2.5 aria-selected:bg-muted" href="${d.u}" role="option" aria-selected="${i === 0}"><strong class="block font-medium">${highlight(d.t, hl)}</strong><span class="block text-sm leading-[21px] text-muted-foreground">${highlight(snipWord ? snippet(d.x, snipWord) : d.x.slice(0, 140) + (d.x.length > 140 ? '…' : ''), hl)}</span></a></li>`,
      )
      .join('');
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
    docs ??= fetch('/search.json').then((r) => r.json());
    if (initialQuery !== undefined) {
      input.value = initialQuery;
      input.focus();
      input.setSelectionRange(input.value.length, input.value.length);
      input.dispatchEvent(new Event('input'));
    } else {
      input.select();
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

  document.querySelectorAll('[data-search-open]').forEach((b) => b.addEventListener('click', () => show()));
  document.addEventListener('click', (e) => {
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
    const link = (e.target as Element).closest<HTMLAnchorElement>('a[href^="/tag/"]');
    if (!link) return;
    const tag = link.textContent?.trim().replace(/^#/, '');
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
