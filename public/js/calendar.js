/**
 * Calendar module — displays monthly calendar with veset markers.
 */
var Calendar = (function() {
  'use strict';

  var currentYear;
  var currentMonth;
  var currentHebMonth; // Hebrew month number (1-13)
  var currentHebYear;  // Hebrew year (5786)
  var calendarMode = 'hebrew'; // default to hebrew

  var GREG_MONTHS = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  var VESET_LABELS = {
    onah_beinonit: 'עונה בינונית',
    onah_beinonit_31: 'עונה בינונית',
    haflagah: 'הפלגה 1',
    haflagah_2: 'הפלגה 2',
    haflagah_3: 'הפלגה 3',
    hachodesh: 'וסת החודש'
  };

  // Sort priority (lower = first) — groups same types together
  var TYPE_ORDER = {
    onah_beinonit: 1,
    onah_beinonit_31: 2,
    haflagah: 3,
    haflagah_2: 4,
    haflagah_3: 5,
    hachodesh: 6
  };

  function init() {
    var now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();

    // Compute current Hebrew month
    var nowHeb = getHebrewDate(now.getFullYear(), now.getMonth(), now.getDate());
    currentHebMonth = nowHeb.month;
    currentHebYear = nowHeb.year;

    document.getElementById('cal-prev').addEventListener('click', function() {
      if (calendarMode === 'hebrew') {
        prevHebMonth();
      } else {
        currentMonth--;
        if (currentMonth < 0) { currentMonth = 11; currentYear--; }
      }
      render();
    });

    document.getElementById('cal-next').addEventListener('click', function() {
      if (calendarMode === 'hebrew') {
        nextHebMonth();
      } else {
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
      }
      render();
    });

    document.getElementById('cal-mode-toggle').addEventListener('click', function() {
      calendarMode = calendarMode === 'hebrew' ? 'gregorian' : 'hebrew';
      this.textContent = calendarMode === 'hebrew' ? 'מציג: עברי' : 'מציג: לועזי';
      render();
    });
  }

  function nextHebMonth() {
    // Hebrew month order: 7,8,9,10,11,12,[13],1,2,3,4,5,6
    if (currentHebMonth === 6) { // Elul -> Tishrei (next year)
      currentHebYear++;
      currentHebMonth = 7;
    } else if (currentHebMonth === 13) { // Adar II -> Nisan
      currentHebMonth = 1;
    } else if (currentHebMonth === 12 && !HebrewDate.isLeapYear(currentHebYear)) {
      // Adar (non-leap) -> Nisan
      currentHebMonth = 1;
    } else {
      currentHebMonth++;
    }
  }

  function prevHebMonth() {
    if (currentHebMonth === 7) { // Tishrei -> Elul (prev year)
      currentHebYear--;
      currentHebMonth = 6;
    } else if (currentHebMonth === 1) { // Nisan -> Adar or Adar II
      if (HebrewDate.isLeapYear(currentHebYear)) {
        currentHebMonth = 13;
      } else {
        currentHebMonth = 12;
      }
    } else {
      currentHebMonth--;
    }
  }

  function render() {
    updateTitle();
    var from, to;

    if (calendarMode === 'hebrew') {
      // Get Gregorian date of 1st day of this Hebrew month
      var firstDayGreg = hebToGreg(currentHebYear, currentHebMonth, 1);
      var numDays = HebrewDate.daysInMonth(currentHebMonth, currentHebYear);
      var lastDayGreg = hebToGreg(currentHebYear, currentHebMonth, numDays);
      from = fmtDateObj(firstDayGreg);
      to = fmtDateObj(lastDayGreg);
    } else {
      var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
      from = fmtDate(currentYear, currentMonth, 1);
      to = fmtDate(currentYear, currentMonth, daysInMonth);
    }

    Api.get('/api/vestot/calendar?from=' + from + '&to=' + to)
      .then(function(data) {
        var vestotArray = (data && data.vestot) ? data.vestot : [];
        var cyclesArray = (data && data.cycles) ? data.cycles : [];
        if (calendarMode === 'hebrew') {
          renderHebrewGrid(vestotArray, cyclesArray);
        } else {
          renderGrid(vestotArray, cyclesArray);
        }
      })
      .catch(function() {
        if (calendarMode === 'hebrew') {
          renderHebrewGrid([], []);
        } else {
          renderGrid([], []);
        }
      });
  }

  function updateTitle() {
    if (calendarMode === 'hebrew') {
      var monthName = HebrewDate.getMonthName(currentHebMonth);
      var yearName = HebrewDate.formatYear(currentHebYear);
      document.getElementById('cal-month-title').textContent = monthName + ' ' + yearName;
    } else {
      document.getElementById('cal-month-title').textContent = GREG_MONTHS[currentMonth] + ' ' + currentYear;
    }
  }

  function getHebrewDate(year, month, day) {
    // month is 0-based in JS Date, greg2heb expects 1-based
    return HebrewDate.greg2heb(year, month + 1, day);
  }

  function hebToGreg(hebYear, hebMonth, hebDay) {
    return HebrewDate.heb2greg(hebYear, hebMonth, hebDay);
  }

  function fmtDate(y, m, d) {
    return y + '-' + String(m + 1).padStart(2, '0') + '-' + String(d).padStart(2, '0');
  }

  function fmtDateObj(date) {
    return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
  }

  function getMarkerClass(type) {
    if (type.indexOf('beinonit') !== -1) return 'marker-beinonit';
    if (type === 'haflagah') return 'marker-haflagah1';
    if (type === 'haflagah_2') return 'marker-haflagah2';
    if (type === 'haflagah_3') return 'marker-haflagah3';
    if (type.indexOf('hachodesh') !== -1) return 'marker-hachodesh';
    return 'marker-beinonit';
  }

  function getLabel(v) {
    var type = v.type || '';
    var base = VESET_LABELS[type] || type;
    var isAZ = v.is_or_zarua || v.isOrZarua;
    var label = isAZ ? ('א״ז ' + base) : base;
    if (v.is_kavua || v.isKavua) label += ' ⭐';
    return label;
  }

  function sortVestot(list) {
    return list.slice().sort(function(a, b) {
      var oA = TYPE_ORDER[a.type] || 99;
      var oB = TYPE_ORDER[b.type] || 99;
      if (oA !== oB) return oA - oB;
      // Same type: or-zarua FIRST (above), then main entry
      var azA = (a.is_or_zarua || a.isOrZarua) ? 0 : 1;
      var azB = (b.is_or_zarua || b.isOrZarua) ? 0 : 1;
      if (azA !== azB) return azA - azB;
      // Same type and az status: night before day
      var nightA = a.onah === 'night' ? 0 : 1;
      var nightB = b.onah === 'night' ? 0 : 1;
      return nightA - nightB;
    });
  }

  function renderHebrewGrid(vestotData, cyclesArray) {
    var container = document.getElementById('cal-days');
    container.innerHTML = '';

    var numDays = HebrewDate.daysInMonth(currentHebMonth, currentHebYear);
    var firstDayGreg = hebToGreg(currentHebYear, currentHebMonth, 1);
    var firstDayOfWeek = firstDayGreg.getDay(); // 0=Sun

    var today = new Date();
    var todayStr = fmtDateObj(today);

    // Build vestot map
    var map = {};
    vestotData.forEach(function(v) {
      if (!map[v.date]) map[v.date] = [];
      map[v.date].push(v);
    });

    // Build cycles map (re'iyot)
    var cyclesMap = {};
    if (cyclesArray) {
      cyclesArray.forEach(function(c) {
        if (!cyclesMap[c.date]) cyclesMap[c.date] = [];
        cyclesMap[c.date].push(c);
      });
    }

    // Empty cells before first day of Hebrew month
    for (var i = 0; i < firstDayOfWeek; i++) {
      var empty = document.createElement('div');
      empty.className = 'cal-cell empty';
      container.appendChild(empty);
    }

    // Day cells for each day of the Hebrew month
    for (var d = 1; d <= numDays; d++) {
      var gregDate = hebToGreg(currentHebYear, currentHebMonth, d);
      var dateStr = fmtDateObj(gregDate);
      var cell = document.createElement('div');
      cell.className = 'cal-cell';
      if (dateStr === todayStr) cell.className += ' today';

      // Primary: Hebrew day (large)
      var hebEl = document.createElement('span');
      hebEl.className = 'cal-date-greg'; // large class
      hebEl.textContent = HebrewDate.toGematria(d);
      cell.appendChild(hebEl);

      // Secondary: Gregorian date (small)
      var gregEl = document.createElement('span');
      gregEl.className = 'cal-date-heb'; // small class
      gregEl.textContent = gregDate.getDate() + '/' + (gregDate.getMonth() + 1);
      cell.appendChild(gregEl);

      // Markers container
      var hasMarkers = (map[dateStr] || cyclesMap[dateStr]);
      if (hasMarkers) {
        var markers = document.createElement('div');
        markers.className = 'cal-markers';

        // Re'iyah markers (cycle start dates)
        if (cyclesMap[dateStr]) {
          cyclesMap[dateStr].forEach(function(c) {
            var marker = document.createElement('span');
            marker.className = 'cal-marker marker-reiyah';
            var icon = c.onah === 'night' ? '🌙' : '☀️';
            marker.textContent = icon + ' ראיה';
            markers.appendChild(marker);
          });
        }

        // Veset markers
        if (map[dateStr]) {
          var sorted = sortVestot(map[dateStr]);
          sorted.forEach(function(v) {
            var marker = document.createElement('span');
            var type = v.type || '';
            var isAZ = v.is_or_zarua || v.isOrZarua;
            var cls = 'cal-marker ' + getMarkerClass(type);
            if (isAZ) cls += ' marker-az';
            marker.className = cls;

            var icon = v.onah === 'night' ? '🌙' : '☀️';
            marker.textContent = icon + ' ' + getLabel(v);

            markers.appendChild(marker);
          });
        }

        cell.appendChild(markers);
      }

      container.appendChild(cell);
    }
  }

  function renderGrid(vestotData, cyclesArray) {
    var container = document.getElementById('cal-days');
    container.innerHTML = '';

    var firstDay = new Date(currentYear, currentMonth, 1).getDay();
    var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    var today = new Date();
    var todayStr = fmtDate(today.getFullYear(), today.getMonth(), today.getDate());

    // Map: date -> vestot array
    var map = {};
    vestotData.forEach(function(v) {
      if (!map[v.date]) map[v.date] = [];
      map[v.date].push(v);
    });

    // Build cycles map (re'iyot)
    var cyclesMap = {};
    if (cyclesArray) {
      cyclesArray.forEach(function(c) {
        if (!cyclesMap[c.date]) cyclesMap[c.date] = [];
        cyclesMap[c.date].push(c);
      });
    }

    // Empty cells
    for (var i = 0; i < firstDay; i++) {
      var empty = document.createElement('div');
      empty.className = 'cal-cell empty';
      container.appendChild(empty);
    }

    // Day cells
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = fmtDate(currentYear, currentMonth, d);
      var cell = document.createElement('div');
      cell.className = 'cal-cell';
      if (dateStr === todayStr) cell.className += ' today';

      // Compute Hebrew date for this day
      var hebDate = getHebrewDate(currentYear, currentMonth, d);

      // Date numbers — Gregorian is primary (large), Hebrew is secondary (small)
      var gregEl = document.createElement('span');
      gregEl.className = 'cal-date-greg'; // large
      gregEl.textContent = d;
      cell.appendChild(gregEl);

      var hebEl = document.createElement('span');
      hebEl.className = 'cal-date-heb'; // small
      hebEl.textContent = HebrewDate.formatShort(hebDate);
      cell.appendChild(hebEl);

      // Markers container
      var hasMarkers = (map[dateStr] || cyclesMap[dateStr]);
      if (hasMarkers) {
        var markers = document.createElement('div');
        markers.className = 'cal-markers';

        // Re'iyah markers (cycle start dates)
        if (cyclesMap[dateStr]) {
          cyclesMap[dateStr].forEach(function(c) {
            var marker = document.createElement('span');
            marker.className = 'cal-marker marker-reiyah';
            var icon = c.onah === 'night' ? '🌙' : '☀️';
            marker.textContent = icon + ' ראיה';
            markers.appendChild(marker);
          });
        }

        // Veset markers
        if (map[dateStr]) {
          var sorted = sortVestot(map[dateStr]);
          sorted.forEach(function(v) {
            var marker = document.createElement('span');
            var type = v.type || '';
            var isAZ = v.is_or_zarua || v.isOrZarua;
            var cls = 'cal-marker ' + getMarkerClass(type);
            if (isAZ) cls += ' marker-az';
            marker.className = cls;

            var icon = v.onah === 'night' ? '🌙' : '☀️';
            marker.textContent = icon + ' ' + getLabel(v);

            markers.appendChild(marker);
          });
        }

        cell.appendChild(markers);
      }

      container.appendChild(cell);
    }
  }

  return { init: init, render: render };
})();
