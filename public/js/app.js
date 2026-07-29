/**
 * Main App controller
 * Hash-based router and view management.
 */
var App = (function() {
  'use strict';

  var views = {
    auth: document.getElementById('view-auth'),
    calendar: document.getElementById('view-calendar'),
    history: document.getElementById('view-history'),
    settings: document.getElementById('view-settings'),
    privacy: document.getElementById('view-privacy'),
    'api-docs': document.getElementById('view-api-docs'),
    admin: document.getElementById('view-admin')
  };

  var nav = document.getElementById('main-nav');
  var isAuthenticated = false;
  var isAdmin = false;

  function init() {
    // Initialize i18n
    I18n.init();

    // Dark mode toggle
    var themeToggle = document.getElementById('theme-toggle');
    var savedTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);
    themeToggle.textContent = savedTheme === 'dark' ? '☀️' : '🌙';
    
    themeToggle.addEventListener('click', function() {
      var current = document.documentElement.getAttribute('data-theme');
      var next = current === 'dark' ? 'light' : 'dark';
      document.documentElement.setAttribute('data-theme', next);
      localStorage.setItem('theme', next);
      themeToggle.textContent = next === 'dark' ? '☀️' : '🌙';
    });

    Auth.init();
    Calendar.init();
    History.init();
    Settings.init();

    // Auth page language toggle
    var authLangBtn = document.getElementById('auth-lang-toggle');
    if (authLangBtn) {
      authLangBtn.addEventListener('click', function() {
        var next = I18n.getLang() === 'he' ? 'en' : 'he';
        I18n.setLang(next);
        // Update the lang selector in settings too
        var langSelect = document.getElementById('setting-lang');
        if (langSelect) langSelect.value = next;
      });
    }

    // Logout handler
    document.getElementById('logout-btn').addEventListener('click', function(e) {
      e.preventDefault();
      Api.post('/api/auth/logout', {})
        .then(function() {
          isAuthenticated = false;
          window.location.hash = '#login';
          route();
        })
        .catch(function() {
          // Even on error, redirect to login
          isAuthenticated = false;
          window.location.hash = '#login';
          route();
        });
    });

    // Listen for hash changes
    window.addEventListener('hashchange', route);

    // Initial auth check
    checkAuth();
  }

  function checkAuth() {
    Api.get('/api/settings')
      .then(function(data) {
        isAuthenticated = true;
        if (data.is_admin) {
          isAdmin = true;
          document.getElementById('nav-admin').style.display = '';
        }
        if (!window.location.hash || window.location.hash === '#login' || window.location.hash === '#register') {
          window.location.hash = '#calendar';
        }
        route();
        // Check donation prompt
        checkDonationPrompt();
      })
      .catch(function() {
        isAuthenticated = false;
        if (window.location.hash !== '#register' && window.location.hash !== '#privacy') {
          window.location.hash = '#login';
        }
        route();
      });
  }

  function checkDonationPrompt() {
    Api.get('/api/settings/donation-check')
      .then(function(data) {
        if (data.show) showDonationPopup();
      })
      .catch(function() {});
  }

  function showDonationPopup() {
    var overlay = document.createElement('div');
    overlay.className = 'confirm-overlay';
    overlay.innerHTML =
      '<div class="confirm-dialog" style="max-width:380px; padding:2rem; text-align:center;">' +
      '<p style="font-size:1.8rem; margin-bottom:0.75rem;">☕</p>' +
      '<h3 style="margin-bottom:0.75rem; color:var(--color-primary);">' + I18n.t('donation_title') + '</h3>' +
      '<p style="line-height:1.7; font-size:0.9rem; white-space:pre-line; color:var(--color-text-secondary);">' + I18n.t('donation_body') + '</p>' +
      '<div style="margin-top:1.5rem; display:flex; flex-direction:column; gap:0.75rem; align-items:center;">' +
      '<a href="https://paypal.me/vesatotCal" target="_blank" class="btn btn-primary" style="padding:0.7rem 1.5rem; font-size:0.95rem; text-decoration:none;" id="donation-yes">' + I18n.t('donation_btn') + '</a>' +
      '<button class="btn btn-secondary" style="font-size:0.85rem;" id="donation-dismiss">' + I18n.t('donation_dismiss') + '</button>' +
      '</div></div>';

    document.body.appendChild(overlay);

    document.getElementById('donation-yes').addEventListener('click', function() {
      Api.post('/api/settings/donation-prompt', { action: 'donated' });
      document.body.removeChild(overlay);
    });

    document.getElementById('donation-dismiss').addEventListener('click', function() {
      Api.post('/api/settings/donation-prompt', { action: 'dismissed' });
      document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', function(e) {
      if (e.target === overlay) {
        Api.post('/api/settings/donation-prompt', { action: 'dismissed' });
        document.body.removeChild(overlay);
      }
    });
  }

  function route() {
    var hash = window.location.hash || '#login';

    // Hide all views
    Object.keys(views).forEach(function(key) {
      views[key].style.display = 'none';
    });

    // Update nav link active state
    var navLinks = document.querySelectorAll('.nav-link[data-view]');
    navLinks.forEach(function(link) {
      link.classList.remove('active');
    });

    if (!isAuthenticated) {
      nav.style.display = 'none';

      if (hash === '#privacy') {
        views.privacy.style.display = 'block';
        return;
      }

      if (hash === '#api-docs') {
        views['api-docs'].style.display = 'block';
        return;
      }

      views.auth.style.display = 'block';

      if (hash === '#register') {
        document.getElementById('auth-login').style.display = 'none';
        document.getElementById('auth-register').style.display = 'block';
      } else {
        document.getElementById('auth-login').style.display = 'block';
        document.getElementById('auth-register').style.display = 'none';
      }
      return;
    }

    nav.style.display = 'flex';

    switch (hash) {
      case '#calendar':
        views.calendar.style.display = 'block';
        setActiveNav('calendar');
        Calendar.render();
        break;
      case '#history':
        views.history.style.display = 'block';
        setActiveNav('history');
        History.render();
        break;
      case '#settings':
        views.settings.style.display = 'block';
        setActiveNav('settings');
        Settings.render();
        break;
      case '#privacy':
        views.privacy.style.display = 'block';
        break;
      case '#api-docs':
        views['api-docs'].style.display = 'block';
        break;
      case '#admin':
        if (isAdmin) {
          views.admin.style.display = 'block';
          setActiveNav('admin');
          renderAdmin();
        } else {
          window.location.hash = '#calendar';
          return;
        }
        break;
      default:
        window.location.hash = '#calendar';
        return;
    }
  }

  function setActiveNav(viewName) {
    var link = document.querySelector('.nav-link[data-view="' + viewName + '"]');
    if (link) link.classList.add('active');
  }

  function renderAdmin() {
    // Load stats
    Api.get('/api/admin/stats').then(function(data) {
      var el = document.getElementById('admin-stats');
      el.innerHTML =
        '<div style="text-align:center; padding:0.75rem; background:var(--color-bg-secondary, #f0f4f8); border-radius:8px;">' +
        '<div style="font-size:1.6rem; font-weight:700; color:var(--color-primary);">' + data.total_users + '</div><div style="font-size:0.8rem; color:var(--color-text-secondary);">' + I18n.t('admin_stat_users') + '</div></div>' +
        '<div style="text-align:center; padding:0.75rem; background:var(--color-bg-secondary, #f0f4f8); border-radius:8px;">' +
        '<div style="font-size:1.6rem; font-weight:700; color:var(--color-primary);">' + data.users_with_data + '</div><div style="font-size:0.8rem; color:var(--color-text-secondary);">' + I18n.t('admin_stat_with_data') + '</div></div>' +
        '<div style="text-align:center; padding:0.75rem; background:var(--color-bg-secondary, #f0f4f8); border-radius:8px;">' +
        '<div style="font-size:1.6rem; font-weight:700; color:var(--color-primary);">' + data.new_users_7d + '</div><div style="font-size:0.8rem; color:var(--color-text-secondary);">' + I18n.t('admin_stat_new_7d') + '</div></div>' +
        '<div style="text-align:center; padding:0.75rem; background:var(--color-bg-secondary, #f0f4f8); border-radius:8px;">' +
        '<div style="font-size:1.6rem; font-weight:700; color:var(--color-primary);">' + formatBytes(data.db_size_bytes) + '</div><div style="font-size:0.8rem; color:var(--color-text-secondary);">' + I18n.t('admin_stat_db_size') + '</div></div>';
    });

    // Load registration status
    Api.get('/api/admin/registration').then(function(data) {
      var cb = document.getElementById('admin-allow-registration');
      cb.checked = !!data.allow_registration;
      cb.onchange = function() {
        Api.put('/api/admin/registration', { allow: cb.checked });
      };
    });

    // Load donation toggle
    Api.get('/api/admin/donation-enabled').then(function(data) {
      var cb = document.getElementById('admin-donation-enabled');
      cb.checked = !!data.enabled;
      cb.onchange = function() {
        Api.put('/api/admin/donation-enabled', { enabled: cb.checked });
      };
    });

    // Load users
    Api.get('/api/admin/users').then(function(data) {
      var tbody = document.getElementById('admin-users-tbody');
      tbody.innerHTML = '';
      // Find the system owner (lowest ID)
      var ownerIdNum = null;
      (data.users || []).forEach(function(u) {
        if (ownerIdNum === null || u.id < ownerIdNum) ownerIdNum = u.id;
      });

      // Check if current user is the owner (only owner sees admin toggle buttons)
      var currentIsOwner = (ownerIdNum !== null && isAdmin);
      // We need to figure out current user ID — use a settings call or embed it
      // Simpler: check via API response. The owner buttons only show if current session user = owner
      Api.get('/api/settings').then(function(settings) {
        var currentUserId = null;
        // Get current user id from users list by matching email or just check
        // Actually, let's fetch it from a dedicated check
        (data.users || []).forEach(function(u) {
          // The owner is the one with lowest id
        });

        // Determine if I am the owner
        var iAmOwner = false;
        Api.get('/api/admin/users').then(function() {}); // already have data

        // Simple approach: try the admin toggle endpoint — if it returns 403, I'm not owner
        // Better: just pass it from backend. For now, show buttons only if ownerIdNum matches
        // We'll use a trick: try to see if my user id is the owner
        // Since we can't easily get current user id client-side, let's add it to stats response

        renderUsersTable(data.users || [], ownerIdNum, settings);
      });
    });
  }

  function renderUsersTable(users, ownerIdNum, settings) {
    var tbody = document.getElementById('admin-users-tbody');
    tbody.innerHTML = '';

    // Determine if current user is owner by checking if settings returns for the owner
    // We'll get current user email from the page or pass from backend
    // Simplest: compare — the /api/admin/users/:id/admin endpoint enforces owner-only server-side
    // So we show the buttons always for admins, but the server rejects if not owner
    // Better UX: only show if I am owner. Let's check via dedicated field.

    users.forEach(function(u) {
      var tr = document.createElement('tr');
      var dateStr = u.created_at ? new Date(u.created_at).toLocaleDateString('he-IL') : '—';
      var badge = '';
      if (u.id === ownerIdNum) {
        badge = ' <span style="background:#FFF3E0; color:#E65100; font-size:0.7rem; padding:0.1rem 0.3rem; border-radius:3px; white-space:nowrap;">owner</span>';
      } else if (u.is_admin) {
        badge = ' <span style="background:#E3F2FD; color:#1976D2; font-size:0.7rem; padding:0.1rem 0.3rem; border-radius:3px;">admin</span>';
      }
      tr.innerHTML =
        '<td>' + u.id + '</td>' +
        '<td style="direction:ltr; text-align:left;">' + u.email + badge + '</td>' +
        '<td>' + dateStr + '</td>' +
        '<td></td>';

      var actionsCell = tr.querySelector('td:last-child');

      // Only the owner sees admin toggle and delete buttons
      if (u.id !== ownerIdNum && settings.is_owner) {
        if (u.is_admin) {
          var revokeBtn = document.createElement('button');
          revokeBtn.className = 'btn';
          revokeBtn.style.cssText = 'font-size:0.7rem; padding:0.2rem 0.4rem; background:#FFF3E0; color:#E65100; margin-left:0.3rem;';
          revokeBtn.textContent = '- admin';
          revokeBtn.addEventListener('click', (function(uid, email) {
            return function() {
              if (confirm(I18n.t('confirm_revoke_admin', {email: email}))) {
                Api.put('/api/admin/users/' + uid + '/admin', { is_admin: false }).then(function() { renderAdmin(); });
              }
            };
          })(u.id, u.email));
          actionsCell.appendChild(revokeBtn);
        } else {
          var adminBtn = document.createElement('button');
          adminBtn.className = 'btn';
          adminBtn.style.cssText = 'font-size:0.7rem; padding:0.2rem 0.4rem; background:#E3F2FD; color:#1976D2; margin-left:0.3rem;';
          adminBtn.textContent = '+ admin';
          adminBtn.addEventListener('click', (function(uid, email) {
            return function() {
              if (confirm(I18n.t('confirm_grant_admin', {email: email}))) {
                Api.put('/api/admin/users/' + uid + '/admin', { is_admin: true }).then(function() { renderAdmin(); });
              }
            };
          })(u.id, u.email));
          actionsCell.appendChild(adminBtn);
        }

        if (!u.is_admin) {
          var delBtn = document.createElement('button');
          delBtn.className = 'btn btn-danger';
          delBtn.style.cssText = 'font-size:0.7rem; padding:0.2rem 0.4rem; margin-right:0.3rem;';
          delBtn.textContent = I18n.t('admin_delete');
          delBtn.addEventListener('click', (function(uid, email) {
            return function() {
              if (confirm(I18n.t('confirm_delete_user', {email: email}))) {
                Api.del('/api/admin/users/' + uid).then(function() { renderAdmin(); });
              }
            };
          })(u.id, u.email));
          actionsCell.appendChild(delBtn);
        }
      } else if (u.id !== ownerIdNum && !u.is_admin && !settings.is_owner) {
        // Non-owner admin can only delete non-admin users
        var delBtn2 = document.createElement('button');
        delBtn2.className = 'btn btn-danger';
        delBtn2.style.cssText = 'font-size:0.7rem; padding:0.2rem 0.4rem;';
        delBtn2.textContent = I18n.t('admin_delete');
        delBtn2.addEventListener('click', (function(uid, email) {
          return function() {
            if (confirm(I18n.t('confirm_delete_user', {email: email}))) {
              Api.del('/api/admin/users/' + uid).then(function() { renderAdmin(); });
            }
          };
        })(u.id, u.email));
        actionsCell.appendChild(delBtn2);
      }

      tbody.appendChild(tr);
    });
  }

  function formatBytes(bytes) {
    if (!bytes) return '0 B';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  // Public API
  return {
    init: init,
    checkAuth: checkAuth
  };
})();

// Start the app when DOM is ready
document.addEventListener('DOMContentLoaded', function() {
  App.init();
});
