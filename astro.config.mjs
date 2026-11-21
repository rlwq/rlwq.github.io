// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { callouts, codeBlocks, codeTitle, figures, headingAnchors, inlineSvg, math, sidenotes, tailwindClasses, wikilinks } from './src/lib/markdown-plugins.mjs';
import markdownClasses from './src/styles/markdown-classes.mjs';
import { phosphorDark, phosphorLight } from './src/lib/code-themes.mjs';

import tailwindcss from '@tailwindcss/vite';
import { site } from './src/site.config.ts';

const notesDir = fileURLToPath(new URL('./src/content/posts/', import.meta.url));

/** While the light theme is hidden (site.lightTheme), its CSS stays in the sources but
 *  never ships: every rule whose selectors all name [data-theme=light] is dropped from
 *  the built stylesheets. Only leaf rules (no nested blocks) are touched. */
/** @returns {import('vite').Plugin} */
function dropLightTheme() {
  const light = /\[data-theme=(['"]?)light\1\]/;
  // the lookbehind leaves the previous rule's } in place, so back-to-back rules all match
  const rule = /(?<=^|[{};])([^{};@]+)\{[^{}]*\}/g;
  /** @param {string} css */
  const strip = (css) =>
    css.replace(rule, (/** @type {string} */ all, /** @type {string} */ selectors) =>
      selectors.split(',').every((s) => light.test(s)) ? '' : all,
    );
  return {
    name: 'drop-light-theme',
    apply: 'build',
    generateBundle(_, bundle) {
      for (const file of Object.values(bundle)) {
        if (file.type === 'asset' && file.fileName.endsWith('.css')) file.source = strip(String(file.source));
      }
    },
  };
}

export default defineConfig({
  // Your site's address: used by RSS, the sitemap and social previews.
  site: 'https://rlwq.github.io',

  trailingSlash: 'always',
  // the article list lives on the home page; articles themselves stay at /blog/<name>/
  redirects: { '/blog': '/' },
  integrations: [sitemap()],

  markdown: {
    processor: satteri({
      features: {
        wikilinks: true,
        math: true,
      },
      hastPlugins: [
        wikilinks({ notesDir, base: '/blog/' }),
        callouts(),
        math(),
        headingAnchors(),
        codeBlocks(),
        sidenotes(),
        inlineSvg({ notesDir }),
        figures(),
        // Last: Tailwind classes for every element of the article text.
        tailwindClasses(markdownClasses),
      ],
    }),
    // Phosphor / neon-CRT syntax themes. Each token carries a color per theme
    // (--shiki-light / --shiki-dark); markdown-classes.mjs picks one by the site theme.
    // With the light theme hidden only the dark colors are emitted.
    shikiConfig: {
      themes: site.lightTheme ? { light: phosphorLight, dark: phosphorDark } : { dark: phosphorDark },
      defaultColor: false,
      transformers: [codeTitle],
    },
  },

  vite: {
    plugins: [tailwindcss(), ...(site.lightTheme ? [] : [dropLightTheme()])],
  },
});
