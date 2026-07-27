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
    'api-docs': document.getElementById('view-api-docs')
  };

  var nav = document.getElementById('main-nav');
  var isAuthenticated = false;

  function init() {
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
      .then(function() {
        isAuthenticated = true;
        if (!window.location.hash || window.location.hash === '#login' || window.location.hash === '#register') {
          window.location.hash = '#calendar';
        }
        route();
      })
      .catch(function() {
        isAuthenticated = false;
        if (window.location.hash !== '#register' && window.location.hash !== '#privacy') {
          window.location.hash = '#login';
        }
        route();
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
      default:
        window.location.hash = '#calendar';
        return;
    }
  }

  function setActiveNav(viewName) {
    var link = document.querySelector('.nav-link[data-view="' + viewName + '"]');
    if (link) link.classList.add('active');
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
