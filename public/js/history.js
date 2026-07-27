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

    // Populate day dropdown with Hebrew gematria (1-30)
    populateDays('cycle-heb-day', 30);

    // Populate year dropdown with Hebrew year names
    populateYears(document.getElementById('cycle-heb-year'));

    // Month/year change updates day count
    document.getElementById('cycle-heb-month').addEventListener('change', updateMainFormDays);
    document.getElementById('cycle-heb-year').addEventListener('change', updateMainFormDays);

    // Sunset display when date fields change
    document.getElementById('cycle-heb-day').addEventListener('change', updateSunsetDisplay);
    document.getElementById('cycle-heb-month').addEventListener('change', updateSunsetDisplay);
    document.getElementById('cycle-heb-year').addEventListener('change', updateSunsetDisplay);

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

    if (!day || !month || !year) { sunsetDiv.style.display = 'none'; return; }

    var gregDate = HebrewDate.heb2greg(parseInt(year), parseInt(month), parseInt(day));
    if (!gregDate) { sunsetDiv.style.display = 'none'; return; }

    var dateStr = gregDate.getFullYear() + '-' + String(gregDate.getMonth()+1).padStart(2,'0') + '-' + String(gregDate.getDate()).padStart(2,'0');
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

  function render() {
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

      // Gregorian date (secondary)
      var gregCell = document.createElement('td');
      gregCell.textContent = cycle.start_date || '';
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
      nekiimBtn.addEventListener('click', (function(cycleId, cycleStartDate, hebDate) {
        return function() {
          var hefsekDate = cycleStartDate;
          if (confirm('להתחיל ספירת 7 נקיים?\n\nיום ההפסק: ' + HebrewDate.format(hebDate) + '\n(7 הנקיים מתחילים למחרת)')) {
            Api.post('/api/cycles/' + cycleId + '/nekiim', { startDate: hefsekDate })
              .then(function() { render(); })
              .catch(function(err) { alert(err.message); });
          }
        };
      })(cycle.id, cycle.start_date, { year: cycle.start_heb_year, month: cycle.start_heb_month, day: cycle.start_heb_day }));
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

    // Ensure the year exists in the dropdown before setting it
    var yearSelect = document.getElementById('cycle-heb-year');
    var yearValue = String(cycle.start_heb_year);
    var yearExists = false;
    for (var i = 0; i < yearSelect.options.length; i++) {
      if (yearSelect.options[i].value === yearValue) {
        yearExists = true;
        break;
      }
    }
    if (!yearExists && cycle.start_heb_year) {
      var opt = document.createElement('option');
      opt.value = cycle.start_heb_year;
      opt.textContent = HebrewDate.formatYear(cycle.start_heb_year);
      yearSelect.insertBefore(opt, yearSelect.options[1]); // After "שנה" placeholder
    }

    yearSelect.value = yearValue;
    document.getElementById('cycle-heb-month').value = String(cycle.start_heb_month) || '';

    // Update days dropdown for this month/year combination, then set day
    updateMainFormDays();
    document.getElementById('cycle-heb-day').value = String(cycle.start_heb_day) || '';

    document.getElementById('cycle-onah').value = cycle.onah || 'day';
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
      '<div class="form-row">' +
      '  <div class="form-group" style="flex:0.6;">' +
      '    <select class="import-day" required>' +
      '      <option value="">יום</option>' +
      generateHebrewDayOptions(30) +
      '    </select>' +
      '  </div>' +
      '  <div class="form-group" style="flex:1;">' +
      '    <select class="import-month" required>' +
      '      <option value="">חודש</option>' +
      '      <option value="7">תשרי</option>' +
      '      <option value="8">חשוון</option>' +
      '      <option value="9">כסלו</option>' +
      '      <option value="10">טבת</option>' +
      '      <option value="11">שבט</option>' +
      '      <option value="12">אדר</option>' +
      '      <option value="13">אדר ב׳</option>' +
      '      <option value="1">ניסן</option>' +
      '      <option value="2">אייר</option>' +
      '      <option value="3">סיוון</option>' +
      '      <option value="4">תמוז</option>' +
      '      <option value="5">אב</option>' +
      '      <option value="6">אלול</option>' +
      '    </select>' +
      '  </div>' +
      '  <div class="form-group" style="flex:0.8;">' +
      '    <select class="import-year"></select>' +
      '  </div>' +
      '  <div class="form-group" style="flex:0.7;">' +
      '    <select class="import-onah" required>' +
      '      <option value="day">יום ☀️</option>' +
      '      <option value="night">לילה 🌙</option>' +
      '    </select>' +
      '  </div>' +
      '  <div class="form-group" style="flex:0.3; display:flex; align-items:flex-end;">' +
      '    <button type="button" class="btn btn-danger import-remove-btn" style="padding:0.4rem 0.6rem; font-size:0.8rem;">✕</button>' +
      '  </div>' +
      '</div>';

    container.appendChild(rowDiv);

    // Populate year dropdown for this row
    populateYears(rowDiv.querySelector('.import-year'));

    // Remove button handler
    rowDiv.querySelector('.import-remove-btn').addEventListener('click', function() {
      container.removeChild(rowDiv);
    });

    // Month/year change updates day count for this row
    rowDiv.querySelector('.import-month').addEventListener('change', function() {
      var daySelect = rowDiv.querySelector('.import-day');
      var month = parseInt(this.value);
      var year = parseInt(rowDiv.querySelector('.import-year').value);
      var maxDay = getMaxDays(month, year);
      populateDaysElement(daySelect, maxDay);
    });

    rowDiv.querySelector('.import-year').addEventListener('change', function() {
      var daySelect = rowDiv.querySelector('.import-day');
      var month = parseInt(rowDiv.querySelector('.import-month').value);
      var year = parseInt(this.value);
      var maxDay = getMaxDays(month, year);
      populateDaysElement(daySelect, maxDay);
    });
  }

  function generateHebrewDayOptions(max) {
    var html = '';
    for (var d = 1; d <= max; d++) {
      html += '<option value="' + d + '">' + HEBREW_DAYS[d] + '</option>';
    }
    return html;
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
        errors.push('שורה ' + (idx + 1) + ': נא למלא את כל השדות');
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

      var title = document.createElement('p');
      title.style.fontWeight = '600';
      var hefsekStr = n.hefsek_heb ? HebrewDate.format(n.hefsek_heb) : n.hefsek_date || n.start_date;
      var tevilahStr = n.tevilah_heb ? HebrewDate.format(n.tevilah_heb) : '';
      title.textContent = 'הפסק טהרה: ' + hefsekStr;
      if (n.completed) title.textContent += ' ✅';
      div.appendChild(title);

      if (tevilahStr) {
        var tevilahP = document.createElement('p');
        tevilahP.style.cssText = 'font-size:0.85rem; color:var(--color-primary); margin-top:0.25rem;';
        tevilahP.textContent = 'טבילה: ליל ' + tevilahStr;
        div.appendChild(tevilahP);
      }

      var daysDiv = document.createElement('div');
      daysDiv.style.cssText = 'display:flex; gap:0.5rem; margin-top:0.5rem;';

      for (var i = 0; i < 7; i++) {
        var dayBtn = document.createElement('button');
        dayBtn.style.cssText = 'width:36px; height:36px; border-radius:50%; border:2px solid; cursor:pointer; font-size:0.8rem;';
        dayBtn.textContent = (i + 1);
        if (n.days[i]) {
          dayBtn.style.background = '#66BB6A';
          dayBtn.style.borderColor = '#388E3C';
          dayBtn.style.color = '#fff';
        } else {
          dayBtn.style.background = 'var(--color-surface)';
          dayBtn.style.borderColor = 'var(--color-border)';
          dayBtn.style.color = 'var(--color-text)';
        }
        (function(dayIndex, nekiimId, cycleId) {
          dayBtn.addEventListener('click', function() {
            Api.put('/api/cycles/' + cycleId + '/nekiim/' + nekiimId, { day: dayIndex, clean: !n.days[dayIndex] })
              .then(function() { render(); });
          });
        })(i, n.id, n.cycle_id);
        daysDiv.appendChild(dayBtn);
      }

      div.appendChild(daysDiv);
      container.appendChild(div);
    });
  }

  return {
    init: init,
    render: render
  };
})();
