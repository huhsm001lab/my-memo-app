'use strict';
/* ============================================================
   내 메모장 — 1단계 (AI 없는 버전)
   구역: 0.도구  1.store(저장)  2.memo  3.todo  4.calendar  5.notify  6.settings  7.시작
   ============================================================ */

/* ---------- 0. 도구 ---------- */
const $ = (s) => document.querySelector(s);

// 화면 요소를 만드는 도우미. 글자는 항상 textContent 로 넣어서 HTML 주입을 막는다.
function h(tag, props = {}, ...kids) {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(props)) {
    if (k === 'class') e.className = v;
    else if (k === 'text') e.textContent = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else if (k === 'checked' || k === 'value') e[k] = v;
    else e.setAttribute(k, v);
  }
  kids.flat().forEach((c) => { if (c != null && c !== false) e.append(c.nodeType ? c : document.createTextNode(c)); });
  return e;
}
const pad = (n) => String(n).padStart(2, '0');
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; // 날짜는 'YYYY-MM-DD' 글자로 저장
const todayStr = () => ymd(new Date());
const starBtn = (on, fn) => h('button', { class: 'star', title: '중요 표시', onclick: fn, text: on ? '⭐' : '☆' });
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toast.id); toast.id = setTimeout(() => (t.hidden = true), 2200);
}

/* ---------- 1. store: 저장소 (메모/할 일/일정이 함께 쓴다) ---------- */
const store = {
  KEY: 'notes.items',
  items: [],
  load() {
    try { const a = JSON.parse(localStorage.getItem(this.KEY) || '[]'); this.items = Array.isArray(a) ? a : []; }
    catch { this.items = []; }
  },
  save() { localStorage.setItem(this.KEY, JSON.stringify(this.items)); },
  add(type, fields) {
    const now = new Date().toISOString();
    const it = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      type, title: '', content: '', important: false, dueDate: null, tags: [],
      createdAt: now, updatedAt: now, ...fields,
    };
    this.items.push(it); this.save(); return it;
  },
  update(id, patch) {
    const it = this.items.find((x) => x.id === id);
    if (it) { Object.assign(it, patch, { updatedAt: new Date().toISOString() }); this.save(); }
  },
  remove(id) { this.items = this.items.filter((x) => x.id !== id); this.save(); },
  ofType(t) { return this.items.filter((x) => x.type === t); },
};

function renderAll() { memo.render(); todo.render(); calendar.render(); notify.banner(); }

/* ---------- 2. memo: 메모 ---------- */
const memo = {
  editingId: null,
  star: false,
  init() {
    $('#memo-star').onclick = () => { this.star = !this.star; this.syncStar(); };
    $('#memo-form').onsubmit = (e) => { e.preventDefault(); this.submit(); };
    $('#memo-cancel').onclick = () => this.reset();
    $('#memo-search').oninput = () => this.render();
    $('#memo-only-star').onchange = () => this.render();
  },
  syncStar() { $('#memo-star').textContent = this.star ? '⭐' : '☆'; },
  reset() {
    this.editingId = null; this.star = false; this.syncStar();
    $('#memo-title').value = ''; $('#memo-content').value = '';
    $('#memo-submit').textContent = '메모 추가'; $('#memo-cancel').hidden = true;
  },
  submit() {
    const title = $('#memo-title').value.trim(); if (!title) return;
    const data = { title, content: $('#memo-content').value, important: this.star };
    if (this.editingId) store.update(this.editingId, data); else store.add('memo', data);
    this.reset(); renderAll();
  },
  edit(m) {
    this.editingId = m.id; this.star = m.important; this.syncStar();
    $('#memo-title').value = m.title; $('#memo-content').value = m.content;
    $('#memo-submit').textContent = '수정 저장'; $('#memo-cancel').hidden = false;
    $('#memo-title').focus(); window.scrollTo(0, 0);
  },
  render() {
    const q = $('#memo-search').value.trim().toLowerCase();
    const onlyStar = $('#memo-only-star').checked;
    const list = store.ofType('memo')
      .filter((m) => (!onlyStar || m.important) && (!q || (m.title + ' ' + m.content + ' ' + m.tags.join(' ')).toLowerCase().includes(q)))
      .sort((a, b) => (b.important - a.important) || b.updatedAt.localeCompare(a.updatedAt)); // 중요 먼저, 그다음 최근 수정순
    const box = $('#memo-list'); box.replaceChildren();
    if (!list.length) { box.append(h('div', { class: 'empty', text: '메모가 없습니다.' })); return; }
    list.forEach((m) => box.append(h('div', { class: 'card item' + (m.important ? ' imp' : '') },
      h('div', { class: 'body' },
        h('div', { class: 'title', text: m.title }),
        m.content && h('div', { class: 'content', text: m.content }),
        h('div', { class: 'meta', text: '수정 ' + new Date(m.updatedAt).toLocaleString('ko-KR') })),
      h('div', { class: 'actions' },
        starBtn(m.important, () => { store.update(m.id, { important: !m.important }); renderAll(); }),
        h('button', { text: '수정', onclick: () => this.edit(m) }),
        h('button', { text: '할 일 만들기', onclick: () => { // 1-4 연결: 메모 → 할 일
          store.add('todo', { title: m.title, content: m.content, important: m.important, done: false });
          renderAll(); toast('할 일에 추가했어요'); } }),
        h('button', { class: 'danger', text: '삭제', onclick: () => { if (confirm('이 메모를 삭제할까요?')) { store.remove(m.id); renderAll(); } } })))));
  },
};

