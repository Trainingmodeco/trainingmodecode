/* Features: scroll-spy section strip + rank-avatar gender toggle.
   Every block is guarded — nothing here throws if a section or element is missing. */
(function () {

  /* ---------- scroll-spy: .tm-disc--sections tabs follow the section in view ---------- */
  var ids = ['fit', 'fight', 'arcade', 'camp', 'combat', 'progression'];
  var strip = document.getElementById('secStrip') || document.querySelector('.tm-disc--sections');
  var tabs = Array.prototype.slice.call(document.querySelectorAll('.tm-disc__tab[data-sec]'));
  var current = null;

  function centerTab(tab) {
    // phones: the strip scrolls sideways — keep the active tab in view (strip only, never the page)
    if (!strip || strip.scrollWidth <= strip.clientWidth) return;
    var left = tab.offsetLeft - (strip.clientWidth - tab.offsetWidth) / 2;
    try { strip.scrollTo({ left: left, behavior: 'smooth' }); } catch (err) { strip.scrollLeft = left; }
  }

  function setActive(id) {
    if (id === current) return;
    current = id;
    var active = null;
    tabs.forEach(function (t) {
      var on = t.dataset.sec === id;
      t.classList.toggle('is-on', on);
      if (on) { t.setAttribute('aria-current', 'true'); active = t; }
      else t.removeAttribute('aria-current');
    });
    if (strip && active) {
      strip.dataset.on = active.dataset.tone || id;   // :has() fallback for the strip hairline colour
      centerTab(active);
    }
  }

  if (tabs.length) {
    var onScroll = function () {
      var mid = window.innerHeight * 0.38;
      var cur = ids[0];
      ids.forEach(function (id) {
        var el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= mid) cur = id;
      });
      setActive(cur);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    onScroll();
  }

  /* ---------- gender toggle (#gtoggle → #tiers img / #secrets img via data-male / data-female) ---------- */
  var gtoggle = document.getElementById('gtoggle');
  if (gtoggle) {
    var opts = Array.prototype.slice.call(gtoggle.querySelectorAll('.gtoggle__opt'));
    var imgs = Array.prototype.slice.call(document.querySelectorAll('#tiers img, #secrets img'));
    opts.forEach(function (opt) {
      opt.addEventListener('click', function () {
        var g = opt.dataset.g;
        opts.forEach(function (o) { o.classList.toggle('is-on', o === opt); });
        imgs.forEach(function (img) { if (img.dataset[g]) img.src = img.dataset[g]; });
      });
    });
  }

})();
