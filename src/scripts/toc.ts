// Highlights the section you are reading in the side table of contents.
const toc = document.querySelector<HTMLElement>('[data-toc]');

if (toc) {
  const links = [...toc.querySelectorAll<HTMLAnchorElement>('a[href^="#"]')];
  const headings = links
    .map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1))))
    .filter((h): h is HTMLElement => !!h);

  let current = -1;
  const update = () => {
    const line = window.innerHeight * 0.25;
    let active = -1;
    headings.forEach((h, i) => {
      if (h.getBoundingClientRect().top < line) active = i;
    });
    if (active === current) return;
    current = active;
    links.forEach((a, i) => a.toggleAttribute('data-active', i === active));
  };

  let ticking = false;
  window.addEventListener(
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
  update();
}