/* ---------- 3. todo: 할 일 ---------- */
const todo = {
  star: false,
  init() {
    $('#todo-star').onclick = () => { this.star = !this.star; $('#todo-star').textContent = this.star ? '⭐' : '☆'; };
    $('#todo-form').onsubmit = (e) => {
      e.preventDefault();
      const title = $('#todo-title').value.trim(); if (!title) return;
      store.add('todo', { title, dueDate: $('#todo-due').value || null, important: this.star, done: false });
      $('#todo-title').value = ''; $('#todo-due').value = '';
      this.star = false; $('#todo-star').textContent = '☆'; renderAll();
    };
    ['#todo-hide-done', '#todo-today', '#todo-only-star'].forEach((s) => ($(s).onchange = () => this.render()));
  },
  render() {
    const t = todayStr();
    let list = store.ofType('todo');
    if ($('#todo-hide-done').checked) list = list.filter((x) => !x.done);
    if ($('#todo-today').checked) list = list.filter((x) => x.dueDate === t);
    if ($('#todo-only-star').checked) list = list.filter((x) => x.important);
    // 미완료 먼저 → 중요 먼저 → 마감일 빠른 순(없으면 맨 뒤)
    list.sort((a, b) => (!!a.done - !!b.done) || (b.important - a.important) ||
      ((a.dueDate || '9999').localeCompare(b.dueDate || '9999')) || a.createdAt.localeCompare(b.createdAt));
    const box = $('#todo-list'); box.replaceChildren();
    if (!list.length) { box.append(h('div', { class: 'empty', text: '할 일이 없습니다.' })); return; }
    list.forEach((x) => {
      const over = x.dueDate && x.dueDate < t && !x.done;
      box.append(h('div', { class: 'card item' + (x.important ? ' imp' : '') + (x.done ? ' done' : '') },
        h('input', { type: 'checkbox', checked: !!x.done, onchange: (e) => { store.update(x.id, { done: e.target.checked }); renderAll(); } }),
        h('div', { class: 'body' },
          h('div', { class: 'title' }, x.title,
            x.dueDate && h('span', { class: 'badge' + (over ? ' over' : ''), text: (over ? '기한 지남 ' : '') + x.dueDate }))),
        h('div', { class: 'actions' },
          starBtn(x.important, () => { store.update(x.id, { important: !x.important }); renderAll(); }),
          h('button', { text: '수정', onclick: () => { const v = prompt('할 일 이름', x.title); if (v && v.trim()) { store.update(x.id, { title: v.trim() }); renderAll(); } } }),
          h('button', { class: 'danger', text: '삭제', onclick: () => { if (confirm('이 할 일을 삭제할까요?')) { store.remove(x.id); renderAll(); } } }))));
    });
  },
};

