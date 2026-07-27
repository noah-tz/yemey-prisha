/**
 * Settings module
 * Manages posek selection and advanced halachic settings.
 */
var Settings = (function() {
  'use strict';

  var apiKeyValue = null;
  var apiKeyRevealed = false;

  function init() {
    // Posek radio buttons
    var radios = document.querySelectorAll('input[name="posek"]');
    radios.forEach(function(radio) {
      radio.addEventListener('change', function() {
        saveAllSettings();
      });
    });

    // Advanced settings checkboxes
    var checkboxes = [
      'setting-beinonit31',
      'setting-orzarua',
      'setting-haflagah3',
      'setting-hachodesh-overflow'
    ];
    checkboxes.forEach(function(id) {
      var el = document.getElementById(id);
      if (el) {
        el.addEventListener('change', function() {
          saveAllSettings();
        });
      }
    });

    // Reminder settings
    var reminderCheckbox = document.getElementById('setting-reminder-enabled');
    if (reminderCheckbox) {
      reminderCheckbox.addEventListener('change', function() {
        saveReminderSettings();
      });
    }

    // Nekiim settings
    var nekiimReminderCheckbox = document.getElementById('setting-nekiim-reminder');
    if (nekiimReminderCheckbox) {
      nekiimReminderCheckbox.addEventListener('change', function() {
        saveNekiimSettings();
      });
    }
    var nekiimCalendarCheckbox = document.getElementById('setting-nekiim-calendar');
    if (nekiimCalendarCheckbox) {
      nekiimCalendarCheckbox.addEventListener('change', function() {
        saveNekiimSettings();
      });
    }

    // Multi-email management
    var addEmailBtn = document.getElementById('add-reminder-email-btn');
    if (addEmailBtn) {
      addEmailBtn.addEventListener('click', function() {
        var emailInput = document.getElementById('add-reminder-email');
        var msgEl = document.getElementById('reminder-email-message');
        var email = emailInput.value.trim();
        msgEl.textContent = '';

        if (!email || !email.includes('@')) {
          msgEl.className = 'error-message';
          msgEl.textContent = 'נא להזין כתובת מייל תקינה';
          return;
        }

        Api.post('/api/reminder-emails', { email: email })
          .then(function(data) {
            emailInput.value = '';
            msgEl.className = 'success-message';
            msgEl.textContent = 'מייל אימות נשלח ✓';
            setTimeout(function() { msgEl.textContent = ''; }, 5000);
            loadReminderEmails();
          })
          .catch(function(err) {
            msgEl.className = 'error-message';
            msgEl.textContent = err.message || 'שגיאה';
            setTimeout(function() { msgEl.textContent = ''; }, 5000);
          });
      });
    }

    // API key management
    document.getElementById('reveal-api-key-btn').addEventListener('click', function() {
      apiKeyRevealed = true;
      updateApiKeyDisplay();
    });

    document.getElementById('hide-api-key-btn').addEventListener('click', function() {
      apiKeyRevealed = false;
      updateApiKeyDisplay();
    });

    document.getElementById('copy-api-key-btn').addEventListener('click', function() {
      if (apiKeyValue && navigator.clipboard) {
        navigator.clipboard.writeText(apiKeyValue).then(function() {
          var msgEl = document.getElementById('api-key-message');
          msgEl.className = 'success-message';
          msgEl.textContent = 'הועתק ✓';
          setTimeout(function() { msgEl.textContent = ''; }, 2000);
        });
      }
    });

    document.getElementById('generate-api-key-btn').addEventListener('click', function() {
      if (!confirm('ייווצר מפתח חדש. המפתח הישן יפסיק לעבוד. להמשיך?')) return;
      Api.post('/api/settings/api-key', {})
        .then(function(data) {
          apiKeyValue = data.apiKey;
          apiKeyRevealed = true;
          updateApiKeyDisplay();
          var msgEl = document.getElementById('api-key-message');
          msgEl.className = 'success-message';
          msgEl.textContent = 'מפתח חדש נוצר ✓';
          setTimeout(function() { msgEl.textContent = ''; }, 3000);
        })
        .catch(function(err) {
          var msgEl = document.getElementById('api-key-message');
          msgEl.className = 'error-message';
          msgEl.textContent = err.message || 'שגיאה';
          setTimeout(function() { msgEl.textContent = ''; msgEl.className = 'success-message'; }, 3000);
        });
    });

    // City/location selection
    var citySelect = document.getElementById('setting-city');
    if (citySelect) {
      citySelect.addEventListener('change', function() {
        var val = this.value;
        if (!val) return;
        var parts = val.split(',');
        Api.put('/api/settings', { latitude: parseFloat(parts[0]), longitude: parseFloat(parts[1]) })
          .then(function() {
            var msgEl = document.getElementById('location-message');
            msgEl.textContent = 'מיקום נשמר ✓';
            setTimeout(function() { msgEl.textContent = ''; }, 3000);
          });
      });
    }
  }

  function loadApiKey() {
    Api.get('/api/settings/api-key')
      .then(function(data) {
        apiKeyValue = data.apiKey || null;
        updateApiKeyDisplay();
      })
      .catch(function() {
        apiKeyValue = null;
        updateApiKeyDisplay();
      });
  }

  function updateApiKeyDisplay() {
    var el = document.getElementById('api-key-value');
    var revealBtn = document.getElementById('reveal-api-key-btn');
    var hideBtn = document.getElementById('hide-api-key-btn');
    var copyBtn = document.getElementById('copy-api-key-btn');
    
    if (!apiKeyValue) {
      el.textContent = 'לא נוצר עדיין';
      revealBtn.style.display = 'none';
      hideBtn.style.display = 'none';
      copyBtn.style.display = 'none';
      return;
    }
    
    if (apiKeyRevealed) {
      el.textContent = apiKeyValue;
      revealBtn.style.display = 'none';
      hideBtn.style.display = 'inline-block';
      copyBtn.style.display = 'inline-block';
    } else {
      el.textContent = '••••••••••••••••••••••••••••••••';
      revealBtn.style.display = 'inline-block';
      hideBtn.style.display = 'none';
      copyBtn.style.display = 'inline-block';
    }
  }

  function render() {
    // Load API key
    loadApiKey();
    // Load reminder emails list
    loadReminderEmails();
    // Load encryption mode
    loadEncryptionMode();

    Api.get('/api/settings')
      .then(function(data) {
        // Posek
        var posek = data.posek || 'rama';
        var radio = document.querySelector('input[name="posek"][value="' + posek + '"]');
        if (radio) {
          radio.checked = true;
        }

        // Advanced settings
        var beinonit31 = document.getElementById('setting-beinonit31');
        var orzarua = document.getElementById('setting-orzarua');
        var haflagah3 = document.getElementById('setting-haflagah3');
        var hachodeshOverflow = document.getElementById('setting-hachodesh-overflow');

        if (beinonit31) beinonit31.checked = data.onah_beinonit_31 !== false;
        if (orzarua) orzarua.checked = data.or_zarua !== false;
        if (haflagah3) haflagah3.checked = data.haflagah_shlishit !== false;
        if (hachodeshOverflow) hachodeshOverflow.checked = !!data.hachodesh_overflow;

        // Reminder settings
        var reminderEnabled = document.getElementById('setting-reminder-enabled');
        if (reminderEnabled) reminderEnabled.checked = !!data.reminder_enabled;

        // Nekiim settings
        var nekiimReminder = document.getElementById('setting-nekiim-reminder');
        if (nekiimReminder) nekiimReminder.checked = !!data.nekiim_reminder;
        var nekiimCalendar = document.getElementById('setting-nekiim-calendar');
        if (nekiimCalendar) nekiimCalendar.checked = !!data.nekiim_show_calendar;

        // City/location — match saved lat/lng to dropdown option
        if (data.latitude && data.longitude) {
          var citySelect = document.getElementById('setting-city');
          if (citySelect) {
            var savedCoords = data.latitude + ',' + data.longitude;
            for (var i = 0; i < citySelect.options.length; i++) {
              if (citySelect.options[i].value === savedCoords) {
                citySelect.value = savedCoords;
                break;
              }
            }
          }
        }
      })
      .catch(function() {
        // Default to rama and all defaults
        var ramaRadio = document.querySelector('input[name="posek"][value="rama"]');
        if (ramaRadio) ramaRadio.checked = true;
      });
  }

  function saveAllSettings() {
    var posekRadio = document.querySelector('input[name="posek"]:checked');
    var posek = posekRadio ? posekRadio.value : 'rama';

    var beinonit31 = document.getElementById('setting-beinonit31');
    var orzarua = document.getElementById('setting-orzarua');
    var haflagah3 = document.getElementById('setting-haflagah3');
    var hachodeshOverflow = document.getElementById('setting-hachodesh-overflow');

    var payload = {
      posek: posek,
      onah_beinonit_31: beinonit31 ? beinonit31.checked : true,
      or_zarua: orzarua ? orzarua.checked : true,
      haflagah_shlishit: haflagah3 ? haflagah3.checked : true,
      hachodesh_overflow: hachodeshOverflow ? hachodeshOverflow.checked : false
    };

    var msgEl = document.getElementById('settings-message');
    msgEl.textContent = '';

    Api.put('/api/settings', payload)
      .then(function() {
        msgEl.textContent = 'ההגדרות נשמרו בהצלחה ✓';
        setTimeout(function() {
          msgEl.textContent = '';
        }, 3000);
      })
      .catch(function(err) {
        msgEl.textContent = '';
        msgEl.className = 'error-message';
        msgEl.textContent = err.message || 'שגיאה בשמירה';
        setTimeout(function() {
          msgEl.textContent = '';
          msgEl.className = 'success-message';
        }, 3000);
      });
  }

  function saveReminderSettings() {
    var reminderEnabled = document.getElementById('setting-reminder-enabled');

    var payload = {
      reminder_enabled: reminderEnabled ? reminderEnabled.checked : false
    };

    var msgEl = document.getElementById('reminder-message');
    if (msgEl) msgEl.textContent = '';

    Api.put('/api/settings', payload)
      .then(function() {
        if (msgEl) {
          msgEl.className = 'success-message';
          msgEl.textContent = 'הגדרות תזכורת נשמרו ✓';
          setTimeout(function() { msgEl.textContent = ''; }, 3000);
        }
      })
      .catch(function(err) {
        if (msgEl) {
          msgEl.className = 'error-message';
          msgEl.textContent = err.message || 'שגיאה בשמירה';
          setTimeout(function() { msgEl.textContent = ''; msgEl.className = 'success-message'; }, 3000);
        }
      });
  }

  function saveNekiimSettings() {
    var nekiimReminder = document.getElementById('setting-nekiim-reminder');
    var nekiimCalendar = document.getElementById('setting-nekiim-calendar');

    var payload = {
      nekiim_reminder: nekiimReminder ? nekiimReminder.checked : false,
      nekiim_show_calendar: nekiimCalendar ? nekiimCalendar.checked : false
    };

    var msgEl = document.getElementById('nekiim-settings-message');
    if (msgEl) msgEl.textContent = '';

    Api.put('/api/settings', payload)
      .then(function() {
        if (msgEl) {
          msgEl.className = 'success-message';
          msgEl.textContent = 'הגדרות 7 נקיים נשמרו ✓';
          setTimeout(function() { msgEl.textContent = ''; }, 3000);
        }
      })
      .catch(function(err) {
        if (msgEl) {
          msgEl.className = 'error-message';
          msgEl.textContent = err.message || 'שגיאה בשמירה';
          setTimeout(function() { msgEl.textContent = ''; msgEl.className = 'success-message'; }, 3000);
        }
      });
  }

  function loadReminderEmails() {
    Api.get('/api/reminder-emails')
      .then(function(data) {
        var container = document.getElementById('reminder-emails-list');
        if (!container) return;
        container.innerHTML = '';
        var emails = data.emails || [];

        if (emails.length === 0) {
          container.innerHTML = '<p style="color: var(--color-text-secondary); font-size: 0.85rem;">לא הוגדרו כתובות. הוסף כתובת מייל למטה.</p>';
          return;
        }

        emails.forEach(function(e) {
          var row = document.createElement('div');
          row.style.cssText = 'display:flex; align-items:center; gap:0.5rem; padding:0.4rem 0; border-bottom:1px solid var(--color-border);';

          var emailSpan = document.createElement('span');
          emailSpan.style.cssText = 'flex:1; direction:ltr; text-align:left; font-size:0.9rem;';
          emailSpan.textContent = e.email;

          var statusSpan = document.createElement('span');
          statusSpan.style.cssText = 'font-size:0.75rem; padding:0.15rem 0.4rem; border-radius:4px;';
          if (e.verified) {
            statusSpan.textContent = '\u2713 מאומת';
            statusSpan.style.background = '#E8F5E9';
            statusSpan.style.color = '#2E7D32';
          } else {
            statusSpan.textContent = 'ממתין לאימות';
            statusSpan.style.background = '#FFF3E0';
            statusSpan.style.color = '#E65100';
          }

          var delBtn = document.createElement('button');
          delBtn.className = 'btn btn-danger';
          delBtn.style.cssText = 'font-size:0.7rem; padding:0.2rem 0.4rem;';
          delBtn.textContent = '\u2715';
          delBtn.addEventListener('click', function() {
            Api.del('/api/reminder-emails/' + e.id).then(function() { loadReminderEmails(); });
          });

          row.appendChild(emailSpan);
          row.appendChild(statusSpan);
          row.appendChild(delBtn);
          container.appendChild(row);
        });
      })
      .catch(function() {});
  }

  function loadEncryptionMode() {
    Api.get('/api/settings/encryption-mode')
      .then(function(data) {
        var statusEl = document.getElementById('encryption-mode-status');
        var descEl = document.getElementById('encryption-mode-desc');
        var actionsEl = document.getElementById('encryption-mode-actions');
        
        if (data.mode === 'e2e') {
          statusEl.textContent = '\uD83D\uDD12 מצב E2E (הצפנה מקצה לקצה)';
          statusEl.style.color = '#388E3C';
          descEl.textContent = 'הנתונים מוצפנים באופן מוחלט. רק סיסמתך יכולה לפענח אותם. תזכורות באימייל, API ו-MCP אינם זמינים במצב זה.';
          actionsEl.innerHTML = '<button class="btn btn-primary" id="enable-extended-btn">הפעל גישה מורחבת (API + תזכורות)</button>';
          
          document.getElementById('enable-extended-btn').addEventListener('click', function() {
            showExtendedModeConfirm();
          });

          // Dim/disable API and reminder sections in E2E mode
          var apiKeyCard = document.getElementById('api-key-display') ? document.getElementById('api-key-display').closest('.card') : null;
          var reminderCard = document.getElementById('reminder-emails-section') ? document.getElementById('reminder-emails-section').closest('.card') : null;
          if (apiKeyCard) apiKeyCard.style.display = 'none';
          if (reminderCard) reminderCard.style.display = 'none';
        } else {
          statusEl.textContent = '\uD83D\uDD14 מצב מורחב (API + תזכורות)';
          statusEl.style.color = '#1976D2';
          descEl.textContent = 'תזכורות באימייל, API ו-MCP פעילים. המערכת מסוגלת לעבד את הנתונים באופן אוטומטי.';
          actionsEl.innerHTML = '<button class="btn btn-secondary" id="disable-extended-btn">חזרה למצב E2E (ביטול גישה מורחבת)</button>';
          
          document.getElementById('disable-extended-btn').addEventListener('click', function() {
            if (confirm('חזרה למצב E2E תבטל תזכורות באימייל וגישת API. להמשיך?')) {
              Api.post('/api/settings/disable-extended', {})
                .then(function() { loadEncryptionMode(); render(); })
                .catch(function(err) { alert(err.message); });
            }
          });

          // Restore opacity for API and reminder sections in extended mode
          var apiKeyCard = document.getElementById('api-key-display') ? document.getElementById('api-key-display').closest('.card') : null;
          var reminderCard = document.getElementById('reminder-emails-section') ? document.getElementById('reminder-emails-section').closest('.card') : null;
          if (apiKeyCard) apiKeyCard.style.display = 'block';
          if (reminderCard) reminderCard.style.display = 'block';
        }
      })
      .catch(function() {});
  }

  function showExtendedModeConfirm() {
    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML = 
      '<div class="confirm-dialog" style="max-width:450px; text-align:right;">' +
      '<h3 style="margin-bottom:1rem; color:#1976D2;">שינוי מצב הצפנה</h3>' +
      '<p style="line-height:1.7; font-size:0.9rem;">הנתונים שלך מוצפנים כעת בשיטת הצפנה מקצה לקצה (E2E) — המערכת אינה יכולה לגשת אליהם ללא סיסמתך.</p>' +
      '<p style="line-height:1.7; font-size:0.9rem; margin-top:0.75rem;">הפעלת תזכורות ו/או גישת API דורשת מעבר לשיטת הצפנה שבה המערכת מסוגלת לעבד את הנתונים באופן אוטומטי. האימייל אינו נשמר במערכת ושום אדם אינו רואה אותו מלבדך.</p>' +
      '<p style="line-height:1.7; font-size:0.85rem; margin-top:0.75rem;">המערכת אינה נושאת באחריות למקרה של פגיעה בסודיות הנתונים בשל הפעלת שירות זה.</p>' +
      '<p style="line-height:1.7; font-size:0.85rem; margin-top:0.5rem; color:#666;">ניתן לבטל בכל עת — ביטול מחזיר את ההצפנה למצב E2E.</p>' +
      '<div style="margin-top:1.5rem; display:flex; gap:0.75rem; justify-content:center;">' +
      '<button class="btn btn-primary" id="confirm-extended-yes">אני מאשר/ת</button>' +
      '<button class="btn btn-secondary" id="confirm-extended-no">ביטול</button>' +
      '</div></div>';
    
    document.body.appendChild(overlay);
    
    document.getElementById('confirm-extended-yes').addEventListener('click', function() {
      document.body.removeChild(overlay);
      Api.post('/api/settings/enable-extended', {})
        .then(function() {
          var msgEl = document.getElementById('encryption-mode-message');
          msgEl.textContent = 'גישה מורחבת הופעלה \u2713';
          setTimeout(function() { msgEl.textContent = ''; }, 3000);
          loadEncryptionMode();
          render();
        })
        .catch(function(err) { alert(err.message || 'שגיאה'); });
    });
    
    document.getElementById('confirm-extended-no').addEventListener('click', function() {
      document.body.removeChild(overlay);
    });
    
    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) document.body.removeChild(overlay);
    });
  }

  return {
    init: init,
    render: render
  };
})();
