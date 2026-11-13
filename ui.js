/* Bookmarklet UI + capture. Depends on core.js (concatenated by build.js). */
(function () {
  var KEY = 'feriesaldo.settings';
  var DAYS = ['søn', 'man', 'tirs', 'ons', 'tors', 'fre', 'lør'];
  var MONTHS = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];

  if (window.__feriesaldo) {
    window.__feriesaldo.show();
    return;
  }

  function load() {
    try {
      return Object.assign({ hoursPerDay: 7.4, f6CreditMonthDay: '' }, JSON.parse(localStorage.getItem(KEY) || '{}'));
    } catch (e) {
      return { hoursPerDay: 7.4, f6CreditMonthDay: '' };
    }
  }
  function save(s) {
    try {
      localStorage.setItem(KEY, JSON.stringify(s));
    } catch (e) {}
  }
  function fmt(d) {
    return DAYS[d.getUTCDay()] + ' ' + d.getUTCDate() + '. ' + MONTHS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }
  function num(x) {
    return String(x).replace('.', ',');
  }
  function todayUtc() {
    var n = new Date();
    return new Date(Date.UTC(n.getFullYear(), n.getMonth(), n.getDate()));
  }

  var settings = load();
  var lastJson = null;
  var root = document.createElement('div');
  root.style.cssText =
    'position:fixed;top:12px;right:12px;z-index:2147483647;width:380px;max-height:90vh;overflow:auto;background:#fff;color:#1a1a1a;' +
    'font:14px/1.4 system-ui,sans-serif;border:1px solid #bbb;border-radius:10px;box-shadow:0 6px 24px rgba(0,0,0,.3);padding:14px';
  document.body.appendChild(root);

  function el(tag, css, text) {
    var e = document.createElement(tag);
    if (css) e.style.cssText = css;
    if (text != null) e.textContent = text;
    return e;
  }

  // CSSOM-based stylesheet: <style> elements can be blocked by the page's CSP, insertRule is not.
  var RULES = [
    '.fs-meter{appearance:none;-moz-appearance:none;-webkit-appearance:none;display:block;width:100%;height:8px;margin:4px 0 2px;border:0;border-radius:4px;background:#e5e5e5;overflow:hidden}',
    '.fs-meter::-webkit-meter-bar{background:#e5e5e5;border:0;border-radius:4px;height:8px}',
    '.fs-meter::-webkit-meter-optimum-value{background:var(--fs-c);border-radius:4px}',
    '.fs-meter::-webkit-meter-suboptimum-value{background:var(--fs-c);border-radius:4px}',
    '.fs-meter::-webkit-meter-even-less-good-value{background:var(--fs-c);border-radius:4px}',
    '.fs-meter::-moz-meter-bar{background:var(--fs-c);border-radius:4px}',
    '.fs-btn{margin-top:8px;padding:6px 16px;border:0;border-radius:6px;background:#1a73e8;color:#fff;font:600 13px system-ui,sans-serif;cursor:pointer}',
    '.fs-btn:hover{background:#1558b0}',
    '.fs-btn:active{background:#124a96}',
    '.fs-btn:focus-visible{outline:2px solid #1a73e8;outline-offset:2px}',
    '.fs-in{padding:3px 6px;border:1px solid #bbb;border-radius:4px;font:inherit}'
  ];
  try {
    var sheet = new CSSStyleSheet();
    RULES.forEach(function (r) {
      try {
        sheet.insertRule(r, sheet.cssRules.length);
      } catch (e) {}
    });
    document.adoptedStyleSheets = Array.prototype.concat.call([], document.adoptedStyleSheets || [], [sheet]);
  } catch (e) {}

  function bar(left, total, color) {
    var m = el('meter', 'display:block;width:100%;height:8px;margin:4px 0 2px;border:0;border-radius:4px;background:#e5e5e5', null);
    m.className = 'fs-meter';
    m.min = 0;
    m.max = total > 0 ? total : 1;
    m.value = Math.max(0, Math.min(m.max, left));
    m.style.setProperty('--fs-c', color);
    return m;
  }

  function render() {
    root.textContent = '';
    var head = el('div', 'display:flex;justify-content:space-between;align-items:center;margin-bottom:8px');
    head.appendChild(el('strong', 'font-size:16px', 'Feriesaldo'));
    var close = el('button', 'border:0;background:none;font-size:18px;cursor:pointer', '×');
    close.onclick = function () {
      root.style.display = 'none';
    };
    head.appendChild(close);
    root.appendChild(head);

    if (!lastJson) {
      var p = el('p', 'margin:6px 0');
      p.appendChild(document.createTextNode('Åbn '));
      var a = el('a', 'color:#1a73e8;text-decoration:underline', 'tor.tv2.dk');
      a.href = 'https://tor.tv2.dk';
      a.target = '_blank';
      a.rel = 'noopener';
      p.appendChild(a);
      p.appendChild(document.createTextNode(' og klik på fanen "Saldi" nederst. Så aflæser jeg din saldo automatisk.'));
      root.appendChild(p);
      root.appendChild(el('p', 'margin:6px 0;font-size:12px;color:#555', 'Står du allerede i TOR, så klik på "Saldi" nu. Vises intet, så genindlæs siden, klik på bogmærket igen og derefter på "Saldi".'));
      return;
    }
    var r = compute(lastJson, { today: todayUtc(), hoursPerDay: settings.hoursPerDay, f6CreditMonthDay: settings.f6CreditMonthDay });
    var today = todayUtc();

    if (r.ferie) {
      var f = r.ferie;
      root.appendChild(el('div', 'font-weight:600;margin-top:6px', 'Ferie – ' + num(f.leftD) + ' dage tilbage'));
      root.appendChild(el('div', 'color:#555', 'Afholdt ' + num(f.usedD) + ' af ' + num(f.startD) + ' dage i ferieåret ' + fmt(f.periodStart) + ' – ' + fmt(new Date(f.periodEnd.getTime() - 86400000))));
      f.buckets.forEach(function (b) {
        var d = daysBetween(today, b.useBefore);
        var urgent = b.left > 0 && d <= 90;
        var box = el('div', 'margin-top:8px;padding:8px;border-radius:6px;background:' + (urgent ? '#fff1f0' : '#f5f7fa'));
        box.appendChild(el('div', '', b.label + ': ' + num(b.left) + ' af ' + num(b.total) + ' dage'));
        box.appendChild(bar(b.left, b.total, urgent ? '#d93025' : '#1a73e8'));
        box.appendChild(
          el('div', 'font-size:12px;color:' + (urgent ? '#b3261e' : '#555'), 'Skal bruges inden ' + fmt(b.useBefore) + ' (om ' + d + ' dage)')
        );
        root.appendChild(box);
      });
      root.appendChild(
        el('div', 'margin-top:8px;font-size:12px;color:#555', 'Fornyes ' + fmt(f.replenishOn) + ': ny ferie på ' + f.replenishDays + ' dage (optjenes 2,08 dage/md).')
      );
      root.appendChild(
        el('div', 'margin-top:4px;font-size:11px;color:#888', 'Antagelse: saldo over 25 dage ved ferieårets start er overført ferie. 5. ferieuge kan evt. overføres efter aftale – tjek med nærmeste leder/HR.')
      );
    }

    if (r.f6) {
      var g = r.f6;
      root.appendChild(el('div', 'font-weight:600;margin-top:14px', 'F6 – ' + num(g.leftD) + ' dage (' + g.wholeDaysLeft + ' hele dage kan holdes)'));
      root.appendChild(el('div', 'color:#555', 'Afholdt i alt ' + num(g.usedD) + ', udbetalt ' + num(g.paidOutD) + ' dage'));
      var box2 = el('div', 'margin-top:6px;padding:8px;border-radius:6px;background:#f5f7fa');
      box2.appendChild(bar(g.leftD, g.capDays, '#188038'));
      box2.appendChild(el('div', 'font-size:12px;color:#555', 'Maks. saldo er ' + g.capDays + ' dage (2 uger). Kun hele dage kan afholdes.'));
      if (g.nextCredit) {
        var warn = g.overCapAtCredit > 0;
        box2.appendChild(
          el('div', 'font-size:12px;margin-top:2px;color:' + (warn ? '#b3261e' : '#555'),
            'Ny F6-uge tilskrives ' + fmt(g.nextCredit) + (warn ? ' – hold mindst ' + num(g.overCapAtCredit) + ' dage inden da, ellers overstiges maks.' : '.'))
        );
      } else {
        box2.appendChild(el('div', 'font-size:12px;margin-top:2px;color:#555', 'Angiv tilskrivningsdato nedenfor for at se hvornår næste F6-uge kommer.'));
      }
      root.appendChild(box2);
    }

    if (!r.ferie && !r.f6) root.appendChild(el('p', '', 'Svaret fra TOR indeholdt ikke Ferie- eller F6-totaler.'));

    var set = el('details', 'margin-top:12px;font-size:12px');
    set.appendChild(el('summary', 'cursor:pointer', 'Indstillinger'));
    var row1 = el('div', 'margin-top:6px');
    row1.appendChild(el('label', '', 'Timer pr. dag: '));
    var h = el('input', 'width:60px');
    h.className = 'fs-in';
    h.value = settings.hoursPerDay;
    row1.appendChild(h);
    var row2 = el('div', 'margin-top:6px');
    row2.appendChild(el('label', '', 'F6 tilskrives (MM-DD, fx 03-01): '));
    var c = el('input', 'width:70px');
    c.className = 'fs-in';
    c.value = settings.f6CreditMonthDay;
    row2.appendChild(c);
    var ok = el('button', null, 'Gem');
    ok.className = 'fs-btn';
    ok.onclick = function () {
      var v = parseFloat(String(h.value).replace(',', '.'));
      if (v > 0 && v < 24) settings.hoursPerDay = v;
      settings.f6CreditMonthDay = /^\d{2}-\d{2}$/.test(c.value) ? c.value : '';
      save(settings);
      render();
    };
    set.appendChild(row1);
    set.appendChild(row2);
    set.appendChild(ok);
    root.appendChild(set);
  }

  function consider(text) {
    try {
      var j = JSON.parse(text);
      if (j && j.result && j.result.EmpRegTotals) {
        lastJson = j;
        render();
      }
    } catch (e) {}
  }

  // Hook the page's own network calls; nothing leaves the browser.
  var origFetch = window.fetch;
  window.fetch = function () {
    var p = origFetch.apply(this, arguments);
    p.then(function (res) {
      try {
        res.clone().text().then(consider);
      } catch (e) {}
    }).catch(function () {});
    return p;
  };
  var origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function () {
    this.addEventListener('load', function () {
      try {
        if (this.responseType === '' || this.responseType === 'text') consider(this.responseText);
      } catch (e) {}
    });
    return origSend.apply(this, arguments);
  };

  window.__feriesaldo = {
    show: function () {
      root.style.display = '';
      render();
    }
  };
  render();
})();