/* ---------- 4. calendar: 캘린더 ---------- */
const calendar = {
  view: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  selected: todayStr(),
  star: false,
  init() {
    $('#cal-prev').onclick = () => { this.view = new Date(this.view.getFullYear(), this.view.getMonth() - 1, 1); this.render(); };
    $('#cal-next').onclick = () => { this.view = new Date(this.view.getFullYear(), this.view.getMonth() + 1, 1); this.render(); };
    $('#cal-today').onclick = () => { const n = new Date(); this.view = new Date(n.getFullYear(), n.getMonth(), 1); this.selected = todayStr(); this.render(); };
  },
  // 그 날짜에 표시할 것: 일정 + 마감일 있는 할 일 (1-4 연결)
  entriesOn(date) {
    return store.items.filter((x) => (x.type === 'event' || x.type === 'todo') && x.dueDate === date)
      .sort((a, b) => (b.important - a.important) || (a.type === 'event' ? -1 : 1));
  },
  render() {
    const y = this.view.getFullYear(), m = this.view.getMonth();
    $('#cal-label').textContent = `${y}년 ${m + 1}월`;
    const grid = $('#cal-grid'); grid.replaceChildren();
    ['일', '월', '화', '수', '목', '금', '토'].forEach((d) => grid.append(h('div', { class: 'cal-dow', text: d })));
    for (let i = 0; i < new Date(y, m, 1).getDay(); i++) grid.append(h('div', { class: 'cal-cell blank' }));
    const last = new Date(y, m + 1, 0).getDate();
    for (let d = 1; d <= last; d++) {
      const date = `${y}-${pad(m + 1)}-${pad(d)}`;
      const es = this.entriesOn(date);
      grid.append(h('div', {
        class: 'cal-cell' + (date === todayStr() ? ' today' : '') + (date === this.selected ? ' selected' : ''),
        onclick: () => { this.selected = date; this.render(); },
      },
        h('span', { class: 'num', text: d }),
        es.slice(0, 3).map((x) => h('div', { class: 'chip ' + (x.type === 'todo' ? 'td' : '') + (x.important ? ' imp' : '') + (x.done ? ' done' : ''), text: (x.important ? '⭐' : '') + x.title })),
        es.length > 3 && h('div', { class: 'more', text: `+${es.length - 3}개 더` })));
    }
    this.renderDay();
  },
  renderDay() {
    const date = this.selected, p = $('#day-panel'); p.replaceChildren();
    const events = store.items.filter((x) => x.type === 'event' && x.dueDate === date);
    const todos = store.items.filter((x) => x.type === 'todo' && x.dueDate === date);
    const memos = store.ofType('memo').filter((x) => ymd(new Date(x.createdAt)) === date); // 그날 만든 메모
    p.append(h('h3', { text: date + ' 모아보기' }));

    // 일정 추가 폼
    const input = h('input', { placeholder: '일정 제목', style: 'flex:1;min-width:140px' });
    const star = h('button', { type: 'button', class: 'star', title: '중요 표시', text: this.star ? '⭐' : '☆',
      onclick: () => { this.star = !this.star; star.textContent = this.star ? '⭐' : '☆'; } });
    const add = () => {
      const title = input.value.trim(); if (!title) return;
      store.add('event', { title, dueDate: date, important: this.star });
      this.star = false; renderAll();
    };
    input.onkeydown = (e) => { if (e.key === 'Enter') { e.preventDefault(); add(); } };
    p.append(h('div', { class: 'row' }, input, star, h('button', { text: '일정 추가', onclick: add })));

    const row = (x, label) => h('div', { class: 'day-row' + (x.done ? ' done' : '') },
      h('span', { class: 'badge', text: label }),
      h('span', { class: 't', text: (x.important ? '⭐ ' : '') + x.title }),
      x.type === 'event' && h('button', { text: '수정', onclick: () => { const v = prompt('일정 제목', x.title); if (v && v.trim()) { store.update(x.id, { title: v.trim() }); renderAll(); } } }),
      x.type === 'event' && starBtn(x.important, () => { store.update(x.id, { important: !x.important }); renderAll(); }),
      x.type === 'event' && h('button', { class: 'danger', text: '삭제', onclick: () => { if (confirm('이 일정을 삭제할까요?')) { store.remove(x.id); renderAll(); } } }));

    // append 는 배열을 글자로 바꿔 버리므로, 목록은 ... 로 펼쳐서 넣는다
    const none = () => h('div', { class: 'hint', text: '없음' });
    p.append(h('div', { class: 'day-section', text: '일정' }), ...(events.length ? events.map((x) => row(x, '일정')) : [none()]));
    p.append(h('div', { class: 'day-section', text: '할 일 (마감일)' }), ...(todos.length ? todos.map((x) => row(x, x.done ? '완료' : '할 일')) : [none()]));
    p.append(h('div', { class: 'day-section', text: '이날 작성한 메모' }), ...(memos.length ? memos.map((x) => row(x, '메모')) : [none()]));
  },
};

