/* Le site d'Ultor · l'en-tête commun : la loupe et la recherche globale (le wiki, les chapitres et les plis du livre,
   les parties de l'Acte III). L'index est recherche.json à la racine du site ; s'il manque (un wiki construit seul),
   on se rabat sur l'index du wiki. */
(function () {
  'use strict';
  const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const SECTIONS = { livre: 'Le livre', acte3: "L'Acte III", wiki: 'Le wiki' };

  function start() {
    const head = document.querySelector('header.site');
    if (!head) return;
    const root = head.dataset.root || '';
    const btn = head.querySelector('.site-qb'), form = head.querySelector('.site-q');
    const input = form.querySelector('input'), list = form.querySelector('.site-qr');
    const sprite = root + 'wiki/assets/types.svg';

    // ── la loupe (téléphone) ouvre la ligne de recherche
    btn.addEventListener('click', () => {
      const open = !head.classList.contains('q-open');
      head.classList.toggle('q-open', open); btn.setAttribute('aria-expanded', String(open));
      if (open) input.focus(); else close();
    });
    document.addEventListener('keydown', ev => {
      if (ev.key !== '/' || ev.metaKey || ev.ctrlKey || ev.altKey) return;
      const t = ev.target; if (t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName))) return;
      ev.preventDefault(); head.classList.add('q-open'); btn.setAttribute('aria-expanded', 'true'); input.focus();
    });

    // ── l'index
    let INDEX = null, loading = null;
    function prep(list, prefix) {
      return list.map(e => Object.assign({}, e, {
        u: prefix + e.u, s: e.s || 'wiki',
        fn: fold(e.n), fa: (e.a || []).map(fold), fr: fold(e.r)
      }));
    }
    function load() {
      if (INDEX) return Promise.resolve(INDEX);
      if (!loading) loading = fetch(root + 'recherche.json').then(r => { if (!r.ok) throw r; return r.json(); })
        .then(j => (INDEX = prep(j, root)))
        .catch(() => fetch(root + 'wiki/recherche.json').then(r => r.json()).then(j => (INDEX = prep(j, root + 'wiki/'))))
        .catch(() => (INDEX = []));
      return loading;
    }
    load.soon = () => { if (!INDEX && !loading) load(); };

    function score(e, q, words) {
      let s = 0;
      const names = [e.fn].concat(e.fa);
      for (const n of names) {
        if (n === q) s = Math.max(s, 100);
        else if (n.startsWith(q)) s = Math.max(s, 80);
        else if (n.split(/[\s'’·-]+/).some(w => w.startsWith(q))) s = Math.max(s, 60);
        else if (n.includes(q)) s = Math.max(s, 40);
      }
      if (!s && words.every(w => names.some(n => n.includes(w)) || e.fr.includes(w))) s = words.every(w => names.some(n => n.includes(w))) ? 30 : 12;
      if (s && e.s === 'wiki') s += 2;   // à égalité, la fiche passe devant la page qui la cite
      return s;
    }
    function mark(name, q) {
      const f = fold(name), i = f.indexOf(q);
      if (i < 0 || !q) return esc(name);
      return esc(name.slice(0, i)) + '<mark>' + esc(name.slice(i, i + q.length)) + '</mark>' + esc(name.slice(i + q.length));
    }
    function glyph(e) {
      const id = e.y ? 't-' + e.y : e.s === 'livre' ? 's-livre' : e.s === 'acte3' ? 's-acte3' : 't-systeme';
      return '<svg class="gl" aria-hidden="true"><use href="' + esc(sprite) + '#' + esc(id) + '"/></svg>';
    }

    let items = [], sel = -1;
    function close() { list.hidden = true; input.setAttribute('aria-expanded', 'false'); sel = -1; }
    function paint() {
      list.querySelectorAll('li[role=option]').forEach((li, i) => {
        li.classList.toggle('sel', i === sel); li.setAttribute('aria-selected', String(i === sel));
        if (i === sel) li.scrollIntoView({ block: 'nearest' });
      });
    }
    function run() {
      const q = fold(input.value.trim());
      if (!q) { close(); return; }
      load().then(idx => {
        if (fold(input.value.trim()) !== q) return;
        const words = q.split(/\s+/).filter(Boolean);
        // chaque section garde sa place : le wiki ne mange pas le livre ni l'Acte III
        const seen = {};
        const hits = idx.map(e => [score(e, q, words), e]).filter(x => x[0] > 0)
          .sort((a, b) => b[0] - a[0] || a[1].fn.localeCompare(b[1].fn)).map(x => x[1])
          .filter(e => (seen[e.s] = (seen[e.s] || 0) + 1) <= (e.s === 'wiki' ? 8 : 5));
        // groupées par section, dans l'ordre de la meilleure réponse de chacune
        const groups = [];
        for (const e of hits) { let g = groups.find(x => x.s === e.s); if (!g) groups.push(g = { s: e.s, l: [] }); g.l.push(e); }
        items = [].concat(...groups.map(g => g.l));
        sel = items.length ? 0 : -1;
        let k = 0;
        list.innerHTML = items.length ? groups.map(g => '<li class="gh" role="presentation">' + esc(SECTIONS[g.s] || g.s) + '</li>' +
          g.l.map(e => '<li role="option" id="site-qr' + (k++) + '"><a href="' + esc(e.u) + '">' + glyph(e) +
            '<b>' + mark(e.n, q) + '<small>' + esc(e.t || '') + (e.p ? ' · proposition' : '') + '</small></b><span>' + esc(e.r || '') + '</span></a></li>').join('')).join('')
          : '<li class="none">Rien ne porte ce nom, ni dans le wiki, ni dans le livre, ni dans l\'Acte III.</li>';
        list.hidden = false; input.setAttribute('aria-expanded', 'true'); paint();
      });
    }
    input.addEventListener('input', run);
    input.addEventListener('focus', () => { load.soon(); if (input.value.trim()) run(); });
    input.addEventListener('keydown', ev => {
      if (ev.key === 'ArrowDown' && items.length) { sel = (sel + 1) % items.length; paint(); ev.preventDefault(); }
      else if (ev.key === 'ArrowUp' && items.length) { sel = (sel - 1 + items.length) % items.length; paint(); ev.preventDefault(); }
      else if (ev.key === 'Enter') { if (sel >= 0 && items[sel]) go(items[sel].u); ev.preventDefault(); }
      else if (ev.key === 'Escape') { close(); if (!input.value) { head.classList.remove('q-open'); btn.setAttribute('aria-expanded', 'false'); btn.focus(); } }
    });
    // un lien vers la page où l'on est déjà (un autre chapitre du livre, une autre partie de l'Acte III) : on ferme la liste
    function go(u) { close(); location.href = u; }
    list.addEventListener('click', ev => { if (ev.target.closest('a')) close(); });
    document.addEventListener('click', ev => { if (!form.contains(ev.target) && ev.target !== btn && !btn.contains(ev.target)) close(); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
