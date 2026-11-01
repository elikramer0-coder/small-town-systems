// Contact form for every page: <form data-contact> posts to /api/contact and shows a plain result.
// Without JavaScript the form still posts; the function sends the visitor back to the page with #sent or #not-sent.
(function () {
  var forms = document.querySelectorAll('form[data-contact]');
  if (!forms.length) return;

  var MESSAGES = {
    missing: 'Fill in your name, your email and what you need.',
    email: 'Check the email address. It needs an @ and a domain.',
    too_long: 'That is longer than the form takes. Shorten it a little and send again.',
    turnstile: 'The spam check did not finish. Send again.',
    not_configured: 'The form is not switched on yet. Try again later.',
    send_failed: 'It did not send. Wait a minute and send again.',
    network: 'It did not send. Check your connection and send again.'
  };
  var SENT = 'Sent. We will get back to you.';

  var siteKey = null;
  var turnstileReady = false;
  var widgets = [];

  function renderWidgets() {
    if (!turnstileReady || !siteKey || !window.turnstile) return;
    forms.forEach(function (form) {
      var box = form.querySelector('[data-turnstile]');
      if (box && !box.hasAttribute('data-rendered')) {
        box.setAttribute('data-rendered', '');
        widgets.push(window.turnstile.render(box, { sitekey: siteKey, theme: 'light' }));
      }
    });
  }

  window.stsTurnstileReady = function () { turnstileReady = true; renderWidgets(); };

  fetch('/api/config', { headers: { Accept: 'application/json' } })
    .then(function (r) { return r.ok ? r.json() : {}; })
    .then(function (cfg) { siteKey = cfg && cfg.turnstileSiteKey; renderWidgets(); })
    .catch(function () { /* the form still posts; the server answers not_configured */ });

  forms.forEach(function (form) {
    var status = form.querySelector('[data-status]');
    var button = form.querySelector('button[type="submit"]');

    function say(kind, text) {
      status.className = 'form-status' + (kind ? ' is-' + kind : '');
      status.textContent = text;
    }

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var required = ['name', 'email', 'business'];
      for (var i = 0; i < required.length; i++) {
        var field = form.elements[required[i]];
        if (!field.value.trim()) { say('error', MESSAGES.missing); field.focus(); return; }
      }
      button.disabled = true;
      say('', 'Sending…');
      fetch('/api/contact', { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            if (res.ok && data.ok) { form.reset(); say('ok', SENT); }
            else say('error', MESSAGES[data.error] || MESSAGES.send_failed);
          });
        })
        .catch(function () { say('error', MESSAGES.network); })
        .then(function () {
          button.disabled = false;
          if (window.turnstile) widgets.forEach(function (id) { window.turnstile.reset(id); });
        });
    });
  });
})();
