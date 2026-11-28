import assert from 'node:assert/strict';

export const path = 'preview/chat-page.mjs';
export const source = 'https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme';
function replace(sourceText, old, fresh) {
  assert.equal(sourceText.split(old).length, 2, 'source contract changed');
  return sourceText.replace(old, () => fresh);
}
export function transform(before, kind) {
  if (kind === 'dashboard-theme') {
    const light = ':root{color-scheme:light;--bg:#f1f5fb;--panel:#fff;--line:#bdc9dc;--ink:#17253c;--accent:#174d74}';
    const theme = '@media(prefers-color-scheme:light){'+light+'}';
    return replace(before, '*{box-sizing:border-box}', theme+'\n'+
      "[data-theme=light]{color-scheme:light;--bg:#f1f5fb;--panel:#fff;--line:#bdc9dc;--ink:#17253c;--accent:#174d74}\n"+
      '*{box-sizing:border-box}');
  }
  assert.equal(kind, 'composer-keyboard');
  return replace(before, "  $('composer').onsubmit = async event => {", 
    "  $('prompt').addEventListener('keydown', event => {\n"+
    "    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey) || event.isComposing || $('send').disabled) return;\n"+
    "    event.preventDefault();\n"+
    "    $('composer').requestSubmit();\n"+
    "  });\n  $('composer').onsubmit = async event => {");
}
