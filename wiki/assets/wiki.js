/* Le wiki d'Ultor · la visionneuse, la carte (zoom et déplacement au doigt). La recherche est celle du site (assets/site.js). */
(function () {
  'use strict';
  const $ = (s, r) => (r || document).querySelector(s);
  const $$ = (s, r) => Array.from((r || document).querySelectorAll(s));
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  // ── la visionneuse
  function setupLightbox() {
    let box = null, list = [], i = 0, x0 = null;
    function show() {
      $('img', box).src = list[i];
      $('.c', box).textContent = list.length > 1 ? (i + 1) + ' / ' + list.length : '';
      $('.p', box).hidden = $('.n', box).hidden = list.length < 2;
    }
    function step(d) { i = (i + d + list.length) % list.length; show(); }
    function close() { box.remove(); box = null; document.body.style.overflow = ''; }
    function key(ev) {
      if (!box) { document.removeEventListener('keydown', key); return; }
      if (ev.key === 'Escape') close(); else if (ev.key === 'ArrowRight') step(1); else if (ev.key === 'ArrowLeft') step(-1);
    }
    $$('.gal').forEach(g => {
      const btns = $$('[data-full]', g);
      btns.forEach((b, k) => b.addEventListener('click', () => {
        list = btns.map(x => x.dataset.full); i = k;
        box = document.createElement('div'); box.className = 'lb'; box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true');
        box.innerHTML = '<img alt=""><button class="x" type="button" aria-label="Fermer">×</button><button class="p" type="button" aria-label="Précédente">‹</button><button class="n" type="button" aria-label="Suivante">›</button><div class="c"></div>';
        document.body.appendChild(box); document.body.style.overflow = 'hidden'; show();
        $('.x', box).onclick = close; $('.p', box).onclick = e => { e.stopPropagation(); step(-1); }; $('.n', box).onclick = e => { e.stopPropagation(); step(1); };
        box.addEventListener('click', e => { if (e.target === box) close(); });
        box.addEventListener('touchstart', e => { x0 = e.touches.length === 1 ? e.touches[0].clientX : null; }, { passive: true });
        box.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; if (Math.abs(dx) > 50 && list.length > 1) step(dx < 0 ? 1 : -1); x0 = null; });
        document.addEventListener('keydown', key); $('.x', box).focus();
      }));
    });
  }

  // ── les cartes : l'épaisseur d'un trait et le corps d'un nom ne bougent pas avec le zoom (--u = une unité de carte en px)
  function fitUnits(svg) {
    const vb = svg.viewBox.baseVal, w = svg.clientWidth, h = svg.clientHeight;
    if (!w || !vb.width) return;
    const s = Math.min(w / vb.width, h / vb.height || Infinity);
    svg.style.setProperty('--u', (1 / s).toFixed(4));
    return s;
  }
  function setupStaticMaps() {
    const svgs = $$('svg.gx').filter(s => !s.classList.contains('full'));
    const run = () => svgs.forEach(fitUnits);
    run(); addEventListener('resize', run);
  }

  function setupMap() {
    const box = $('#mapbox'); if (!box) return;
    const svg = $('svg.gx', box), card = $('#mapcard'), data = JSON.parse($('#gxdata').textContent);
    const R = 106; let cx = 0, cy = 0, w = 2 * R, minW = 2 * R;
    function size() { return [svg.clientWidth || 1, svg.clientHeight || 1]; }
    function fitW() { const [W, H] = size(); return Math.max(2 * R, 2 * R * W / H); }
    function apply() {
      const [W, H] = size();
      w = Math.min(Math.max(w, minW / 14), fitW()); const h = w * H / W;
      cx = Math.max(-R, Math.min(R, cx)); cy = Math.max(-R, Math.min(R, cy));
      svg.setAttribute('viewBox', (cx - w / 2).toFixed(2) + ' ' + (cy - h / 2).toFixed(2) + ' ' + w.toFixed(2) + ' ' + h.toFixed(2));
      const s = W / w; svg.style.setProperty('--u', (1 / s).toFixed(4));
      svg.classList.toggle('z2', s > 5.2); svg.classList.toggle('zm', s > 2.6 && s <= 5.2); svg.classList.toggle('z1', s <= 2.6);
    }
    function zoomAt(f, px, py) {
      const [W, H] = size(), h = w * H / W;
      const mx = cx - w / 2 + px / W * w, my = cy - h / 2 + py / H * h;
      const nw = Math.min(Math.max(w / f, minW / 14), fitW()), k = nw / w;
      cx = mx + (cx - mx) * k; cy = my + (cy - my) * k; w = nw; apply();
    }
    function fit() { cx = 0; cy = 0; w = fitW(); minW = w; apply(); }
    fit(); addEventListener('resize', () => { const k = w / minW; minW = fitW(); w = minW * k; apply(); });

    // le doigt : un pour glisser, deux pour pincer ; la molette et les boutons sur ordinateur
    const pts = new Map(); let moved = 0, last = null, pinch = null;
    svg.addEventListener('pointerdown', e => { if (pts.size) svg.setPointerCapture(e.pointerId); pts.set(e.pointerId, [e.clientX, e.clientY]); moved = pts.size > 1 ? 99 : 0; last = [e.clientX, e.clientY]; pinch = null; svg.classList.add('drag'); });
    svg.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, [e.clientX, e.clientY]);
      const r = svg.getBoundingClientRect(), [W] = size();
      if (pts.size === 1) {
        const dx = e.clientX - last[0], dy = e.clientY - last[1]; last = [e.clientX, e.clientY];
        moved += Math.abs(dx) + Math.abs(dy);
        if (moved > 6) { if (!svg.hasPointerCapture(e.pointerId)) svg.setPointerCapture(e.pointerId); cx -= dx * w / W; cy -= dy * w / W; apply(); }
      } else if (pts.size === 2) {
        const [a, b] = Array.from(pts.values()), d = Math.hypot(a[0] - b[0], a[1] - b[1]), m = [(a[0] + b[0]) / 2 - r.left, (a[1] + b[1]) / 2 - r.top];
        if (pinch) { zoomAt(d / pinch.d, m[0], m[1]); cx -= (m[0] - pinch.m[0]) * w / W; cy -= (m[1] - pinch.m[1]) * w / W; apply(); }
        pinch = { d, m };
      }
    });
    const up = e => { pts.delete(e.pointerId); if (pts.size < 2) pinch = null; if (pts.size === 1) last = Array.from(pts.values())[0]; if (!pts.size) svg.classList.remove('drag'); };
    svg.addEventListener('pointerup', up); svg.addEventListener('pointercancel', up);
    svg.addEventListener('wheel', e => { e.preventDefault(); const r = svg.getBoundingClientRect(); zoomAt(Math.exp(-e.deltaY * 0.0022), e.clientX - r.left, e.clientY - r.top); }, { passive: false });
    $$('.mapctl button', box).forEach(b => b.addEventListener('click', () => {
      const [W, H] = size();
      if (b.dataset.z === 'fit') fit(); else zoomAt(b.dataset.z === 'in' ? 1.7 : 1 / 1.7, W / 2, H / 2);
    }));

    // toucher un système : sa carte en bas ; un second toucher (ou « Ouvrir la fiche ») ouvre la fiche
    let selected = null;
    function select(id, focus) {
      $$('.sy.sel', svg).forEach(n => n.classList.remove('sel'));
      const info = data.sys[id], node = $('.sy[data-id="' + id + '"]', svg);
      if (!info || !node) { card.hidden = true; selected = null; return; }
      node.classList.add('sel'); selected = id;
      const dom = info.d ? $('.dom[data-d="' + info.d + '"]', svg) : null, tint = dom ? dom.getAttribute('fill') : null;
      card.style.setProperty('--tint', tint || 'var(--line)');
      card.innerHTML = '<button class="x" type="button" aria-label="Fermer">×</button><b>' + esc(info.n) + '</b><div class="m">' +
        (info.d ? '<img src="blasons/' + esc(info.d) + '.svg" alt="" onerror="this.remove()">' + esc(info.dn) : 'sans maison') + (info.c ? ' · ' + esc(info.c) : '') + '</div>' +
        (info.r ? '<p>' + esc(info.r) + '</p>' : '') + '<a class="go" href="' + esc(id) + '.html">Ouvrir la fiche ›</a>';
      card.hidden = false; $('.x', card).onclick = () => { card.hidden = true; node.classList.remove('sel'); selected = null; };
      const p = data.x[id], [W, H] = size();
      if (focus) w = Math.min(w, minW / 3.2);
      cx = p[0]; cy = p[1] + 0.18 * w * H / W; apply();
    }
    svg.addEventListener('click', e => {
      if (moved > 6) { e.preventDefault(); e.stopPropagation(); return; }
      const a = e.target.closest('a.sy');
      if (!a) { return; }
      if (selected !== a.dataset.id) { e.preventDefault(); select(a.dataset.id, false); }
    }, true);

    // le filtre par maison : le reste s'éteint
    function filter(f) {
      $$('.lg').forEach(b => { const on = b.dataset.f === f; b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); });
      $$('[data-d]', svg).forEach(n => n.classList.toggle('dim', !!f && n.dataset.d !== f));
      $$('.dom', svg).forEach(n => n.classList.toggle('dim', !!f && n.dataset.d !== f));
    }
    $$('.lg').forEach(b => b.addEventListener('click', () => { filter(b.classList.contains('on') && b.dataset.f ? '' : b.dataset.f); }));

    function fromHash() {
      const h = decodeURIComponent(location.hash.slice(1));
      if (data.sys[h]) select(h, true);
      else if ($('.lg[data-f="' + h + '"]')) filter(h);
    }
    fromHash(); addEventListener('hashchange', fromHash);
  }

  function start() {
    setupLightbox(); setupStaticMaps(); setupMap();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();
