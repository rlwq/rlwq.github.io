// "Copy" button on code blocks.
document.addEventListener('click', async (event) => {
  const button = (event.target as Element).closest<HTMLButtonElement>('[data-copy-code]');
  if (!button) return;
  const block = button.closest<HTMLElement>('.code-block');
  const code =
    block?.querySelector<HTMLElement>('pre > code:not(.code-glow)') ??
    block?.querySelector<HTMLElement>('pre');
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code.innerText.replace(/\n$/, ''));
    button.textContent = 'Copied';
    block?.setAttribute('data-copied', '');
  } catch {
    button.textContent = 'Failed';
  }
  setTimeout(() => {
    button.textContent = 'Copy';
    block?.removeAttribute('data-copied');
  }, 1600);
});
