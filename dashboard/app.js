// SIGNAL — the dashboard. Reads window.RADAR (written beside dashboard/ by main.ts) and renders
// the ranked board, a filterable table, a per-protocol detail view with the model's own inputs and
// the protocol's farm plan, and the live-token comparison set. No network: every byte it shows is
// in data.js. The page recomputes each row's implied value from the snapshot figures and checks
// the number board.json carries, so the page's code and the board's data are visibly the same
// arithmetic.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('app');
  var state = { q: '', category: 'all', chain: 'all', sort: 'implied', watchOnly: false, tab: 'pre', selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // The model in one function: the same arithmetic lib/model.ts runs, so a row whose recomputed
  // value differs from the board's is shown as a mismatch instead of silently trusted.
  function impliedOf(row, model) {
    var growth = Math.min(model.growth_cap, Math.max(model.growth_floor, row.change_7d === null ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * model.growth_weight;
    var age = row.age_days === null ? model.unknown_age_days : row.age_days;
    var maturity = model.maturity_floor + (Math.min(Math.max(age, 0), model.maturity_days) / model.maturity_days) * model.maturity_range;
    var breadth = 1 + model.breadth_per_chain * Math.min(Math.max(row.chains.length - 1, 0), model.breadth_max_chains);
    var taper = row.tvl_usd > model.taper_threshold_usd
      ? Math.max(model.taper_floor, Math.pow(model.taper_threshold_usd / row.tvl_usd, model.taper_exponent))
      : 1;
    return Math.max(1, Math.round(row.tvl_usd * row.category_multiple * growthMult * maturity * breadth * taper));
  }

  var maxImplied = Math.max.apply(null, DATA.rows.map(function (r) { return r.implied_value_usd; }));
  var sorted = DATA.rows.slice().sort(function (a, b) { return a.implied_value_usd - b.implied_value_usd; });
  var medianImplied = sorted[Math.floor(sorted.length / 2)].implied_value_usd;

  // Stats strip.
  document.getElementById('stats').innerHTML =
    '<div class="stat"><b>' + DATA.watchlist_size + '</b><span>protocols on the watchlist</span></div>' +
    '<div class="stat"><b>' + DATA.board_size + '</b><span>pre-token protocols ranked</span></div>' +
    '<div class="stat"><b>' + fmtUsd(medianImplied) + '</b><span>median implied value</span></div>' +
    '<div class="stat"><b>' + fmtUsd(maxImplied) + '</b><span>top implied value</span></div>';

  // Filter options from the data itself.
  var cats = {}, chains = {};
  DATA.rows.forEach(function (r) {
    if (r.category) cats[r.category] = 1;
    r.chains.forEach(function (c) { chains[c] = 1; });
  });
  function fillSelect(id, values) {
    var el = document.getElementById(id);
    Object.keys(values).sort().forEach(function (v) {
      var o = document.createElement('option');
      o.value = v; o.textContent = v; el.appendChild(o);
    });
  }
  fillSelect('cat', cats);
  fillSelect('chain', chains);

  function visibleRows() {
    var rows = DATA.rows.filter(function (r) {
      if (state.watchOnly && !r.watchlist) return false;
      if (state.category !== 'all' && r.category !== state.category) return false;
      if (state.chain !== 'all' && r.chains.indexOf(state.chain) < 0) return false;
      if (state.q) {
        var q = state.q.toLowerCase();
        if (r.name.toLowerCase().indexOf(q) < 0 && r.slug.toLowerCase().indexOf(q) < 0) return false;
      }
      return true;
    });
    var key = state.sort;
    rows.sort(function (a, b) {
      if (key === 'tvl') return b.tvl_usd - a.tvl_usd;
      if (key === 'growth') return (b.change_7d === null ? -Infinity : b.change_7d) - (a.change_7d === null ? -Infinity : a.change_7d);
      if (key === 'age') return (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days);
      return b.implied_value_usd - a.implied_value_usd;
    });
    return rows;
  }

  function rowHtml(r) {
    var pctCls = r.change_7d === null ? '' : (r.change_7d >= 0 ? 'pos' : 'neg');
    var barPct = Math.max(2, Math.round(100 * r.implied_value_usd / maxImplied));
    return '<tr data-slug="' + esc(r.slug) + '"' + (state.selected === r.slug ? ' class="sel"' : '') + '>' +
      '<td class="num">' + r.rank + '</td>' +
      '<td><span class="pname">' + esc(r.name) + '</span>' +
      (r.watchlist ? '<span class="badge w">WATCHLIST</span>' : '') +
      '<br><span class="sub">' + esc(r.slug) + '</span></td>' +
      '<td>' + esc(r.category || '—') + '</td>' +
      '<td>' + esc(r.chains.slice(0, 3).join(', ')) + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
      '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
      '<td class="num ' + pctCls + '">' + fmtPct(r.change_7d) + '</td>' +
      '<td class="num">' + fmtAge(r.age_days) + '</td>' +
      '<td class="num"><strong>' + fmtUsd(r.implied_value_usd) + '</strong><div class="bar"><i style="width:' + barPct + '%"></i></div></td>' +
      '</tr>';
  }

  function renderBoard() {
    var rows = visibleRows();
    document.getElementById('rows').innerHTML = rows.map(rowHtml).join('');
    document.getElementById('count').textContent = rows.length + ' of ' + DATA.board_size + ' pre-token protocols · snapshot ' + DATA.as_of + ' · model ' + DATA.model_version;
    document.getElementById('live').hidden = true;
    document.querySelector('.tablewrap').style.display = '';
    document.getElementById('controls').style.display = '';
    document.getElementById('count').style.display = '';
  }

  function renderLive() {
    document.getElementById('live').hidden = false;
    document.querySelector('.tablewrap').style.display = 'none';
    document.getElementById('controls').style.display = 'none';
    document.getElementById('count').style.display = 'none';
    document.getElementById('live-rows').innerHTML = DATA.live.map(function (p) {
      var pctCls = p.change_7d === null ? '' : (p.change_7d >= 0 ? 'pos' : 'neg');
      return '<tr><td><span class="pname">' + esc(p.name) + '</span><br><span class="sub">' + esc(p.slug) + '</span></td>' +
        '<td>' + esc(p.category || '—') + '</td>' +
        '<td>' + esc(p.chains.slice(0, 3).join(', ')) + '</td>' +
        '<td class="num">' + fmtUsd(p.tvl_usd) + '</td>' +
        '<td class="num">' + fmtUsd(p.mcap_usd) + '</td>' +
        '<td class="num ' + pctCls + '">' + fmtPct(p.change_7d) + '</td></tr>';
    }).join('');
  }

  function parseStep(s) {
    var ci = s.indexOf(' Cost: ');
    if (ci < 0) return { text: s, meta: '' };
    var ti = s.indexOf(' Time: ', ci);
    return { text: s.slice(0, ci), meta: s.slice(ci + 1, ti < 0 ? undefined : ti) + (ti < 0 ? '' : ' · ' + s.slice(ti + 7)) };
  }

  function renderDetail(slug) {
    var panel = document.getElementById('detail');
    var row = null;
    DATA.rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) { panel.hidden = true; state.selected = null; return; }
    state.selected = slug;
    var recomputed = impliedOf(row, DATA.model);
    var match = recomputed === row.implied_value_usd;
    var base = row.tvl_usd * row.category_multiple;
    var steps = row.farm_steps.map(function (s) {
      var p = parseStep(s);
      return '<li>' + esc(p.text) + (p.meta ? '<br><span class="cost">' + esc(p.meta) + '</span>' : '') + '</li>';
    }).join('');
    panel.innerHTML =
      '<h2>#' + row.rank + ' ' + esc(row.name) + (row.watchlist ? '<span class="badge w">WATCHLIST</span>' : '') + ' <span class="badge pre">RECORDS NO TOKEN</span></h2>' +
      '<p class="meta">' + esc(row.slug) + ' · ' + esc(row.category || 'uncategorised') + ' · ' + esc(row.chains.join(', ')) +
      ' · TVL ' + fmtUsd(row.tvl_usd) + ' · 7d ' + fmtPct(row.change_7d) + ' · tracked ' + fmtAge(row.age_days) + '</p>' +
      '<h3>How the implied value is made</h3>' +
      '<div class="modelgrid">' +
      '<div><b>' + fmtUsd(row.tvl_usd) + '</b><span>TVL in the snapshot</span></div>' +
      '<div><b>× ' + row.category_multiple.toFixed(2) + '</b><span>category multiple (' + esc(row.category || 'default') + ')</span></div>' +
      '<div><b>× ' + row.growth_multiplier.toFixed(2) + '</b><span>growth multiplier (' + fmtPct(row.change_7d) + ' over 7 days)</span></div>' +
      '<div><b>× ' + row.maturity_multiplier.toFixed(2) + '</b><span>maturity multiplier (' + fmtAge(row.age_days) + ' with no token)</span></div>' +
      '<div><b>× ' + row.breadth_multiplier.toFixed(2) + '</b><span>breadth multiplier (' + row.chains.length + ' chain' + (row.chains.length === 1 ? '' : 's') + ')</span></div>' +
      '<div><b>× ' + row.taper.toFixed(2) + '</b><span>size taper</span></div>' +
      '<div class="total"><b>' + fmtUsd(row.implied_value_usd) + '</b><span>implied value' + (match ? ' — recomputed in this page, it matches' : ' — page recomputation gives ' + fmtUsd(recomputed)) + '</span></div>' +
      '</div>' +
      '<p class="note">Base before multipliers: ' + fmtUsd(base) + '. The page recomputes the value from the snapshot figures with the same arithmetic the board was built with.</p>' +
      '<h3>How to farm it — 7 steps</h3>' +
      '<ol class="steps">' + steps + '</ol>' +
      '<p class="note">This protocol records no token in the snapshot. That is not proof it has none, and it is not a prediction that one will launch.</p>';
    panel.hidden = false;
  }

  function applyHash() {
    var h = location.hash || '#/';
    var m;
    if (h === '#/live') { setTab('live'); return; }
    if ((m = h.match(/^#\/protocol\/(.+)$/))) { setTab('pre'); renderDetail(decodeURIComponent(m[1])); renderBoard(); return; }
    if ((m = h.match(/^#\/category\/(.+)$/))) {
      setTab('pre');
      var cat = decodeURIComponent(m[1]);
      state.category = cat;
      document.getElementById('cat').value = cat;
      renderBoard();
      return;
    }
    setTab('pre');
    renderBoard();
  }

  function setTab(tab) {
    state.tab = tab;
    document.querySelectorAll('#tabs button').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === tab);
    });
    if (tab === 'live') renderLive();
    else renderBoard();
  }

  document.getElementById('q').addEventListener('input', function (e) { state.q = e.target.value; renderBoard(); });
  document.getElementById('cat').addEventListener('change', function (e) { state.category = e.target.value; renderBoard(); });
  document.getElementById('chain').addEventListener('change', function (e) { state.chain = e.target.value; renderBoard(); });
  document.getElementById('sort').addEventListener('change', function (e) { state.sort = e.target.value; renderBoard(); });
  document.getElementById('watchonly').addEventListener('change', function (e) { state.watchOnly = e.target.checked; renderBoard(); });
  document.getElementById('tabs').addEventListener('click', function (e) {
    var b = e.target.closest('button[data-tab]');
    if (!b) return;
    location.hash = b.getAttribute('data-tab') === 'live' ? '#/live' : '#/';
  });
  document.getElementById('rows').addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    location.hash = '#/protocol/' + encodeURIComponent(tr.getAttribute('data-slug'));
  });
  window.addEventListener('hashchange', applyHash);

  applyHash();
  app.setAttribute('aria-busy', 'false');
  window.__shotReady = true;
})();
