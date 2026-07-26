/**
 * API client wrapper
 * Handles fetch calls, JSON parsing, and 401 redirects.
 */
var Api = (function() {
  'use strict';

  function handleResponse(res) {
    if (res.status === 401) {
      window.location.hash = '#login';
      return Promise.reject(new Error('אין הרשאה'));
    }
    if (res.status === 204) {
      return null;
    }
    return res.json().then(function(data) {
      if (!res.ok) {
        var msg = data.error || data.message || 'שגיאה לא ידועה';
        return Promise.reject(new Error(msg));
      }
      return data;
    });
  }

  function get(url) {
    return fetch(url, {
      method: 'GET',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    }).then(handleResponse);
  }

  function post(url, data) {
    return fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data)
    }).then(handleResponse);
  }

  function put(url, data) {
    return fetch(url, {
      method: 'PUT',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(data)
    }).then(handleResponse);
  }

  function del(url) {
    return fetch(url, {
      method: 'DELETE',
      credentials: 'same-origin',
      headers: { 'Accept': 'application/json' }
    }).then(handleResponse);
  }

  return {
    get: get,
    post: post,
    put: put,
    del: del
  };
})();
