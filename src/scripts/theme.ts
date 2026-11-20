// Light/dark switch. The button names the theme it will switch to.
const root = document.documentElement;
const button = document.querySelector<HTMLButtonElement>('[data-theme-toggle]');
const themeColor = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');

function sync() {
  const dark = root.dataset.theme === 'dark';
  if (button) button.textContent = dark ? 'Light' : 'Dark';
  if (themeColor) themeColor.content = dark ? '#161616' : '#fafaf9';
}

button?.addEventListener('click', () => {
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  try {
    localStorage.setItem('theme', next);
  } catch {}
  sync();
});

sync();
