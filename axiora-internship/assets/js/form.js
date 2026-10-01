/* Axiora Labs — GenAI internship application form.
   Vanilla JS to match the rest of the theme (no libraries). */
(function () {
  'use strict';

  var CFG = window.AXI_INT || {};

  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  function fieldOf(input) {
    return input ? input.closest('.axi-field') : null;
  }

  function showError(form, name, message) {
    var slot = form.querySelector('[data-err="' + name + '"]');
    if (slot) {
      slot.textContent = message;
      slot.classList.add('is-shown');
    }
    var input = form.querySelector('[name="' + name + '"]');
    var field = fieldOf(input);
    if (field) field.classList.add('is-invalid');
  }

  function clearErrors(form) {
    each(form.querySelectorAll('.axi-err'), function (el) {
      el.textContent = '';
      el.classList.remove('is-shown');
    });
    each(form.querySelectorAll('.axi-field.is-invalid'), function (el) {
      el.classList.remove('is-invalid');
    });
    var box = form.querySelector('.axi-form-error');
    if (box) { box.hidden = true; box.textContent = ''; }
  }

  /* Same rules the server enforces — this only saves the user a round trip. */
  function validate(form) {
    var errors = {};
    var val = function (n) {
      var el = form.querySelector('[name="' + n + '"]');
      return el ? String(el.value || '').trim() : '';
    };

    if (val('full_name').length < 2) errors.full_name = 'Please enter your full name.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val('email'))) errors.email = 'Please enter a valid email address.';

    var digits = val('phone').replace(/\D+/g, '');
    if (digits.length < 7 || digits.length > 15) errors.phone = 'Please enter a valid phone number.';

    if (val('college').length < 2) errors.college = 'Please enter your college or university.';
    if (!val('course')) errors.course = 'Please select your course.';

    var file = form.querySelector('[name="resume"]');
    if (!file || !file.files || !file.files.length) {
      errors.resume = 'Please attach your resume (PDF or Word, up to 5 MB).';
    } else {
      var f = file.files[0];
      var max = CFG.maxSize || 5242880;
      if (f.size > max) {
        errors.resume = 'That file is larger than ' + (CFG.maxSizeMB || 5) + ' MB. Please upload a smaller one.';
      } else if (!/\.(pdf|doc|docx)$/i.test(f.name)) {
        errors.resume = 'Only PDF, DOC and DOCX files are accepted.';
      }
    }

    var consent = form.querySelector('[name="consent"]');
    if (consent && !consent.checked) errors.consent = 'Please accept the privacy terms to continue.';

    return errors;
  }

  function initFileField(form) {
    var input = form.querySelector('input[type="file"][name="resume"]');
    if (!input) return;

    var wrap = input.closest('.axi-file');
    var name = wrap ? wrap.querySelector('.axi-file-name') : null;
    var hint = wrap ? wrap.querySelector('.axi-file-hint') : null;
    var defaultName = name ? name.textContent : '';
    var defaultHint = hint ? hint.textContent : '';

    input.addEventListener('change', function () {
      var f = input.files && input.files[0];
      if (!f) {
        if (name) name.textContent = defaultName;
        if (hint) hint.textContent = defaultHint;
        if (wrap) wrap.classList.remove('is-set');
        return;
      }
      if (name) name.textContent = f.name;
      if (hint) hint.textContent = (f.size / 1048576).toFixed(2) + ' MB — click to replace';
      if (wrap) wrap.classList.add('is-set');

      var field = fieldOf(input);
      if (field) field.classList.remove('is-invalid');
      var slot = form.querySelector('[data-err="resume"]');
      if (slot) { slot.textContent = ''; slot.classList.remove('is-shown'); }
    });
  }

  function initForm(form) {
    initFileField(form);

    // Clear a field's error as soon as the user starts fixing it.
    each(form.querySelectorAll('input, select, textarea'), function (el) {
      el.addEventListener('input', function () {
        var field = fieldOf(el);
        if (field) field.classList.remove('is-invalid');
        var slot = form.querySelector('[data-err="' + el.name + '"]');
        if (slot) { slot.textContent = ''; slot.classList.remove('is-shown'); }
      });
    });

    form.addEventListener('submit', function (e) {
      e.preventDefault();
      clearErrors(form);

      var errors = validate(form);
      var keys = Object.keys(errors);
      if (keys.length) {
        keys.forEach(function (k) { showError(form, k, errors[k]); });
        var first = form.querySelector('.axi-field.is-invalid, [data-err].is-shown');
        if (first && first.scrollIntoView) first.scrollIntoView({ behavior: 'smooth', block: 'center' });
        return;
      }

      var button = form.querySelector('.axi-submit');
      var label = form.querySelector('.axi-submit-label');
      var originalLabel = label ? label.textContent : '';

      if (button) { button.disabled = true; button.classList.add('is-busy'); }
      if (label) label.textContent = 'Saving';

      var data = new FormData(form);
      data.append('action', 'axi_int_submit');
      data.append('nonce', CFG.nonce || '');

      fetch(CFG.ajax, { method: 'POST', body: data, credentials: 'same-origin' })
        .then(function (res) { return res.json().catch(function () { return null; }); })
        .then(function (json) {
          if (json && json.success) {
            showSuccess(form, json.data || {});
            return;
          }

          var payload = (json && json.data) || {};
          if (payload.errors) {
            Object.keys(payload.errors).forEach(function (k) { showError(form, k, payload.errors[k]); });
          }

          var box = form.querySelector('.axi-form-error');
          if (box) {
            box.textContent = payload.message || 'Something went wrong. Please try again, or email sales@axioralabs.ai.';
            box.hidden = false;
            if (box.scrollIntoView) box.scrollIntoView({ behavior: 'smooth', block: 'center' });
          }
        })
        .catch(function () {
          var box = form.querySelector('.axi-form-error');
          if (box) {
            box.textContent = 'We could not reach the server. Please check your connection and try again.';
            box.hidden = false;
          }
        })
        .then(function () {
          if (button) { button.disabled = false; button.classList.remove('is-busy'); }
          if (label) label.textContent = originalLabel;
        });
    });
  }

  function showSuccess(form, data) {
    var card = form.closest('.axi-form-card');
    if (!card) return;

    var success = card.querySelector('.axi-success');
    var head = card.querySelector('.axi-form-head');

    if (data.ref) {
      var code = card.querySelector('.axi-ref-code');
      if (code) code.textContent = data.ref;
    } else {
      var box = card.querySelector('.axi-ref-box');
      if (box) box.hidden = true;
    }

    if (data.name) {
      var msg = card.querySelector('.axi-success-msg');
      if (msg) {
        msg.textContent = 'Thanks, ' + String(data.name).split(' ')[0] +
          ' — we have received your application and emailed you a confirmation.';
      }
    }

    form.hidden = true;
    if (head) head.hidden = true;
    if (success) success.hidden = false;
    if (card.scrollIntoView) card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  document.addEventListener('DOMContentLoaded', function () {
    each(document.querySelectorAll('.axi-form'), initForm);
  });
})();
