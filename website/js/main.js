/* Shared: page-transition fade + mobile nav */
(function () {
  // page transition overlay (fade out .16s -> navigate -> fade in .22s)
  var px = document.createElement('div');
  px.className = 'px-overlay';
  document.body.appendChild(px);

  function fadeInIfFlagged() {
    try {
      if (sessionStorage.getItem('tm-px')) {
        sessionStorage.removeItem('tm-px');
        px.classList.add('px-in');
        requestAnimationFrame(function () {
          requestAnimationFrame(function () {
            px.classList.remove('px-in'); // transitions back to opacity 0 over .22s
          });
        });
      }
    } catch (err) {}
  }
  // prerendered pages (Speculation Rules) run this script before the user clicks —
  // wait for activation so the fade-in flag set at click time is visible
  if (document.prerendering) {
    document.addEventListener('prerenderingchange', fadeInIfFlagged, { once: true });
  } else {
    fadeInIfFlagged();
  }

  // fade out then navigate — shared by data-px links and JS-driven navigation
  window.tmNav = function (href) {
    try { sessionStorage.setItem('tm-px', '1'); } catch (err) {}
    px.classList.add('px-out');
    setTimeout(function () { window.location.href = href; }, 160);
  };

  document.addEventListener('click', function (e) {
    var a = e.target.closest('a[data-px]');
    if (!a) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || a.target === '_blank') return;
    e.preventDefault();
    window.tmNav(a.getAttribute('href'));
  });

  // mobile nav
  var nav = document.getElementById('nav');
  var burger = nav && nav.querySelector('.nav__burger');
  if (burger) {
    burger.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', open ? 'true' : 'false');
      burger.textContent = open ? '✕' : '☰';
    });
    nav.querySelectorAll('.nav__drawer a').forEach(function (a) {
      a.addEventListener('click', function () {
        nav.classList.remove('is-open');
        burger.setAttribute('aria-expanded', 'false');
        burger.textContent = '☰';
      });
    });
  }
})();
