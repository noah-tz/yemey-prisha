/**
 * Authentication module
 * Handles login and registration forms.
 */
var Auth = (function() {
  'use strict';

  function init() {
    var loginForm = document.getElementById('login-form');
    var registerForm = document.getElementById('register-form');
    var showRegister = document.getElementById('show-register');
    var showLogin = document.getElementById('show-login');

    showRegister.addEventListener('click', function(e) {
      e.preventDefault();
      document.getElementById('auth-login').style.display = 'none';
      document.getElementById('auth-register').style.display = 'block';
    });

    showLogin.addEventListener('click', function(e) {
      e.preventDefault();
      document.getElementById('auth-register').style.display = 'none';
      document.getElementById('auth-login').style.display = 'block';
    });

    loginForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var errorEl = document.getElementById('login-error');
      errorEl.textContent = '';

      var email = document.getElementById('login-email').value.trim();
      var password = document.getElementById('login-password').value;

      if (!email || !password) {
        errorEl.textContent = 'נא למלא את כל השדות';
        return;
      }

      Api.post('/api/auth/login', { email: email, password: password })
        .then(function() {
          window.location.hash = '#calendar';
          App.checkAuth();
        })
        .catch(function(err) {
          errorEl.textContent = err.message || 'שגיאה בכניסה';
        });
    });

    document.getElementById('forgot-password-link').addEventListener('click', function(e) {
      e.preventDefault();
      var email = document.getElementById('login-email').value.trim();
      if (!email) { document.getElementById('login-error').textContent = 'נא להזין כתובת מייל'; return; }
      fetch('/api/auth/forgot-password', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({email:email}) })
        .then(function(r) { return r.json(); })
        .then(function(d) { document.getElementById('login-error').textContent = ''; document.getElementById('login-error').style.color='#388E3C'; document.getElementById('login-error').textContent = d.message || 'נשלח קישור לאיפוס'; });
    });

    registerForm.addEventListener('submit', function(e) {
      e.preventDefault();
      var errorEl = document.getElementById('register-error');
      errorEl.textContent = '';

      var email = document.getElementById('register-email').value.trim();
      var password = document.getElementById('register-password').value;
      var confirm = document.getElementById('register-confirm').value;

      if (!email || !password || !confirm) {
        errorEl.textContent = 'נא למלא את כל השדות';
        return;
      }

      if (password !== confirm) {
        errorEl.textContent = 'הסיסמאות אינן תואמות';
        return;
      }

      if (password.length < 6) {
        errorEl.textContent = 'הסיסמה חייבת להכיל לפחות 6 תווים';
        return;
      }

      var termsChecked = document.getElementById('register-terms').checked;
      if (!termsChecked) {
        errorEl.textContent = 'יש לאשר את תנאי השימוש';
        return;
      }

      Api.post('/api/auth/register', { email: email, password: password, termsAccepted: true })
        .then(function() {
          window.location.hash = '#calendar';
          App.checkAuth();
        })
        .catch(function(err) {
          errorEl.textContent = err.message || 'שגיאה בהרשמה';
        });
    });
  }

  function reset() {
    document.getElementById('login-form').reset();
    document.getElementById('register-form').reset();
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
    document.getElementById('auth-login').style.display = 'block';
    document.getElementById('auth-register').style.display = 'none';
  }

  return {
    init: init,
    reset: reset
  };
})();
