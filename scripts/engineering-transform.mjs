import assert from 'node:assert/strict';

export const path = 'preview/chat-page.mjs';
export const source = 'https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/color-scheme';
function replace(sourceText, old, fresh) {
  assert.equal(sourceText.split(old).length, 2, 'source contract changed');
  return sourceText.replace(old, () => fresh);
}
export function discoverDashboardRecipe(sourceText) {
  return sourceText.includes('@media(prefers-color-scheme:light)') &&
    !sourceText.includes('id="dashboard-theme"') ? 'dashboard-theme-selector' : null;
}

export function transform(before, kind) {
  if (kind === 'dashboard-theme') {
    const light = ':root{color-scheme:light;--bg:#f1f5fb;--panel:#fff;--line:#bdc9dc;--ink:#17253c;--accent:#174d74}';
    const theme = '@media(prefers-color-scheme:light){'+light+'}';
    return replace(before, '*{box-sizing:border-box}', theme+'\n'+
      "[data-theme=light]{color-scheme:light;--bg:#f1f5fb;--panel:#fff;--line:#bdc9dc;--ink:#17253c;--accent:#174d74}\n"+
      '*{box-sizing:border-box}');
  }
  if (kind === 'dashboard-theme-selector') {
    assert.equal(discoverDashboardRecipe(before),kind);
    const control = '<label for="dashboard-theme">${t(\'Theme\',\'المظهر\')}</label><select id="dashboard-theme">'+
      '<option value="system">${t(\'System\',\'النظام\')}</option><option value="light">${t(\'Light\',\'فاتح\')}</option>'+
      '<option value="dark">${t(\'Dark\',\'داكن\')}</option></select>';
    let page=replace(before,'</nav></header>',control+'</nav></header>');
    page=replace(page,'*{box-sizing:border-box}',
      '[data-theme=dark]{color-scheme:dark;--bg:#0b1120;--panel:#141e31;--line:#34425e;--ink:#eef2ff;--accent:#a9def6}\n'+
      'select{font:inherit;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:8px;padding:6px}\n'+
      '*{box-sizing:border-box}');
    const anchor="  const $ = id => document.getElementById(id);";
    const script=[
      anchor,
      "  const themeControl = $('dashboard-theme');",
      "  const themes = ['system','light','dark'];",
      "  const applyTheme = value => {",
      "    if(value==='system') delete root.dataset.theme;",
      "    else root.dataset.theme=value;",
      "  };",
      "  let savedTheme;",
      "  try { savedTheme=localStorage.getItem('badp-dashboard-theme'); } catch {}",
      "  themeControl.value=themes.includes(savedTheme)?savedTheme:(root.dataset.theme??'system');",
      "  applyTheme(themeControl.value);",
      "  themeControl.addEventListener('change',()=>{",
      "    if(!themes.includes(themeControl.value)) return;",
      "    applyTheme(themeControl.value);",
      "    try { localStorage.setItem('badp-dashboard-theme',themeControl.value); } catch {}",
      "  });",
    ].join('\n');
    return replace(page,anchor,script);
  }
  assert.equal(kind, 'composer-keyboard');
  return replace(before, "  $('composer').onsubmit = async event => {", 
    "  $('prompt').addEventListener('keydown', event => {\n"+
    "    if (event.key !== 'Enter' || (!event.ctrlKey && !event.metaKey) || event.isComposing || $('send').disabled) return;\n"+
    "    event.preventDefault();\n"+
    "    $('composer').requestSubmit();\n"+
    "  });\n  $('composer').onsubmit = async event => {");
}
