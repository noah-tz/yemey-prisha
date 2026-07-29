/**
 * Hebrew Datepicker Component
 * A mini calendar popup for selecting Hebrew dates.
 * Usage: HebrewDatepicker.create(inputEl, { onSelect: fn, defaultDate: {year,month,day} })
 */
var HebrewDatepicker = (function() {
  'use strict';

  var MONTH_NAMES = [
    '', 'ניסן', 'אייר', 'סיון', 'תמוז', 'אב', 'אלול',
    'תשרי', 'חשון', 'כסלו', 'טבת', 'שבט', 'אדר', 'אדר ב׳'
  ];

  var DAY_HEADERS = ['א׳', 'ב׳', 'ג׳', 'ד׳', 'ה׳', 'ו׳', 'ש׳'];

  // Hebrew month order for navigation (Tishrei-first)
  function getMonthOrder(year) {
    var months = [7, 8, 9, 10, 11, 12];
    if (HebrewDate.isLeapYear(year)) months.push(13);
    months = months.concat([1, 2, 3, 4, 5, 6]);
    return months;
  }

  function nextMonth(year, month) {
    var order = getMonthOrder(year);
    var idx = order.indexOf(month);
    if (idx === order.length - 1) {
      // Last month (Elul) -> Tishrei next year
      return { year: year + 1, month: 7 };
    }
    return { year: year, month: order[idx + 1] };
  }

  function prevMonth(year, month) {
    var order = getMonthOrder(year);
    var idx = order.indexOf(month);
    if (idx === 0) {
      // First month (Tishrei) -> Elul prev year
      return { year: year - 1, month: 6 };
    }
    // Handle case where month is Nisan (1) in non-leap going back to Adar
    if (idx === -1) {
      // month not found in this year's order (e.g. Adar II in non-leap)
      return { year: year, month: 12 };
    }
    return { year: year, month: order[idx - 1] };
  }

  function getCurrentHebDate() {
    var now = new Date();
    return HebrewDate.greg2heb(now.getFullYear(), now.getMonth() + 1, now.getDate());
  }

  /**
   * Create a datepicker attached to an input element.
   * @param {HTMLElement} triggerEl - The input/button that opens the picker
   * @param {Object} opts
   * @param {Function} opts.onSelect - callback({year, month, day})
   * @param {Object} [opts.defaultDate] - {year, month, day} to show initially
   * @param {boolean} [opts.showOnah] - if true, show onah selector after date pick
   * @param {Function} [opts.onSelectWithOnah] - callback({year, month, day}, onah)
   * @returns {Object} { open(), close(), destroy() }
   */
  function create(triggerEl, opts) {
    opts = opts || {};
    var popup = null;
    var currentYear, currentMonth;
    var isOpen = false;

    // Determine initial month to display
    var initDate = opts.defaultDate || getCurrentHebDate();
    currentYear = initDate.year;
    currentMonth = initDate.month;

    function open() {
      if (isOpen) return;
      isOpen = true;
      buildPopup();
      positionPopup();
      renderMonth();
      document.addEventListener('click', outsideClick, true);
    }

    function close() {
      if (!isOpen) return;
      isOpen = false;
      if (popup && popup.parentNode) {
        popup.parentNode.removeChild(popup);
      }
      popup = null;
      document.removeEventListener('click', outsideClick, true);
    }

    function destroy() {
      close();
      triggerEl.removeEventListener('click', handleTriggerClick);
      triggerEl.removeEventListener('focus', handleTriggerClick);
    }

    function outsideClick(e) {
      if (popup && !popup.contains(e.target) && e.target !== triggerEl) {
        close();
      }
    }

    function handleTriggerClick(e) {
      e.preventDefault();
      e.stopPropagation();
      if (isOpen) {
        close();
      } else {
        open();
      }
    }

    function buildPopup() {
      popup = document.createElement('div');
      popup.className = 'heb-dp-popup';
      popup.innerHTML =
        '<div class="heb-dp-header">' +
        '  <button type="button" class="heb-dp-nav heb-dp-next" title="חודש הבא">‹</button>' +
        '  <span class="heb-dp-title"></span>' +
        '  <button type="button" class="heb-dp-nav heb-dp-prev" title="חודש קודם">›</button>' +
        '</div>' +
        '<div class="heb-dp-days-header"></div>' +
        '<div class="heb-dp-grid"></div>';

      document.body.appendChild(popup);

      // Nav buttons (RTL: next is left arrow, prev is right arrow)
      popup.querySelector('.heb-dp-next').addEventListener('click', function(e) {
        e.stopPropagation();
        var n = nextMonth(currentYear, currentMonth);
        currentYear = n.year;
        currentMonth = n.month;
        renderMonth();
      });

      popup.querySelector('.heb-dp-prev').addEventListener('click', function(e) {
        e.stopPropagation();
        var p = prevMonth(currentYear, currentMonth);
        currentYear = p.year;
        currentMonth = p.month;
        renderMonth();
      });

      // Day headers
      var headersEl = popup.querySelector('.heb-dp-days-header');
      DAY_HEADERS.forEach(function(d) {
        var span = document.createElement('span');
        span.textContent = d;
        headersEl.appendChild(span);
      });
    }

    function positionPopup() {
      var rect = triggerEl.getBoundingClientRect();
      var scrollTop = window.pageYOffset || document.documentElement.scrollTop;
      var scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;

      popup.style.position = 'absolute';
      popup.style.top = (rect.bottom + scrollTop + 4) + 'px';

      // RTL: align to the right edge of the trigger
      var right = window.innerWidth - rect.right - scrollLeft;
      popup.style.right = right + 'px';
      popup.style.left = 'auto';

      // If popup goes off-screen left, switch to left alignment
      setTimeout(function() {
        var popupRect = popup.getBoundingClientRect();
        if (popupRect.left < 0) {
          popup.style.right = 'auto';
          popup.style.left = (rect.left + scrollLeft) + 'px';
        }
      }, 0);
    }

    function renderMonth() {
      var titleEl = popup.querySelector('.heb-dp-title');
      var gridEl = popup.querySelector('.heb-dp-grid');

      titleEl.textContent = MONTH_NAMES[currentMonth] + ' ' + HebrewDate.formatYear(currentYear);
      gridEl.innerHTML = '';

      var numDays = HebrewDate.daysInMonth(currentMonth, currentYear);

      // Find day-of-week for 1st of this Hebrew month
      var firstGreg = HebrewDate.heb2greg(currentYear, currentMonth, 1);
      var firstDow = firstGreg.getDay(); // 0=Sunday

      // Empty cells before first day
      for (var e = 0; e < firstDow; e++) {
        var emptyCell = document.createElement('span');
        emptyCell.className = 'heb-dp-cell heb-dp-empty';
        gridEl.appendChild(emptyCell);
      }

      // Day cells
      var today = getCurrentHebDate();
      for (var d = 1; d <= numDays; d++) {
        var cell = document.createElement('button');
        cell.type = 'button';
        cell.className = 'heb-dp-cell';
        cell.textContent = HebrewDate.toGematria(d);
        cell.dataset.day = d;

        // Highlight today
        if (currentYear === today.year && currentMonth === today.month && d === today.day) {
          cell.classList.add('heb-dp-today');
        }

        cell.addEventListener('click', (function(day) {
          return function(ev) {
            ev.stopPropagation();
            selectDate(day);
          };
        })(d));

        gridEl.appendChild(cell);
      }
    }

    function selectDate(day) {
      var selected = { year: currentYear, month: currentMonth, day: day };

      if (opts.showOnah) {
        showOnahSelector(selected);
      } else {
        close();
        if (opts.onSelect) opts.onSelect(selected);
        updateTriggerDisplay(selected);
      }
    }

    function showOnahSelector(selected) {
      var gridEl = popup.querySelector('.heb-dp-grid');
      var headerEl = popup.querySelector('.heb-dp-header');
      var daysHeaderEl = popup.querySelector('.heb-dp-days-header');

      headerEl.style.display = 'none';
      daysHeaderEl.style.display = 'none';
      gridEl.innerHTML = '';
      gridEl.className = 'heb-dp-onah-selector';

      var title = document.createElement('p');
      title.className = 'heb-dp-onah-title';
      title.textContent = HebrewDate.toGematria(selected.day) + ' ' + MONTH_NAMES[selected.month] + ' — בחרי עונה:';
      gridEl.appendChild(title);

      var btnDay = document.createElement('button');
      btnDay.type = 'button';
      btnDay.className = 'heb-dp-onah-btn heb-dp-onah-day';
      btnDay.textContent = '☀️ יום';
      btnDay.addEventListener('click', function(e) {
        e.stopPropagation();
        close();
        if (opts.onSelectWithOnah) opts.onSelectWithOnah(selected, 'day');
        else if (opts.onSelect) opts.onSelect(selected);
        updateTriggerDisplay(selected, 'day');
      });

      var btnNight = document.createElement('button');
      btnNight.type = 'button';
      btnNight.className = 'heb-dp-onah-btn heb-dp-onah-night';
      btnNight.textContent = '🌙 לילה';
      btnNight.addEventListener('click', function(e) {
        e.stopPropagation();
        close();
        if (opts.onSelectWithOnah) opts.onSelectWithOnah(selected, 'night');
        else if (opts.onSelect) opts.onSelect(selected);
        updateTriggerDisplay(selected, 'night');
      });

      var btnsDiv = document.createElement('div');
      btnsDiv.className = 'heb-dp-onah-btns';
      btnsDiv.appendChild(btnDay);
      btnsDiv.appendChild(btnNight);
      gridEl.appendChild(btnsDiv);
    }

    function updateTriggerDisplay(date, onah) {
      var text = HebrewDate.toGematria(date.day) + ' ' + MONTH_NAMES[date.month] + ' ' + HebrewDate.formatYear(date.year);
      if (onah) {
        text += ' | ' + (onah === 'night' ? '🌙 לילה' : '☀️ יום');
      }
      if (triggerEl.tagName === 'INPUT') {
        triggerEl.value = text;
      } else {
        triggerEl.textContent = text;
      }
    }

    // Attach events
    triggerEl.addEventListener('click', handleTriggerClick);
    if (triggerEl.tagName === 'INPUT') {
      triggerEl.readOnly = true;
      triggerEl.style.cursor = 'pointer';
    }

    return {
      open: open,
      close: close,
      destroy: destroy,
      setDate: function(date) {
        if (date) {
          currentYear = date.year;
          currentMonth = date.month;
          updateTriggerDisplay(date);
        }
      }
    };
  }

  return {
    create: create
  };
})();
