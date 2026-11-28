function client() {
  const root = document.documentElement;
  const ar = root.lang === 'ar';
  const t = (english, arabic) => ar ? arabic : english;
  const $ = id => document.getElementById(id);
  const error = $('error');
  const labels = {
    queued: t('Queued', 'في الانتظار'), running: t('Running', 'قيد التنفيذ'),
    paused: t('Paused', 'متوقفة'), review: t('Ready for review', 'جاهزة للمراجعة'),
    blocked: t('Blocked', 'متعذرة'), plan: t('Planning', 'التخطيط'),
    patch: t('Building', 'الإنشاء'), test: t('Testing', 'الاختبار'),
    preview: t('Saving preview', 'حفظ المعاينة'),
  };
  const names = {
    daily_limit: t('Daily task limit reached. Try again tomorrow.', 'بلغت الحد اليومي للمهام. حاول مجددًا غدًا.'),
    invalid_attachment: t('Attach a TXT, MD, CSV or JSON file up to 4 KB.', 'أرفق ملف TXT أو MD أو CSV أو JSON بحجم لا يتجاوز 4 كيلوبايت.'),
    invalid_state: t('The task has changed. Check its latest status.', 'تغيّرت حالة المهمة. اطّلع على حالتها الحالية.'),
  };
  async function api(path, options) {
    const response = await fetch('/api/chat'+path, options);
    if (response.status === 401) {
      location.assign('/');
      throw Error('unauthorized');
    }
    const body = await response.json();
    if (!response.ok) throw Error(body.error);
    return body;
  }
  function show(err) {
    error.textContent = names[err.message] ?? t('The request could not be completed. Try again.', 'تعذّر إكمال الطلب. حاول مجددًا.');
  }
  function node(tag, label) {
    const value = document.createElement(tag);
    if (label) value.textContent = label;
    return value;
  }
  async function refresh() {
    const {tasks} = await api('');
    const fingerprint = JSON.stringify(tasks.map(task => [task, task.state === 'running' && Date.now()/1000-task.updated_at > 120]));
    if (fingerprint === refresh.last) return;
    refresh.last = fingerprint;
    $('history').replaceChildren(...tasks.reverse().map(task => {
      const article = node('article');
      const prompt = node('p', task.prompt);
      prompt.dir = 'auto';
      prompt.className = 'message';
      article.append(prompt);
      if (task.attachment_name) article.append(node('small', task.attachment_name));
      const category = {design:t('Design','تصميم'),report:t('Report','تقرير'),
        code:t('Programming draft','مسودة برمجية'),general:t('General request','طلب عام')}[task.kind];
      const status = [category, labels[task.state] ?? task.state].filter(Boolean).join(' · ');
      const phase = task.state === 'running' && labels[task.stage] ? ' · '+labels[task.stage] : '';
      article.append(node('p', status+phase));
      const actions = node('div');
      if (task.state === 'review') {
        const link = node('a', t('Open result', 'فتح النتيجة'));
        link.href = '/api/chat/'+task.id+'/preview';
        link.target = '_blank';
        link.rel = 'noopener';
        actions.append(link);
        const checks = node('button', t('View checks', 'عرض الفحوص'));
        checks.onclick = async () => {
          try {
            const result = await api('/'+task.id);
            if (!article.querySelector('ul')) {
              const list = node('ul');
              for (const check of result.checks) list.append(node('li', (check.passed ? '✓ ' : '✗ ')+check.name));
              article.append(list);
            }
          } catch (err) { show(err); }
        };
        actions.append(checks);
      }
      const available = task.state === 'paused' ? ['resume']
        : task.state === 'queued' ? ['pause', 'resume'] : task.state === 'running'
          ? (Date.now()/1000-task.updated_at > 120 ? ['pause', 'resume'] : ['pause']) : [];
      for (const action of available) {
        const button = node('button', action === 'pause' ? t('Stop', 'إيقاف') : t('Resume', 'استئناف'));
        button.onclick = async () => {
          error.textContent = '';
          button.disabled = true;
          try { await api('/'+task.id+'/'+action, {method: 'POST'}); await refresh(); }
          catch (err) { show(err); }
          finally { button.disabled = false; }
        };
        actions.append(button);
      }
      article.append(actions);
      return article;
    }));
    $('empty').hidden = tasks.length > 0;
  }
  async function engineering(payload) {
    const response = await fetch('/api/engineering', payload ? {
      method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(payload),
    } : {});
    if (!response.ok) throw Error('engineering_unavailable');
    return response.json();
  }
  async function refreshEngineering() {
    const {tasks}=await engineering();
    const fingerprint=JSON.stringify(tasks);
    if (fingerprint===refreshEngineering.last) return;
    refreshEngineering.last=fingerprint;
    $('engineering-history').replaceChildren(...tasks.map(task=>{
      const line=node('li');
      const status={queued:t('Queued','في الانتظار'),running:t('Running','قيد التنفيذ'),
        paused:t('Paused','متوقفة'),blocked:t('Blocked','متعذرة'),verified:t('Deployment verified','تم التحقق من النشر')};
      line.append(node('span',(task.kind==='dashboard-theme'?t('Dashboard theme','مظهر اللوحة'):t('Composer keyboard shortcut','اختصار لوحة المفاتيح'))+' · '+status[task.status]+' '));
      if(task.pr){
        const link=node('a',t('Pull request','طلب الدمج'));
        link.href='https://github.com/bmkamel/bmk-badp/pull/'+task.pr;
        line.append(link);
      }
      if(task.run_id){
        const link=node('a',t(' Run evidence',' سجل التشغيل'));
        link.href='https://github.com/bmkamel/bmk-badp/actions/runs/'+task.run_id;
        line.append(link);
      }
      if(task.status==='queued'||task.status==='paused'){
        const pause=task.status==='queued';
        const button=node('button',pause?t('Pause','إيقاف'):t('Resume','استئناف'));
        button.onclick=async()=>{try{await engineering({id:task.id,action:pause?'pause':'resume'});await refreshEngineering();}catch(error){show(error);}};
        line.append(button);
      }
      return line;
    }));
  }
  $('composer').onsubmit = async event => {
    event.preventDefault();
    error.textContent = '';
    $('send').disabled = true;
    try {
      const command=$('prompt').value.trim();
      if (/^(?:طور|طوّر|حسّن|حسن) واجهة badp[.!؟]?$/iu.test(command) || /^improve (?:the )?badp (?:dashboard|interface)[.!]?$/i.test(command)) {
        await engineering({id:crypto.randomUUID(),kind:'dashboard-theme'});
        $('composer').reset();
        await refreshEngineering();
        return;
      }
      const file = $('file').files[0];
      if (file?.size > 4000) throw Error('invalid_attachment');
      const attachment = file ? {name: file.name, text: await file.text()} : undefined;
      const payload = {id: crypto.randomUUID(), prompt: $('prompt').value, attachment, allowAi: $('allow-ai').checked};
      await api('', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(payload)});
      $('composer').reset();
      await refresh();
    } catch (err) { show(err); }
    finally { $('send').disabled = false; }
  };
  refresh().catch(show);
  refreshEngineering().catch(()=>{});
  setInterval(() => { if (!document.hidden) { refresh().catch(() => {}); refreshEngineering().catch(()=>{}); } }, 3000);
}

