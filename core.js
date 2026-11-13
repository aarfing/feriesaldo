/* Pure rules core: no DOM, no network. */
var FERIE_YEAR_DAYS = 25;
var F6_CAP_DAYS = 10;

function parseDate(s) {
  var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || '');
  return m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
}

function findTotal(json, id) {
  var emps = (json && json.result && json.result.EmpRegTotals) || [];
  for (var i = 0; i < emps.length; i++) {
    var list = emps[i].RegTotals || [];
    for (var j = 0; j < list.length; j++) if (list[j].TotalId === id) return list[j];
  }
  return null;
}

function sub(total, label) {
  var list = (total && total.RegSubTotals) || [];
  for (var i = 0; i < list.length; i++) {
    if (list[i].Label === label) return list[i].ValueInfo.Value;
  }
  return 0;
}

function round2(x) {
  return Math.round(x * 100) / 100;
}

function computeFerie(total, hoursPerDay, today) {
  if (!total || !total.Period) return null;
  var start = parseDate(total.Period.Start);
  var end = parseDate(total.Period.End);
  var startH = sub(total, 'Start');
  var usedH = sub(total, 'Afholdt');
  var endH = sub(total, 'End');
  var startD = startH / hoursPerDay;
  var usedD = usedH / hoursPerDay;
  var leftD = endH / hoursPerDay;
  var carriedD = Math.max(0, startD - FERIE_YEAR_DAYS);
  var carriedLeft = Math.max(0, carriedD - usedD);
  var currentLeft = Math.max(0, leftD - carriedLeft);
  var buckets = [];
  if (carriedD > 0) {
    buckets.push({
      key: 'carried',
      label: 'Overført fra sidste ferieår',
      total: round2(carriedD),
      left: round2(carriedLeft),
      useBefore: new Date(Date.UTC(start.getUTCFullYear(), 11, 31))
    });
  }
  buckets.push({
    key: 'current',
    label: 'Ferieår ' + start.getUTCFullYear() + '/' + end.getUTCFullYear(),
    total: round2(Math.min(startD, FERIE_YEAR_DAYS)),
    left: round2(currentLeft),
    useBefore: new Date(Date.UTC(end.getUTCFullYear(), 11, 31))
  });
  return {
    periodStart: start,
    periodEnd: end,
    startD: round2(startD),
    usedD: round2(usedD),
    leftD: round2(leftD),
    buckets: buckets,
    replenishOn: end,
    replenishDays: FERIE_YEAR_DAYS,
    expiringNow: buckets.filter(function (b) {
      return b.left > 0 && daysBetween(today, b.useBefore) <= 90;
    })
  };
}

function daysBetween(a, b) {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

// creditMonthDay: "MM-DD" of the yearly F6 credit (hire anniversary), or null if unknown
function computeF6(total, hoursPerDay, creditMonthDay, today) {
  if (!total) return null;
  var leftD = sub(total, 'End') / hoursPerDay;
  var usedD = sub(total, 'Afholdt') / hoursPerDay;
  var paidD = sub(total, 'Udbetalt') / hoursPerDay;
  var next = null;
  var m = /^(\d{2})-(\d{2})$/.exec(creditMonthDay || '');
  if (m) {
    var y = today.getUTCFullYear();
    next = new Date(Date.UTC(y, +m[1] - 1, +m[2]));
    if (next.getTime() <= today.getTime()) next = new Date(Date.UTC(y + 1, +m[1] - 1, +m[2]));
  }
  var afterCredit = leftD + 5;
  return {
    leftD: round2(leftD),
    usedD: round2(usedD),
    paidOutD: round2(paidD),
    wholeDaysLeft: Math.floor(leftD + 1e-9),
    nextCredit: next,
    capDays: F6_CAP_DAYS,
    // balance above the cap when the next week is credited would be lost/paid out
    overCapAtCredit: next ? Math.max(0, round2(afterCredit - F6_CAP_DAYS)) : null
  };
}

function compute(json, opts) {
  var today = opts.today;
  return {
    ferie: computeFerie(findTotal(json, 121), opts.hoursPerDay, today),
    f6: computeF6(findTotal(json, 201), opts.hoursPerDay, opts.f6CreditMonthDay, today)
  };
}

if (typeof module !== 'undefined') {
  module.exports = { compute: compute, computeFerie: computeFerie, computeF6: computeF6, findTotal: findTotal, daysBetween: daysBetween };
}
