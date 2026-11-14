(() => {
  'use strict';

  const STORE_KEY = 'tasky.v1';
  const COLORS = ['#64d2ff', '#30d158', '#ff9f0a', '#bf5af2', '#ff375f', '#ac8e68'];
  const DAY = 86400000;
  const LOCALE = 'en-US';
  const GROUPS = [
    ['overdue', 'Overdue'],
    ['today', 'Today'],
    ['tomorrow', 'Tomorrow'],
    ['soon', 'Coming up'],
    ['later', 'Later'],
    ['none', 'No deadline'],
  ];

  /* ---------- Helpers ---------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
  const uid = () => Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const safeColor = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? c : COLORS[0]);

  const pad = (n) => String(n).padStart(2, '0');
  const toISO = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const startOfToday = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };
  const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
  const parseISO = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const daysUntil = (iso) => Math.round((parseISO(iso) - startOfToday()) / DAY);
  const daysSince = (ts) => { const d = new Date(ts); d.setHours(0, 0, 0, 0); return Math.round((startOfToday() - d) / DAY); };
  const fmt = (d, opts) => d.toLocaleDateString(LOCALE, opts);
  const shortDate = (d) => fmt(d, d.getFullYear() === new Date().getFullYear()
    ? { month: 'short', day: 'numeric' }
    : { month: 'short', day: 'numeric', year: 'numeric' });

  function dueInfo(task) {
    if (!task.due) return { bucket: 'none', label: 'No deadline', tone: '' };
    const n = daysUntil(task.due);
    if (n < 0) return { bucket: 'overdue', label: `${plural(-n, 'day')} late`, tone: 'late' };
    if (n === 0) return { bucket: 'today', label: 'Today', tone: 'today' };
    if (n === 1) return { bucket: 'tomorrow', label: 'Tomorrow', tone: '' };
    if (n < 7) return { bucket: 'soon', label: fmt(parseISO(task.due), { weekday: 'long' }), tone: '' };
    return { bucket: 'later', label: shortDate(parseISO(task.due)), tone: '' };
  }

  function doneLabel(task) {
    const n = daysSince(task.doneAt);
    if (n <= 0) return 'Done today';
    if (n === 1) return 'Done yesterday';
    return `Done ${shortDate(new Date(task.doneAt))}`;
  }

  const byDue = (a, b) => (a.due || '9999').localeCompare(b.due || '9999') || a.createdAt - b.createdAt;

  /* ---------- State ---------- */
  const ui = {
    view: 'tasks',
    seg: 'todo',
    client: 'all',
    editingTask: null,
    editingClient: null,
    sheetClient: '',
    sheetDue: '',
    sheetColor: COLORS[0],
  };
  let state = load();

  function valid(s) { return s && Array.isArray(s.clients) && Array.isArray(s.tasks); }

  function normalize(s) {
    const clients = s.clients
      .filter((c) => c && typeof c.id === 'string' && typeof c.name === 'string')
      .map((c) => ({ id: c.id, name: c.name.slice(0, 60), color: safeColor(c.color) }));
    const tasks = s.tasks
      .filter((t) => t && typeof t.id === 'string' && typeof t.title === 'string')
      .map((t) => ({
        id: t.id,
        title: t.title.slice(0, 160),
        clientId: typeof t.clientId === 'string' ? t.clientId : '',
        due: /^\d{4}-\d{2}-\d{2}$/.test(t.due) ? t.due : '',
        notes: typeof t.notes === 'string' ? t.notes : '',
        done: !!t.done,
        doneAt: t.done ? Number(t.doneAt) || Date.now() : null,
        createdAt: Number(t.createdAt) || Date.now(),
      }));
    return { clients, tasks, sample: !!s.sample, lastClient: typeof s.lastClient === 'string' ? s.lastClient : '' };
  }

  function load() {
    try {
      const raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (valid(parsed)) return normalize(parsed);
      }
    } catch (_) { /* fall through to sample data */ }
    const s = seed();
    persist(s);
    return s;
  }

  function persist(s = state) {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(s)); } catch (_) { /* storage full or blocked */ }
  }

  function seed() {
    const today = startOfToday();
    const d = (n) => toISO(addDays(today, n));
    const now = Date.now();
    const ids = [uid(), uid(), uid(), uid()];
    const clients = [
      { id: ids[0], name: 'Nova Studio', color: COLORS[0] },
      { id: ids[1], name: 'Bloom Café', color: COLORS[1] },
      { id: ids[2], name: 'Atlas Fitness', color: COLORS[2] },
      { id: ids[3], name: 'Kora Skincare', color: COLORS[3] },
    ];
    let order = 0;
    const mk = (title, c, due, notes = '', doneDaysAgo = null) => ({
      id: uid(),
      title,
      clientId: ids[c],
      due,
      notes,
      done: doneDaysAgo !== null,
      doneAt: doneDaysAgo !== null ? now - doneDaysAgo * DAY : null,
      createdAt: now + order++,
    });
    const tasks = [
      mk('Send revised homepage mockup', 0, d(-2), 'They want a bolder hero headline + new CTA copy.'),
      mk('Fix mobile nav overlap on small iPhones', 2, d(-1)),
      mk('Figma → HTML: pricing page', 0, d(0)),
      mk('Feedback call at 4 pm', 1, d(0), 'Bring 3 quick CRO wins to pitch.'),
      mk('Menu page copy review', 1, d(1)),
      mk('A/B test the new signup CTA', 2, d(3)),
      mk('Product page responsive build', 3, d(4)),
      mk('CRO audit report', 3, d(9)),
      mk('Collect brand assets & fonts', 3, ''),
      mk('Kickoff call notes', 0, d(-6), '', 5),
      mk('Wireframes approved', 2, d(-3), '', 2),
      mk('Moodboard v2', 1, d(-1), '', 1),
      mk('Send invoice #014', 0, d(0), '', 0),
    ];
    return { clients, tasks, sample: true, lastClient: ids[0] };
  }

  const clientById = (id) => state.clients.find((c) => c.id === id);
  const taskById = (id) => state.tasks.find((t) => t.id === id);

  /** Apply a change, save, re-render, and offer Undo. */
  function mutate(fn, message, { undo = true } = {}) {
    const snapshot = JSON.stringify(state);
    fn();
    persist();
    render();
    if (message) {
      toast(message, undo ? () => {
        state = JSON.parse(snapshot);
        persist();
        render();
        toast('Undone');
      } : null);
    }
  }

  /* ---------- Rendering ---------- */
  function render() {
    if (ui.client !== 'all' && !clientById(ui.client)) ui.client = 'all';
    $('#sampleStrip').hidden = !state.sample;
    renderTasks();
    renderClients();
  }

  const icons = {
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 12.5l4 4 8-9"/></svg>',
    notes: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 7h14M5 12h14M5 17h9"/></svg>',
    sparkle: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
    people: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8.2" r="3.2"/><path d="M3.5 19.2c.6-3.2 2.9-5.1 5.5-5.1s4.9 1.9 5.5 5.1"/><circle cx="17" cy="9" r="2.5"/><path d="M15.8 14.3c2.4-.3 4.3 1.3 4.8 4.4"/></svg>',
    tray: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 13l2.5-7h11L20 13v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1z"/><path d="M4 13h4.5l1 2h5l1-2H20"/></svg>',
  };

  function renderTasks() {
    $('#todayLabel').textContent = fmt(startOfToday(), { weekday: 'long', month: 'long', day: 'numeric' });

    // Client filter chips
    const chipsEl = $('#clientChips');
    chipsEl.hidden = !state.clients.length;
    chipsEl.innerHTML = state.clients.length
      ? [`<button type="button" class="chip" data-action="filter-client" data-id="all" aria-pressed="${ui.client === 'all'}">All clients</button>`]
        .concat(state.clients.map((c) => `
          <button type="button" class="chip" data-action="filter-client" data-id="${esc(c.id)}" aria-pressed="${ui.client === c.id}">
            <span class="dot" style="--c:${safeColor(c.color)}"></span>${esc(c.name)}
          </button>`)).join('')
      : '';

    const scoped = state.tasks.filter((t) => ui.client === 'all' || t.clientId === ui.client);
    const todo = scoped.filter((t) => !t.done).sort(byDue);
    const done = scoped.filter((t) => t.done).sort((a, b) => b.doneAt - a.doneAt);

    const buckets = { overdue: [], today: [], tomorrow: [], soon: [], later: [], none: [] };
    todo.forEach((t) => buckets[dueInfo(t).bucket].push(t));
    const week = buckets.today.length + buckets.tomorrow.length + buckets.soon.length;

    // Brand-new account: keep the screen focused on the first step.
    const blank = !state.clients.length && !state.tasks.length;
    $('#tiles').hidden = blank;
    $('#segmented').hidden = blank;

    // Summary tiles
    const tile = (key, n, label, cls) => `
      <button type="button" class="tile ${n ? cls : ''}" data-action="jump" data-bucket="${key}">
        <span class="tile-num">${n}</span><span class="tile-label">${label}</span>
      </button>`;
    $('#tiles').innerHTML =
      tile('overdue', buckets.overdue.length, 'Overdue', 'is-late') +
      tile('today', buckets.today.length, 'Due today', 'is-today') +
      tile('week', week, 'Next 7 days', '');

    // Segmented control
    $('#segmented').dataset.active = ui.seg;
    $$('#segmented [role="tab"]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.seg === ui.seg)));
    $('#countTodo').textContent = todo.length;
    $('#countDone').textContent = done.length;

    const clientName = ui.client !== 'all' ? clientById(ui.client)?.name : '';
    const list = $('#taskList');

    if (ui.seg === 'todo') {
      if (!todo.length) {
        if (!state.clients.length && !state.tasks.length) {
          list.innerHTML = emptyState(icons.people, "Let's get you set up", 'Add a client, then drop in their tasks and deadlines.',
            '<button type="button" class="pill-outline btn-blue" data-action="new-client">Add your first client</button>');
        } else if (done.length) {
          list.innerHTML = emptyState(icons.sparkle, 'All clear.', `Nothing left to do${clientName ? ` for ${esc(clientName)}` : ''}. Nice work.`,
            '<button type="button" class="link" data-action="new-task">Add a task</button>', 'ok');
        } else {
          list.innerHTML = emptyState(icons.tray, 'No tasks yet', `Add the first task${clientName ? ` for ${esc(clientName)}` : ''} and set its deadline.`,
            '<button type="button" class="pill-outline btn-blue" data-action="new-task">Add a task</button>');
        }
      } else {
        list.innerHTML = GROUPS.filter(([k]) => buckets[k].length)
          .map(([k, title]) => group(k, title, buckets[k]))
          .join('');
      }
    } else if (!done.length) {
      list.innerHTML = emptyState(icons.check, 'Nothing done yet', "Tap a task's circle and it lands here.");
    } else {
      const doneGroups = { today: [], yesterday: [], earlier: [] };
      done.forEach((t) => {
        const n = daysSince(t.doneAt);
        doneGroups[n <= 0 ? 'today' : n === 1 ? 'yesterday' : 'earlier'].push(t);
      });
      list.innerHTML = [['today', 'Today'], ['yesterday', 'Yesterday'], ['earlier', 'Earlier']]
        .filter(([k]) => doneGroups[k].length)
        .map(([k, title]) => group(`done-${k}`, title, doneGroups[k]))
        .join('') +
        `<button type="button" class="link clear-done" data-action="clear-done">Clear ${plural(done.length, 'completed task')}</button>`;
    }
  }

  function group(key, title, tasks) {
    return `
      <section class="group ${key === 'overdue' ? 'is-late' : ''}" id="group-${key}" aria-labelledby="gt-${key}">
        <div class="group-head">
          <h2 class="group-title" id="gt-${key}">${title}</h2>
          <span class="group-count">${tasks.length}</span>
        </div>
        <ul class="list">${tasks.map(taskRow).join('')}</ul>
      </section>`;
  }

  function taskRow(t) {
    const c = ui.client === 'all' ? clientById(t.clientId) : null;
    const d = dueInfo(t);
    const when = t.done
      ? `<span class="due">${doneLabel(t)}</span>`
      : `<span class="due ${d.tone}">${d.label}</span>`;
    return `
      <li class="task ${t.done ? 'is-done' : ''}" data-id="${esc(t.id)}">
        <button type="button" class="check" data-action="toggle" data-id="${esc(t.id)}"
          aria-label="${t.done ? 'Move back to To do' : 'Mark as done'}: ${esc(t.title)}">
          <span class="ring">${icons.check}</span>
        </button>
        <button type="button" class="task-body" data-action="edit-task" data-id="${esc(t.id)}">
          <span class="task-title">${esc(t.title)}</span>
          <span class="task-meta">
            ${c ? `<span class="dot" style="--c:${safeColor(c.color)}"></span><span>${esc(c.name)}</span><span aria-hidden="true">·</span>` : ''}
            ${when}
            ${t.notes ? `<span aria-label="Has notes">${icons.notes}</span>` : ''}
          </span>
        </button>
      </li>`;
  }

  function emptyState(icon, title, text, action = '', tone = '') {
    return `
      <div class="empty">
        <div class="empty-icon ${tone}">${icon}</div>
        <h2>${title}</h2>
        <p>${text}</p>
        ${action}
      </div>`;
  }

  function renderClients() {
    const open = state.tasks.filter((t) => !t.done).length;
    $('#clientsSummary').textContent = state.clients.length
      ? `${plural(state.clients.length, 'client')} · ${plural(open, 'open task')}`
      : 'No clients yet';

    const el = $('#clientList');
    if (!state.clients.length) {
      el.innerHTML = emptyState(icons.people, 'No clients yet', 'Add the people and brands you work with.',
        '<button type="button" class="pill-outline btn-blue" data-action="new-client">Add a client</button>');
      return;
    }

    const cards = state.clients.map((c) => {
      const ts = state.tasks.filter((t) => t.clientId === c.id);
      const openTasks = ts.filter((t) => !t.done).sort(byDue);
      const overdue = openTasks.filter((t) => t.due && daysUntil(t.due) < 0).length;
      return { c, total: ts.length, open: openTasks.length, doneN: ts.length - openTasks.length, overdue, next: openTasks[0] };
    }).sort((a, b) =>
      (b.overdue - a.overdue) ||
      ((a.next?.due || '9999').localeCompare(b.next?.due || '9999')) ||
      a.c.name.localeCompare(b.c.name));

    el.innerHTML = cards.map(({ c, total, open: openN, doneN, overdue, next }) => {
      const pct = total ? Math.round((doneN / total) * 100) : 0;
      let foot;
      if (next) {
        const d = dueInfo(next);
        foot = `<span class="muted">Next</span><span class="next-title">${esc(next.title)}</span><span class="due ${d.tone}">${d.label}</span>`;
      } else if (total) {
        foot = '<span class="ok">All done</span>';
      } else {
        foot = '<span class="muted">No tasks yet</span>';
      }
      return `
        <article class="client-card" style="--c:${safeColor(c.color)}">
          <button type="button" class="client-main" data-action="open-client" data-id="${esc(c.id)}">
            <span class="client-top"><span class="dot"></span><span class="client-name">${esc(c.name)}</span></span>
            <span class="client-stats">
              <span><span class="num">${openN}</span><span class="muted">open</span></span>
              ${overdue ? `<span class="late">${overdue} overdue</span>` : ''}
              <span class="muted right">${doneN}/${total} done</span>
            </span>
            <span class="progress" aria-hidden="true"><span style="width:${pct}%"></span></span>
            <span class="client-next">${foot}</span>
          </button>
          <button type="button" class="link client-edit" data-action="edit-client" data-id="${esc(c.id)}" aria-label="Edit ${esc(c.name)}">Edit</button>
        </article>`;
    }).join('');
  }

  /* ---------- Views ---------- */
  function setView(view) {
    ui.view = view;
    $('#view-tasks').hidden = view !== 'tasks';
    $('#view-clients').hidden = view !== 'clients';
    $$('.tab').forEach((t) => t.setAttribute('aria-current', t.dataset.view === view ? 'page' : 'false'));
    window.scrollTo(0, 0);
  }

  function jumpTo(bucket) {
    const order = bucket === 'week' ? ['today', 'tomorrow', 'soon'] : [bucket];
    if (ui.seg !== 'todo') { ui.seg = 'todo'; renderTasks(); }
    const target = order.map((k) => document.getElementById(`group-${k}`)).find(Boolean);
    if (target) {
      target.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'start' });
    } else {
      toast(bucket === 'overdue' ? 'Nothing overdue' : bucket === 'today' ? 'Nothing due today' : 'Nothing due this week');
    }
  }

  /* ---------- Toggle ---------- */
  const pending = new Set();
  function toggleTask(id) {
    const t = taskById(id);
    if (!t || pending.has(id)) return;
    const finishing = !t.done;
    const commit = () => {
      pending.delete(id);
      mutate(() => {
        const x = taskById(id);
        if (!x) return;
        x.done = finishing;
        x.doneAt = finishing ? Date.now() : null;
      }, finishing ? 'Marked as done' : 'Moved back to To do');
    };
    if (finishing && navigator.vibrate) navigator.vibrate(8);
    const row = document.querySelector(`.task[data-id="${CSS.escape(id)}"]`);
    if (row && !reducedMotion()) {
      pending.add(id);
      row.classList.add(finishing ? 'is-completing' : 'is-reopening');
      setTimeout(commit, 520);
    } else {
      commit();
    }
  }

  /* ---------- Toast ---------- */
  let toastTimer = null;
  let undoFn = null;
  function toast(message, undo = null) {
    const el = $('#toast');
    undoFn = undo;
    el.innerHTML = `<span>${esc(message)}</span>${undo ? '<button type="button" class="link" data-action="undo">Undo</button>' : ''}`;
    el.classList.toggle('no-action', !undo);
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(hideToast, undo ? 5000 : 2200);
  }
  function hideToast() {
    $('#toast').classList.remove('show');
    undoFn = null;
  }

  /* ---------- Sheets ---------- */
  const taskSheet = $('#taskSheet');
  const clientSheet = $('#clientSheet');

  function openSheet(dlg) {
    dlg.classList.remove('closing');
    if (!dlg.open) dlg.showModal();
    dlg.scrollTop = 0;
  }

  function closeSheet(dlg) {
    if (!dlg.open || dlg.classList.contains('closing')) return;
    if (reducedMotion()) { dlg.close(); return; }
    dlg.classList.add('closing');
    setTimeout(() => { dlg.classList.remove('closing'); dlg.close(); }, 210);
  }

  [taskSheet, clientSheet].forEach((dlg) => {
    dlg.addEventListener('click', (e) => { if (e.target === dlg) closeSheet(dlg); });
    dlg.addEventListener('cancel', (e) => { e.preventDefault(); closeSheet(dlg); });
  });

  function defaultClientId() {
    if (ui.client !== 'all') return ui.client;
    if (state.lastClient && clientById(state.lastClient)) return state.lastClient;
    return state.clients[0]?.id || '';
  }

  function openTaskSheet(id) {
    const t = id ? taskById(id) : null;
    ui.editingTask = t ? t.id : null;
    ui.sheetClient = t ? t.clientId : defaultClientId();
    $('#taskSheetTitle').textContent = t ? 'Edit task' : 'New task';
    $('#taskTitle').value = t ? t.title : '';
    $('#taskTitle').removeAttribute('aria-invalid');
    $('#taskTitleError').hidden = true;
    $('#taskNotes').value = t ? t.notes : '';
    $('#taskSubmit').textContent = t ? 'Save changes' : 'Add task';
    $('#taskEditActions').hidden = !t;
    $('#toggleFromSheet').textContent = t && t.done ? 'Move back to To do' : 'Mark as done';
    $('#newClientName').value = '';
    $('#newClientRow').hidden = state.clients.length > 0;
    setSheetDue(t ? t.due : '');
    renderSheetClients();
    openSheet(taskSheet);
    if (!t) $('#taskTitle').focus();
  }

  function renderSheetClients() {
    const rowOpen = !$('#newClientRow').hidden;
    $('#taskClientChips').innerHTML = state.clients.map((c) => `
      <button type="button" class="chip" data-action="sheet-client" data-id="${esc(c.id)}" aria-pressed="${ui.sheetClient === c.id}">
        <span class="dot" style="--c:${safeColor(c.color)}"></span>${esc(c.name)}
      </button>`).join('') +
      `<button type="button" class="chip chip-ghost" data-action="sheet-new-client" aria-expanded="${rowOpen}">+ New client</button>`;
  }

  function setSheetDue(iso) {
    ui.sheetDue = iso || '';
    $('#taskDue').value = ui.sheetDue;
    const t = startOfToday();
    const presets = { 0: toISO(t), 1: toISO(addDays(t, 1)), 7: toISO(addDays(t, 7)), none: '' };
    let matched = false;
    $$('#dueChips [data-due]').forEach((b) => {
      const on = presets[b.dataset.due] === ui.sheetDue;
      if (on) matched = true;
      b.setAttribute('aria-pressed', String(on));
    });
    const custom = !matched && !!ui.sheetDue;
    $('#pickDateChip').classList.toggle('is-on', custom);
    $('#pickDateLabel').textContent = custom
      ? fmt(parseISO(ui.sheetDue), { weekday: 'short', month: 'short', day: 'numeric' })
      : 'Pick date';
  }

  function addInlineClient() {
    const input = $('#newClientName');
    const name = input.value.trim();
    if (!name) { input.focus(); return null; }
    const c = { id: uid(), name: name.slice(0, 60), color: COLORS[state.clients.length % COLORS.length] };
    state.clients.push(c);
    persist();
    ui.sheetClient = c.id;
    input.value = '';
    $('#newClientRow').hidden = true;
    renderSheetClients();
    render();
    return c;
  }

  $('#taskForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const titleEl = $('#taskTitle');
    const title = titleEl.value.trim();
    if (!title) {
      titleEl.setAttribute('aria-invalid', 'true');
      $('#taskTitleError').hidden = false;
      titleEl.focus();
      return;
    }
    if (!$('#newClientRow').hidden && $('#newClientName').value.trim()) addInlineClient();

    const data = {
      title,
      clientId: clientById(ui.sheetClient) ? ui.sheetClient : '',
      due: ui.sheetDue,
      notes: $('#taskNotes').value.trim(),
    };
    const editing = ui.editingTask;
    const newId = uid();
    mutate(() => {
      if (editing) {
        Object.assign(taskById(editing) || {}, data);
      } else {
        state.tasks.push({ id: newId, ...data, done: false, doneAt: null, createdAt: Date.now() });
        state.lastClient = data.clientId || state.lastClient;
      }
    }, editing ? 'Task updated' : 'Task added');

    if (!editing) {
      if (ui.client !== 'all' && ui.client !== data.clientId) ui.client = 'all';
      ui.seg = 'todo';
      if (ui.view !== 'tasks') setView('tasks');
      render();
      const row = document.querySelector(`.task[data-id="${CSS.escape(newId)}"]`);
      if (row) {
        row.classList.add('is-new');
        row.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest' });
      }
    }
    closeSheet(taskSheet);
  });

  $('#taskTitle').addEventListener('input', (e) => {
    if (e.target.value.trim()) {
      e.target.removeAttribute('aria-invalid');
      $('#taskTitleError').hidden = true;
    }
  });

  $('#newClientName').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); addInlineClient(); }
  });

  const dueInput = $('#taskDue');
  ['change', 'input'].forEach((ev) => dueInput.addEventListener(ev, () => setSheetDue(dueInput.value)));
  dueInput.addEventListener('click', () => {
    try { dueInput.showPicker?.(); } catch (_) { /* picker opens natively on mobile */ }
  });

  function openClientSheet(id) {
    const c = id ? clientById(id) : null;
    ui.editingClient = c ? c.id : null;
    ui.sheetColor = c ? safeColor(c.color) : COLORS[state.clients.length % COLORS.length];
    $('#clientSheetTitle').textContent = c ? 'Edit client' : 'New client';
    $('#clientName').value = c ? c.name : '';
    $('#clientName').removeAttribute('aria-invalid');
    $('#clientNameError').hidden = true;
    $('#clientSubmit').textContent = c ? 'Save changes' : 'Add client';
    $('#clientEditActions').hidden = !c;
    renderSwatches();
    openSheet(clientSheet);
    if (!c) $('#clientName').focus();
  }

  function renderSwatches() {
    $('#swatches').innerHTML = COLORS.map((col, i) => `
      <button type="button" class="swatch" role="radio" data-action="swatch" data-color="${col}" style="--c:${col}"
        aria-checked="${ui.sheetColor === col}" aria-label="Color ${i + 1}"></button>`).join('');
  }

  $('#clientForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const nameEl = $('#clientName');
    const name = nameEl.value.trim();
    if (!name) {
      nameEl.setAttribute('aria-invalid', 'true');
      $('#clientNameError').hidden = false;
      nameEl.focus();
      return;
    }
    const editing = ui.editingClient;
    mutate(() => {
      if (editing) {
        Object.assign(clientById(editing) || {}, { name, color: ui.sheetColor });
      } else {
        state.clients.push({ id: uid(), name, color: ui.sheetColor });
      }
    }, editing ? 'Client updated' : 'Client added');
    closeSheet(clientSheet);
  });

  $('#clientName').addEventListener('input', (e) => {
    if (e.target.value.trim()) {
      e.target.removeAttribute('aria-invalid');
      $('#clientNameError').hidden = true;
    }
  });

  /* ---------- Data tools ---------- */
  function exportData() {
    const payload = { app: 'tasky', version: 1, exportedAt: new Date().toISOString(), ...state };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `tasky-backup-${toISO(new Date())}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('Backup downloaded');
  }

  $('#importFile').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    try {
      const data = JSON.parse(await file.text());
      if (!valid(data)) throw new Error('invalid');
      const next = normalize(data);
      const ok = window.confirm(`Replace what's on this device with the backup?\n${plural(next.clients.length, 'client')}, ${plural(next.tasks.length, 'task')}.`);
      if (!ok) return;
      mutate(() => { state = { ...next, sample: false }; ui.client = 'all'; }, 'Backup restored');
    } catch (_) {
      toast("That file isn't a Tasky backup");
    }
  });

  const emptyData = () => ({ clients: [], tasks: [], sample: false, lastClient: '' });

  /* ---------- Click delegation ---------- */
  document.addEventListener('click', (e) => {
    const el = e.target.closest('[data-action]');
    if (!el) return;
    const { action, id } = el.dataset;

    switch (action) {
      case 'tab':
        setView(el.dataset.view);
        break;
      case 'filter-client':
        ui.client = id;
        renderTasks();
        el.scrollIntoView({ behavior: reducedMotion() ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
        break;
      case 'seg':
        ui.seg = el.dataset.seg;
        renderTasks();
        break;
      case 'jump':
        jumpTo(el.dataset.bucket);
        break;
      case 'toggle':
        toggleTask(id);
        break;
      case 'edit-task':
        openTaskSheet(id);
        break;
      case 'new-task':
        openTaskSheet();
        break;
      case 'close-sheet':
        closeSheet(el.closest('dialog'));
        break;
      case 'sheet-client':
        ui.sheetClient = ui.sheetClient === id ? '' : id;
        renderSheetClients();
        break;
      case 'sheet-new-client': {
        const row = $('#newClientRow');
        row.hidden = !row.hidden;
        renderSheetClients();
        if (!row.hidden) $('#newClientName').focus();
        break;
      }
      case 'add-inline-client':
        addInlineClient();
        break;
      case 'sheet-due': {
        const v = el.dataset.due;
        setSheetDue(v === 'none' ? '' : toISO(addDays(startOfToday(), Number(v))));
        break;
      }
      case 'toggle-from-sheet': {
        const tid = ui.editingTask;
        closeSheet(taskSheet);
        const t = tid && taskById(tid);
        if (t) {
          const finishing = !t.done;
          mutate(() => { t.done = finishing; t.doneAt = finishing ? Date.now() : null; },
            finishing ? 'Marked as done' : 'Moved back to To do');
        }
        break;
      }
      case 'delete-task': {
        const tid = ui.editingTask;
        closeSheet(taskSheet);
        if (tid) mutate(() => { state.tasks = state.tasks.filter((t) => t.id !== tid); }, 'Task deleted');
        break;
      }
      case 'clear-done': {
        const scopedDone = (t) => t.done && (ui.client === 'all' || t.clientId === ui.client);
        const n = state.tasks.filter(scopedDone).length;
        mutate(() => { state.tasks = state.tasks.filter((t) => !scopedDone(t)); }, `Cleared ${plural(n, 'task')}`);
        break;
      }
      case 'new-client':
        openClientSheet();
        break;
      case 'edit-client':
        openClientSheet(id);
        break;
      case 'open-client':
        ui.client = id;
        ui.seg = 'todo';
        renderTasks();
        setView('tasks');
        break;
      case 'swatch':
        ui.sheetColor = el.dataset.color;
        renderSwatches();
        break;
      case 'delete-client': {
        const cid = ui.editingClient;
        const c = clientById(cid);
        if (!c) break;
        const n = state.tasks.filter((t) => t.clientId === cid).length;
        const ok = window.confirm(n
          ? `Delete ${c.name}? Their ${plural(n, 'task')} will be deleted too.`
          : `Delete ${c.name}?`);
        if (!ok) break;
        closeSheet(clientSheet);
        mutate(() => {
          state.clients = state.clients.filter((x) => x.id !== cid);
          state.tasks = state.tasks.filter((t) => t.clientId !== cid);
        }, 'Client deleted');
        break;
      }
      case 'start-fresh':
        ui.client = 'all';
        mutate(() => { state = emptyData(); }, 'Sample data cleared');
        break;
      case 'keep-sample':
        state.sample = false;
        persist();
        render();
        break;
      case 'export':
        exportData();
        break;
      case 'import':
        $('#importFile').click();
        break;
      case 'reset':
        if (window.confirm('Erase all clients and tasks on this device?')) {
          ui.client = 'all';
          mutate(() => { state = emptyData(); }, 'Everything erased');
        }
        break;
      case 'undo':
        if (undoFn) { const fn = undoFn; hideToast(); fn(); }
        break;
      default:
        break;
    }
  });

  // Keep "Today" / "Overdue" honest if the app stays open past midnight.
  document.addEventListener('visibilitychange', () => { if (!document.hidden) render(); });

  render();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
  }
})();
