/**
 * Calendar module
 * Displays a monthly calendar with veset markers.
 */
var Calendar = (function() {
  'use strict';

  var currentYear;
  var currentMonth;

  var GREG_MONTHS = [
    'ינואר', 'פברואר', 'מרץ', 'אפריל', 'מאי', 'יוני',
    'יולי', 'אוגוסט', 'ספטמבר', 'אוקטובר', 'נובמבר', 'דצמבר'
  ];

  var VESET_LABELS = {
    onah_beinonit: 'בינונית',
    haflagah: 'הפלגה',
    hachodesh: 'החודש'
  };

  function init() {
    var now = new Date();
    currentYear = now.getFullYear();
    currentMonth = now.getMonth();

    document.getElementById('cal-prev').addEventListener('click', function() {
      currentMonth++;
      if (currentMonth > 11) {
        currentMonth = 0;
        currentYear++;
      }
      render();
    });

    document.getElementById('cal-next').addEventListener('click', function() {
      currentMonth--;
      if (currentMonth < 0) {
        currentMonth = 11;
        currentYear--;
      }
      render();
    });
  }

  function render() {
    updateTitle();
    var from = formatDate(currentYear, currentMonth, 1);
    var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    var to = formatDate(currentYear, currentMonth, daysInMonth);

    Api.get('/api/vestot/calendar?from=' + from + '&to=' + to)
      .then(function(data) {
        renderGrid(data);
      })
      .catch(function() {
        renderGrid([]);
      });
  }

  function updateTitle() {
    var title = GREG_MONTHS[currentMonth] + ' ' + currentYear;
    document.getElementById('cal-month-title').textContent = title;
  }

  function formatDate(y, m, d) {
    var mm = String(m + 1).padStart(2, '0');
    var dd = String(d).padStart(2, '0');
    return y + '-' + mm + '-' + dd;
  }

  function renderGrid(vestotData) {
    var container = document.getElementById('cal-days');
    container.innerHTML = '';

    var firstDay = new Date(currentYear, currentMonth, 1).getDay();
    var daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    var today = new Date();
    var todayStr = formatDate(today.getFullYear(), today.getMonth(), today.getDate());

    // Build lookup map: date -> array of vestot
    var vestotMap = {};
    if (Array.isArray(vestotData)) {
      vestotData.forEach(function(v) {
        var dateKey = v.date;
        if (!vestotMap[dateKey]) vestotMap[dateKey] = [];
        vestotMap[dateKey].push(v);
      });
    }

    // Empty cells before first day
    for (var i = 0; i < firstDay; i++) {
      var empty = document.createElement('div');
      empty.className = 'cal-cell empty';
      container.appendChild(empty);
    }

    // Day cells
    for (var d = 1; d <= daysInMonth; d++) {
      var dateStr = formatDate(currentYear, currentMonth, d);
      var cell = document.createElement('div');
      cell.className = 'cal-cell';
      if (dateStr === todayStr) cell.className += ' today';

      // Gregorian date
      var gregEl = document.createElement('span');
      gregEl.className = 'cal-date-greg';
      gregEl.textContent = d;
      cell.appendChild(gregEl);

      // Hebrew date (from vestot data if available, or just show day number)
      var hebEl = document.createElement('span');
      hebEl.className = 'cal-date-heb';
      if (vestotMap[dateStr] && vestotMap[dateStr][0] && vestotMap[dateStr][0].hebrew_date) {
        hebEl.textContent = HebrewDate.formatShort(vestotMap[dateStr][0].hebrew_date);
      }
      cell.appendChild(hebEl);

      // Veset markers
      if (vestotMap[dateStr]) {
        var markers = document.createElement('div');
        markers.className = 'cal-markers';
        vestotMap[dateStr].forEach(function(v) {
          var marker = document.createElement('span');
          var vesetType = v.veset_type || v.type || '';
          var markerClass = 'cal-marker';
          if (vesetType.indexOf('beinonit') !== -1) markerClass += ' marker-beinonit';
          else if (vesetType.indexOf('haflagah') !== -1) markerClass += ' marker-haflagah';
          else if (vesetType.indexOf('hachodesh') !== -1) markerClass += ' marker-hachodesh';
          else markerClass += ' marker-beinonit';

          var onahIcon = v.onah === 'night' ? '🌙' : '☀️';
          var label = VESET_LABELS[vesetType] || vesetType;
          marker.className = markerClass;
          marker.textContent = onahIcon + ' ' + label;
          markers.appendChild(marker);
        });
        cell.appendChild(markers);
      }

      container.appendChild(cell);
    }
  }

  return {
    init: init,
    render: render
  };
})();
