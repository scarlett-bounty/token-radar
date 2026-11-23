// Token Radar dashboard (no framework, no network).
//
// The page reads window.RADAR from ../data.js, written by main.ts from the same board as
// board.json, so the screenshots and the code agree. The model that scored the board:
//
//   implied = TVL x peerMultiple x growthFactor x maturityFactor x breadthFactor
//   peerMultiple  = the category's median market-cap / TVL among its live-token protocols,
//                   shrunk toward the global median when the category has few live peers,
//                   clamped to [0.05, 0.80]
//   growthFactor  = 1 + 0.30 x tanh(clamped 7-day TVL change / 40)
//   maturityFactor = 0.85 + 0.30 x min(age in days, 1460) / 1460
//   breadthFactor = 1 + 0.02 x min(chains - 1, 4)
//
// The Model lab below re-ranks the board live from the same snapshot figures when the reader
// moves the weights; the submitted board uses the defaults. A protocol records no token, never
// has none: the board states an implied value, it does not predict a launch.

(function () {
  'use strict';
  var D = window.RADAR;
  if (!D) { document.body.innerHTML = '<p class="empty">No radar data loaded.</p>'; return; }

  var $ = function (id) { return document.getElementById(id); };
  var rowsEl = $('rows'), liveEl = $('liverows'), detailEl = $('detail'), countEl = $('count');

  var state = { view: 'board', q: '', cat: '', wl: false, sort: 'value', detail: null, gw: 0.3, mw: 0.3, lab: false };

  function fmtUsd(n) {
    if (n >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (n >= 1e3) return '$' + (n / 1e3).toFixed(1) + 'K';
    return '$' + Math.round(n);
  }
  function fmtPct(v) {
    if (v === null || v === undefined) return '—';
    return (v > 0 ? '+' : '') + v.toFixed(1) + '%';
  }
  function fmtAge(d) {
    if (d === null || d === undefined) return '—';
    if (d < 30) return d + 'd';
    if (d < 365) return Math.round(d / 30) + 'mo';
    return (d / 365).toFixed(1) + 'y';
  }
  function esc(s) {
    return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // Recompute one row's implied value under the lab weights, from the snapshot figures.
  function labImplied(r) {
    var g = r.change_7d === null ? 0 : Math.max(-50, Math.min(100, r.change_7d));
    var gf = r.change_7d === null ? 1 : 1 + state.gw * Math.tanh(g / 40);
    var age = r.age_days === null ? 365 : r.age_days;
    var mf = 0.85 + state.mw * Math.min(age, 1460) / 1460;
    return Math.max(1, Math.round(r.tvl_usd * r.peer_multiple * gf * mf * r.breadth_factor));
  }

  function viewRows() {
    var list = D.rows.slice();
    if (state.lab) {
      list.forEach(function (r) { r._lab = labImplied(r); });
      list.sort(function (a, b) { return b._lab - a._lab || (a.slug < b.slug ? -1 : 1); });
      list.forEach(function (r, i) { r._labRank = i + 1; });
    } else {
      list.sort(function (a, b) { return a.rank - b.rank; });
    }
    var q = state.q.trim().toLowerCase();
    if (q) list = list.filter(function (r) { return r.name.toLowerCase().indexOf(q) >= 0 || r.slug.toLowerCase().indexOf(q) >= 0; });
    if (state.cat) list = list.filter(function (r) { return (r.category || '') === state.cat; });
    if (state.wl) list = list.filter(function (r) { return r.watchlist; });
    if (state.sort === 'tvl') list.sort(function (a, b) { return b.tvl_usd - a.tvl_usd; });
    else if (state.sort === 'growth') list.sort(function (a, b) { return (b.change_7d === null ? -1e9 : b.change_7d) - (a.change_7d === null ? -1e9 : a.change_7d); });
    else if (state.sort === 'age') list.sort(function (a, b) { return (b.age_days === null ? -1 : b.age_days) - (a.age_days === null ? -1 : a.age_days); });
    else if (state.sort === 'name') list.sort(function (a, b) { return a.name < b.name ? -1 : 1; });
    return list;
  }

  function rowHtml(r, i) {
    var chg = r.change_7d === null ? '<td class="num">—</td>' : '<td class="num ' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + fmtPct(r.change_7d) + '</td>';
    var val = state.lab ? r._lab : r.implied_value_usd;
    var shownRank = state.lab ? r._labRank : r.rank;
    var badge = r.watchlist ? '<span class="badge wl">WATCHLIST</span>' : '<span class="badge early">EARLY</span>';
    return '<tr data-slug="' + esc(r.slug) + '"' + (state.detail === r.slug ? ' class="sel"' : '') + '>' +
      '<td class="num rank">' + shownRank + '</td>' +
      '<td class="name">' + esc(r.name) + badge + '<small>' + esc(r.slug) + '</small></td>' +
      '<td>' + esc(r.category || '—') + '</td>' +
      '<td class="chains">' + esc(r.chains.slice(0, 3).join(', ') || '—') + (r.chains.length > 3 ? ' +' + (r.chains.length - 3) : '') + '</td>' +
      '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' + chg +
      '<td class="num">' + fmtAge(r.age_days) + '</td>' +
      '<td class="num val">' + fmtUsd(val) + '</td></tr>';
  }

  function renderBoard() {
    var list = viewRows();
    countEl.textContent = list.length + ' of ' + D.rows.length + ' protocols' + (state.lab ? ' — model lab active' : '');
    rowsEl.innerHTML = list.length
      ? list.map(rowHtml).join('')
      : '<tr><td colspan="8" class="empty">No protocols match this filter.</td></tr>';
  }

  function renderLive() {
    liveEl.innerHTML = D.live.map(function (r) {
      var chg = r.change_7d === null ? '<td class="num">—</td>' : '<td class="num ' + (r.change_7d >= 0 ? 'up' : 'down') + '">' + fmtPct(r.change_7d) + '</td>';
      return '<tr>' +
        '<td class="name">' + esc(r.name) + '<small>' + esc(r.slug) + '</small></td>' +
        '<td>' + esc(r.category || '—') + '</td>' +
        '<td class="chains">' + esc(r.chains.slice(0, 3).join(', ') || '—') + '</td>' +
        '<td class="num">' + fmtUsd(r.tvl_usd) + '</td>' +
        '<td class="num val">' + (r.mcap_usd === null ? '—' : fmtUsd(r.mcap_usd)) + '</td>' + chg + '</tr>';
    }).join('');
  }

  function factorCell(title, value, note) {
    return '<div class="factor"><h4>' + title + '</h4><div class="v">' + value + '</div><p>' + note + '</p></div>';
  }

  function renderDetail() {
    var r = null;
    for (var i = 0; i < D.rows.length; i++) if (D.rows[i].slug === state.detail) { r = D.rows[i]; break; }
    if (!r) { detailEl.hidden = true; detailEl.innerHTML = ''; return; }
    var val = state.lab ? labImplied(r) : r.implied_value_usd;
    var steps = (r.farm_steps || []).map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('');
    var peerNote = r.peer_n >= 3
      ? 'Median market-cap / TVL of ' + r.peer_n + ' live ' + esc(r.category || 'uncategorised') + ' protocols, shrunk to the global median.'
      : 'Fewer than three live ' + esc(r.category || 'uncategorised') + ' protocols to price the category: the market-wide median.';
    detailEl.innerHTML =
      '<button class="close" id="closeDetail" type="button">Close ×</button>' +
      '<h2>#' + r.rank + ' ' + esc(r.name) + (r.watchlist ? ' <span class="badge wl">WATCHLIST</span>' : ' <span class="badge early">EARLY</span>') + '</h2>' +
      '<p class="sub">' + esc(r.slug) + ' · ' + esc(r.category || 'uncategorised') + ' · ' + esc(r.chains.join(', ') || 'no chain listed') + ' · listed ' + esc(r.listed_at || 'unknown') + ' · records no token</p>' +
      '<div class="grid">' +
      '<div class="cell"><dt>TVL</dt><dd>' + fmtUsd(r.tvl_usd) + '</dd></div>' +
      '<div class="cell"><dt>7-day change</dt><dd>' + fmtPct(r.change_7d) + '</dd></div>' +
      '<div class="cell"><dt>Age with no token</dt><dd>' + fmtAge(r.age_days) + '</dd></div>' +
      '<div class="cell"><dt>Implied value</dt><dd>' + fmtUsd(val) + '<small>rank #' + r.rank + ' of ' + D.rows.length + '</small></dd></div>' +
      '</div>' +
      '<div class="factors">' +
      factorCell('Peer multiple', '×' + r.peer_multiple.toFixed(3), peerNote) +
      factorCell('Growth factor', '×' + r.growth_factor.toFixed(3), 'From the 7-day TVL change of ' + fmtPct(r.change_7d) + '.') +
      factorCell('Maturity factor', '×' + r.maturity_factor.toFixed(3), 'From ' + fmtAge(r.age_days) + ' running with no token.') +
      factorCell('Breadth factor', '×' + r.breadth_factor.toFixed(3), 'From running on ' + r.chains.length + ' chain' + (r.chains.length === 1 ? '' : 's') + '.') +
      '</div>' +
      '<h3>Farm plan — how to farm ' + esc(r.name) + '</h3>' +
      '<ol class="plan">' + steps + '</ol>';
    detailEl.hidden = false;
    $('closeDetail').addEventListener('click', function () { state.detail = null; render(); });
  }

  function render() {
    var isBoard = state.view === 'board', isLive = state.view === 'live', isModel = state.view === 'model';
    $('board').hidden = !isBoard;
    $('livetable').hidden = !isLive;
    $('modelpage').hidden = !isModel;
    $('controls').style.display = isBoard ? '' : 'none';
    var tabs = document.querySelectorAll('#tabs button');
    for (var i = 0; i < tabs.length; i++) tabs[i].classList.toggle('on', tabs[i].getAttribute('data-view') === state.view);
    if (isBoard) renderBoard();
    if (isLive) renderLive();
    renderDetail();
  }

  // Header stats.
  (function () {
    var top = D.rows[0];
    $('stats').innerHTML =
      '<div><dt>Snapshot</dt><dd>' + esc(D.as_of) + '</dd></div>' +
      '<div><dt>Protocols</dt><dd>' + D.rows.length + '<small> ranked</small></dd></div>' +
      '<div><dt>Watchlist</dt><dd>' + D.watchlist_size + '<small> of 40</small></dd></div>' +
      '<div><dt>Top implied</dt><dd>' + fmtUsd(top.implied_value_usd) + '<small> ' + esc(top.name) + '</small></dd></div>';
    $('modelver').textContent = '(' + D.model_version + ')';
    $('foot').textContent = 'Source: ' + D.source + ' · Floor $' + (D.floor_usd / 1e6) + 'M · Model ' + D.model_version +
      ' · Global peer multiple ×' + D.peer_global.toFixed(3) + ' · Live-token protocols are shown with the market’s own values, never mixed into the ranked board.';
    var cats = [];
    D.rows.forEach(function (r) { if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category); });
    cats.sort();
    $('cat').innerHTML = '<option value="">All categories</option>' + cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  })();

  // Events.
  document.querySelectorAll('#tabs button').forEach(function (b) {
    b.addEventListener('click', function () { state.view = b.getAttribute('data-view'); render(); });
  });
  $('q').addEventListener('input', function () { state.q = this.value; renderBoard(); });
  $('cat').addEventListener('change', function () { state.cat = this.value; renderBoard(); });
  $('wl').addEventListener('change', function () { state.wl = this.checked; renderBoard(); });
  $('sort').addEventListener('change', function () { state.sort = this.value; renderBoard(); });
  rowsEl.addEventListener('click', function (e) {
    var tr = e.target.closest('tr[data-slug]');
    if (!tr) return;
    state.detail = state.detail === tr.getAttribute('data-slug') ? null : tr.getAttribute('data-slug');
    render();
  });

  // Model lab.
  function labChanged() {
    state.gw = parseFloat($('gw').value);
    state.mw = parseFloat($('mw').value);
    $('gwOut').textContent = state.gw.toFixed(2);
    $('mwOut').textContent = state.mw.toFixed(2);
    state.lab = !(state.gw === 0.3 && state.mw === 0.3);
    if (state.view === 'board') renderBoard();
    renderDetail();
  }
  $('gw').addEventListener('input', labChanged);
  $('mw').addEventListener('input', labChanged);
  $('resetLab').addEventListener('click', function () { $('gw').value = '0.3'; $('mw').value = '0.3'; labChanged(); });

  // Initial state from the URL hash: #view=board&cat=RWA&detail=slug&q=text&wl=1&sort=tvl
  (function () {
    var h = location.hash.replace(/^#/, '');
    if (!h) return;
    h.split('&').forEach(function (pair) {
      var kv = pair.split('=');
      var k = decodeURIComponent(kv[0] || ''), v = decodeURIComponent(kv[1] || '');
      if (k === 'view' && (v === 'board' || v === 'live' || v === 'model')) state.view = v;
      else if (k === 'cat') { state.cat = v; $('cat').value = v; }
      else if (k === 'q') { state.q = v; $('q').value = v; }
      else if (k === 'wl' && v === '1') { state.wl = true; $('wl').checked = true; }
      else if (k === 'sort') { state.sort = v; $('sort').value = v; }
      else if (k === 'detail') state.detail = v;
    });
  })();

  render();
})();
