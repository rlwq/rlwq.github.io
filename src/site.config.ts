// Site-wide settings: name, description, menu.
export const site = {
  title: 'rlwq blog',
  tagline: 'Long-form writing on systems, programming languages and applied AI.',
  description: 'In-depth articles on systems programming, programming languages and applied AI — with code, charts and notes in the margins.',
  lang: 'en',
  nav: [] as { href: string; label: string }[],
  /** The light theme is fully styled (palette, [data-theme='light'] rules in the CSS, the
   *  phosphor-light code theme) but hidden: the site is always dark. true brings back the
   *  Theme switch in the header, the OS preference and the saved choice. */
  lightTheme: false,
};

