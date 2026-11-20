// @ts-check
import { fileURLToPath } from 'node:url';
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';
import { satteri } from '@astrojs/markdown-satteri';
import { callouts, codeBlocks, codeTitle, figures, headingAnchors, inlineSvg, math, sidenotes, tailwindClasses, wikilinks } from './src/lib/markdown-plugins.mjs';
import markdownClasses from './src/styles/markdown-classes.mjs';
import { phosphorDark, phosphorLight } from './src/lib/code-themes.mjs';

import tailwindcss from '@tailwindcss/vite';

const notesDir = fileURLToPath(new URL('./src/content/posts/', import.meta.url));

export default defineConfig({
  // Your site's address: used by RSS, the sitemap and social previews.
  site: 'https://example.com',

  trailingSlash: 'always',
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
    // Phosphor / neon-CRT syntax themes. Each token carries both colors
    // (--shiki-light / --shiki-dark); markdown-classes.mjs picks one by the site theme.
    shikiConfig: {
      themes: { light: phosphorLight, dark: phosphorDark },
      defaultColor: false,
      transformers: [codeTitle],
    },
  },

  vite: {
    plugins: [tailwindcss()],
  },
});
