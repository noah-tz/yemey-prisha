/**
 * History module
 * Manages veset history table with CRUD operations.
 * Uses Hebrew date input exclusively.
 */
var History = (function() {
  'use strict';

  var cycles = [];
  var mechitzot = [];
  var mechitzotSet = new Set();
  var editingId = null;

  // Hebrew day names (gematria) - index 0 is unused, days are 1-30
  var HEBREW_DAYS = [
    '', "א׳", "ב׳", "ג׳", "ד׳", "ה׳", "ו׳", "ז׳", "ח׳", "ט׳", "י׳",
    "י״א", "י״ב", "י״ג", "י״ד", "ט״ו", "ט״ז", "י״ז", "י״ח", "י״ט", "כ׳",
    "כ״א", "כ״ב", "כ״ג", "כ״ד", "כ״ה", "כ״ו", "כ״ז", "כ״ח", "כ״ט", "ל׳"
  ];

  var MONTHS = [
    { value: '7', name: 'תשרי', days: 30 },
    { value: '8', name: 'חשוון', days: 29 },  // variable
    { value: '9', name: 'כסלו', days: 30 },   // variable
    { value: '10', name: 'טבת', days: 29 },
    { value: '11', name: 'שבט', days: 30 },
    { value: '12', name: 'אדר', days: 29 },   // variable in leap
    { value: '13', name: 'אדר ב׳', days: 29 },
    { value: '1', name: 'ניסן', days: 30 },
    { value: '2', name: 'אייר', days: 29 },
    { value: '3', name: 'סיוון', days: 30 },
    { value: '4', name: 'תמוז', days: 29 },
    { value: '5', name: 'אב', days: 30 },
    { value: '6', name: 'אלול', days: 29 }
  ];

  var mainDatepicker = null;

  function init() {
    var form = document.getElementById('cycle-form');
    var cancelBtn = document.getElementById('cycle-cancel-btn');

    form.addEventListener('submit', function(e) {
      e.preventDefault();
      handleSubmit();
    });

    cancelBtn.addEventListener('click', function() {
      resetForm();
    });

    // Initialize datepicker on the main form input
    var dpInput = document.getElementById('cycle-datepicker-input');
    mainDatepicker = HebrewDatepicker.create(dpInput, {
      showOnah: true,
      onSelectWithOnah: function(date, onah) {
        document.getElementById('cycle-heb-day').value = date.day;
        document.getElementById('cycle-heb-month').value = date.month;
        document.getElementById('cycle-heb-year').value = date.year;
        document.getElementById('cycle-onah').value = onah;
        updateSunsetDisplay();
      }
    });

    // Import buttons
    document.getElementById('import-add-row-btn').addEventListener('click', function() {
      addImportRow();
    });

    document.getElementById('import-btn').addEventListener('click', function() {
      handleImport();
    });

    // Export button
    document.getElementById('export-btn').addEventListener('click', function() {
      Api.get('/api/cycles/export')
        .then(function(data) {
          var blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          var url = URL.createObjectURL(blob);
          var a = document.createElement('a');
          a.href = url;
          a.download = 'luach-vestot-backup.json';
          a.click();
          URL.revokeObjectURL(url);
        })
        .catch(function(err) { alert(err.message || 'שגיאה בייצוא'); });
    });

    // Add initial import row
    addImportRow();
  }

  function populateDays(selectId, maxDay) {
    var sel = typeof selectId === 'string' ? document.getElementById(selectId) : selectId;
    var currentVal = sel.value;
    sel.innerHTML = '<option value="">יום</option>';
    for (var d = 1; d <= maxDay; d++) {
      var opt = document.createElement('option');
      opt.value = d;
      opt.textContent = HEBREW_DAYS[d];
      sel.appendChild(opt);
    }
    if (currentVal && parseInt(currentVal) <= maxDay) {
      sel.value = currentVal;
    }
  }

  function populateDaysElement(selectEl, maxDay) {
    var currentVal = selectEl.value;
    selectEl.innerHTML = '<option value="">יום</option>';
    for (var d = 1; d <= maxDay; d++) {
      var opt = document.createElement('option');
      opt.value = d;
      opt.textContent = HEBREW_DAYS[d];
      selectEl.appendChild(opt);
    }
    if (currentVal && parseInt(currentVal) <= maxDay) {
      selectEl.value = currentVal;
    }
  }

  function populateYears(selectEl) {
    // Current Hebrew year (approximate: Gregorian year + 3760, adjust after Tishrei)
    var now = new Date();
    var gregYear = now.getFullYear();
    var currentHebYear = gregYear + 3760;
    // After September, we're likely in the new Hebrew year
    if (now.getMonth() >= 8) currentHebYear++;

    selectEl.innerHTML = '<option value="">שנה</option>';

    // Smart order: current year first, then previous, then next
    var priorityYears = [currentHebYear, currentHebYear - 1, currentHebYear + 1];
    var addedYears = {};

    // Add priority years first
    priorityYears.forEach(function(y) {
      var opt = document.createElement('option');
      opt.value = y;
      opt.textContent = HebrewDate.formatYear(y);
      selectEl.appendChild(opt);
      addedYears[y] = true;
    });

    // Separator
    var sep = document.createElement('option');
    sep.disabled = true;
    sep.textContent = '───────';
    selectEl.appendChild(sep);

    // Range from current+2 down to 5780 (descending, skip already added)
    for (var y = currentHebYear + 2; y >= 5780; y--) {
      if (addedYears[y]) continue;
      var opt = document.createElement('option');
      opt.value = y;
      opt.textContent = HebrewDate.formatYear(y);
      selectEl.appendChild(opt);
    }
  }

  function getMaxDays(month, year) {
    if (!month) return 30;
    if (!year) {
      // No year selected yet — use safe defaults
      var always30 = [1, 3, 5, 7, 11];
      var always29 = [2, 4, 6, 10, 13];
      if (always30.indexOf(month) !== -1) return 30;
      if (always29.indexOf(month) !== -1) return 29;
      return 30; // variable months default to 30 until year is known
    }
    // Use the actual Hebrew calendar calculation
    return HebrewDate.daysInMonth(month, year);
  }

  function updateMainFormDays() {
    var month = parseInt(document.getElementById('cycle-heb-month').value);
    var year = parseInt(document.getElementById('cycle-heb-year').value);
    var maxDay = getMaxDays(month, year);
    populateDays('cycle-heb-day', maxDay);
  }

  function updateSunsetDisplay() {
    var day = document.getElementById('cycle-heb-day').value;
    var month = document.getElementById('cycle-heb-month').value;
    var year = document.getElementById('cycle-heb-year').value;
    var sunsetDiv = document.getElementById('sunset-display');
    var sunsetTime = document.getElementById('sunset-time');

    var dateStr;
    if (day && month && year) {
      var gregDate = HebrewDate.heb2greg(parseInt(year), parseInt(month), parseInt(day));
      if (!gregDate) { dateStr = todayDateStr(); }
      else { dateStr = gregDate.getFullYear() + '-' + String(gregDate.getMonth()+1).padStart(2,'0') + '-' + String(gregDate.getDate()).padStart(2,'0'); }
    } else {
      // No date selected — show today's sunset
      dateStr = todayDateStr();
    }

    Api.get('/api/settings/sunset?date=' + dateStr)
      .then(function(data) {
        if (data.sunset) {
          sunsetDiv.style.display = 'block';
          sunsetTime.textContent = data.sunset;
        } else {
          sunsetDiv.style.display = 'none';
        }
      })
      .catch(function() { sunsetDiv.style.display = 'none'; });
  }

  function todayDateStr() {
    var now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth()+1).padStart(2,'0') + '-' + String(now.getDate()).padStart(2,'0');
  }

  function render() {
    // Always show sunset time
    updateSunsetDisplay();

    Promise.all([
      Api.get('/api/cycles'),
      Api.get('/api/mechitzot')
    ]).then(function(results) {
      cycles = results[0].records || (Array.isArray(results[0]) ? results[0] : []);
      mechitzot = results[1].mechitzot || [];
      mechitzotSet = new Set(mechitzot.map(function(m) { return m.after_record_id; }));
      renderTable();
    }).catch(function() {
      cycles = [];
      mechitzot = [];
      mechitzotSet = new Set();
      renderTable();
    });

    // Load and render nekiim
    Api.get('/api/cycles/nekiim')
      .then(function(data) {
        renderNekiim(data.nekiim || []);
      })
      .catch(function() {
        renderNekiim([]);
      });
  }

  function renderTable() {
    var tbody = document.getElementById('history-tbody');
    var emptyState = document.getElementById('history-empty');
    var table = document.getElementById('history-table');

    tbody.innerHTML = '';

    if (cycles.length === 0) {
      table.style.display = 'none';
      emptyState.style.display = 'block';
      return;
    }

    table.style.display = 'table';
    emptyState.style.display = 'none';

    cycles.forEach(function(cycle) {
      var row = document.createElement('tr');

      // Hebrew date
      var startCell = document.createElement('td');
      var hebDate = { year: cycle.start_heb_year, month: cycle.start_heb_month, day: cycle.start_heb_day };
      startCell.textContent = HebrewDate.format(hebDate);
      row.appendChild(startCell);

      // Gregorian date (secondary) — formatted as DD/MM/YYYY
      var gregCell = document.createElement('td');
      var gregRaw = cycle.start_date || '';
      if (gregRaw && gregRaw.indexOf('-') !== -1) {
        var parts = gregRaw.split('-');
        gregCell.textContent = parts[2] + '/' + parts[1] + '/' + parts[0];
      } else {
        gregCell.textContent = gregRaw;
      }
      gregCell.style.color = 'var(--color-text-secondary)';
      gregCell.style.fontSize = '0.85rem';
      row.appendChild(gregCell);

      // Onah
      var onahCell = document.createElement('td');
      var onah = cycle.onah || 'day';
      onahCell.textContent = onah === 'night' ? 'לילה 🌙' : 'יום ☀️';
      row.appendChild(onahCell);

      // Interval
      var intervalCell = document.createElement('td');
      intervalCell.textContent = cycle.intervalFromPrevious || '—';
      row.appendChild(intervalCell);

      // Actions
      var actionsCell = document.createElement('td');
      actionsCell.className = 'actions-cell';

      var editBtn = document.createElement('button');
      editBtn.className = 'btn btn-edit';
      editBtn.textContent = 'עריכה';
      editBtn.addEventListener('click', function() {
        startEdit(cycle);
      });
      actionsCell.appendChild(editBtn);

      var delBtn = document.createElement('button');
      delBtn.className = 'btn btn-danger';
      delBtn.textContent = 'מחיקה';
      delBtn.addEventListener('click', function() {
        confirmDelete(cycle.id);
      });
      actionsCell.appendChild(delBtn);

      // Mechitza button
      var mechitzaBtn = document.createElement('button');
      mechitzaBtn.className = 'btn btn-secondary';
      mechitzaBtn.style.fontSize = '0.7rem';
      mechitzaBtn.style.padding = '0.2rem 0.4rem';
      mechitzaBtn.textContent = '✂️';
      mechitzaBtn.title = 'הוסף מחיצה אחרי וסת זו';
      mechitzaBtn.addEventListener('click', (function(cycleId) {
        return function() { addMechitza(cycleId); };
      })(cycle.id));
      actionsCell.appendChild(mechitzaBtn);

      // Nekiim button
      var nekiimBtn = document.createElement('button');
      nekiimBtn.className = 'btn btn-secondary';
      nekiimBtn.style.fontSize = '0.7rem';
      nekiimBtn.style.padding = '0.2rem 0.4rem';
      nekiimBtn.textContent = '7️⃣';
      nekiimBtn.title = 'התחל שבעה נקיים';
      nekiimBtn.addEventListener('click', (function(cycleId, hebDate) {
        return function() {
          showHefsekDatePicker(cycleId, hebDate);
        };
      })(cycle.id, { year: cycle.start_heb_year, month: cycle.start_heb_month, day: cycle.start_heb_day }));
      actionsCell.appendChild(nekiimBtn);

      row.appendChild(actionsCell);
      tbody.appendChild(row);

      // Show mechitza divider if one exists after this record
      if (mechitzotSet.has(cycle.id)) {
        var dividerRow = document.createElement('tr');
        dividerRow.className = 'mechitza-row';
        dividerRow.innerHTML = '<td colspan="5" class="mechitza-divider">✂️ מחיצה — איפוס ספירת הפלגות <button class="btn btn-danger" style="font-size:0.65rem;padding:0.1rem 0.3rem;margin-right:0.5rem;">הסר</button></td>';
        dividerRow.querySelector('button').addEventListener('click', (function(cycleId) {
          return function() { removeMechitza(cycleId); };
        })(cycle.id));
        tbody.appendChild(dividerRow);
      }
    });
  }

  function handleSubmit() {
    var errorEl = document.getElementById('cycle-form-error');
    errorEl.textContent = '';

    var day = document.getElementById('cycle-heb-day').value;
    var month = document.getElementById('cycle-heb-month').value;
    var year = document.getElementById('cycle-heb-year').value;
    var onah = document.getElementById('cycle-onah').value;

    if (!day || !month || !year) {
      errorEl.textContent = 'נא למלא את כל שדות התאריך';
      return;
    }

    var payload = {
      startDateHeb: {
        year: parseInt(year),
        month: parseInt(month),
        day: parseInt(day)
      },
      onah: onah,
      inputFormat: 'hebrew'
    };

    if (editingId) {
      Api.put('/api/cycles/' + editingId, payload)
        .then(function() {
          resetForm();
          render();
        })
        .catch(function(err) {
          errorEl.textContent = err.message || 'שגיאה בעדכון';
        });
    } else {
      Api.post('/api/cycles', payload)
        .then(function() {
          resetForm();
          render();
        })
        .catch(function(err) {
          errorEl.textContent = err.message || 'שגיאה בהוספה';
        });
    }
  }

  function startEdit(cycle) {
    editingId = cycle.id;
    document.getElementById('cycle-edit-id').value = cycle.id;

    // Set hidden fields
    document.getElementById('cycle-heb-day').value = String(cycle.start_heb_day);
    document.getElementById('cycle-heb-month').value = String(cycle.start_heb_month);
    document.getElementById('cycle-heb-year').value = String(cycle.start_heb_year);
    document.getElementById('cycle-onah').value = cycle.onah || 'day';

    // Update datepicker display
    var date = { year: cycle.start_heb_year, month: cycle.start_heb_month, day: cycle.start_heb_day };
    var dpInput = document.getElementById('cycle-datepicker-input');
    var onah = cycle.onah || 'day';
    var text = HebrewDate.toGematria(date.day) + ' ' + HebrewDate.getMonthName(date.month) + ' ' + HebrewDate.formatYear(date.year);
    text += ' | ' + (onah === 'night' ? '🌙 לילה' : '☀️ יום');
    dpInput.value = text;

    if (mainDatepicker) mainDatepicker.setDate(date);

    document.getElementById('cycle-form-title').textContent = 'עריכת וסת';
    document.getElementById('cycle-submit-btn').textContent = 'עדכן';
    document.getElementById('cycle-cancel-btn').style.display = 'inline-block';

    // Scroll to form
    document.getElementById('cycle-form-container').scrollIntoView({ behavior: 'smooth' });
  }

  function resetForm() {
    editingId = null;
    document.getElementById('cycle-form').reset();
    document.getElementById('cycle-edit-id').value = '';
    document.getElementById('cycle-heb-day').value = '';
    document.getElementById('cycle-heb-month').value = '';
    document.getElementById('cycle-heb-year').value = '';
    document.getElementById('cycle-onah').value = 'day';
    document.getElementById('cycle-datepicker-input').value = '';
    document.getElementById('cycle-form-title').textContent = 'הוספת וסת';
    document.getElementById('cycle-submit-btn').textContent = 'הוסף';
    document.getElementById('cycle-cancel-btn').style.display = 'none';
    document.getElementById('cycle-form-error').textContent = '';
  }

  function confirmDelete(id) {
    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML =
      '<div class="confirm-dialog">' +
      '<p>האם למחוק וסת זו?</p>' +
      '<div class="confirm-actions">' +
      '<button class="btn btn-danger" id="confirm-yes">מחק</button>' +
      '<button class="btn btn-secondary" id="confirm-no">ביטול</button>' +
      '</div></div>';

    document.body.appendChild(overlay);

    document.getElementById('confirm-yes').addEventListener('click', function() {
      document.body.removeChild(overlay);
      Api.del('/api/cycles/' + id)
        .then(function() { render(); })
        .catch(function() {});
    });

    document.getElementById('confirm-no').addEventListener('click', function() {
      document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) document.body.removeChild(overlay);
    });
  }

  // ========== Import Section ==========

  var importRowCount = 0;

  function addImportRow() {
    importRowCount++;
    var container = document.getElementById('import-entries');
    var rowDiv = document.createElement('div');
    rowDiv.className = 'import-row';
    rowDiv.id = 'import-row-' + importRowCount;
    
    rowDiv.innerHTML =
      '<div class="form-row" style="align-items:center;">' +
      '  <div class="form-group" style="flex:1;">' +
      '    <input type="text" class="import-dp-input heb-dp-input" placeholder="בחירת תאריך" readonly style="cursor:pointer;">' +
      '    <input type="hidden" class="import-day">' +
      '    <input type="hidden" class="import-month">' +
      '    <input type="hidden" class="import-year">' +
      '    <input type="hidden" class="import-onah" value="day">' +
      '  </div>' +
      '  <div class="form-group" style="flex:0 0 auto;">' +
      '    <button type="button" class="btn btn-danger import-remove-btn" style="padding:0.4rem 0.6rem; font-size:0.8rem;">✕</button>' +
      '  </div>' +
      '</div>';

    container.appendChild(rowDiv);

    // Initialize datepicker for this row
    var dpInput = rowDiv.querySelector('.import-dp-input');
    HebrewDatepicker.create(dpInput, {
      showOnah: true,
      onSelectWithOnah: function(date, onah) {
        rowDiv.querySelector('.import-day').value = date.day;
        rowDiv.querySelector('.import-month').value = date.month;
        rowDiv.querySelector('.import-year').value = date.year;
        rowDiv.querySelector('.import-onah').value = onah;
      }
    });

    // Remove button handler
    rowDiv.querySelector('.import-remove-btn').addEventListener('click', function() {
      container.removeChild(rowDiv);
    });
  }

  function handleImport() {
    var errorEl = document.getElementById('import-error');
    var successEl = document.getElementById('import-success');
    errorEl.textContent = '';
    successEl.textContent = '';

    var rows = document.querySelectorAll('#import-entries .import-row');
    var records = [];
    var errors = [];

    rows.forEach(function(row, idx) {
      var day = row.querySelector('.import-day').value;
      var month = row.querySelector('.import-month').value;
      var year = row.querySelector('.import-year').value;
      var onah = row.querySelector('.import-onah').value;

      if (!day && !month && !year) return; // skip empty rows

      if (!day || !month || !year) {
        errors.push('שורה ' + (idx + 1) + ': נא לבחור תאריך');
        return;
      }

      records.push({
        startDateHeb: {
          year: parseInt(year),
          month: parseInt(month),
          day: parseInt(day)
        },
        onah: onah,
        inputFormat: 'hebrew'
      });
    });

    if (errors.length > 0) {
      errorEl.textContent = errors.join('\n');
      return;
    }

    if (records.length === 0) {
      errorEl.textContent = 'נא להזין לפחות וסת אחת';
      return;
    }

    Api.post('/api/cycles/import', { records: records })
      .then(function(result) {
        var msg = 'יובאו ' + result.imported + ' וסתות';
        if (result.skipped > 0) {
          msg += ' (' + result.skipped + ' דולגו)';
        }
        successEl.textContent = msg + ' ✓';
        // Clear import rows
        document.getElementById('import-entries').innerHTML = '';
        importRowCount = 0;
        addImportRow();
        setTimeout(function() { successEl.textContent = ''; }, 5000);
        render();
      })
      .catch(function(err) {
        errorEl.textContent = err.message || 'שגיאה בייבוא';
      });
  }

  function addMechitza(afterRecordId) {
    Api.post('/api/mechitzot', { afterRecordId: afterRecordId })
      .then(function() { render(); })
      .catch(function(err) { alert(err.message || 'שגיאה'); });
  }

  function removeMechitza(afterRecordId) {
    // Find the mechitza with this after_record_id and delete it
    var mechitza = mechitzot.find(function(m) { return m.after_record_id === afterRecordId; });
    if (!mechitza) return;
    Api.del('/api/mechitzot/' + mechitza.id)
      .then(function() { render(); })
      .catch(function(err) { alert(err.message || 'שגיאה'); });
  }

  function showHefsekDatePicker(cycleId, defaultHeb) {
    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';

    var dialog = document.createElement('div');
    dialog.className = 'confirm-dialog';
    dialog.style.cssText = 'max-width:340px; padding:1.5rem;';

    dialog.innerHTML =
      '<h3 style="margin-bottom:0.75rem; font-size:1rem;">בחרי תאריך הפסק טהרה</h3>' +
      '<p style="font-size:0.85rem; color:var(--color-text-secondary); margin-bottom:1rem;">7 הנקיים מתחילים למחרת יום ההפסק.</p>' +
      '<div class="form-group">' +
      '  <input type="text" id="hefsek-dp-input" class="heb-dp-input" placeholder="בחירת תאריך" readonly style="cursor:pointer; width:100%;">' +
      '</div>' +
      '<div class="confirm-actions" style="margin-top:1rem;">' +
      '  <button class="btn btn-primary" id="hefsek-confirm">התחל ספירה</button>' +
      '  <button class="btn btn-secondary" id="hefsek-cancel">ביטול</button>' +
      '</div>' +
      '<p id="hefsek-error" style="color:var(--color-danger); font-size:0.85rem; margin-top:0.5rem;"></p>';

    overlay.appendChild(dialog);
    document.body.appendChild(overlay);

    // Compute default hefsek date: ראיה + 4 days
    var hefsekDefault = null;
    if (defaultHeb) {
      var gregStart = HebrewDate.heb2greg(defaultHeb.year, defaultHeb.month, defaultHeb.day);
      gregStart.setDate(gregStart.getDate() + 4);
      hefsekDefault = HebrewDate.greg2heb(gregStart.getFullYear(), gregStart.getMonth() + 1, gregStart.getDate());
    }

    var selectedDate = hefsekDefault;
    var dpInput = document.getElementById('hefsek-dp-input');
    var hefsekPicker = HebrewDatepicker.create(dpInput, {
      defaultDate: hefsekDefault,
      onSelect: function(date) {
        selectedDate = date;
      }
    });

    // Set initial display
    if (hefsekDefault) {
      dpInput.value = HebrewDate.toGematria(hefsekDefault.day) + ' ' + HebrewDate.getMonthName(hefsekDefault.month) + ' ' + HebrewDate.formatYear(hefsekDefault.year);
    }

    // Confirm
    document.getElementById('hefsek-confirm').addEventListener('click', function() {
      if (!selectedDate) {
        document.getElementById('hefsek-error').textContent = 'נא לבחור תאריך';
        return;
      }
      var payload = { hefsekHeb: { year: selectedDate.year, month: selectedDate.month, day: selectedDate.day } };
      Api.post('/api/cycles/' + cycleId + '/nekiim', payload)
        .then(function() {
          hefsekPicker.destroy();
          document.body.removeChild(overlay);
          render();
        })
        .catch(function(err) {
          document.getElementById('hefsek-error').textContent = err.message || 'שגיאה';
        });
    });

    // Cancel
    document.getElementById('hefsek-cancel').addEventListener('click', function() {
      hefsekPicker.destroy();
      document.body.removeChild(overlay);
    });
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        hefsekPicker.destroy();
        document.body.removeChild(overlay);
      }
    });
  }

  function renderNekiim(nekiimList) {
    var container = document.getElementById('nekiim-list');
    if (!container) return;
    container.innerHTML = '';

    if (nekiimList.length === 0) {
      container.innerHTML = '<p style="color:var(--color-text-secondary); font-size:0.85rem;">אין ספירות פעילות. לחצי על 7️⃣ ליד וסת להתחיל ספירה.</p>';
      return;
    }

    nekiimList.forEach(function(n) {
      var div = document.createElement('div');
      div.style.cssText = 'margin-bottom:1rem; padding:0.75rem; border:1px solid var(--color-border); border-radius:8px;';

      // Header row with title and cancel button
      var headerDiv = document.createElement('div');
      headerDiv.style.cssText = 'display:flex; justify-content:space-between; align-items:center;';

      var title = document.createElement('p');
      title.style.cssText = 'font-weight:600; margin:0;';
      var hefsekStr = n.hefsek_heb ? HebrewDate.format(n.hefsek_heb) : n.hefsek_date || n.start_date;
      title.textContent = 'הפסק טהרה: ' + hefsekStr;
      if (n.completed) title.textContent += ' ✅';
      headerDiv.appendChild(title);

      // Cancel button (always visible — allows deleting any count)
      var cancelBtn = document.createElement('button');
      cancelBtn.className = 'btn btn-danger';
      cancelBtn.style.cssText = 'font-size:0.7rem; padding:0.2rem 0.5rem;';
      cancelBtn.textContent = '✕ מחיקה';
      cancelBtn.title = 'מחיקת ספירה';
      cancelBtn.addEventListener('click', (function(nekiimId, cycleId) {
        return function() {
          if (confirm('למחוק את הספירה?')) {
            Api.del('/api/cycles/' + cycleId + '/nekiim/' + nekiimId)
              .then(function() { render(); })
              .catch(function(err) { alert(err.message || 'שגיאה'); });
          }
        };
      })(n.id, n.cycle_id));
      headerDiv.appendChild(cancelBtn);

      div.appendChild(headerDiv);

      // Tevilah date
      var tevilahStr = n.tevilah_heb ? HebrewDate.format(n.tevilah_heb) : '';
      if (tevilahStr) {
        var tevilahP = document.createElement('p');
        tevilahP.style.cssText = 'font-size:0.85rem; color:var(--color-primary); margin-top:0.25rem;';
        tevilahP.textContent = 'טבילה: ליל ' + tevilahStr;
        div.appendChild(tevilahP);
      }

      // 14 checkboxes: 7 days x 2 (night + day)
      var daysGrid = document.createElement('div');
      daysGrid.style.cssText = 'display:grid; grid-template-columns:auto repeat(7, 1fr); gap:0.25rem; margin-top:0.75rem; font-size:0.8rem; text-align:center;';

      // Compute Hebrew dates for each of the 7 days (hefsek + 1 + i)
      var dayDates = [];
      if (n.hefsek_date) {
        for (var hd = 0; hd < 7; hd++) {
          var base = new Date(n.hefsek_date);
          base.setDate(base.getDate() + 1 + hd);
          var hebD = HebrewDate.greg2heb(base.getFullYear(), base.getMonth() + 1, base.getDate());
          dayDates.push(hebD);
        }
      }

      // Header row: Hebrew dates with day number
      var cornerEl = document.createElement('div');
      cornerEl.textContent = '';
      daysGrid.appendChild(cornerEl);
      for (var h = 0; h < 7; h++) {
        var dayHeader = document.createElement('div');
        dayHeader.style.cssText = 'font-weight:600; font-size:0.7rem; line-height:1.2;';
        var numLine = document.createElement('div');
        numLine.style.cssText = 'font-size:0.85rem; font-weight:700;';
        numLine.textContent = (h + 1);
        dayHeader.appendChild(numLine);
        if (dayDates[h]) {
          var dateLine = document.createElement('div');
          dateLine.style.cssText = 'font-size:0.65rem; color:var(--color-text-secondary); font-weight:400;';
          dateLine.textContent = HebrewDate.toGematria(dayDates[h].day) + ' ' + HebrewDate.getMonthName(dayDates[h].month);
          dayHeader.appendChild(dateLine);
        }
        daysGrid.appendChild(dayHeader);
      }

      // Migrate old boolean array format for display
      var days = n.days || [];
      if (days.length > 0 && typeof days[0] === 'boolean') {
        days = days.map(function(d) { return { night: d, day: d }; });
      }

      // Night row (🌙)
      var nightLabel = document.createElement('div');
      nightLabel.style.cssText = 'display:flex; align-items:center; font-size:0.75rem;';
      nightLabel.textContent = '🌙';
      daysGrid.appendChild(nightLabel);
      for (var i = 0; i < 7; i++) {
        var nightCheck = createCheckbox(n, i, 'night', days[i] ? days[i].night : false);
        daysGrid.appendChild(nightCheck);
      }

      // Day row (☀️)
      var dayLabel = document.createElement('div');
      dayLabel.style.cssText = 'display:flex; align-items:center; font-size:0.75rem;';
      dayLabel.textContent = '☀️';
      daysGrid.appendChild(dayLabel);
      for (var j = 0; j < 7; j++) {
        var dayCheck = createCheckbox(n, j, 'day', days[j] ? days[j].day : false);
        daysGrid.appendChild(dayCheck);
      }

      div.appendChild(daysGrid);

      // Progress indicator
      var checkedCount = 0;
      for (var k = 0; k < 7; k++) {
        if (days[k]) {
          if (days[k].night) checkedCount++;
          if (days[k].day) checkedCount++;
        }
      }
      var progressP = document.createElement('p');
      progressP.style.cssText = 'font-size:0.75rem; color:var(--color-text-secondary); margin-top:0.5rem; text-align:center;';
      progressP.textContent = checkedCount + '/14 בדיקות';
      div.appendChild(progressP);

      container.appendChild(div);
    });
  }

  function createCheckbox(nekiimEntry, dayIndex, onah, checked) {
    var wrapper = document.createElement('div');
    wrapper.style.cssText = 'display:flex; justify-content:center; align-items:center;';

    var cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = checked;
    cb.style.cssText = 'width:20px; height:20px; cursor:pointer; accent-color:#388E3C;';
    cb.addEventListener('change', (function(nId, cId, dIdx, o) {
      return function() {
        Api.put('/api/cycles/' + cId + '/nekiim/' + nId, { day: dIdx, onah: o, clean: this.checked })
          .then(function() { render(); });
      };
    })(nekiimEntry.id, nekiimEntry.cycle_id, dayIndex, onah));

    wrapper.appendChild(cb);
    return wrapper;
  }

  return {
    init: init,
    render: render
  };
})();