/* ---------- 5. notify: 알림 ---------- */
const notify = {
  KEY: 'notes.settings',
  s: { enabled: true, daysBefore: 0, time: '09:00', lastNotified: '' },
  load() { try { Object.assign(this.s, JSON.parse(localStorage.getItem(this.KEY) || '{}')); } catch { /* 기본값 사용 */ } },
  save() { localStorage.setItem(this.KEY, JSON.stringify(this.s)); },
  dueTodos(date) { return store.ofType('todo').filter((x) => !x.done && x.dueDate === date); },
  // 화면 안 알림: 앱을 열면 보이는 배너
  banner() {
    const b = $('#banner'); const t = todayStr();
    const today = this.dueTodos(t).length;
    const over = store.ofType('todo').filter((x) => !x.done && x.dueDate && x.dueDate < t).length;
    if (!this.s.enabled || (!today && !over)) { b.hidden = true; return; }
    b.textContent = '🔔 ' + [today && `오늘 마감 할 일 ${today}개`, over && `기한 지난 할 일 ${over}개`].filter(Boolean).join(' · ');
    b.hidden = false;
  },
  supported() { return 'Notification' in window; },
  state() {
    if (!this.supported()) return '이 브라우저는 알림을 지원하지 않아요.';
    return { granted: '허용됨 ✅', denied: '차단됨 ❌ (주소창 자물쇠에서 허용으로 바꿔 주세요)', default: '아직 허용 안 함' }[Notification.permission];
  },
  // 브라우저 알림: 탭이 열려 있을 때 정한 시각이 지나면 하루에 한 번
  tick() {
    if (!this.s.enabled || !this.supported() || Notification.permission !== 'granted') return;
    const now = new Date(), t = todayStr();
    if (this.s.lastNotified === t || `${pad(now.getHours())}:${pad(now.getMinutes())}` < this.s.time) return;
    const target = new Date(now); target.setDate(target.getDate() + Number(this.s.daysBefore));
    const list = this.dueTodos(ymd(target));
    this.s.lastNotified = t; this.save();
    if (list.length) new Notification(this.s.daysBefore ? '내일 마감 할 일' : '오늘 마감 할 일', { body: list.map((x) => x.title).slice(0, 5).join('\n') });
  },
};

/* ---------- 6. settings: 설정 / 백업 ---------- */
const settings = {
  init() {
    const s = notify.s;
    $('#set-enabled').checked = s.enabled; $('#set-days').value = String(s.daysBefore); $('#set-time').value = s.time;
    $('#set-enabled').onchange = (e) => { s.enabled = e.target.checked; notify.save(); notify.banner(); };
    $('#set-days').onchange = (e) => { s.daysBefore = Number(e.target.value); s.lastNotified = ''; notify.save(); };
    $('#set-time').onchange = (e) => { s.time = e.target.value || '09:00'; s.lastNotified = ''; notify.save(); };
    $('#set-browser-state').textContent = notify.state();
    $('#set-browser').onclick = async () => {
      if (!notify.supported()) return;
      await Notification.requestPermission();
      $('#set-browser-state').textContent = notify.state();
    };
    $('#export-btn').onclick = () => {
      const a = h('a', { href: URL.createObjectURL(new Blob([JSON.stringify(store.items, null, 2)], { type: 'application/json' })), download: `메모장백업_${todayStr()}.json` });
      a.click(); URL.revokeObjectURL(a.href);
    };
    $('#import-btn').onclick = () => $('#import-file').click();
    $('#import-file').onchange = async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!Array.isArray(data) || !data.every((x) => x && x.id && ['memo', 'todo', 'event'].includes(x.type))) throw new Error('형식 오류');
        if (confirm(`현재 데이터를 지우고 파일의 ${data.length}개 항목으로 바꿀까요?`)) { store.items = data; store.save(); renderAll(); toast('가져왔어요'); }
      } catch { alert('올바른 백업 파일이 아니에요.'); }
      e.target.value = '';
    };
  },
};

/* ---------- 7. 시작 ---------- */
document.querySelectorAll('.tab').forEach((b) => (b.onclick = () => {
  document.querySelectorAll('.tab').forEach((x) => x.classList.toggle('active', x === b));
  document.querySelectorAll('.panel').forEach((p) => (p.hidden = p.id !== 'tab-' + b.dataset.tab));
}));
store.load(); notify.load();
memo.init(); todo.init(); calendar.init(); settings.init();
renderAll();
notify.tick(); setInterval(() => notify.tick(), 30000);
