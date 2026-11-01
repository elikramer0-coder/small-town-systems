// "Get a price" form: <form data-contact>. Two steps with JavaScript, one plain form without it.
// Step 1: what they need (any of four). Step 2: name, and an email or a phone. Posts to /api/contact.
(function () {
  var forms = document.querySelectorAll('form[data-contact]');
  if (!forms.length) return;

  var MESSAGES = {
    name: 'Add your name.',
    reach: 'Add an email or a phone number, so we can get back to you.',
    email: 'Check the email address. It needs an @ and a domain after it.',
    missing: 'Add your name, and an email or a phone number.',
    too_long: 'That is longer than the form takes. Shorten it a little and send again.',
    turnstile: 'The spam check did not finish. Send again.',
    not_configured: 'The form is not switched on yet. Try again later.',
    send_failed: 'It did not send. Wait a minute and send again.',
    network: 'It did not send. Check your connection and send again.'
  };
  var NEED_FROM_LINK = { website: 'website', fix: 'fix', google: 'google', notion: 'notion' };

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
    .catch(function () { /* the server answers not_configured if it really is off */ });

  var linked = new URLSearchParams(location.search).get('need');

  forms.forEach(function (form) {
    var status = form.querySelector('[data-status]');
    var send = form.querySelector('button[type="submit"]');
    var done = form.querySelector('[data-done]');
    var el = form.elements;

    form.classList.add('js-steps');
    if (linked && NEED_FROM_LINK[linked]) {
      var box = form.querySelector('[data-need="' + NEED_FROM_LINK[linked] + '"]');
      if (box) box.checked = true;
    }

    function say(kind, text) {
      status.className = 'form-status' + (kind ? ' is-' + kind : '');
      status.textContent = text;
    }
    function invalid(field, on) {
      if (on) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
    }

    form.querySelector('[data-next]').addEventListener('click', function () {
      form.classList.add('on-step-2');
      el.name.focus();
    });
    form.querySelector('[data-back]').addEventListener('click', function () {
      form.classList.remove('on-step-2');
      say('', '');
      form.querySelector('.chip input').focus();
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var name = el.name.value.trim();
      var email = el.email.value.trim();
      var phone = el.phone.value.trim();
      invalid(el.name, !name);
      invalid(el.email, false);
      invalid(el.phone, false);
      if (!name) { say('error', MESSAGES.name); el.name.focus(); return; }
      if (!email && !phone) { invalid(el.email, true); invalid(el.phone, true); say('error', MESSAGES.reach); el.email.focus(); return; }
      if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { invalid(el.email, true); say('error', MESSAGES.email); el.email.focus(); return; }

      send.disabled = true;
      say('', 'Sending…');
      fetch('/api/contact', { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            if (res.ok && data.ok) {
              form.classList.add('is-sent');
              say('', '');
              done.focus();
              return;
            }
            say('error', MESSAGES[data.error] || MESSAGES.send_failed);
          });
        })
        .catch(function () { say('error', MESSAGES.network); })
        .then(function () {
          send.disabled = false;
          if (window.turnstile) widgets.forEach(function (id) { window.turnstile.reset(id); });
        });
    });
  });
})();
