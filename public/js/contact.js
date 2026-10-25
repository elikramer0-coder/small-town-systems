// Contact form: posts to /api/contact, shows a plain success or failure message.
// Without JavaScript the form still posts; the function then redirects to /contact#sent or /contact#error.
(function () {
  var form = document.getElementById('contact-form');
  if (!form) return;

  var status = document.getElementById('form-status');
  var button = document.getElementById('send');
  var EMAIL = 'eli@smalltownsystems.com';
  var siteKey = null;
  var widgetId = null;
  var turnstileLoaded = false;

  var MESSAGES = {
    missing: 'Please fill in your name, email, and what your business is.',
    email: 'That email address doesn\'t look right.',
    too_long: 'That\'s a bit long for the form. Email us instead: ' + EMAIL,
    turnstile: 'We couldn\'t confirm you\'re a person. Try once more.',
    not_configured: 'The form isn\'t connected yet. Email ' + EMAIL + ' instead.',
    send_failed: 'That didn\'t send. Email ' + EMAIL + ' instead.',
    network: 'That didn\'t send. Check your connection, or email ' + EMAIL + '.'
  };

  function say(kind, text) {
    status.className = 'form-status ' + kind;
    status.textContent = text;
  }

  function renderTurnstile() {
    if (!turnstileLoaded || !siteKey || widgetId !== null || !window.turnstile) return;
    widgetId = window.turnstile.render('#turnstile', { sitekey: siteKey, theme: 'light' });
  }

  // called by the Turnstile script once it has loaded (see ?onload= in contact.html)
  window.stsTurnstileReady = function () {
    turnstileLoaded = true;
    renderTurnstile();
  };

  fetch('/api/config', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (cfg) {
      siteKey = cfg && cfg.turnstileSiteKey ? cfg.turnstileSiteKey : null;
      if (!siteKey) {
        say('bad', MESSAGES.not_configured);
        button.disabled = true;
      }
      renderTurnstile();
    })
    .catch(function () {
      say('bad', MESSAGES.not_configured);
      button.disabled = true;
    });

  form.addEventListener('submit', function (event) {
    event.preventDefault();

    var required = ['name', 'email', 'business'];
    for (var i = 0; i < required.length; i++) {
      var field = form.elements[required[i]];
      if (!field.value.trim()) {
        say('bad', MESSAGES.missing);
        field.focus();
        return;
      }
    }

    button.disabled = true;
    say('', 'Sending…');

    fetch('/api/contact', {
      method: 'POST',
      body: new FormData(form),
      headers: { Accept: 'application/json' }
    })
      .then(function (res) {
        return res.json().catch(function () { return {}; }).then(function (data) {
          if (res.ok && data.ok) {
            form.reset();
            say('ok', 'Got it. We\'ll email you back.');
            if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
            button.disabled = false;
            return;
          }
          say('bad', MESSAGES[data.error] || MESSAGES.send_failed);
          button.disabled = false;
          if (window.turnstile && widgetId !== null) window.turnstile.reset(widgetId);
        });
      })
      .catch(function () {
        say('bad', MESSAGES.network);
        button.disabled = false;
      });
  });
})();
