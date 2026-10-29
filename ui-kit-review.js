// UI kit review page: sample tabs and progress only. Reads and writes no storage.
(function () {
  var tabs = document.querySelectorAll('#kitTabs .lb-tab');
  var note = document.getElementById('kitTabNote');
  Array.prototype.forEach.call(tabs, function (tab) {
    tab.addEventListener('click', function () {
      Array.prototype.forEach.call(tabs, function (t) { t.setAttribute('aria-selected', String(t === tab)); });
      note.textContent = tab.textContent + ' tab selected.';
    });
  });

  var slider = document.getElementById('kitFill');
  var bars = document.querySelectorAll('[data-kit-bar]');
  function paint() {
    var value = Number(slider.value);
    Array.prototype.forEach.call(bars, function (bar) {
      bar.setAttribute('role', 'progressbar');
      bar.setAttribute('aria-valuemin', '0');
      bar.setAttribute('aria-valuemax', '100');
      bar.setAttribute('aria-valuenow', String(value));
      bar.querySelector('i').style.width = value + '%';
      bar.querySelector('.lb-progress__label').textContent = value + '%';
    });
  }
  slider.addEventListener('input', paint);
  paint();
})();
