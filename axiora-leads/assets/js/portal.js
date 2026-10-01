/* Axiora Labs — client dashboard portal.
   Vanilla JS, no dependencies. */
(function () {
  'use strict';

  function each(list, fn) { Array.prototype.forEach.call(list, fn); }

  /* ---------------------------------------------------------------- nav */
  function initNav() {
    each(document.querySelectorAll('[data-axi-toggle-nav]'), function (el) {
      el.addEventListener('click', function () {
        document.body.classList.toggle('axi-nav-open');
      });
    });

    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') document.body.classList.remove('axi-nav-open');
    });
  }

  /* ----------------------------------------------------- password toggle */
  function initPasswordToggle() {
    each(document.querySelectorAll('[data-axi-pwd]'), function (btn) {
      btn.addEventListener('click', function () {
        var input = btn.parentNode.querySelector('input');
        if (!input) return;
        var hidden = input.type === 'password';
        input.type = hidden ? 'text' : 'password';
        btn.textContent = hidden ? 'Hide' : 'Show';
        btn.setAttribute('aria-label', hidden ? 'Hide password' : 'Show password');
      });
    });
  }

  /* ------------------------------------------------------- bulk selection */
  function initBulk() {
    var bar = document.querySelector('[data-axi-bulk]');
    var boxes = document.querySelectorAll('[data-axi-check]');
    if (!bar || !boxes.length) return;

    var all = document.querySelector('[data-axi-check-all]');
    var counter = bar.querySelector('.axi-bulk-count strong');
    var clear = bar.querySelector('[data-axi-bulk-clear]');

    function sync() {
      var n = 0;
      each(boxes, function (b) { if (b.checked) n++; });
      if (counter) counter.textContent = String(n);
      bar.hidden = n === 0;
      if (all) all.indeterminate = n > 0 && n < boxes.length;
    }

    each(boxes, function (b) { b.addEventListener('change', sync); });

    if (all) {
      all.addEventListener('change', function () {
        each(boxes, function (b) { b.checked = all.checked; });
        sync();
      });
    }

    if (clear) {
      clear.addEventListener('click', function () {
        each(boxes, function (b) { b.checked = false; });
        if (all) all.checked = false;
        sync();
      });
    }

    // Don't let the bulk form submit with no status chosen.
    var form = bar.closest('form');
    if (form) {
      form.addEventListener('submit', function (e) {
        var select = bar.querySelector('select[name="status"]');
        if (select && !select.value) {
          e.preventDefault();
          select.focus();
        }
      });
    }

    sync();
  }

  /* --------------------------------------------------- destructive confirm */
  function initConfirms() {
    each(document.querySelectorAll('[data-axi-confirm]'), function (form) {
      form.addEventListener('submit', function (e) {
        if (!window.confirm(form.getAttribute('data-axi-confirm'))) e.preventDefault();
      });
    });
  }

  /* ------------------------------------------------- trend chart hover layer */
  function initChart(chart) {
    var svg = chart.querySelector('svg');
    var tip = chart.querySelector('.axi-tip');
    var cross = chart.querySelector('.axi-crosshair');
    var hits = chart.querySelectorAll('.axi-hit');
    if (!svg || !tip || !hits.length) return;

    var vbHeight = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal.height : 240;

    function show(hit) {
      var label = hit.getAttribute('data-label');
      var value = hit.getAttribute('data-value');
      var y = parseFloat(hit.getAttribute('data-y'));
      var x = hit.getAttribute('data-x');

      tip.querySelector('strong').textContent = label;
      tip.querySelector('span').textContent = value;
      tip.hidden = false;

      var chartRect = chart.getBoundingClientRect();
      var svgRect = svg.getBoundingClientRect();
      var hitRect = hit.getBoundingClientRect();

      tip.style.left = (hitRect.left - chartRect.left + hitRect.width / 2) + 'px';
      tip.style.top = (svgRect.top - chartRect.top + (y / vbHeight) * svgRect.height) + 'px';

      if (cross) {
        cross.setAttribute('x1', x);
        cross.setAttribute('x2', x);
        cross.setAttribute('opacity', '1');
      }
    }

    function hide() {
      tip.hidden = true;
      if (cross) cross.setAttribute('opacity', '0');
    }

    each(hits, function (hit) {
      hit.addEventListener('mouseenter', function () { show(hit); });
      hit.addEventListener('focus', function () { show(hit); });
      hit.setAttribute('tabindex', '0');
    });

    svg.addEventListener('mouseleave', hide);
    svg.addEventListener('blur', hide, true);
  }

  function initCharts() {
    each(document.querySelectorAll('[data-axi-chart]'), initChart);
  }

  document.addEventListener('DOMContentLoaded', function () {
    initNav();
    initPasswordToggle();
    initBulk();
    initConfirms();
    initCharts();
  });
})();
