// Tailwind classes for the HTML made from Markdown (article text).
// The markdown plugin puts these classes on every element when the site is built.
//
// Keys:
//   'h2'         every <h2>
//   'li p'       a <p> whose parent is <li> (replaces the plain 'p' rule)
//   '.callout'   an element with this class, made by our plugins
//                (replaces the tag rule; several class rules add up)

export default {
  // ---- Headings ---------------------------------------------------------
  h2: 'group relative mt-13 mb-3 text-[28px] leading-[35px] font-normal italic text-balance scroll-mt-18 first:mt-0',
  h3: 'group relative mt-[38px] mb-2 text-[22px] leading-[30px] font-normal italic text-balance scroll-mt-18 first:mt-0',
  h4: 'group relative mt-7 mb-1.5 text-[19px] font-normal italic scroll-mt-18',
  // "#" link that shows up next to a heading on hover
  '.heading-anchor':
    "absolute -left-[0.85em] pr-[0.2em] text-muted-foreground not-italic opacity-0 transition-opacity before:content-['#'] group-hover:opacity-55 focus-visible:opacity-55",

  // ---- Text -------------------------------------------------------------
  p: 'mb-6',
  a: 'text-primary no-underline transition-opacity hover:opacity-75',
  strong: 'font-[650]',
  hr: 'my-11',
  blockquote: 'mb-6 border-l-2 pl-[18px] italic text-muted-foreground [&>:last-child]:mb-0',
  // [[link]] to an article that isn't written yet
  '.link-missing': 'cursor-help text-muted-foreground underline decoration-border decoration-dotted underline-offset-3',

  // ---- Lists ------------------------------------------------------------
  ul: 'mb-6 list-disc pl-[1.4em] marker:text-muted-foreground',
  ol: 'mb-6 list-decimal pl-[1.4em] marker:text-muted-foreground',
  li: 'mt-1.5 first:mt-0',
  'li p': 'mb-0',
  'li ul': 'mt-1.5 list-disc pl-[1.4em] marker:text-muted-foreground',
  'li ol': 'mt-1.5 list-decimal pl-[1.4em] marker:text-muted-foreground',
  '.contains-task-list': 'mb-6 list-none pl-[0.2em]',
  input: 'mr-1.5 accent-primary',

  // ---- Code -------------------------------------------------------------
  code: 'rounded-[3px] border bg-muted px-[5px] py-px font-mono text-[0.82em]',
  'pre code': '',
  pre: 'm-0 overflow-x-auto px-4 py-3.5 font-mono text-[13.5px] leading-[21px] [scrollbar-width:thin] text-(--shiki-light) dark:text-(--shiki-dark) [&_span]:text-(--shiki-light) dark:[&_span]:text-(--shiki-dark) [&_span]:[font-style:var(--shiki-light-font-style)] dark:[&_span]:[font-style:var(--shiki-dark-font-style)]',
  '.code-block': 'mb-6 flex flex-col overflow-hidden rounded-md border bg-muted',
  '.code-bar': 'order-first flex min-h-8 items-center justify-between gap-3 border-b pr-1.5 pl-4 font-sans text-xs text-muted-foreground',
  '.code-label': 'font-mono text-xs',
  '.code-title': 'font-mono text-xs text-foreground',
  '.code-copy': 'cursor-pointer rounded-[3px] px-2 py-0.5 font-sans text-xs text-muted-foreground hover:bg-foreground/10 hover:text-foreground',

  // ---- Callouts: > [!note], > [!tip], > [!warning], > [!danger] ---------
  '.callout': 'mb-6 rounded-r-md border-l-[3px] border-(--c) bg-(--c)/8 px-[18px] py-3.5 text-[17px] leading-7 [&>:last-child]:mb-0',
  '.callout-note': '[--c:var(--note)]',
  '.callout-tip': '[--c:var(--tip)]',
  '.callout-warning': '[--c:var(--warning)]',
  '.callout-danger': '[--c:var(--danger)]',
  '.callout-quote': '[--c:var(--muted-foreground)] italic',
  '.callout-title': 'mt-0 mb-1 font-sans text-[13px] leading-5 font-semibold not-italic text-(--c)',

  // ---- Math -------------------------------------------------------------
  '.math-inline': '[&_.katex]:text-[1.06em]',
  '.math-display': 'mb-6 overflow-x-auto overflow-y-hidden py-1 [&_.katex]:text-[1.06em]',

  // ---- Tables -----------------------------------------------------------
  table: 'mb-6 block w-full overflow-x-auto text-base leading-6',
  th: 'border-b py-2 pr-4 text-left align-top font-sans text-[13px] font-semibold text-muted-foreground',
  td: 'border-b py-2 pr-4 align-top',

  // ---- Images: ![alt](src) with an italic caption line under it ---------
  figure: 'my-8 first:mt-0',
  '.figure-plate': 'my-8 first:mt-0',
  img: 'block w-full rounded-sm dark:brightness-90',
  '.svg-figure': '[&_svg]:mx-auto [&_svg]:block [&_svg]:h-auto [&_svg]:max-w-full',
  figcaption: 'mt-2.5 font-sans text-[13px] leading-[19px] text-muted-foreground',

  // ---- Sidenotes: in the right margin on wide screens, under the line otherwise
  '.sidenote-ref': 'px-px font-sans text-[11px] leading-none font-semibold text-primary',
  '.sidenote':
    'my-2.5 block border-l-2 pl-3.5 text-[15px] leading-6 text-muted-foreground not-italic wide:relative wide:float-right wide:clear-right wide:mt-1 wide:mb-3 wide:-mr-[276px] wide:w-[220px] wide:border-0 wide:p-0 wide:text-sm wide:leading-[21px]',
  '.sidenote-n': 'font-sans text-[11px] font-semibold text-primary',
};
