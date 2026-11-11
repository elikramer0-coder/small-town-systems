// "Get a price" form: <form data-contact>. Two steps with JavaScript, one plain form without it.
// Step 1: what they need (and a write-in for "Something else"), business name and town, website now, plan.
// Step 2: name, phone or email, best way to reach them, anything else. Posts to /api/contact.
(function () {
  var forms = document.querySelectorAll('form[data-contact]');
  if (!forms.length) return;

  var MESSAGES = {
    business: 'Add your business name and town. Area or state is fine.',
    name: 'Add your name.',
    contact: 'Add a phone number or an email, so we can get back to you.',
    contact_bad: 'Check the phone or email. A phone needs at least 7 digits; an email needs an @ and a domain.',
    missing: 'Fill in your business and town, your name, and a phone or email.',
    too_long: 'That is longer than the form takes. Shorten it a little and send again.',
    turnstile: 'The spam check did not finish. Send again.',
    not_configured: 'The form is not switched on yet. Try again later.',
    send_failed: 'It did not send. Wait a minute and send again.',
    network: 'It did not send. Check your connection and send again.'
  };
  var NEED_FROM_LINK = { website: 'website', fix: 'fix', google: 'google', notion: 'notion', other: 'other' };

  function looksLikeContact(v) {
    if (v.indexOf('@') !== -1) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
    return (v.match(/\d/g) || []).length >= 7;
  }

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
    var el = form.elements;
    var status1 = form.querySelector('[data-status-1]');
    var status = form.querySelector('[data-status]');
    var send = form.querySelector('button[type="submit"]');
    var done = form.querySelector('[data-done]');
    var other = form.querySelector('[data-need="other"]');
    var otherBox = form.querySelector('[data-other]');

    form.classList.add('js-steps');

    function syncOther() { otherBox.hidden = !other.checked; }
    other.addEventListener('change', syncOther);

    if (linked && NEED_FROM_LINK[linked]) {
      var box = form.querySelector('[data-need="' + NEED_FROM_LINK[linked] + '"]');
      if (box) box.checked = true;
    }
    syncOther();

    function say(target, kind, text) {
      target.className = 'form-status' + (kind ? ' is-' + kind : '');
      target.textContent = text;
    }
    function flag(field, bad) {
      if (bad) field.setAttribute('aria-invalid', 'true'); else field.removeAttribute('aria-invalid');
    }

    // Clear an error as soon as the visitor fixes that field.
    [['business', status1], ['name', status], ['contact', status]].forEach(function (pair) {
      el[pair[0]].addEventListener('input', function () {
        if (el[pair[0]].getAttribute('aria-invalid') === 'true') { flag(el[pair[0]], false); say(pair[1], '', ''); }
      });
    });

    form.querySelector('[data-next]').addEventListener('click', function () {
      var business = el.business.value.trim();
      flag(el.business, !business);
      if (!business) { say(status1, 'error', MESSAGES.business); el.business.focus(); return; }
      say(status1, '', '');
      form.classList.add('on-step-2');
      el.name.focus();
    });
    form.querySelector('[data-back]').addEventListener('click', function () {
      form.classList.remove('on-step-2');
      say(status, '', '');
      form.querySelector('.chip input').focus();
    });

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      var name = el.name.value.trim();
      var contact = el.contact.value.trim();
      flag(el.name, !name);
      flag(el.contact, !contact || !looksLikeContact(contact));
      if (!el.business.value.trim()) { form.classList.remove('on-step-2'); flag(el.business, true); say(status1, 'error', MESSAGES.business); el.business.focus(); return; }
      if (!name) { say(status, 'error', MESSAGES.name); el.name.focus(); return; }
      if (!contact) { say(status, 'error', MESSAGES.contact); el.contact.focus(); return; }
      if (!looksLikeContact(contact)) { say(status, 'error', MESSAGES.contact_bad); el.contact.focus(); return; }

      send.disabled = true;
      say(status, '', 'Sending…');
      fetch('/api/contact', { method: 'POST', body: new FormData(form), headers: { Accept: 'application/json' } })
        .then(function (res) {
          return res.json().catch(function () { return {}; }).then(function (data) {
            if (res.ok && data.ok) {
              form.classList.add('is-sent');
              say(status, '', '');
              done.focus();
              return;
            }
            var msg = MESSAGES[data.error === 'contact' ? 'contact_bad' : data.error] || MESSAGES.send_failed;
            if (data.error === 'missing' && data.fields && data.fields.indexOf('business') !== -1) {
              form.classList.remove('on-step-2'); say(status1, 'error', MESSAGES.business); el.business.focus(); return;
            }
            say(status, 'error', msg);
          });
        })
        .catch(function () { say(status, 'error', MESSAGES.network); })
        .then(function () {
          send.disabled = false;
          if (window.turnstile) widgets.forEach(function (id) { window.turnstile.reset(id); });
        });
    });
  });
})();
