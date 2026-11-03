/* FAQ: single-open accordion with keyboard + screen-reader support */
(function () {
  var items = Array.prototype.slice.call(document.querySelectorAll('.faq-item'));
  items.forEach(function (item, idx) {
    var q = item.querySelector('.faq-item__q');
    var a = item.querySelector('.faq-item__a');
    a.id = 'faq-a-' + (idx + 1);
    q.setAttribute('role', 'button');
    q.setAttribute('tabindex', '0');
    q.setAttribute('aria-controls', a.id);
    q.setAttribute('aria-expanded', item.classList.contains('is-open') ? 'true' : 'false');

    function toggle() {
      var wasOpen = item.classList.contains('is-open');
      items.forEach(function (i) {
        i.classList.remove('is-open');
        i.querySelector('.faq-item__q').setAttribute('aria-expanded', 'false');
      });
      if (!wasOpen) {
        item.classList.add('is-open');
        q.setAttribute('aria-expanded', 'true');
      }
    }
    q.addEventListener('click', toggle);
    q.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
    });
  });
})();
