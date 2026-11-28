export function taskKind(prompt) {
  if (/تقرير|إحصاء|احصاء|تصدير|\b(?:report|metrics|statistics|analytics|summary)\b/iu.test(prompt)) return 'report';
  if (/برمج|أصلح|اصلاح|إصلاح|مستودع|كود|شيفرة|اختبار|\b(?:code|implement|fix|debug|refactor|repository|test|programming)\b/iu.test(prompt)) return 'code';
  if (/تصميم|صمّم|صمم|واجهة|واجهه|صفحة|معاينة|موقع|\b(?:design|page|preview|html|website|ui|interface)\b/iu.test(prompt)) return 'design';
  return 'general';
}

export const html = text => String(text).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;')
  .replaceAll('"','&quot;').replaceAll("'",'&#39;').replaceAll('(','&#40;');

export function renderResult({task, kind, advice, metrics}) {
  const ar = /\p{Script=Arabic}/u.test(task.prompt);
  const t = (en, arabic) => ar ? arabic : en;
  const labels = {report:t('Task report','تقرير المهام'),code:t('Programming draft','مسودة برمجية'),
    design:t('Interface concept','تصور للواجهة'),general:t('Request assessment','معالجة الطلب')};
  const title = labels[kind];
  const result = advice ? '<section><h2>'+t('AI draft','مسودة الذكاء الاصطناعي')+'</h2><pre>'+html(advice)+'</pre></section>' : '';
  const dataset = kind === 'report' && task.attachment_name
    ? '<p>'+t('The attachment is shown below. The counts describe BADP tasks only.','المرفق ظاهر أدناه. الأعداد تخص مهام BADP فقط.')+'</p>' : '';
  const names = {queued:t('Queued','في الانتظار'),running:t('Running','قيد التنفيذ'),paused:t('Paused','متوقفة'),
    review:t('Ready for review','جاهزة للمراجعة'),blocked:t('Blocked','متعذرة')};
  const parts = {
    report: '<section><h2>'+t('Recorded BADP task counts','أعداد مهام BADP المسجلة')+'</h2><dl>'+
      Object.entries(names).map(([state,label])=>'<div><dt>'+label+'</dt><dd>'+html(metrics?.[state]??0)+'</dd></div>').join('')+
      '</dl>'+dataset+'</section>',
    code: '<section><h2>'+t('Implementation and verification','خطة التنفيذ والتحقق')+'</h2><ol>'+
      t('<li>Identify the repository, target files and expected behavior.</li><li>Prepare a scoped change and test it against the current baseline.</li><li>Review the diff and test evidence before publication.</li>',
        '<li>حدّد المستودع والملفات المستهدفة والسلوك المطلوب.</li><li>جهّز تعديلًا محدد النطاق واختبره على الإصدار الحالي.</li><li>راجع التغيير وأدلة الاختبار قبل النشر.</li>')+
      '</ol><p>'+t('Repository status: no change submitted.','حالة المستودع: لم يُرسل تعديل.')+'</p></section>',
    design: '<section class="concept"><h2>'+t('Page structure','هيكل الصفحة')+'</h2><div><b>'+t('Overview','نظرة عامة')+
      '</b><p>'+t('Introduce the purpose and primary action.','اعرض الغرض والإجراء الرئيسي.')+
      '</p></div><div><b>'+t('Content','المحتوى')+'</b><p>'+t('Show the information and tasks that matter most.','اعرض أهم المعلومات والمهام.')+'</p></div></section>',
    general: advice ? '' : '<section><h2>'+t('Next step','الخطوة التالية')+'</h2><p>'+
      t('Describe the expected result and include any necessary context. To request an AI draft, enable public-command sharing when sending a public request.',
        'صف النتيجة المطلوبة وأضف السياق اللازم. للحصول على مسودة بالذكاء الاصطناعي، فعّل مشاركة الأمر العام عند إرسال طلب قابل للمشاركة.')+'</p></section>',
  };
  const attachment = task.attachment_name
    ? '<section><h2>'+html(task.attachment_name)+'</h2><pre>'+html(task.attachment_text)+'</pre></section>' : '';
  return '<!doctype html><html lang="'+(ar?'ar':'en')+'" dir="'+(ar?'rtl':'ltr')+'"><meta charset="utf-8">'+
    '<meta name="viewport" content="width=device-width,initial-scale=1"><title>'+title+'</title>'+
    '<style>body{background:#f0f5fb;color:#10233e;font:16px system-ui;margin:0}main{max-width:760px;margin:auto;padding:24px}'+
    'header,section{background:white;border:1px solid #cbd8e6;border-radius:16px;padding:20px;margin:14px 0}header{background:#122740;color:white}'+
    'h1{margin:0}pre,p{overflow-wrap:anywhere}pre{white-space:pre-wrap}.concept div,dl div{padding:9px;border-bottom:1px solid #cbd8e6}'+
    'dl div{display:flex;justify-content:space-between}</style><main><header><h1>'+title+'</h1><p dir="auto">'+html(task.prompt)+
    '</p></header>'+parts[kind]+result+attachment+'</main></html>';
}
