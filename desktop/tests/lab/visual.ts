import type { Layout, SyntheticQuestion, VisualCase } from './cases';

const escape = (text: string): string => text.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const diagram = `<svg class="diagram" viewBox="0 0 500 220" role="img" aria-label="Rectangle, width 8 centimetres and height 3 centimetres">
  <defs><marker id="arrow" markerWidth="7" markerHeight="7" refX="3.5" refY="3.5" orient="auto-start-reverse"><path d="M7 0 L0 3.5 L7 7" fill="none" stroke="#435c79"/></marker></defs>
  <rect data-required-diagram x="96" y="48" width="288" height="108" rx="3" fill="#e9f2ff" stroke="#335c9b" stroke-width="3"/>
  <path d="M96 183H384 M412 48V156" stroke="#435c79" marker-start="url(#arrow)" marker-end="url(#arrow)"/>
  <text data-required-label x="240" y="209" text-anchor="middle" fill="#152b48" font-size="23">8 cm</text>
  <text data-required-label x="425" y="111" fill="#152b48" font-size="23">3 cm</text>
</svg>`;
function question(item: SyntheticQuestion, count: number): string {
  const options = item.options?.map((option, i) => `<div class="option"><span class="${item.type === 'multiple_selection' ? 'checkbox' : 'radio'}"></span><strong>${String.fromCharCode(65 + i)}.</strong> ${escape(option)}</div>`).join('') ?? '';
  return `<article class="question" data-question="${item.id}"><div class="question-label">Question ${item.id} of ${count} <span>${item.type.replaceAll('_', ' ')}</span></div>
    <h2>${escape(item.text)}</h2>${options}${item.code ? `<pre><code>${escape(item.code)}</code></pre>` : ''}${item.diagram ? diagram : ''}
    ${['short_answer', 'code', 'image'].includes(item.type) ? '<div class="answer-slot">Answer <span></span></div>' : ''}</article>`;
}
// Visual chrome only: no getUserMedia, identity lookup, monitoring, external assets, or assessment integration.
export function fixtureHtml(fixture: VisualCase, layout: Layout): string {
  const proctoring = layout === 'proctoring';
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; base-uri 'none'; form-action 'none'">
    <meta name="viewport" content="width=device-width, initial-scale=1"><title>SC synthetic visual lab</title><style>
    *{box-sizing:border-box}html,body{margin:0;min-height:100%;font-family:Segoe UI,Arial,sans-serif;color:#182b44}body{background:#edf2f8}
    .notice{height:29px;background:#1c304d;color:#e9f1fc;text-align:center;font-size:12px;letter-spacing:.06em;padding:6px}
    header{height:78px;display:flex;align-items:center;justify-content:space-between;padding:0 35px;background:#fff;border-bottom:1px solid #dce5f0}
    .brand{font-weight:700;font-size:22px;color:#284c89}.brand small{display:block;font-size:12px;letter-spacing:.04em;font-weight:400;color:#59708e;margin-top:3px}
    .identity{display:flex;align-items:center;gap:12px;font-size:13px}.avatar{width:37px;height:37px;background:#e3edfc;border-radius:50%;display:grid;place-items:center;font-weight:700;color:#355d99}
    .identity strong{display:block;font-size:14px}.identity small{color:#637793}.timer{font-size:24px;font-variant-numeric:tabular-nums;font-weight:600;color:#344967}.timer small{display:block;font-size:10px;letter-spacing:.1em;font-weight:400;text-align:right}
    .shell{display:grid;grid-template-columns:190px 1fr 210px;gap:22px;max-width:1570px;margin:25px auto;padding:0 28px}
    aside{font-size:13px}.side-card{background:#fff;border:1px solid #dfe7f1;border-radius:10px;padding:19px 16px;margin-bottom:15px}.side-card h3{font-size:13px;margin:0 0 15px;color:#536987}
    .section-name{font-size:15px;font-weight:600;margin-bottom:20px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:8px}.nav-item{height:31px;border:1px solid #d6e0ee;border-radius:5px;display:grid;place-items:center;color:#687e99}.nav-item.active{background:#3267b8;color:#fff;border-color:#3267b8}
    .legend{font-size:11px;color:#6c7c91;line-height:1.8;margin-top:19px}.dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:#3d9c78;margin-right:6px}
    main{min-width:0}.page-label{font-size:12px;color:#687c99;margin-bottom:11px}.title-row{display:flex;justify-content:space-between;align-items:center;margin-bottom:18px}h1{font-size:22px;margin:0;font-weight:600}.tag{font-size:11px;color:#577397;background:#e5edf8;padding:6px 10px;border-radius:20px}
    .question{background:#fff;border:1px solid #dbe4ef;border-radius:11px;padding:24px 28px;margin-bottom:17px;box-shadow:0 3px 12px #213f6b05}.question-label{font-size:12px;color:#70839b;display:flex;justify-content:space-between;gap:15px}.question-label span{text-transform:capitalize;color:#7087a7}h2{font-size:21px;line-height:1.4;font-weight:500;margin:22px 0}
    .option{font-size:18px;border:1px solid #dfe6ee;border-radius:7px;margin-top:10px;padding:12px 16px;display:flex;align-items:center;gap:12px}.radio,.checkbox{width:17px;height:17px;border:1.5px solid #95a6bc;display:inline-block;flex-shrink:0}.radio{border-radius:50%}.checkbox{border-radius:3px}.option strong{font-size:15px;color:#6880a0}
    pre{background:#f0f4fa;border:1px solid #dce4ee;border-radius:7px;padding:21px;font-size:21px;line-height:1.65;color:#193d73;white-space:pre-wrap}.diagram{display:block;width:min(100%,500px);height:220px;margin:8px auto 18px}
    .answer-slot{font-size:12px;color:#6f829a;display:flex;align-items:center;gap:12px;margin-top:21px}.answer-slot span{display:block;width:150px;height:36px;border:1px solid #cfdbea;border-radius:5px}
    .toolbar{display:flex;align-items:center;justify-content:space-between;padding-top:2px}.button{font-size:12px;border:1px solid #c8d5e6;background:#fff;padding:11px 18px;border-radius:6px;color:#526d92}.button.primary{background:#3267b8;color:#fff;border-color:#3267b8}.toolbar small{font-size:11px;color:#6c7e97}
    .camera{height:106px;background:linear-gradient(135deg,#e4ebf6,#d1dcea);border-radius:7px;display:grid;place-items:center;text-align:center;color:#5f7696;font-size:11px}.camera svg{display:block;margin:0 auto 6px}.status{font-size:11px;line-height:1.9;margin-top:12px;color:#607793}.status strong{color:#3b8d70;font-weight:500}.visual-only{font-size:10px;line-height:1.6;color:#8a7b55;border-top:1px solid #e8e3d5;padding-top:10px;margin-top:12px}
    footer{text-align:center;font-size:11px;color:#788aa2;padding:0 20px 18px}.plain .shell{display:block;max-width:1020px;margin-top:30px}.plain header{height:67px}.plain .question{box-shadow:none}.plain h2{font-size:24px}.plain .question-label span{display:none}
    .case-multiple .question{padding-top:18px;padding-bottom:18px}.case-multiple h2{margin:14px 0;font-size:20px}.case-multiple .answer-slot{margin-top:12px}
    @media(max-width:1100px){.shell{grid-template-columns:145px 1fr 170px;gap:14px;padding:0 18px;margin-top:18px}header{padding:0 20px}.question{padding:20px}.option{padding:10px 12px}h2{font-size:20px}.side-card{padding:15px 12px}}
    @media(max-height:850px){.notice{height:25px;padding:5px}.shell{margin:16px auto}.plain .shell{margin-top:20px}header,.plain header{height:64px}.question{padding:18px 22px}h2{margin:15px 0}.diagram{height:175px;margin:5px auto 10px}.answer-slot{margin-top:12px}.answer-slot span{height:30px}.toolbar .button{padding:9px 15px}footer{padding-bottom:10px}.option{padding:9px 14px}}
    </style></head><body class="${layout} case-${fixture.id}"><div class="notice">SYNTHETIC SOFTWARE QA · VISUAL FIXTURE ONLY · NO REAL ASSESSMENT</div>
    <header><div class="brand">${proctoring ? 'OES Practice Workspace' : 'Practice worksheet'}<small>SC local synthetic visual lab</small></div>
      ${proctoring ? '<div class="identity"><span class="avatar">QA</span><div><strong>Synthetic Candidate</strong><small>Practice identity · QA-017</small></div></div><div class="timer"><small>TIME REMAINING · STATIC</small>42:18</div>' : '<span class="tag">Unmarked practice</span>'}</header>
    <div class="shell">${proctoring ? `<aside><div class="side-card"><h3>SECTION</h3><div class="section-name">Reasoning practice</div><div class="grid">${Array.from({ length: 12 }, (_, i) => `<span class="nav-item ${i < fixture.questions.length ? 'active' : ''}">${i + 1}</span>`).join('')}</div><div class="legend"><span class="dot"></span>Current practice task<br>Navigation is decorative</div></div><div class="side-card"><h3>SESSION</h3>Local synthetic layout<br><small>No account connected</small></div></aside>` : ''}
    <main><div class="page-label">Practice / Section 1 / ${escape(fixture.title)}</div><div class="title-row"><h1>${escape(fixture.title)}</h1><span class="tag">${fixture.questions.length} visible ${fixture.questions.length === 1 ? 'task' : 'tasks'}</span></div>
      ${fixture.questions.map(item => question(item, fixture.questions.length)).join('')}<div class="toolbar"><span class="button" aria-disabled="true">Previous</span><small>All values and identities are synthetic</small><span class="button primary" aria-disabled="true">Save &amp; next →</span></div></main>
    ${proctoring ? '<aside><div class="side-card"><h3>MONITORING PANEL</h3><div class="camera"><div><svg width="30" height="24" viewBox="0 0 30 24" aria-hidden="true"><rect x="1" y="3" width="20" height="18" rx="4" fill="#7b91ae"/><path d="M23 8L29 5V19L23 16Z" fill="#7b91ae"/></svg>Camera preview placeholder</div></div><div class="status"><span class="dot"></span>Camera <strong>visual indicator</strong><br><span class="dot"></span>Microphone <strong>visual indicator</strong><br><span class="dot"></span>Monitoring label <strong>simulated</strong></div><div class="visual-only">No camera, microphone, recording, biometrics or monitoring is active.</div></div><div class="side-card"><h3>PRACTICE STATUS</h3>Connection: local fixture<br>Identity: invented<br>Timer: fixed display</div></aside>' : ''}</div>
    <footer>SC QA lab · standalone HTML/CSS/SVG · no external OES integration</footer></body></html>`;
}