export function chatPage(lang, theme) {
  const ar = lang === 'ar';
  const t = (english, arabic) => ar ? arabic : english;
  return `<!doctype html><html lang="${lang}" dir="${ar ? 'rtl' : 'ltr'}"${theme === 'light' ? ' data-theme="light"' : ''}><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>BADP · ${t('Development chat','محادثة التطوير')}</title>
<style>
:root{color-scheme:dark;--bg:#0b1120;--panel:#141e31;--line:#34425e;--ink:#eef2ff;--accent:#a9def6}
*{box-sizing:border-box}body{margin:0;background:var(--bg);color:var(--ink);font:16px system-ui;line-height:1.6}
header{border-bottom:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;padding:12px max(16px,calc((100% - 760px)/2));gap:12px}
nav,article div,.tools{display:flex;gap:12px;flex-wrap:wrap;align-items:center}main{max-width:760px;margin:auto;padding:20px 16px}
h1{font-size:clamp(26px,5vw,42px);margin:8px 0}a{color:var(--accent)}button{border:1px solid var(--line);border-radius:10px;padding:9px 13px;background:var(--panel);color:inherit;font:inherit;cursor:pointer}
button:disabled{opacity:.6}article{padding:12px 16px;border:1px solid var(--line);border-radius:14px;margin:12px 0;background:var(--panel);overflow-wrap:anywhere}
.message{white-space:pre-wrap;font-weight:600}textarea{background:var(--bg);color:inherit;font:inherit;width:100%;min-height:88px;resize:vertical;border:1px solid var(--line);border-radius:10px;padding:10px}
#composer{background:var(--panel);border:1px solid var(--line);border-radius:14px;padding:14px}#send{background:#b9e6fc;color:#0c1829;font-weight:700}#error{color:#ffb7a7}small{opacity:.8}input[type=file]{max-width:100%}
</style><header><strong>BMK BADP</strong><nav><a href="?lang=${ar ? 'en' : 'ar'}">${ar ? 'English' : 'العربية'}</a>
<form method="post" action="/auth/logout"><button>${t('Sign out','تسجيل الخروج')}</button></form></nav></header>
<main><h1>${t('Development chat','محادثة التطوير')}</h1>
<p>${t('Send a design, report, programming or general request in Arabic or English.','أرسل طلب تصميم أو تقرير أو برمجة أو أي طلب عام بالعربية أو الإنجليزية.')}</p>
<section><h2>${t('Engineering tasks','المهام الهندسية')}</h2><p>${t('Use “Improve BADP dashboard” to queue the next approved interface change.','أرسل «طور واجهة BADP» لإدراج تحسين الواجهة المعتمد في قائمة التنفيذ.')}</p><ul id="engineering-history"></ul></section>
<section id="history" aria-label="${t('Conversation history','سجل المحادثة')}"></section>
<p id="empty">${t('No development tasks yet.','لم تُرسل مهام تطوير بعد.')}</p>
<form id="composer"><label for="prompt">${t('Development command','أمر التطوير')}</label>
<textarea id="prompt" dir="auto" required maxlength="2000" placeholder="${t('Create a static page for the project overview','أنشئ صفحة ثابتة للتعريف بالمشروع')}"></textarea>
<div class="tools"><label for="file">${t('Attach text (4 KB max)','إرفاق ملف نصي (حتى 4 كيلوبايت)')}</label><input id="file" type="file" accept=".txt,.md,.json,.csv">
<label><input id="allow-ai" type="checkbox"> ${t('Send this public command to OpenRouter for an AI draft','إرسال هذا الأمر العام إلى OpenRouter لإعداد مسودة بالذكاء الاصطناعي')}</label>
<button id="send">${t('Send','إرسال')}</button></div><p id="error" role="status"></p></form>
<p><a href="/api/development/validation">${t('Engine verification','التحقق من المحرك')}</a></p>
</main><script src="/dashboard/chat.js" defer></script></html>`;
}

export const chatScript = '('+client.toString()+')();';
