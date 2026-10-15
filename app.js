(function () {
  'use strict';

  // ---------- Hilfsfunktionen ----------
  var STORE_KEY = 'tagesplaner.v1';
  var MONTHS = ['Januar','Februar','März','April','Mai','Juni','Juli','August','September','Oktober','November','Dezember'];
  var DOWS = ['Mo','Di','Mi','Do','Fr','Sa','So'];
  var DAYNAMES = ['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'];

  function pad(n){ return n < 10 ? '0' + n : '' + n; }
  function iso(d){ return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  function parse(s){ var p = s.split('-'); return new Date(+p[0], +p[1] - 1, +p[2]); }
  function addDays(s, n){ var d = parse(s); d.setDate(d.getDate() + n); return iso(d); }
  function nice(s){ var d = parse(s); return DAYNAMES[d.getDay()] + ', ' + d.getDate() + '. ' + MONTHS[d.getMonth()]; }
  function uid(){ return Math.random().toString(36).slice(2, 10) + Date.now().toString(36); }
  function esc(t){ var e = document.createElement('div'); e.textContent = t == null ? '' : t; return e.innerHTML; }
  function $(id){ return document.getElementById(id); }

  // ---------- Daten ----------
  var state = load();
  function load(){
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) {
        var s = JSON.parse(raw);
        if (s && typeof s === 'object') {
          s.events = Array.isArray(s.events) ? s.events : [];
          s.days = s.days && typeof s.days === 'object' ? s.days : {};
          return s;
        }
      }
    } catch (e) {}
    return { events: [], days: {} };
  }
  var persistFailed = false;
  function save(){
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
    catch (e) {
      if (!persistFailed) { persistFailed = true; alert('Speichern nicht möglich (Speicher voll oder im privaten Modus).'); }
    }
  }
  function day(date){
    if (!state.days[date]) state.days[date] = { prios: ['', '', ''], todos: [], note: '' };
    var d = state.days[date];
    if (!Array.isArray(d.prios)) d.prios = ['', '', ''];
    if (!Array.isArray(d.todos)) d.todos = [];
    if (typeof d.note !== 'string') d.note = '';
    return d;
  }
  function isEmptyDay(d){
    return !d.note.trim() && !d.todos.length && !d.prios.some(function(p){ return p.trim(); });
  }
  function eventsOn(date){
    return state.events.filter(function(e){ return e.date === date; })
      .sort(function(a, b){ return (a.start || '99:99').localeCompare(b.start || '99:99'); });
  }

  // ---------- Zustand der Oberfläche ----------
  var now = new Date();
  // Nach 17 Uhr plant man standardmäßig den nächsten Tag
  var selected = iso(now.getHours() >= 17 ? new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1) : now);
  var tab = 'day';
  var calMonth = parse(selected); calMonth.setDate(1);
  var view = $('view');

  function render(){
    document.querySelectorAll('.tabbar button').forEach(function(b){
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    if (tab === 'day') renderDay();
    else if (tab === 'cal') renderCal();
    else renderNotes();
  }

  function dateNav(){
    var today = iso(new Date());
    var sub = selected === today ? 'Heute' : selected === addDays(today, 1) ? 'Morgen' : selected === addDays(today, -1) ? 'Gestern' : '';
    return '<div class="datenav">' +
      '<button class="btn" data-act="prev" aria-label="Vorheriger Tag">‹</button>' +
      '<div class="title"><b>' + esc(nice(selected)) + '</b><small>' + esc(sub || selected.split('-').reverse().join('.')) + '</small></div>' +
      '<button class="btn" data-act="next" aria-label="Nächster Tag">›</button></div>' +
      '<div style="display:flex;gap:8px;margin-bottom:12px">' +
      '<button class="btn small-btn" data-act="today">Heute</button>' +
      '<button class="btn small-btn" data-act="tomorrow">Morgen</button></div>';
  }

  // ---------- Tag planen ----------
  function renderDay(){
    var d = day(selected);
    var evs = eventsOn(selected);
    var h = dateNav();

    h += '<div class="card"><h2>Termine <button class="btn small-btn" data-act="addEvent">+ Termin</button></h2>';
    if (!evs.length) h += '<div class="empty">Keine Termine an diesem Tag.</div>';
    evs.forEach(function(e){
      h += '<div class="ev" data-ev="' + esc(e.id) + '"><div class="t">' + esc(e.start || 'Ganztägig') + (e.end ? '<br><small>bis ' + esc(e.end) + '</small>' : '') + '</div>' +
        '<div class="n">' + esc(e.title) + (e.note ? '<small>' + esc(e.note) + '</small>' : '') + '</div></div>';
    });
    h += '</div>';

    h += '<div class="card"><h2>Top 3 Prioritäten</h2>';
    for (var i = 0; i < 3; i++) {
      h += '<div class="prio"><div class="num">' + (i + 1) + '</div><input data-prio="' + i + '" placeholder="Was ist wirklich wichtig?" maxlength="140" value="' + esc(d.prios[i]).replace(/"/g, '&quot;') + '"></div>';
    }
    h += '</div>';

    h += '<div class="card"><h2>Aufgaben</h2>';
    if (!d.todos.length) h += '<div class="empty">Noch keine Aufgaben.</div>';
    d.todos.forEach(function(t){
      h += '<div class="todo' + (t.done ? ' done' : '') + '" data-todo="' + esc(t.id) + '"><input type="checkbox" data-check="' + esc(t.id) + '"' + (t.done ? ' checked' : '') + '><div class="txt">' + esc(t.text) + '</div><button class="x" data-del="' + esc(t.id) + '" aria-label="Löschen">×</button></div>';
    });
    h += '<div class="addrow"><input id="newTodo" placeholder="Neue Aufgabe…" maxlength="200"><button class="btn primary" data-act="addTodo">Hinzufügen</button></div></div>';

    h += '<div class="card"><h2>Notiz für den Tag</h2><textarea id="dayNote" placeholder="Gedanken, Ideen, Erinnerungen…">' + esc(d.note) + '</textarea><div class="saved" id="savedMsg"></div></div>';

    view.innerHTML = h;
    var nt = $('newTodo');
    if (nt) nt.addEventListener('keydown', function(e){ if (e.key === 'Enter') addTodo(); });
    bindNote('dayNote');
  }

  function bindNote(id){
    var ta = $(id); if (!ta) return;
    var timer;
    ta.addEventListener('input', function(){
      var d = day(selected); d.note = ta.value;
      clearTimeout(timer);
      timer = setTimeout(function(){
        if (isEmptyDay(d)) delete state.days[selected];
        save();
        var m = $('savedMsg'); if (m) { m.textContent = 'Gespeichert'; setTimeout(function(){ if (m) m.textContent = ''; }, 1200); }
      }, 400);
    });
  }

  function addTodo(){
    var inp = $('newTodo'); var v = inp.value.trim(); if (!v) return;
    day(selected).todos.push({ id: uid(), text: v, done: false });
    save(); renderDay();
    var n = $('newTodo'); if (n) n.focus();
  }

  // ---------- Kalender ----------
  function renderCal(){
    var y = calMonth.getFullYear(), m = calMonth.getMonth();
    var first = new Date(y, m, 1);
    var offset = (first.getDay() + 6) % 7; // Montag = 0
    var start = new Date(y, m, 1 - offset);
    var today = iso(new Date());
    var h = '<div class="monthnav"><button class="btn" data-act="prevMonth">‹</button><b>' + MONTHS[m] + ' ' + y + '</b><button class="btn" data-act="nextMonth">›</button></div>';
    h += '<div class="grid">';
    DOWS.forEach(function(n){ h += '<div class="dow">' + n + '</div>'; });
    for (var i = 0; i < 42; i++) {
      var dt = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
      var s = iso(dt);
      var cls = 'cell' + (dt.getMonth() !== m ? ' out' : '') + (s === today ? ' today' : '') + (s === selected ? ' sel' : '');
      h += '<button class="' + cls + '" data-day="' + s + '">' + dt.getDate() + (state.events.some(function(e){ return e.date === s; }) ? '<span class="dot"></span>' : '') + '</button>';
    }
    h += '</div>';

    var evs = eventsOn(selected);
    h += '<div class="card" style="margin-top:14px"><h2>' + esc(nice(selected)) + ' <button class="btn small-btn" data-act="addEvent">+ Termin</button></h2>';
    if (!evs.length) h += '<div class="empty">Keine Termine.</div>';
    evs.forEach(function(e){
      h += '<div class="ev" data-ev="' + esc(e.id) + '"><div class="t">' + esc(e.start || 'Ganztägig') + (e.end ? '<br><small>bis ' + esc(e.end) + '</small>' : '') + '</div>' +
        '<div class="n">' + esc(e.title) + (e.note ? '<small>' + esc(e.note) + '</small>' : '') + '</div></div>';
    });
    h += '<div style="margin-top:10px"><button class="btn primary" data-act="planDay">Diesen Tag planen →</button></div></div>';
    view.innerHTML = h;
  }

  // ---------- Notizen ----------
  function renderNotes(){
    var d = day(selected);
    var h = dateNav();
    h += '<div class="card"><h2>Notizen</h2><textarea id="noteArea" style="min-height:220px" placeholder="Schreibe hier deine Notizen für diesen Tag…">' + esc(d.note) + '</textarea><div class="saved" id="savedMsg"></div></div>';

    var keys = Object.keys(state.days).filter(function(k){ return state.days[k].note && state.days[k].note.trim(); }).sort().reverse().slice(0, 20);
    h += '<div class="card"><h2>Letzte Notizen</h2>';
    if (!keys.length) h += '<div class="empty">Noch keine Notizen gespeichert.</div>';
    keys.forEach(function(k){
      h += '<div class="noteitem" data-note="' + k + '"><b>' + esc(nice(k)) + '</b><span>' + esc(state.days[k].note.replace(/\s+/g, ' ')) + '</span></div>';
    });
    h += '</div>';
    view.innerHTML = h;
    bindNote('noteArea');
  }

  // ---------- Termin-Dialog ----------
  var editingId = null;
  function openEvent(id){
    editingId = id || null;
    var e = id ? state.events.filter(function(x){ return x.id === id; })[0] : null;
    $('eventDlgTitle').textContent = e ? 'Termin bearbeiten' : 'Neuer Termin';
    $('evTitle').value = e ? e.title : '';
    $('evDate').value = e ? e.date : selected;
    $('evStart').value = e ? (e.start || '') : '';
    $('evEnd').value = e ? (e.end || '') : '';
    $('evNote').value = e ? (e.note || '') : '';
    $('evDelete').style.display = e ? '' : 'none';
    $('eventDlg').showModal();
    setTimeout(function(){ $('evTitle').focus(); }, 50);
  }
  $('eventForm').addEventListener('submit', function(){
    var title = $('evTitle').value.trim(); if (!title) return;
    var rec = { id: editingId || uid(), title: title, date: $('evDate').value || selected, start: $('evStart').value, end: $('evEnd').value, note: $('evNote').value.trim() };
    if (editingId) state.events = state.events.map(function(x){ return x.id === editingId ? rec : x; });
    else state.events.push(rec);
    selected = rec.date;
    save(); setTimeout(render, 0);
  });
  $('evCancel').addEventListener('click', function(){ $('eventDlg').close(); });
  $('evDelete').addEventListener('click', function(){
    if (!editingId || !confirm('Termin wirklich löschen?')) return;
    state.events = state.events.filter(function(x){ return x.id !== editingId; });
    save(); $('eventDlg').close(); render();
  });

  // ---------- Backup ----------
  $('menuBtn').addEventListener('click', function(){ $('menuDlg').showModal(); });
  $('menuClose').addEventListener('click', function(){ $('menuDlg').close(); });
  $('exportBtn').addEventListener('click', function(){
    var blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'tagesplaner-backup-' + iso(new Date()) + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(function(){ URL.revokeObjectURL(a.href); }, 2000);
  });
  $('importBtn').addEventListener('click', function(){ $('importFile').click(); });
  $('importFile').addEventListener('change', function(ev){
    var f = ev.target.files[0]; if (!f) return;
    var r = new FileReader();
    r.onload = function(){
      try {
        var s = JSON.parse(r.result);
        if (!s || !Array.isArray(s.events) || typeof s.days !== 'object') throw new Error('format');
        if (!confirm('Aktuelle Daten durch das Backup ersetzen?')) return;
        state = s; save(); $('menuDlg').close(); render();
      } catch (e) { alert('Das ist keine gültige Backup-Datei.'); }
    };
    r.readAsText(f);
    ev.target.value = '';
  });

  // ---------- Ereignisse ----------
  document.querySelector('.tabbar').addEventListener('click', function(e){
    var b = e.target.closest('button[data-tab]'); if (!b) return;
    tab = b.getAttribute('data-tab'); render(); window.scrollTo(0, 0);
  });

  view.addEventListener('click', function(e){
    var t = e.target;
    var el;
    if ((el = t.closest('[data-act]'))) {
      var a = el.getAttribute('data-act');
      var today = iso(new Date());
      if (a === 'prev') { selected = addDays(selected, -1); render(); }
      else if (a === 'next') { selected = addDays(selected, 1); render(); }
      else if (a === 'today') { selected = today; render(); }
      else if (a === 'tomorrow') { selected = addDays(today, 1); render(); }
      else if (a === 'addEvent') openEvent();
      else if (a === 'addTodo') addTodo();
      else if (a === 'prevMonth') { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() - 1, 1); render(); }
      else if (a === 'nextMonth') { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + 1, 1); render(); }
      else if (a === 'planDay') { tab = 'day'; render(); window.scrollTo(0, 0); }
      return;
    }
    if ((el = t.closest('[data-day]'))) {
      selected = el.getAttribute('data-day');
      var p = parse(selected);
      if (p.getMonth() !== calMonth.getMonth()) calMonth = new Date(p.getFullYear(), p.getMonth(), 1);
      render(); return;
    }
    if ((el = t.closest('[data-del]'))) {
      var id = el.getAttribute('data-del'); var d = day(selected);
      d.todos = d.todos.filter(function(x){ return x.id !== id; });
      if (isEmptyDay(d)) delete state.days[selected];
      save(); render(); return;
    }
    if ((el = t.closest('[data-ev]'))) { openEvent(el.getAttribute('data-ev')); return; }
    if ((el = t.closest('[data-note]'))) { selected = el.getAttribute('data-note'); render(); window.scrollTo(0, 0); return; }
  });

  view.addEventListener('change', function(e){
    var c = e.target.closest('[data-check]'); if (!c) return;
    var id = c.getAttribute('data-check');
    day(selected).todos.forEach(function(x){ if (x.id === id) x.done = c.checked; });
    save(); render();
  });

  view.addEventListener('input', function(e){
    var p = e.target.getAttribute && e.target.getAttribute('data-prio');
    if (p === null || p === undefined) return;
    var d = day(selected); d.prios[+p] = e.target.value;
    if (isEmptyDay(d)) delete state.days[selected];
    save();
  });

  render();

  // ---------- Service Worker + automatische Updates ----------
  if ('serviceWorker' in navigator) {
    var reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', function(){
      if (reloading) return; reloading = true; location.reload();
    });
    window.addEventListener('load', function(){
      navigator.serviceWorker.register('sw.js').then(function(reg){
        function offer(worker){
          $('updateBar').hidden = false;
          $('updateBtn').onclick = function(){ worker.postMessage('SKIP_WAITING'); };
        }
        if (reg.waiting && navigator.serviceWorker.controller) offer(reg.waiting);
        reg.addEventListener('updatefound', function(){
          var nw = reg.installing; if (!nw) return;
          nw.addEventListener('statechange', function(){
            if (nw.state === 'installed' && navigator.serviceWorker.controller) offer(nw);
          });
        });
        // regelmäßig und beim Zurückkehren in die App nach Updates suchen
        setInterval(function(){ reg.update(); }, 60 * 60 * 1000);
        document.addEventListener('visibilitychange', function(){ if (!document.hidden) reg.update(); });
      }).catch(function(){});
    });
  }
})();
