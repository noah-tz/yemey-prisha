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
    var reminderEmailInput = document.getElementById('setting-reminder-email');
    if (reminderEmailInput) {
      var reminderTimeout = null;
      reminderEmailInput.addEventListener('input', function() {
        clearTimeout(reminderTimeout);
        reminderTimeout = setTimeout(function() {
          saveReminderSettings();
        }, 1000);
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
        var reminderEmail = document.getElementById('setting-reminder-email');
        if (reminderEnabled) reminderEnabled.checked = !!data.reminder_enabled;
        if (reminderEmail) reminderEmail.value = data.reminder_email || '';
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
    var reminderEmail = document.getElementById('setting-reminder-email');

    var payload = {
      reminder_enabled: reminderEnabled ? reminderEnabled.checked : false,
      reminder_email: reminderEmail ? reminderEmail.value.trim() : ''
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

  return {
    init: init,
    render: render
  };
})();
