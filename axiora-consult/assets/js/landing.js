/* Axiora Labs — AI Consultation landing form.
   Validates in the browser, submits with fetch() so the page never reloads,
   and falls back to a normal POST (server redirects back) without JS. */
(function () {
  'use strict';

  var form = document.querySelector('[data-axc-form]');
  if (!form) return;

  var done   = document.querySelector('[data-axc-done]');
  var head   = document.querySelector('[data-axc-heading]');
  var alertB = form.querySelector('[data-axc-alert]');
  var submit = form.querySelector('[data-axc-submit]');

  var rules = {
    name:        function (v) { return v ? '' : 'Please enter your name.'; },
    email:       function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v) ? '' : 'Please enter a valid work email.'; },
    phone:       function (v) { var d = v.replace(/\D/g, ''); return (d.length >= 7 && d.length <= 15) ? '' : 'Please enter a valid phone or WhatsApp number.'; },
    company:     function (v) { return v ? '' : 'Please enter your company name.'; },
    city:        function (v) { return v ? '' : 'Please enter your city.'; },
    requirement: function (v) { return v ? '' : 'Please tell us briefly what you want to automate.'; }
  };

  function setError(name, msg) {
    var input = form.elements[name];
    var slot  = form.querySelector('.axc-err[data-for="' + name + '"]');
    if (!input || !slot) return;
    input.closest('.axc-field').classList.toggle('is-bad', !!msg);
    input.setAttribute('aria-invalid', msg ? 'true' : 'false');
    slot.textContent = msg || '';
  }

  function showAlert(msg) {
    alertB.textContent = msg || '';
    alertB.hidden = !msg;
  }

  function validate() {
    var first = null;
    Object.keys(rules).forEach(function (name) {
      var input = form.elements[name];
      var msg = rules[name](input.value.trim());
      setError(name, msg);
      if (msg && !first) first = input;
    });
    return first;
  }

  // Clear a field's error as soon as it becomes valid.
  Object.keys(rules).forEach(function (name) {
    form.elements[name].addEventListener('input', function () {
      if (this.closest('.axc-field').classList.contains('is-bad') && !rules[name](this.value.trim())) {
        setError(name, '');
      }
    });
  });

  function busy(on) {
    submit.disabled = on;
    submit.classList.toggle('is-busy', on);
  }

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    showAlert('');

    var bad = validate();
    if (bad) { bad.focus(); return; }

    var data = new FormData(form);
    data.append('axc_ajax', '1');
    busy(true);

    fetch(form.action, { method: 'POST', body: data, credentials: 'same-origin' })
      .then(function (r) {
        return r.json().catch(function () { throw new Error('bad-response'); });
      })
      .then(function (res) {
        busy(false);
        if (res && res.ok) {
          form.reset();
          form.hidden = true;
          if (head) head.hidden = true;
          done.hidden = false;
          done.focus();
          if (window.dataLayer) window.dataLayer.push({ event: 'axc_consultation_submitted' });
          return;
        }
        var errs = (res && res.errors) || {};
        Object.keys(errs).forEach(function (k) { setError(k, errs[k]); });
        showAlert((res && res.message) || 'Something went wrong. Please try again.');
      })
      .catch(function (err) {
        busy(false);
        showAlert(err && err.message === 'bad-response'
          ? 'Something went wrong on our side. Please try again, or email sales@axioralabs.ai.'
          : 'We could not reach the server. Please check your connection and try again.');
      });
  });
})();
