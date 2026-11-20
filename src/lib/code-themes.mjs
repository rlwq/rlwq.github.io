// Phosphor / neon-CRT syntax themes for Shiki (both dark and light).
// Tuned for the soft phosphor bloom in lamp.css, anchored to the blog's
// graphite + amber palette.

/** @param {string} name @param {'light' | 'dark'} type @param {Record<string, string>} c */
function phosphor(name, type, c) {
  const rule = (scope, foreground, fontStyle) => ({ scope, settings: fontStyle ? { foreground, fontStyle } : { foreground } });
  return {
    name,
    type,
    colors: { 'editor.foreground': c.text, 'editor.background': c.bg },
    tokenColors: [
      rule(['source', 'variable', 'punctuation', 'meta.function-call'], c.text),
      rule(['keyword.operator'], c.operator),
      rule(['comment', 'punctuation.definition.comment'], c.comment, 'italic'),
      rule(['keyword', 'storage.type', 'storage.modifier', 'constant.language', 'keyword.operator.logical', 'keyword.operator.word'], c.keyword),
      rule(['string', 'storage.type.string', 'punctuation.definition.string'], c.string),
      rule(['string.quoted.docstring', 'string.quoted.docstring punctuation.definition.string'], c.docstring, 'italic'),
      rule(['constant.numeric'], c.number),
      rule(['constant.character.escape', 'constant.character.format.placeholder', 'meta.fstring.python punctuation.brace'], c.keyword),
      rule(['entity.name.type', 'support.type'], c.type),
      rule(['entity.name.function', 'meta.function entity.name.function'], c.functionDecl),
      rule(['support.function.builtin', 'support.function.magic', 'support.type.python'], c.builtin),
      rule(['variable.language.special.self', 'variable.parameter.function.language.special.self', 'variable.language.this'], c.self),
      rule(['meta.function.decorator', 'entity.name.function.decorator', 'punctuation.definition.decorator'], c.decorator),
      rule(['variable.parameter.function-call'], c.namedArg),
      rule(['entity.name.tag'], c.keyword),
      rule(['entity.other.attribute-name'], c.type),
    ],
  };
}

/** Crisp neon-ink syntax theme for the light site theme. */
export const phosphorLight = phosphor('phosphor-light', 'light', {
  bg: '#f2f1ee',
  text: '#1c1b1a',
  operator: '#9a4408',
  keyword: '#d95800',
  string: '#008a58',
  docstring: '#00754b',
  number: '#0070d1',
  type: '#007b9e',
  functionDecl: '#0070c0',
  builtin: '#7c3aed',
  self: '#c42275',
  decorator: '#c42275',
  namedArg: '#c2410c',
  comment: '#84817b',
});

/** Luminous CRT phosphor syntax theme for the dark site theme. */
export const phosphorDark = phosphor('phosphor-dark', 'dark', {
  bg: '#1f1f1e',
  text: '#edeae4',
  operator: '#f5b067',
  keyword: '#ff9638',
  string: '#57f2a6',
  docstring: '#4bd692',
  number: '#61dcff',
  type: '#7ce8ff',
  functionDecl: '#72e3ff',
  builtin: '#c29eff',
  self: '#ff78b8',
  decorator: '#ff78b8',
  namedArg: '#ffa066',
  comment: '#7e7c77',
});
