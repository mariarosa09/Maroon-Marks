/* =========================================================
   Maroon Marks — MSEUF grade calculator: application logic
   Vanilla JS. Compute-only: everything lives in memory and is
   cleared when the page is refreshed or closed. Nothing is
   written to LocalStorage, cookies or any server.
   ========================================================= */
(function () {
  'use strict';

  /* ---------------------------------------------------------
     1. Constants
     --------------------------------------------------------- */
  const EXAM_SHARE_PCT = 60;        // Major examinations: 60% of the period grade
  const REQ_SHARE_PCT = 40;         // Class requirements: 40% of the period grade
  const FSG_MID = 0.40;             // Final subject grade: midterm 40%
  const FSG_FIN = 0.60;             //                      final 60%
  const EXAMS = '__exams';          // list key used for the major examinations

  const METHODS = {
    nonzero: { label: 'Non-Zero-Based Grading (50% Base)', short: '50% Base', formula: '((Earned ÷ Total) × 50) + 50' },
    zero: { label: 'Zero-Based Grading', short: 'Zero-Based', formula: '(Earned ÷ Total) × 100' }
  };

  // MSEUF grading scale (student handbook)
  const SCALE = [
    { level: 1, gp: 1.00, min: 98, max: 100, desc: 'Excellent' },
    { level: 2, gp: 1.25, min: 95, max: 97, desc: 'Excellent' },
    { level: 3, gp: 1.50, min: 92, max: 94, desc: 'Superior' },
    { level: 4, gp: 1.75, min: 89, max: 91, desc: 'Superior' },
    { level: 5, gp: 2.00, min: 87, max: 88, desc: 'High Average', note: '* Lowest grade for the graduate school with a unit credit.' },
    { level: 6, gp: 2.25, min: 84, max: 86, desc: 'High Average' },
    { level: 7, gp: 2.50, min: 81, max: 83, desc: 'Average' },
    { level: 8, gp: 2.75, min: 78, max: 80, desc: 'Low Average' },
    { level: 9, gp: 3.00, min: 75, max: 77, desc: 'Passed' }
  ];
  const FAIL = { level: 10, gp: 5.00, min: null, max: 74, desc: 'Failed' };
  const GP_CHOICES = SCALE.map(s => s.gp).concat([5.00]);

  const CATEGORY_SUGGESTIONS = ['Quizzes', 'Assignments', 'Activities', 'Recitations', 'Seatwork', 'Laboratory Activities', 'Projects', 'Attendance'];

  const NAV = [
    { id: 'calculator', label: 'Grade Calculator', short: 'Grades', icon: 'calculator' },
    { id: 'gpa', label: 'GPA Calculator', short: 'GPA', icon: 'gpa' }
  ];
  const CALC_TABS = [
    { id: 'initial', label: 'Initial Grade' },
    { id: 'midterm', label: 'Midterm Grade' },
    { id: 'final', label: 'Final Grade' },
    { id: 'fsg', label: 'Final Subject Grade' },
    { id: 'whatif', label: 'What-If Projection' }
  ];
  const ROUNDING = {
    strict: 'No rounding — flag decimals that fall between ranges for review (default)',
    round: 'Round half up to a whole number (e.g. 91.5 → 92)',
    truncate: 'Drop decimals (e.g. 91.9 → 91)'
  };

  const ICONS = {
    calculator: '<rect x="5" y="2" width="14" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 18.5h.01M12 18.5h.01M16 18.5h.01"/>',
    gpa: '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    trash: '<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/>',
    target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'
  };
  const icon = (name) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

  /* ---------------------------------------------------------
     2. Small helpers
     --------------------------------------------------------- */
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const snap = (v) => Math.round(v * 1e9) / 1e9;          // removes floating-point noise only
  const isBlank = (v) => v === undefined || v === null || String(v).trim() === '';
  const num = (v) => (isBlank(v) ? NaN : Number(v));
  const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
  const str = (v) => (v === undefined || v === null ? '' : String(v));
  const sum = (arr) => snap(arr.reduce((a, b) => a + b, 0));

  const fmt = (v, d = 2) => (isNum(v) ? Number(v).toFixed(d) : '—');
  const fmtP = (v) => (isNum(v) ? `${fmt(v)}%` : '—');
  const fmtGP = (gp) => (isNum(gp) ? gp.toFixed(2) : '—');
  const pctNum = (v) => String(+(+v).toFixed(2));          // 5 → "5", 3.3333 → "3.33"
  const scoreLabel = (e, t) => `${+e}/${+t}`;

  /* ---------------------------------------------------------
     3. Core grade computation (pure functions)
     --------------------------------------------------------- */
  let state; // declared early so convertGrade can read the rounding option

  function scorePct(earned, total, method) {
    const r = earned / total;
    return snap(method === 'zero' ? r * 100 : r * 50 + 50);
  }

  function gpEntry(gp) {
    return SCALE.find(s => s.gp === gp) || (gp === 5 ? FAIL : null);
  }
  const rangeLabel = (e) => (e === FAIL ? '74 and below' : `${e.min}–${e.max}`);

  /**
   * Converts a percentage into an MSEUF grade point.
   * rounding: 'strict' (no rounding; decimals between ranges are flagged),
   *           'round' (round half up to a whole number), 'truncate' (drop decimals).
   */
  function convertGrade(v, rounding) {
    rounding = rounding || (state && state.settings.rounding) || 'strict';
    if (!isNum(v)) return null;
    const raw = snap(v);
    let used = raw;
    let note = '';
    const rawTxt = raw.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
    if (rounding === 'round') {
      used = Math.floor(raw + 0.5);
      if (used !== raw) note = `${rawTxt}% was rounded to ${used}% (round half up — confirm against official MSEUF policy).`;
    } else if (rounding === 'truncate') {
      used = Math.floor(raw);
      if (used !== raw) note = `${rawTxt}% was truncated to ${used}% (drop decimals — confirm against official MSEUF policy).`;
    }
    if (used > 100) {
      return { review: true, value: raw, used, message: `${fmt(raw)}% is above 100%, where the handbook scale ends. Review the inputs (for example, extra-credit scores).` };
    }
    if (used < 0) {
      return { review: true, value: raw, used, message: 'The percentage is negative. Review the inputs.' };
    }
    if (used <= FAIL.max) {
      return { gp: FAIL.gp, desc: FAIL.desc, passed: false, range: rangeLabel(FAIL), level: FAIL.level, value: raw, used, note };
    }
    for (const s of SCALE) {
      if (used >= s.min && used <= s.max) {
        return { gp: s.gp, desc: s.desc, passed: true, range: rangeLabel(s), level: s.level, value: raw, used, note };
      }
    }
    // Falls between whole-number ranges (e.g. 91.5)
    const lo = Math.floor(used), hi = Math.ceil(used);
    const lower = lo <= FAIL.max ? FAIL : SCALE.find(s => s.max === lo);
    const upper = SCALE.find(s => s.min === hi);
    const cand = [lower, upper].filter(Boolean);
    return {
      review: true, value: raw, used, candidates: cand,
      message: `${fmt(raw)}% falls between the handbook ranges ${cand.map(c => `${rangeLabel(c)} (${fmtGP(c.gp)})`).join(' and ')}. ` +
        'The handbook only lists whole-number ranges, so no grade point was assigned. Confirm MSEUF\'s official rounding policy, then pick a rounding option under the grading scale.'
    };
  }

  function classify(gpa) {
    if (!isNum(gpa)) return null;
    const g = snap(gpa);
    if (g >= 1 && g <= 1.30) return { key: 'university', label: 'University Scholar', range: '1.00–1.30' };
    if (g > 1.30 && g <= 1.50) return { key: 'college', label: 'College Scholar', range: 'Above 1.30–1.50' };
    return { key: 'none', label: 'No Scholar Classification', range: 'Above 1.50' };
  }

  /** GPA display (2 dp) that never lets display rounding contradict the classification. */
  function fmtGPA(g) {
    if (!isNum(g)) return { text: '—', extended: false };
    let s = g.toFixed(2);
    const key = classify(g).key;
    if (classify(+s).key === key) return { text: s, extended: false };
    for (let d = 3; d <= 6; d++) {
      s = g.toFixed(d);
      if (classify(+s).key === key) break;
    }
    return { text: s, extended: true };
  }

  const catName = (c, i) => str(c.name).trim() || `Category ${i + 1}`;
  const itemLabel = (c, ci, ii) => `${catName(c, ci)} ${ii + 1}`;
  const examLabel = (it, i) => str(it.name).trim() || `Examination ${i + 1}`;

  function validateItem(it, label, extra, catKey) {
    const errs = [];
    const base = { cat: catKey, item: it.id };
    const e = num(it.earned), t = num(it.total);
    if (isBlank(it.earned)) errs.push({ ...base, field: 'earned', msg: `${label}: enter the score earned.` });
    else if (!Number.isFinite(e)) errs.push({ ...base, field: 'earned', msg: `${label}: score earned must be a number.` });
    else if (e < 0) errs.push({ ...base, field: 'earned', msg: `${label}: score earned cannot be negative.` });
    if (isBlank(it.total)) errs.push({ ...base, field: 'total', msg: `${label}: enter the total possible score.` });
    else if (!(t > 0)) errs.push({ ...base, field: 'total', msg: `${label}: total possible score must be greater than zero.` });
    if (Number.isFinite(e) && t > 0 && e > t && !extra) {
      errs.push({ ...base, field: 'earned', msg: `${label}: score earned (${e}) is higher than the total (${t}). Turn on extra credit if this is intentional.` });
    }
    return errs;
  }

  /** Validates weighted categories; each category's weight is split equally among its items. */
  function checkCategories(cats, extra, cap, errors, warnings, underMsg, overMsg) {
    let allocated = 0;
    cats.forEach((c, ci) => {
      const cname = catName(c, ci);
      if (isBlank(c.weight)) errors.push({ cat: c.id, item: '', field: 'weight', msg: `${cname}: enter the category weight (%).` });
      else {
        const w = num(c.weight);
        if (!Number.isFinite(w) || w <= 0) errors.push({ cat: c.id, item: '', field: 'weight', msg: `${cname}: weight must be greater than 0%.` });
        else allocated += w;
      }
      if (!c.items.length) errors.push({ msg: `${cname}: add at least one item.` });
      c.items.forEach((it, ii) => errors.push(...validateItem(it, itemLabel(c, ci, ii), extra, c.id)));
    });
    allocated = snap(allocated);
    const remaining = snap(cap - allocated);
    if (allocated > cap) {
      errors.push({ msg: overMsg ? overMsg(allocated, snap(allocated - cap)) : `Category weights total ${allocated}%. They cannot exceed ${cap}%. Reduce them by ${snap(allocated - cap)}%.` });
      cats.forEach(c => errors.push({ cat: c.id, item: '', field: 'weight', msg: '' }));
    } else if (remaining > 0 && cats.length) {
      warnings.push(underMsg(allocated, remaining));
    }
    return { allocated, remaining, max: cap };
  }

  /** Per-category results: every item is worth (category weight ÷ number of items). */
  function catResults(cats, method) {
    return cats.map((c, ci) => {
      const weight = +c.weight, n = c.items.length;
      const items = c.items.map((it, ii) => {
        const earned = +it.earned, total = +it.total, pct = scorePct(earned, total, method);
        return { name: itemLabel(c, ci, ii), earned, total, pct, share: snap(weight / n), points: snap(pct * weight / (n * 100)) };
      });
      return { name: catName(c, ci), weight, n, share: snap(weight / n), items, avgPct: snap(sum(items.map(i => i.pct)) / n), contribution: sum(items.map(i => i.points)) };
    });
  }

  function computeInitial(d) {
    const errors = [], warnings = [];
    const cats = d.cats || [];
    if (!cats.length) errors.push({ msg: 'Add at least one category.' });
    const allocation = checkCategories(cats, d.extra, 100, errors, warnings,
      (a, r) => `Category weights total ${a}% — ${r}% is still unallocated, so the grade below only counts ${a}% of 100%.`);
    if (errors.length) return { ok: false, errors, warnings, allocation };
    const catRows = catResults(cats, d.method);
    const grade = sum(catRows.map(c => c.contribution));
    return { ok: true, errors, warnings, allocation, catRows, grade, method: d.method };
  }

  function computePeriod(d) {
    const errors = [], warnings = [];
    const exams = d.exams || [], cats = d.cats || [];

    // Major examinations: a fixed 60% category, split equally among exams
    if (!exams.length) errors.push({ msg: 'Add at least one major examination.' });
    exams.forEach((it, i) => errors.push(...validateItem(it, examLabel(it, i), d.extra, EXAMS)));

    // Other categories share the remaining 40%; each weight is split equally among its items
    const allocation = checkCategories(cats, d.extra, REQ_SHARE_PCT, errors, warnings,
      (a, r) => `Categories total ${snap(EXAM_SHARE_PCT + a)}% (exams 60% + others ${a}%) — ${r}% is not allocated yet, so the grade below is missing up to ${r} points.`,
      (a, over) => `Categories total ${snap(EXAM_SHARE_PCT + a)}% (exams 60% + others ${a}%). They cannot exceed 100%. Reduce the other categories by ${over}%.`);
    if (!cats.length) warnings.push('Only Major Examinations so far — add your other categories (quizzes, activities, …) to fill the remaining 40%.');

    if (errors.length) return { ok: false, errors, warnings, allocation };

    const n = exams.length;
    const examRows = exams.map((it, i) => {
      const earned = +it.earned, total = +it.total, pct = scorePct(earned, total, d.method);
      return { name: examLabel(it, i), earned, total, pct, share: snap(EXAM_SHARE_PCT / n), points: snap(pct * EXAM_SHARE_PCT / (n * 100)) };
    });
    const examPct = snap(sum(examRows.map(r => r.pct)) / n);
    const examContribution = sum(examRows.map(r => r.points));
    const catRows = catResults(cats, d.method);
    const reqContribution = sum(catRows.map(c => c.contribution));
    const grade = snap(examContribution + reqContribution);
    return { ok: true, errors, warnings, method: d.method, examRows, examPct, examContribution, catRows, reqContribution, allocation, grade };
  }

  const computeFSG = (m, f) => snap(m * FSG_MID + f * FSG_FIN);

  /** rows: [{ name, units, gp }] where gp is a grade point, 'INC', 'DRP' or '' (not chosen yet). */
  function computeGPA(rows) {
    const included = [], excluded = [];
    rows.forEach((r, idx) => {
      const label = str(r.name).trim() || `Subject ${idx + 1}`;
      const units = num(r.units);
      let g = null, reason = null;
      if (r.gp === 'INC') reason = 'INC (Incomplete) — not a numerical grade point';
      else if (r.gp === 'DRP') reason = 'DRP (Dropped) — not a numerical grade point';
      else if (isBlank(r.gp) || !gpEntry(Number(r.gp))) reason = 'No grade point selected';
      else { const e = gpEntry(Number(r.gp)); g = { gp: e.gp, desc: e.desc }; }
      if (!reason && !(units > 0)) reason = 'Units must be greater than zero';
      if (reason) excluded.push({ r, idx, label, reason });
      else included.push({ r, idx, label, units, g, weighted: snap(g.gp * units) });
    });
    const totalUnits = sum(included.map(x => x.units));
    const totalWeighted = sum(included.map(x => x.weighted));
    const gpa = totalUnits > 0 ? snap(totalWeighted / totalUnits) : null;
    return { included, excluded, totalUnits, totalWeighted, gpa, cls: classify(gpa) };
  }

  /* ---------------------------------------------------------
     4. In-memory state (cleared on refresh — never persisted)
     --------------------------------------------------------- */
  const newItem = (name = '') => ({ id: uid(), name, earned: '', total: '' });
  const newCat = (name = '') => ({ id: uid(), name, weight: '', items: [newItem()] });
  const newGpaRow = (gp = '') => ({ id: uid(), name: '', units: '3', gp });
  const newInitialDraft = () => ({ method: 'nonzero', extra: false, cats: [newCat('Examinations')] }); // optional: weight is yours to set, and it can be removed
  const newPeriodDraft = (examName) => ({ method: 'nonzero', extra: false, exams: [newItem(examName)], cats: [] });
  const defaultState = () => ({
    settings: { rounding: 'strict' },
    drafts: {
      initial: newInitialDraft(),
      midterm: newPeriodDraft('Midterm Examination'),
      final: newPeriodDraft('Final Examination'),
      fsg: { midterm: '', final: '' },
      whatif: { midterm: '', final: '85', targetGP: '1.75', targetPct: '' }
    },
    saved: { midterm: null, final: null },   // grades saved from the Midterm / Final tabs
    gpaRows: [newGpaRow()]
  });
  state = defaultState();

  /* ---------------------------------------------------------
     5. UI primitives: toast, modal, badges
     --------------------------------------------------------- */
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  function toast(msg, type = '') {
    const wrap = $('#toasts');
    if (!wrap) return;
    const t = document.createElement('div');
    t.className = `toast ${type}`;
    t.textContent = msg;
    wrap.appendChild(t);
    setTimeout(() => t.remove(), 3600);
  }

  let modalResolve = null;
  let lastFocus = null;
  function openModal({ title, body, buttons = [] }) {
    return new Promise(resolve => {
      modalResolve = resolve;
      lastFocus = document.activeElement;
      $('#modalTitle').textContent = title;
      $('#modalBody').innerHTML = body;
      const foot = $('#modalFoot');
      foot.innerHTML = buttons.map((b, i) => `<button class="btn ${b.class || ''}" data-modal-btn="${i}">${esc(b.label)}</button>`).join('');
      $$('[data-modal-btn]', foot).forEach(btn => btn.addEventListener('click', () => closeModal(buttons[+btn.dataset.modalBtn].value)));
      $('#modal').hidden = false;
      const first = $('[data-modal-btn]', foot) || $('[data-modal-close]');
      if (first) first.focus();
    });
  }
  function closeModal(value) {
    $('#modal').hidden = true;
    $('#modalBody').innerHTML = '';
    const r = modalResolve; modalResolve = null;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
    if (r) r(value);
  }
  function confirmDialog(title, message, confirmLabel = 'Confirm') {
    return openModal({
      title, body: `<p>${message}</p>`,
      buttons: [{ label: 'Cancel', class: 'ghost', value: false }, { label: confirmLabel, class: 'danger', value: true }]
    });
  }

  /* ---------------------------------------------------------
     5b. Custom dropdowns
     The open list of a native <select> is drawn by the operating system
     and cannot be styled, so each select gets a themed button + listbox.
     The native select stays in the DOM (hidden) and keeps the value; picking
     an option updates it and fires the usual input/change events.
     --------------------------------------------------------- */
  const CHEVRON = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>';
  let openDropdown = null;

  function enhanceSelects(root = document) {
    root.querySelectorAll('select:not([data-enhanced])').forEach(sel => {
      sel.dataset.enhanced = '1';
      const wrap = document.createElement('div');
      wrap.className = 'mm-select';
      sel.parentNode.insertBefore(wrap, sel);
      wrap.appendChild(sel); // keep the select first so label clicks never re-trigger the button
      sel.classList.add('mm-native');
      sel.tabIndex = -1;
      sel.setAttribute('aria-hidden', 'true');
      const labelEl = sel.closest('label');
      const labelText = labelEl && labelEl.querySelector('span') ? labelEl.querySelector('span').textContent.trim() : '';
      const listId = 'mm-' + uid();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mm-trigger';
      btn.setAttribute('aria-haspopup', 'listbox');
      btn.setAttribute('aria-expanded', 'false');
      btn.setAttribute('aria-controls', listId);
      btn.innerHTML = `<span class="mm-value"></span>${CHEVRON}`;
      const list = document.createElement('ul');
      list.className = 'mm-list';
      list.id = listId;
      list.setAttribute('role', 'listbox');
      if (labelText) list.setAttribute('aria-label', labelText);
      list.hidden = true;
      wrap.append(btn, list);
      wrap._sync = () => {
        const o = sel.options[sel.selectedIndex];
        const text = o ? o.textContent : '';
        btn.querySelector('.mm-value').textContent = text;
        btn.classList.toggle('placeholder', !sel.value);
        btn.setAttribute('aria-label', labelText ? `${labelText}: ${text}` : text);
      };
      wrap._sync();
    });
  }

  function openSelect(wrap) {
    closeSelect(false);
    const sel = wrap.querySelector('select'), list = wrap.querySelector('.mm-list'), btn = wrap.querySelector('.mm-trigger');
    list.innerHTML = Array.from(sel.options).map((o, i) => `<li role="option" class="mm-option ${i === sel.selectedIndex ? 'selected' : ''}" id="${list.id}-${i}" data-index="${i}" aria-selected="${i === sel.selectedIndex}">${esc(o.textContent)}</li>`).join('');
    list.hidden = false;
    wrap.classList.add('open');
    btn.setAttribute('aria-expanded', 'true');
    // Open upwards / align right when there is no room below / to the right
    const r = btn.getBoundingClientRect();
    const below = window.innerHeight - r.bottom;
    wrap.classList.toggle('up', below < Math.min(280, list.scrollHeight) + 16 && r.top > below);
    wrap.classList.toggle('right', r.left + list.offsetWidth > document.documentElement.clientWidth - 8);
    openDropdown = wrap;
    setActiveOption(wrap, Math.max(0, sel.selectedIndex));
  }

  function setActiveOption(wrap, i) {
    const items = wrap.querySelectorAll('.mm-option');
    if (!items.length) return;
    i = Math.max(0, Math.min(items.length - 1, i));
    items.forEach((li, k) => li.classList.toggle('active', k === i));
    wrap._active = i;
    const list = wrap.querySelector('.mm-list'), li = items[i];
    if (li.offsetTop < list.scrollTop) list.scrollTop = li.offsetTop - 6;
    else if (li.offsetTop + li.offsetHeight > list.scrollTop + list.clientHeight) list.scrollTop = li.offsetTop + li.offsetHeight - list.clientHeight + 6;
    wrap.querySelector('.mm-trigger').setAttribute('aria-activedescendant', li.id);
  }

  function closeSelect(focus) {
    if (!openDropdown) return;
    const wrap = openDropdown;
    openDropdown = null;
    wrap.classList.remove('open', 'up', 'right');
    wrap.querySelector('.mm-list').hidden = true;
    const btn = wrap.querySelector('.mm-trigger');
    btn.setAttribute('aria-expanded', 'false');
    btn.removeAttribute('aria-activedescendant');
    if (focus) btn.focus();
  }

  function chooseOption(wrap, i) {
    const sel = wrap.querySelector('select');
    const changed = sel.selectedIndex !== i;
    sel.selectedIndex = i;
    wrap._sync();
    closeSelect(true);
    if (changed) {
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }

  /** Returns true when the click was handled by a dropdown. */
  function dropdownClick(e) {
    const opt = e.target.closest('.mm-option');
    if (opt) { chooseOption(opt.closest('.mm-select'), +opt.dataset.index); return true; }
    const trig = e.target.closest('.mm-trigger');
    if (trig) {
      if (e.detail === 0) return true; // keyboard "clicks" are handled in dropdownKey
      const wrap = trig.parentNode;
      if (openDropdown === wrap) closeSelect(true); else openSelect(wrap);
      return true;
    }
    if (e.target.closest('.mm-select')) return true; // e.g. label click forwarded to the hidden select
    if (openDropdown) closeSelect(false);
    return false;
  }

  /** Keyboard support: arrows, Home/End, Enter/Space, Escape, Tab, type-to-jump. */
  function dropdownKey(e) {
    const trig = e.target.closest && e.target.closest('.mm-trigger');
    if (!trig) return false;
    const wrap = trig.parentNode;
    const isOpen = openDropdown === wrap;
    const n = wrap.querySelector('select').options.length;
    switch (e.key) {
      case 'ArrowDown': case 'ArrowUp':
        e.preventDefault();
        if (!isOpen) openSelect(wrap); else setActiveOption(wrap, wrap._active + (e.key === 'ArrowDown' ? 1 : -1));
        return true;
      case 'Home': case 'End':
        if (isOpen) { e.preventDefault(); setActiveOption(wrap, e.key === 'Home' ? 0 : n - 1); }
        return true;
      case 'Enter': case ' ':
        e.preventDefault();
        if (isOpen) chooseOption(wrap, wrap._active); else openSelect(wrap);
        return true;
      case 'Escape':
        if (isOpen) { e.preventDefault(); closeSelect(true); return true; }
        return false;
      case 'Tab':
        if (isOpen) closeSelect(false);
        return false;
      default:
        if (isOpen && e.key.length === 1) {
          const opts = Array.from(wrap.querySelectorAll('.mm-option'));
          const k = e.key.toLowerCase();
          const start = wrap._active + 1;
          const hit = opts.slice(start).concat(opts.slice(0, start)).find(li => li.textContent.trim().toLowerCase().startsWith(k));
          if (hit) setActiveOption(wrap, +hit.dataset.index);
          return true;
        }
        return false;
    }
  }

  function gradeBadge(g) {
    if (!g || g.pending) return '<span class="badge pending">No grade yet</span>';
    if (g.review) return '<span class="badge review" title="Between handbook ranges — review needed">⚠ Needs review</span>';
    const cls = g.gp === 5 ? 'fail' : g.gp <= 1.75 ? 'excellent' : 'pass';
    const mark = g.gp === 5 ? '✕ ' : '✓ ';
    return `<span class="badge ${cls}">${mark}${fmtGP(g.gp)} · ${esc(g.desc)}</span>`;
  }
  const methodBadge = (m) => (m ? `<span class="badge method" title="${esc(METHODS[m].formula)}">${esc(METHODS[m].label)}</span>` : '');

  function scholarBlock(cls, gpaText) {
    if (!cls) return '';
    const iconTxt = cls.key === 'university' ? '★' : cls.key === 'college' ? '☆' : '•';
    const msg = cls.key === 'university' ? 'Your GPA is within the University Scholar range.'
      : cls.key === 'college' ? 'Your GPA is within the College Scholar range.'
        : 'Your GPA is outside the scholar ranges (1.00–1.50).';
    return `<div class="scholar ${cls.key} ${cls.key !== 'none' ? 'celebrate' : ''}" role="status">
      <div class="scholar-icon" aria-hidden="true">${iconTxt}</div>
      <div>
        <span class="small ${cls.key === 'university' ? '' : 'muted'}">Scholar classification (GPA-based estimate)</span>
        <strong>${esc(cls.label)}</strong>
        <div class="congrats">${msg} GPA ${esc(gpaText)} · range ${esc(cls.range)}</div>
        <div class="tiny ${cls.key === 'university' ? '' : 'muted'}">Not an official award — other MSEUF requirements may apply.</div>
      </div>
    </div>`;
  }

  const alertList = (type, title, items) => items.length ? `<div class="alert ${type}" role="${type === 'error' ? 'alert' : 'status'}"><strong>${title}</strong><ul>${items.map(i => `<li>${i}</li>`).join('')}</ul></div>` : '';

  function scaleCard(showRounding = true) {
    return `<div class="card"><h3>MSEUF grading scale</h3>
      <div class="table-wrap"><table class="scale-table"><thead><tr><th>Grade</th><th class="num">%</th><th>Description</th></tr></thead><tbody>
      ${SCALE.map(s => `<tr><td>${fmtGP(s.gp)}${s.note ? '*' : ''}</td><td class="num">${s.min}–${s.max}</td><td>${s.desc}</td></tr>`).join('')}
      <tr><td>5.00</td><td class="num">74 and below</td><td>Failed</td></tr><tr><td>INC</td><td class="num">—</td><td>Incomplete</td></tr><tr><td>DRP</td><td class="num">—</td><td>Dropped</td></tr>
      </tbody></table></div>
      <p class="tiny muted">* Lowest grade for the graduate school with a unit credit.</p>
      ${showRounding ? `<label class="field mt"><span>Rounding (percentage → grade point)</span>
        <select data-setting="rounding">${Object.keys(ROUNDING).map(k => `<option value="${k}" ${state.settings.rounding === k ? 'selected' : ''}>${ROUNDING[k]}</option>`).join('')}</select>
        <small>The handbook lists whole-number ranges only. Confirm MSEUF's official rounding policy before relying on a rounded result.</small></label>` : ''}
    </div>`;
  }

  /* ---------------------------------------------------------
     6. Routing & shell
     --------------------------------------------------------- */
  function parseRoute() {
    const parts = (location.hash || '#/calculator/initial').replace(/^#\/?/, '').split('/');
    const view = NAV.some(n => n.id === parts[0]) ? parts[0] : 'calculator';
    let sub = parts[1] || '';
    if (view === 'calculator' && !CALC_TABS.some(t => t.id === sub)) sub = 'initial';
    return { view, sub };
  }
  function renderNav() {
    const { view } = parseRoute();
    const link = (n, text) => `<a href="#/${n.id}" class="${n.id === view ? 'active' : ''}" ${n.id === view ? 'aria-current="page"' : ''}>${icon(n.icon)}<span>${text}</span></a>`;
    $('#sideNav').innerHTML = NAV.map(n => link(n, n.label)).join('');
    $('#bottomNav').innerHTML = NAV.map(n => link(n, n.short)).join('');
  }
  function render() {
    const { view, sub } = parseRoute();
    renderNav();
    $$('.view').forEach(v => v.classList.toggle('active', v.id === `view-${view}`));
    const nav = NAV.find(n => n.id === view);
    $('#pageTitle').textContent = nav.label;
    document.title = `${nav.label} · Maroon Marks`;
    if (view === 'gpa') renderGPA(); else renderCalculator(sub);
    enhanceSelects();
  }

  /* ---------------------------------------------------------
     7. Grade calculator views
     --------------------------------------------------------- */
  function renderCalculator(tab) {
    const el = $('#view-calculator');
    const tabs = `<div class="tabs" role="tablist">${CALC_TABS.map(t => `<a role="tab" href="#/calculator/${t.id}" class="tab ${t.id === tab ? 'active' : ''}" aria-selected="${t.id === tab}">${t.label}</a>`).join('')}</div>`;
    let body = '';
    if (tab === 'initial') body = initialView();
    else if (tab === 'midterm' || tab === 'final') body = periodView(tab);
    else if (tab === 'fsg') body = fsgView();
    else body = whatIfView();
    el.innerHTML = tabs + body;
    if (tab === 'fsg') updateFsg();
    else if (tab === 'whatif') updateWhatIf();
    else updateCalcResults(tab);
  }

  function methodPicker(calc, method) {
    return `<fieldset class="method-picker"><legend>Grading method for this calculation</legend>
      ${['nonzero', 'zero'].map(m => `<label class="seg ${method === m ? 'active' : ''}">
        <input type="radio" name="method-${calc}" value="${m}" data-action="set-method" data-calc="${calc}" ${method === m ? 'checked' : ''}>
        <span><strong>${METHODS[m].label}</strong>${m === 'nonzero' ? '<span class="default-tag">MSEUF default</span>' : ''}<small>${METHODS[m].formula}</small></span>
      </label>`).join('')}</fieldset>`;
  }

  const dataAttrs = (calc, cat, item, field) => `data-calc="${calc}" data-cat="${cat}" data-item="${item}" data-field="${field}"`;

  function itemRow(calc, catKey, it, label, named) {
    return `<div class="item-row ${named ? 'named' : ''}">
      ${named
        ? `<label class="field f-name"><span>${esc(label)}</span><input type="text" value="${esc(it.name)}" placeholder="e.g. Midterm Examination" ${dataAttrs(calc, catKey, it.id, 'name')} autocomplete="off"></label>`
        : `<div class="item-label" data-item-label="${it.id}">${esc(label)}</div>`}
      <label class="field"><span>Score earned</span><input type="number" inputmode="decimal" step="any" min="0" value="${esc(it.earned)}" ${dataAttrs(calc, catKey, it.id, 'earned')}></label>
      <label class="field"><span>Total possible</span><input type="number" inputmode="decimal" step="any" min="0" value="${esc(it.total)}" ${dataAttrs(calc, catKey, it.id, 'total')}></label>
      <button class="icon-btn" data-action="remove-item" data-calc="${calc}" data-cat="${catKey}" data-item="${it.id}" aria-label="Remove ${esc(label)}" title="Remove">${icon('trash')}</button>
      <div class="row-pct" data-pct="${it.id}"></div>
    </div>`;
  }

  /** Major examinations shown as a fixed category (60% of the grade, not removable). */
  function examCard(calc, d) {
    return `<div class="cat-card fixed">
      <div class="cat-head">
        <label class="field f-name"><span>Category 1</span><input type="text" value="Major Examinations" readonly tabindex="-1" aria-readonly="true"></label>
        <label class="field"><span>Category weight</span><div class="input-suffix" data-suffix="%"><input type="number" value="${EXAM_SHARE_PCT}" readonly tabindex="-1" aria-readonly="true"></div></label>
        <span class="lock-tag" title="Fixed by the MSEUF grading system">Fixed</span>
      </div>
      <div class="cat-share" data-share="${EXAMS}"></div>
      <div class="item-list">${d.exams.map((it, i) => itemRow(calc, EXAMS, it, `Exam ${i + 1}`, true)).join('') || '<div class="empty-inline">Add at least one major examination.</div>'}</div>
      <div><button class="btn sm secondary" data-action="add-item" data-calc="${calc}" data-cat="${EXAMS}">${icon('plus')}Add examination</button></div>
    </div>`;
  }

  function catEditor(calc, cats, emptyText, offset = 0) {
    if (!cats.length) return `<div class="empty-inline">${emptyText}</div>`;
    return `<div class="cat-list">${cats.map((c, ci) => `<div class="cat-card">
      <div class="cat-head">
        <label class="field f-name"><span>Category ${ci + 1 + offset}</span><input type="text" list="dl-categories" value="${esc(c.name)}" placeholder="e.g. Quizzes" ${dataAttrs(calc, c.id, '', 'name')} autocomplete="off"></label>
        <label class="field"><span>Category weight</span><div class="input-suffix" data-suffix="%"><input type="number" inputmode="decimal" step="any" min="0" value="${esc(c.weight)}" placeholder="e.g. 10" ${dataAttrs(calc, c.id, '', 'weight')}></div></label>
        <button class="icon-btn" data-action="remove-cat" data-calc="${calc}" data-cat="${c.id}" aria-label="Remove ${esc(catName(c, ci))}" title="Remove category">${icon('trash')}</button>
      </div>
      <div class="cat-share" data-share="${c.id}"></div>
      <div class="item-list">${c.items.map((it, ii) => itemRow(calc, c.id, it, itemLabel(c, ci, ii), false)).join('') || '<div class="empty-inline">No items yet.</div>'}</div>
      <div><button class="btn sm secondary" data-action="add-item" data-calc="${calc}" data-cat="${c.id}">${icon('plus')}Add item</button></div>
    </div>`).join('')}</div>`;
  }

  function extraToggle(calc, d) {
    return `<label class="check small"><input type="checkbox" data-action="toggle-extra" data-calc="${calc}" ${d.extra ? 'checked' : ''}> Allow extra credit (score may exceed total)</label>`;
  }

  function catChips(calc) {
    const names = calc === 'initial' ? ['Examinations'].concat(CATEGORY_SUGGESTIONS) : CATEGORY_SUGGESTIONS;
    return `<div class="chips">${names.map(n => `<button class="chip" data-action="add-cat" data-calc="${calc}" data-name="${n}">+ ${n}</button>`).join('')}</div>`;
  }

  function initialView() {
    const d = state.drafts.initial;
    return `<div class="calc-layout">
      <div class="stack"><div class="card">
        <div class="card-head"><div><h2>Initial Grade Calculator</h2><p class="muted small">Give each category a weight (total 100%). Examinations is optional here — set its weight, or remove it if your instructor doesn't include exams. A category's weight is split equally among its items — e.g. Quizzes 10% with 2 quizzes → each quiz is worth 5%.</p></div></div>
        ${methodPicker('initial', d.method)}
        <div class="section-label"><h3>Categories</h3>${extraToggle('initial', d)}</div>
        <div class="alloc" id="alloc-initial"></div>
        ${catEditor('initial', d.cats, 'No categories yet. Add one below.')}
        <div class="row mt"><button class="btn secondary" data-action="add-cat" data-calc="initial">${icon('plus')}Add category</button>${catChips('initial')}</div>
        <div class="row mt"><button class="btn ghost sm" data-action="reset-calc" data-calc="initial">Clear calculator</button></div>
      </div></div>
      <div class="card result-card" aria-live="polite" id="results-initial"></div>
    </div>`;
  }

  function periodView(calc) {
    const d = state.drafts[calc];
    const title = calc === 'midterm' ? 'Midterm' : 'Final';
    return `<div class="calc-layout">
      <div class="stack"><div class="card">
        <div class="card-head"><div><h2>${title} Grade Calculator</h2><p class="muted small">Major Examinations are fixed at 60%; your other categories share the remaining 40%. Every category's weight is split equally among its items.</p></div></div>
        ${methodPicker(calc, d.method)}
        <div class="section-label"><h3>Categories</h3>${extraToggle(calc, d)}</div>
        <div class="alloc" id="alloc-${calc}"></div>
        <div class="cat-list">${examCard(calc, d)}
        ${catEditor(calc, d.cats, 'Add your class requirement categories (quizzes, activities, …) below — they share the remaining 40%.', 1)}</div>
        <div class="row mt"><button class="btn secondary" data-action="add-cat" data-calc="${calc}">${icon('plus')}Add category</button>${catChips(calc)}</div>
        <div class="row mt"><button class="btn ghost sm" data-action="reset-calc" data-calc="${calc}">Clear calculator</button></div>
      </div></div>
      <div class="card result-card" aria-live="polite" id="results-${calc}"></div>
    </div>`;
  }

  const showBlankErrors = {}; // only flag untouched blank fields after the user has interacted
  function markInvalid(calc, errors) {
    $$(`[data-calc="${calc}"][data-field]`).forEach(i => { i.classList.remove('invalid'); i.removeAttribute('aria-invalid'); });
    errors.forEach(e => {
      if (!e.cat) return;
      const inp = $(`[data-calc="${calc}"][data-cat="${e.cat}"][data-item="${e.item || ''}"][data-field="${e.field}"]`);
      if (inp && (inp.value !== '' || showBlankErrors[calc])) { inp.classList.add('invalid'); inp.setAttribute('aria-invalid', 'true'); }
    });
  }

  function equivalentBlock(grade) {
    const c = convertGrade(grade);
    if (!c) return '';
    const label = 'Equivalent grade point (reference)';
    if (c.review) return `<div class="alert warn"><strong>${label}: needs review</strong><br>${esc(c.message)}</div>`;
    return `<dl class="kv"><dt>${label}</dt><dd>${gradeBadge(c)}</dd><dt>Percentage range</dt><dd>${c.range}</dd>${c.note ? `<dt>Rounding</dt><dd class="small">${esc(c.note)}</dd>` : ''}</dl>`;
  }

  /** Live hints inside the editor: item %, how much each item is worth, category split. */
  function updateHints(calc, d) {
    const hint = (it, share) => {
      const el = $(`[data-pct="${it.id}"]`);
      if (!el) return;
      const e = num(it.earned), t = num(it.total);
      if (!(Number.isFinite(e) && t > 0 && e >= 0)) { el.textContent = share ? `Worth ${pctNum(share)}% of the grade` : ''; return; }
      const p = scorePct(e, t, d.method);
      el.textContent = `${scoreLabel(e, t)} → ${fmt(p)}% (${METHODS[d.method].short})` + (share ? ` · worth ${pctNum(share)}% of the grade → ${fmt(snap(p * share / 100))} pts` : '');
    };
    (d.cats || []).forEach((c, ci) => {
      const w = num(c.weight), n = c.items.length;
      const share = Number.isFinite(w) && w > 0 && n ? w / n : null;
      const el = $(`[data-share="${c.id}"]`);
      if (el) el.textContent = !n ? 'Add at least one item.'
        : share ? `${n} item${n === 1 ? '' : 's'} · ${pctNum(w)}% ÷ ${n} = ${pctNum(share)}% each`
          : `${n} item${n === 1 ? '' : 's'} · enter a weight to split it equally among the items`;
      c.items.forEach((it, ii) => {
        const lbl = $(`[data-item-label="${it.id}"]`);
        if (lbl) lbl.textContent = itemLabel(c, ci, ii);
        hint(it, share);
      });
    });
    if (d.exams) {
      const n = d.exams.length;
      const share = n ? EXAM_SHARE_PCT / n : null;
      const el = $(`[data-share="${EXAMS}"]`);
      if (el) el.textContent = n ? `${n} exam${n === 1 ? '' : 's'} · 60% ÷ ${n} = ${pctNum(share)}% each` : '';
      d.exams.forEach(it => hint(it, share));
    }
  }

  function updateAlloc(calc, a) {
    const box = $(`#alloc-${calc}`);
    if (!box) return;
    const base = calc === 'initial' ? 0 : EXAM_SHARE_PCT; // exams are a fixed 60% category
    const cap = snap(base + a.max), allocated = snap(base + a.allocated);
    box.className = `alloc ${allocated > cap ? 'over' : allocated === cap ? 'full' : ''}`;
    const d = state.drafts[calc];
    const canDistribute = a.remaining > 0 && d.cats.length > 0;
    box.innerHTML = `<div class="row between"><strong class="small">Allocated: ${allocated}% of ${cap}%${base ? ` <span class="muted">(exams ${base}% + others ${a.allocated}%)</span>` : ''}</strong><span class="small ${allocated > cap ? '' : 'muted'}">${allocated > cap ? `Over by ${snap(allocated - cap)}%` : `Remaining: ${a.remaining}%`}</span></div>
      <div class="alloc-bar" role="progressbar" aria-valuemin="0" aria-valuemax="${cap}" aria-valuenow="${allocated}" aria-label="Category weight allocated"><div style="width:${Math.min(100, allocated / cap * 100)}%"></div></div>
      ${canDistribute ? `<button class="btn sm ghost" data-action="distribute" data-calc="${calc}">Distribute remaining ${a.remaining}%…</button>` : ''}`;
  }

  function breakdownTable(groups, totalLabel, totalWeight, totalPoints) {
    return `<div class="table-wrap"><table><thead><tr><th>Item</th><th class="num">Score</th><th class="num">%</th><th class="num">Worth</th><th class="num">Points</th></tr></thead>
      <tbody>${groups.map(g => `<tr class="group-row"><td>${esc(g.name)}</td><td></td><td class="num">${fmt(g.avgPct)}</td><td class="num">${pctNum(g.weight)}%</td><td class="num">${fmt(g.contribution)}</td></tr>
        ${g.items.map(i => `<tr class="sub-row"><td>${esc(i.name)}</td><td class="num">${scoreLabel(i.earned, i.total)}</td><td class="num">${fmt(i.pct)}</td><td class="num">${pctNum(i.share)}%</td><td class="num">${fmt(i.points)}</td></tr>`).join('')}`).join('')}</tbody>
      <tfoot><tr><td>${totalLabel}</td><td></td><td></td><td class="num">${pctNum(totalWeight)}%</td><td class="num">${fmt(totalPoints)}</td></tr></tfoot></table></div>`;
  }

  const groupStep = (g) => `<li>${esc(g.name)}: ${pctNum(g.weight)}% ÷ ${g.n} item${g.n === 1 ? '' : 's'} = ${pctNum(g.share)}% each<code class="formula">${g.items.map(i => `${fmt(i.pct)} × ${pctNum(i.share)}%`).join(' + ')} = ${fmt(g.contribution)}</code></li>`;

  function updateCalcResults(calc) {
    const box = $(`#results-${calc}`);
    if (!box) return;
    const d = state.drafts[calc];
    const res = calc === 'initial' ? computeInitial(d) : computePeriod(d);
    markInvalid(calc, res.errors);
    updateHints(calc, d);
    updateAlloc(calc, res.allocation);

    if (!res.ok) {
      box.innerHTML = `<h2>Result</h2><p class="muted small">Fill in or fix the items below to see the computed grade.</p>
        ${alertList('error', 'Please check your inputs', res.errors.filter(e => e.msg).map(e => esc(e.msg)))}
        ${alertList('warn', 'Heads up', res.warnings.map(esc))}`;
      return;
    }

    const mf = METHODS[res.method].formula;
    if (calc === 'initial') {
      box.innerHTML = `<div class="row between"><h2>Initial grade</h2>${methodBadge(res.method)}</div>
        <div class="result-big mt"><span class="num">${fmt(res.grade)}</span><span class="unit">%</span></div>
        ${alertList('warn', 'Heads up', res.warnings.map(esc))}
        ${breakdownTable(res.catRows, 'Total', res.allocation.allocated, res.grade)}
        <div class="steps"><h4>Step-by-step</h4><ol>
          <li>Each item's percentage: ${esc(METHODS[res.method].label)}<code class="formula">Percentage = ${mf}</code></li>
          ${res.catRows.map(groupStep).join('')}
          <li>Initial grade = sum of all category points<code class="formula">${res.catRows.map(c => fmt(c.contribution)).join(' + ')} = ${fmt(res.grade)}%</code></li>
        </ol></div>
        ${equivalentBlock(res.grade)}
        <p class="tiny muted">The handbook scale officially applies to final subject grades; the equivalent above is for reference only.</p>`;
      return;
    }

    const title = calc === 'midterm' ? 'Midterm' : 'Final';
    const examGroup = { name: 'Major Examinations', weight: EXAM_SHARE_PCT, n: res.examRows.length, share: res.examRows[0].share, avgPct: res.examPct, contribution: res.examContribution, items: res.examRows };
    box.innerHTML = `<div class="row between"><h2>${title} grade</h2>${methodBadge(res.method)}</div>
      <div class="result-big mt"><span class="num">${fmt(res.grade)}</span><span class="unit">%</span></div>
      ${alertList('warn', 'Heads up', res.warnings.map(esc))}
      <dl class="kv">
        <dt>Major examinations (60%)</dt><dd>${fmt(res.examContribution)} pts</dd>
        <dt>Other categories (${res.allocation.allocated}% of 40%)</dt><dd>${fmt(res.reqContribution)} pts</dd>
      </dl>
      ${breakdownTable([examGroup].concat(res.catRows), 'Total', snap(EXAM_SHARE_PCT + res.allocation.allocated), res.grade)}
      <div class="steps"><h4>Step-by-step</h4><ol>
        <li>Each item's percentage: ${esc(METHODS[res.method].label)}<code class="formula">Percentage = ${mf}</code></li>
        ${groupStep(examGroup)}
        ${res.catRows.map(groupStep).join('')}
        <li>${title} grade = sum of all category points<code class="formula">${[res.examContribution].concat(res.catRows.map(c => c.contribution)).map(v => fmt(v)).join(' + ')} = ${fmt(res.grade)}%</code></li>
      </ol></div>
      ${saveBar(calc, title, res.grade)}
      ${equivalentBlock(res.grade)}
      <p class="tiny muted">The handbook scale officially applies to final subject grades; the equivalent above is for reference only.</p>`;
  }

  /** Save the Midterm / Final result so it fills the Final Subject Grade tab (memory only). */
  function saveBar(calc, title, grade) {
    const saved = state.saved[calc];
    const same = saved !== null && snap(saved) === snap(grade);
    const dest = calc === 'midterm' ? 'Final Subject Grade and What-If' : 'Final Subject Grade';
    const note = saved === null ? `Fills the ${title.toLowerCase()} grade in ${dest}.`
      : same ? `Filled in ${dest}.` : `Saved value is ${fmt(saved)}% — save again to update it.`;
    return `<div class="save-bar"><button class="btn ${same ? 'secondary' : ''}" data-action="save-period" data-calc="${calc}">${same ? '✓ Saved' : `Save ${title.toLowerCase()} grade`}</button><span class="tiny muted">${note}</span></div>`;
  }

  const savedHint = (kind, value) => {
    const saved = state.saved[kind];
    if (saved === null) return `<small>Tip: press “Save” in the ${kind === 'midterm' ? 'Midterm' : 'Final'} Grade tab to fill this in automatically.</small>`;
    return String(saved) === str(value).trim() ? `<small class="ok-text">✓ From the ${kind === 'midterm' ? 'Midterm' : 'Final'} Grade tab</small>` : `<small>Saved ${kind} grade: ${fmt(saved)}%</small>`;
  };

  /* ---- Final subject grade ---- */
  function fsgView() {
    const d = state.drafts.fsg;
    return `<div class="calc-layout">
      <div class="stack"><div class="card">
        <div class="card-head"><div><h2>Final Subject Grade</h2><p class="muted small">Final Subject Grade = (Midterm × 40%) + (Final × 60%). The initial grade is not included.</p></div></div>
        <div class="form-grid">
          <label class="field"><span>Midterm grade (%)</span><input type="number" inputmode="decimal" step="any" min="0" max="100" data-fsg="midterm" value="${esc(d.midterm)}">${savedHint('midterm', d.midterm)}</label>
          <label class="field"><span>Final grade (%)</span><input type="number" inputmode="decimal" step="any" min="0" max="100" data-fsg="final" value="${esc(d.final)}">${savedHint('final', d.final)}</label>
        </div>
      </div>
      ${scaleCard()}</div>
      <div class="card result-card" aria-live="polite" id="results-fsg"></div>
    </div>`;
  }

  function readFsg() {
    const d = state.drafts.fsg;
    const errors = [];
    const m = num(d.midterm), f = num(d.final);
    if (isBlank(d.midterm)) errors.push('Enter the midterm grade.'); else if (!Number.isFinite(m) || m < 0) errors.push('Midterm grade must be 0 or higher.'); else if (m > 100) errors.push('Midterm grade cannot exceed 100%.');
    if (isBlank(d.final)) errors.push('Enter the final grade.'); else if (!Number.isFinite(f) || f < 0) errors.push('Final grade must be 0 or higher.'); else if (f > 100) errors.push('Final grade cannot exceed 100%.');
    return { errors, m, f };
  }
  function updateFsg() {
    const box = $('#results-fsg');
    if (!box) return;
    const { errors, m, f } = readFsg();
    if (errors.length) { box.innerHTML = `<h2>Result</h2>${alertList('error', 'Missing or invalid grades', errors)}`; return; }
    const fsg = computeFSG(m, f);
    const c = convertGrade(fsg);
    box.innerHTML = `<h2>Final subject grade</h2>
      <div class="result-big mt"><span class="num">${fmt(fsg)}</span><span class="unit">%</span></div>
      ${c.review ? `<div class="alert warn"><strong>Needs review</strong><br>${esc(c.message)}</div>` : `
      <dl class="kv"><dt>Grade point</dt><dd style="font-size:20px">${fmtGP(c.gp)}</dd><dt>Description</dt><dd>${esc(c.desc)}</dd><dt>Status</dt><dd>${gradeBadge(c)}</dd><dt>Percentage range</dt><dd>${c.range}</dd>${c.note ? `<dt>Rounding</dt><dd class="small">${esc(c.note)}</dd>` : ''}</dl>
      <div class="alert ${c.passed ? 'ok' : 'error'}"><strong>${c.passed ? 'PASSED' : 'FAILED'}</strong> — ${c.passed ? 'within the passing ranges (75 and above).' : 'within the 74-and-below range.'}</div>`}
      <div class="steps"><h4>Computation</h4><ol>
        <li>Midterm × 40%<code class="formula">${fmt(m)} × 0.40 = ${fmt(snap(m * FSG_MID))}</code></li>
        <li>Final × 60%<code class="formula">${fmt(f)} × 0.60 = ${fmt(snap(f * FSG_FIN))}</code></li>
        <li>Final subject grade<code class="formula">${fmt(snap(m * FSG_MID))} + ${fmt(snap(f * FSG_FIN))} = ${fmt(fsg)}%</code></li>
        ${c.review ? '' : `<li>Convert using the MSEUF scale<code class="formula">${fmt(c.used, Number.isInteger(c.used) ? 0 : 2)}% → ${c.range} → ${fmtGP(c.gp)} (${esc(c.desc)})</code></li>`}
      </ol></div>
      ${c.review ? '' : `<div class="row mt"><button class="btn secondary" data-action="fsg-to-gpa">${icon('plus')}Add ${fmtGP(c.gp)} to GPA calculator</button></div>`}`;
  }

  /* ---- What-if ---- */
  function whatIfView() {
    const d = state.drafts.whatif;
    return `<div class="calc-layout">
      <div class="stack"><div class="card">
        <div class="estimate-banner">${icon('target')} Projection mode — every value here is an estimate, not an actual grade.</div>
        <div class="card-head"><div><h2>Grade Projection &amp; What-If</h2><p class="muted small">Final Subject Grade = (Midterm × 0.40) + (Final × 0.60)</p></div></div>
        <div class="form-grid">
          <label class="field full"><span>Current midterm grade (%)</span><input type="number" inputmode="decimal" step="any" min="0" max="100" data-wf="midterm" value="${esc(d.midterm)}">${savedHint('midterm', d.midterm)}</label>
          <div class="field full"><span>Estimated final grade (%)</span>
            <div class="slider-row"><input type="range" min="0" max="100" step="0.5" data-wf="final" value="${esc(num(d.final) || 0)}" aria-label="Estimated final grade slider"><input type="number" inputmode="decimal" step="any" min="0" max="100" data-wf="final" value="${esc(d.final)}" aria-label="Estimated final grade"></div>
          </div>
        </div>
        <div class="section-label"><h3>Target</h3></div>
        <div class="form-grid">
          <label class="field"><span>Desired grade point</span><select data-wf="targetGP">${SCALE.map(s => `<option value="${s.gp}" ${String(s.gp) === String(+d.targetGP) ? 'selected' : ''}>${fmtGP(s.gp)} — ${s.desc} (${s.min}%+)</option>`).join('')}</select></label>
          <label class="field"><span>…or desired final subject grade (%)</span><input type="number" inputmode="decimal" step="any" min="0" max="100" data-wf="targetPct" value="${esc(d.targetPct)}" placeholder="optional"></label>
        </div>
      </div></div>
      <div class="card result-card" aria-live="polite" id="results-whatif"></div>
    </div>`;
  }

  function computeWhatIf() {
    const d = state.drafts.whatif;
    const errors = [];
    const m = num(d.midterm), f = num(d.final);
    if (isBlank(d.midterm)) errors.push('Enter your current midterm grade.'); else if (!(m >= 0 && m <= 100)) errors.push('Midterm grade must be between 0 and 100.');
    if (!(f >= 0 && f <= 100)) errors.push('Estimated final grade must be between 0 and 100.');
    let targetPct = null, targetLabel = '';
    if (!isBlank(d.targetPct)) {
      const t = num(d.targetPct);
      if (!(t >= 0 && t <= 100)) errors.push('Desired final subject grade must be between 0 and 100.');
      else { targetPct = t; targetLabel = `${fmt(t)}%`; }
    } else {
      const e = gpEntry(+d.targetGP) || SCALE[3];
      targetPct = e.min; targetLabel = `${fmtGP(e.gp)} (${e.min}% minimum)`;
    }
    if (errors.length) return { ok: false, errors };
    const fsg = computeFSG(m, f);
    return { ok: true, m, f, fsg, conv: convertGrade(fsg), targetPct, targetLabel, required: snap((targetPct - m * FSG_MID) / FSG_FIN) };
  }

  function updateWhatIf() {
    const box = $('#results-whatif');
    if (!box) return;
    const r = computeWhatIf();
    if (!r.ok) { box.innerHTML = `<div class="row between"><h2>Projection</h2><span class="badge estimate">Estimate</span></div>${alertList('error', 'Missing or invalid inputs', r.errors)}`; return; }
    let reqMsg;
    if (r.required > 100) reqMsg = `<div class="alert error">To reach ${esc(r.targetLabel)}, you would need a final grade of <strong>${fmt(r.required)}%</strong>, which is above 100% — not reachable with your current midterm.</div>`;
    else if (r.required <= 0) reqMsg = `<div class="alert ok">Your midterm already secures ${esc(r.targetLabel)} with any final grade of 0% or higher.</div>`;
    else reqMsg = `<div class="alert info">To reach ${esc(r.targetLabel)}, you need a final grade of at least <strong>${fmt(r.required)}%</strong>.<br><span class="tiny">(${esc(String(r.targetPct))} − ${fmt(r.m)} × 0.40) ÷ 0.60 = ${fmt(r.required)}</span></div>`;
    box.innerHTML = `<div class="row between"><h2>Projected final subject grade</h2><span class="badge estimate">Estimate</span></div>
      <div class="result-big mt"><span class="num">${fmt(r.fsg)}</span><span class="unit">%</span></div>
      ${r.conv.review ? `<div class="alert warn"><strong>Needs review</strong><br>${esc(r.conv.message)}</div>` : `<dl class="kv"><dt>Projected grade point</dt><dd>${gradeBadge(r.conv)}</dd><dt>Status</dt><dd>${r.conv.passed ? 'Passing (estimate)' : 'Failing (estimate)'}</dd></dl>`}
      <code class="formula">(${fmt(r.m)} × 0.40) + (${fmt(r.f)} × 0.60) = ${fmt(r.fsg)}%</code>
      <h3 class="mt">Needed final grade</h3>${reqMsg}`;
  }

  /* ---------------------------------------------------------
     8. GPA calculator (in-memory subject rows)
     --------------------------------------------------------- */
  function gpaRowHtml(r, i) {
    const a = (field) => `data-gpa-id="${r.id}" data-gpa-field="${field}"`;
    return `<div class="gpa-row">
      <label class="field"><span>Subject ${i + 1}</span><input type="text" value="${esc(r.name)}" placeholder="e.g. CSAL102 (optional)" maxlength="60" ${a('name')}></label>
      <label class="field"><span>Units</span><input type="number" inputmode="decimal" step="0.5" min="0" value="${esc(r.units)}" ${a('units')}></label>
      <label class="field"><span>Grade point</span><select ${a('gp')}>
        <option value="" ${isBlank(r.gp) ? 'selected' : ''}>Select grade point</option>
        ${GP_CHOICES.map(gp => `<option value="${gp}" ${String(r.gp) === String(gp) ? 'selected' : ''}>${fmtGP(gp)} — ${gpEntry(gp).desc}</option>`).join('')}
        <option value="INC" ${r.gp === 'INC' ? 'selected' : ''}>INC — Incomplete</option>
        <option value="DRP" ${r.gp === 'DRP' ? 'selected' : ''}>DRP — Dropped</option>
      </select></label>
      <button class="icon-btn" data-action="remove-gpa-row" data-id="${r.id}" aria-label="Remove subject ${i + 1}" title="Remove">${icon('trash')}</button>
      <div class="gpa-out" data-gpa-out="${r.id}"></div>
    </div>`;
  }

  function renderGPA() {
    const el = $('#view-gpa');
    const rows = state.gpaRows;
    el.innerHTML = `<div class="calc-layout">
      <div class="stack"><div class="card">
        <div class="card-head"><div><h2>GPA Calculator</h2><p class="muted small">GPA = Σ(Grade point × Units) ÷ Total units. For each subject, enter its units and pick its grade point.</p></div></div>
        ${rows.length ? `<div class="gpa-list">${rows.map(gpaRowHtml).join('')}</div>` : '<div class="empty-inline">No subjects yet. Add one below.</div>'}
        <div class="row mt"><button class="btn secondary" data-action="add-gpa-row">${icon('plus')}Add subject</button>
          ${rows.length ? '<button class="btn ghost sm" data-action="clear-gpa">Clear all</button>' : ''}</div>
      </div>
      ${scaleCard(false)}</div>
      <div class="card result-card" aria-live="polite" id="results-gpa"></div>
    </div>`;
    enhanceSelects();
    updateGPA();
  }

  function updateGPA() {
    const box = $('#results-gpa');
    if (!box) return;
    const res = computeGPA(state.gpaRows);
    res.included.forEach(x => {
      const out = $(`[data-gpa-out="${x.r.id}"]`);
      if (out) out.innerHTML = `${gradeBadge(x.g)} × ${x.units} unit${x.units === 1 ? '' : 's'} = <strong>${fmt(x.weighted)}</strong>`;
    });
    res.excluded.forEach(x => {
      const out = $(`[data-gpa-out="${x.r.id}"]`);
      if (out) out.innerHTML = `<span class="muted">Not counted: ${esc(x.reason)}</span>`;
    });
    const gpaF = fmtGPA(res.gpa);
    if (res.gpa === null) {
      box.innerHTML = `<h2>GPA</h2><p class="muted small">Pick a grade point and enter units for at least one subject to compute your GPA.</p>`;
      return;
    }
    const computation = `(${res.included.map(x => `${fmtGP(x.g.gp)}×${x.units}`).join(' + ')}) ÷ ${res.totalUnits} = ${fmt(res.totalWeighted)} ÷ ${res.totalUnits} = ${gpaF.text}`;
    box.innerHTML = `<h2>GPA</h2>
      <div class="result-big mt"><span class="num">${gpaF.text}</span></div>
      <dl class="kv"><dt>Subjects counted</dt><dd>${res.included.length} / ${state.gpaRows.length}</dd><dt>Total units</dt><dd>${res.totalUnits}</dd><dt>Σ Grade point × units</dt><dd>${fmt(res.totalWeighted)}</dd></dl>
      ${scholarBlock(res.cls, gpaF.text)}
      ${gpaF.extended ? '<div class="alert info small">GPA is shown with extra decimals because rounding to two places would misstate the classification.</div>' : ''}
      <div class="steps"><h4>Computation</h4><ol>
        <li>GPA = Σ(Grade point × Units) ÷ Total units<code class="formula">${esc(computation)}</code></li>
        <li>Classification uses the unrounded GPA: 1.00–1.30 University Scholar · above 1.30–1.50 College Scholar · above 1.50 none.</li>
      </ol></div>
      ${res.excluded.length ? `<div class="alert warn"><strong>Not counted (${res.excluded.length})</strong><ul>${res.excluded.map(x => `<li>${esc(x.label)}: ${esc(x.reason)}</li>`).join('')}</ul></div>` : ''}`;
  }

  /* ---------------------------------------------------------
     9. Actions
     --------------------------------------------------------- */
  function getTarget(d, catKey, itemId) {
    if (catKey === EXAMS) return d.exams.find(x => x.id === itemId) || null;
    const cat = (d.cats || []).find(c => c.id === catKey);
    if (!cat) return null;
    return itemId ? cat.items.find(x => x.id === itemId) || null : cat;
  }

  async function distribute(calc) {
    const d = state.drafts[calc];
    const res = calc === 'initial' ? computeInitial(d) : computePeriod(d);
    const remaining = res.allocation.remaining;
    if (!(remaining > 0) || !d.cats.length) return;
    const unweighted = d.cats.filter(c => isBlank(c.weight));
    const targets = unweighted.length ? unweighted : d.cats;
    const each = Math.floor(remaining / targets.length * 100) / 100;
    const last = snap(remaining - each * (targets.length - 1));
    const plan = targets.map((c, i) => ({ c, add: i === targets.length - 1 ? last : each }));
    const ok = await openModal({
      title: 'Distribute remaining weight',
      body: `<p>Split the remaining <strong>${remaining}%</strong> equally among ${unweighted.length ? 'the categories without a weight' : 'all categories'}:</p>
        <div class="table-wrap"><table><thead><tr><th>Category</th><th class="num">Current</th><th class="num">New</th></tr></thead><tbody>
        ${plan.map(p => `<tr><td>${esc(p.c.name || 'Unnamed')}</td><td class="num">${isBlank(p.c.weight) ? 'unset' : p.c.weight + '%'}</td><td class="num">${snap((num(p.c.weight) || 0) + p.add)}%</td></tr>`).join('')}
        </tbody></table></div><p class="tiny muted">You can still edit each weight afterwards.</p>`,
      buttons: [{ label: 'Cancel', class: 'ghost', value: false }, { label: 'Apply', value: true }]
    });
    if (!ok) return;
    plan.forEach(p => { p.c.weight = String(snap((num(p.c.weight) || 0) + p.add)); });
    render();
  }

  async function onClick(e) {
    if (dropdownClick(e)) return;
    if (e.target.closest('[data-modal-close]') || e.target === $('#modal')) { closeModal(null); return; }
    const t = e.target.closest('[data-action]');
    if (!t) return;
    const a = t.dataset.action;
    const calc = t.dataset.calc;
    const d = calc ? state.drafts[calc] : null;
    switch (a) {
      case 'add-cat': {
        const cat = newCat(t.dataset.name || '');
        d.cats.push(cat);
        render();
        const sel = t.dataset.name ? `[data-cat="${cat.id}"][data-field="weight"]` : `[data-cat="${cat.id}"][data-field="name"]`;
        const inp = $(`[data-calc="${calc}"]${sel}`);
        if (inp) inp.focus();
        break;
      }
      case 'remove-cat': d.cats = d.cats.filter(c => c.id !== t.dataset.cat); render(); break;
      case 'add-item': {
        const it = newItem();
        if (t.dataset.cat === EXAMS) d.exams.push(it);
        else { const cat = getTarget(d, t.dataset.cat, ''); if (cat) cat.items.push(it); }
        render();
        const inp = $(`[data-calc="${calc}"][data-item="${it.id}"][data-field="${t.dataset.cat === EXAMS ? 'name' : 'earned'}"]`);
        if (inp) inp.focus();
        break;
      }
      case 'remove-item': {
        if (t.dataset.cat === EXAMS) d.exams = d.exams.filter(x => x.id !== t.dataset.item);
        else { const cat = getTarget(d, t.dataset.cat, ''); if (cat) cat.items = cat.items.filter(x => x.id !== t.dataset.item); }
        render();
        break;
      }
      case 'reset-calc': {
        const ok = await confirmDialog('Clear calculator?', 'This removes every entry in this calculator.', 'Clear');
        if (!ok) return;
        state.drafts[calc] = calc === 'initial' ? newInitialDraft() : newPeriodDraft(calc === 'midterm' ? 'Midterm Examination' : 'Final Examination');
        showBlankErrors[calc] = false;
        render();
        break;
      }
      case 'distribute': distribute(calc); break;
      case 'save-period': {
        const r = computePeriod(d);
        if (!r.ok) return;
        state.saved[calc] = r.grade;
        state.drafts.fsg[calc] = String(r.grade);
        if (calc === 'midterm') state.drafts.whatif.midterm = String(r.grade);
        toast(`${calc === 'midterm' ? 'Midterm' : 'Final'} grade ${fmt(r.grade)}% saved to Final Subject Grade.`, 'success');
        updateCalcResults(calc);
        break;
      }
      case 'fsg-to-gpa': {
        const { errors, m, f } = readFsg();
        if (errors.length) return;
        const c = convertGrade(computeFSG(m, f));
        if (c.review) { toast('This grade falls between handbook ranges — choose a rounding option first.', 'error'); return; }
        const blank = state.gpaRows.find(r => isBlank(r.name) && isBlank(r.gp));
        if (blank) blank.gp = String(c.gp); else state.gpaRows.push(newGpaRow(String(c.gp)));
        toast(`Added grade point ${fmtGP(c.gp)} to the GPA calculator.`, 'success');
        break;
      }
      case 'add-gpa-row': {
        const row = newGpaRow();
        state.gpaRows.push(row);
        renderGPA();
        const inp = $(`[data-gpa-id="${row.id}"][data-gpa-field="name"]`);
        if (inp) inp.focus();
        break;
      }
      case 'remove-gpa-row': state.gpaRows = state.gpaRows.filter(r => r.id !== t.dataset.id); renderGPA(); break;
      case 'clear-gpa': {
        const ok = await confirmDialog('Clear all subjects?', 'This removes every subject from the GPA calculator.', 'Clear');
        if (!ok) return;
        state.gpaRows = [newGpaRow()];
        renderGPA();
        break;
      }
      default: break;
    }
  }

  function onInput(e) {
    const t = e.target;
    if (t.dataset.calc && t.dataset.field) {
      const target = getTarget(state.drafts[t.dataset.calc], t.dataset.cat, t.dataset.item);
      if (!target) return;
      target[t.dataset.field] = t.value;
      showBlankErrors[t.dataset.calc] = true;
      updateCalcResults(t.dataset.calc);
      return;
    }
    if (t.dataset.fsg) { state.drafts.fsg[t.dataset.fsg] = t.value; updateFsg(); return; }
    if (t.dataset.wf) {
      if (t.dataset.wf === 'targetGP') return; // handled on change
      state.drafts.whatif[t.dataset.wf] = t.value;
      if (t.dataset.wf === 'final') $$('[data-wf="final"]').forEach(x => { if (x !== t) x.value = t.value; });
      updateWhatIf();
      return;
    }
    if (t.dataset.gpaId) {
      const row = state.gpaRows.find(r => r.id === t.dataset.gpaId);
      if (!row) return;
      row[t.dataset.gpaField] = t.value;
      updateGPA();
    }
  }

  function onChange(e) {
    const t = e.target;
    const a = t.dataset.action;
    if (a === 'set-method') { state.drafts[t.dataset.calc].method = t.value; render(); return; }
    if (a === 'toggle-extra') { state.drafts[t.dataset.calc].extra = t.checked; updateCalcResults(t.dataset.calc); return; }
    // These re-render the view; put keyboard focus back on the same dropdown afterwards.
    const refocus = (sel) => { const n = $(sel); const trig = n && n.parentNode.querySelector('.mm-trigger'); if (trig) trig.focus(); };
    if (t.dataset.wf === 'targetGP') { state.drafts.whatif.targetGP = t.value; state.drafts.whatif.targetPct = ''; render(); refocus('[data-wf="targetGP"]'); return; }
    if (t.dataset.setting === 'rounding') { state.settings.rounding = ROUNDING[t.value] ? t.value : 'strict'; render(); refocus('[data-setting="rounding"]'); }
  }

  function init() {
    // category name suggestions
    const dl = document.createElement('datalist');
    dl.id = 'dl-categories';
    dl.innerHTML = ['Examinations'].concat(CATEGORY_SUGGESTIONS).map(n => `<option value="${n}">`).join('');
    document.body.appendChild(dl);

    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('keydown', (e) => {
      if (dropdownKey(e)) return;
      if (e.key === 'Escape' && !$('#modal').hidden) closeModal(null);
    });
    window.addEventListener('resize', () => closeSelect(false));
    window.addEventListener('hashchange', () => { render(); window.scrollTo({ top: 0 }); });
    if (!location.hash) history.replaceState(null, '', '#/calculator/initial');
    render();
  }

  // Expose pure functions for testing in Node; start the app in the browser.
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { scorePct, convertGrade, classify, fmtGPA, computeInitial, computePeriod, computeFSG, computeGPA, newItem, newCat };
  }
  if (typeof document !== 'undefined' && document.getElementById('main')) {
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
  }
})();
