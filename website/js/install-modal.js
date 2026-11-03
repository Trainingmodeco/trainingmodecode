/* Install modal — "INSTALL IN ONE TAP".
   Any <a data-install> opens it instead of navigating; with JS off the link
   still goes straight to the app, so nothing is lost. Markup is injected here
   so no page has to carry a copy of it. */
(function () {
  var APP = 'https://apptrainingmode.com/';

  var ua = navigator.userAgent || '';
  var isIOS = /iPad|iPhone|iPod/.test(ua) ||
              (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
  var isAndroid = /Android/.test(ua);
  var os = isIOS ? 'ios' : (isAndroid ? 'android' : 'desktop');

  var HINT = {
    ios: 'Safari → Share → Add to Home Screen. Free to start — no card.',
    android: 'Chrome → three-dot menu → Install app. Free to start — no card.',
    desktop: 'Works on any phone, tablet or computer. Free to start — no card.'
  };

  var ICON = {
    ios: '<svg width="20" height="20" viewBox="0 0 384 512" fill="currentColor" aria-hidden="true"><path d="M318.7 268.7c-.2-36.7 16.4-64.4 50-84.8-18.8-26.9-47.2-41.7-84.7-44.6-35.5-2.8-74.3 20.7-88.5 20.7-15 0-49.4-19.7-76.4-19.7C63.3 141.2 4 184.8 4 273.5q0 39.3 14.4 81.2c12.8 36.7 59 126.7 107.2 125.2 25.2-.6 43-17.9 75.8-17.9 31.8 0 48.3 17.9 76.4 17.9 48.6-.7 90.4-82.5 102.6-119.3-65.2-30.7-61.7-90-61.7-91.9zm-56.6-164.2c27.3-32.4 24.8-61.9 24-72.5-24.1 1.4-52 16.4-67.9 34.9-17.5 19.8-27.8 44.3-25.6 71.9 26.1 2 49.9-11.4 69.5-34.3z"/></svg>',
    android: '<svg width="20" height="20" viewBox="0 0 500 512" aria-hidden="true"><polygon fill="#00E676" points="30,20 266,256 30,256"></polygon><polygon fill="#00C8FF" points="30,256 266,256 30,492"></polygon><polygon fill="#FF3B30" points="266,256 470,256 340,180"></polygon><polygon fill="#FFCE1A" points="266,256 470,256 340,332"></polygon></svg>',
    desktop: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/></svg>'
  };

  var CARDS = [
    { os: 'ios', tone: '157,92,255', accent: '#cdb8ff', title: 'IPHONE &amp; IPAD', steps: [
      'Open <b>apptrainingmode.com</b> in Safari.',
      'Tap the <b>Share</b> button (the square with the arrow).',
      'Choose <b>Add to Home Screen</b>.' ] },
    { os: 'android', tone: '94,234,212', accent: '#5eead4', title: 'ANDROID', steps: [
      'Open <b>apptrainingmode.com</b> in Chrome.',
      'Tap the <b>three-dot menu</b>, top right.',
      'Choose <b>Install app</b>.' ] },
    { os: 'desktop', tone: '244,184,41', accent: '#F4B829', title: 'DESKTOP', steps: [
      'Open <b>apptrainingmode.com</b> in Chrome or Edge.',
      'Click the <b>install icon</b> in the address bar.',
      'Or just train in the browser tab — it all works.' ] }
  ];

  function cardHTML(c) {
    var steps = c.steps.map(function (s, i) {
      return '<li><b>0' + (i + 1) + '</b><span>' + s + '</span></li>';
    }).join('');
    return '<div class="persona' + (c.os === os ? ' is-detected' : '') + '" data-os="' + c.os +
           '" style="--tone:' + c.tone + ';--tone-accent:' + c.accent + '">' +
           '<div class="persona__icon">' + ICON[c.os] + '</div>' +
           '<div class="persona__title">' + c.title + '<span class="tmi__badge">YOUR DEVICE</span></div>' +
           '<ul class="tmi__steps">' + steps + '</ul></div>';
  }

  var modal, card, closeBtn, lastFocus;

  function build() {
    modal = document.createElement('div');
    modal.className = 'tmi';
    modal.id = 'tmInstall';
    modal.hidden = true;
    modal.innerHTML =
      '<div class="tmi__scrim" data-tmi-close></div>' +
      '<div class="tmi__card" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="tmiTitle">' +
        '<button class="tmi__x" type="button" aria-label="Close" data-tmi-close>✕</button>' +
        '<div class="tmi__eyebrow">▚ GET THE APP</div>' +
        '<h2 class="tmi__h2" id="tmiTitle">INSTALL IN ONE TAP.</h2>' +
        '<p class="tmi__sub">No App Store, no download, no waiting. Training Mode runs in your browser and installs to your home screen like a normal app — and it is free to start.</p>' +
        '<div class="tmi__grid">' + CARDS.map(cardHTML).join('') +
          '<div class="tmi__foot">' +
            '<a class="btn-cta-lg" href="' + APP + '"' + (os === 'desktop' ? ' target="_blank" rel="noopener"' : '') + '>OPEN THE APP ›</a>' +
            '<p class="tmi__hint">' + HINT[os] + '</p>' +
          '</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(modal);
    card = modal.querySelector('.tmi__card');
    closeBtn = modal.querySelector('.tmi__x');

    modal.addEventListener('click', function (e) {
      if (e.target.closest('[data-tmi-close]')) close();
    });
  }

  function focusables() {
    return Array.prototype.filter.call(
      card.querySelectorAll('a[href],button:not([disabled])'),
      function (el) { return el.offsetParent !== null; }
    );
  }

  function onKey(e) {
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    var f = focusables();
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function open() {
    if (!modal) build();
    lastFocus = document.activeElement;
    modal.hidden = false;
    // hiding the page scrollbar widens the viewport — pad it back so nothing shifts
    var gutter = window.innerWidth - document.documentElement.clientWidth;
    if (gutter > 0) document.body.style.paddingRight = gutter + 'px';
    document.documentElement.classList.add('tmi-lock');
    document.body.classList.add('tmi-lock');
    // let the browser paint the hidden state once so the transition runs
    requestAnimationFrame(function () {
      requestAnimationFrame(function () { modal.classList.add('is-open'); });
    });
    card.scrollTop = 0;
    card.focus();
    document.addEventListener('keydown', onKey);
  }

  function close() {
    if (!modal || modal.hidden) return;
    modal.classList.remove('is-open');
    document.removeEventListener('keydown', onKey);
    document.documentElement.classList.remove('tmi-lock');
    document.body.classList.remove('tmi-lock');
    document.body.style.paddingRight = '';
    setTimeout(function () { modal.hidden = true; }, 200);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  document.addEventListener('click', function (e) {
    var t = e.target.closest('[data-install]');
    if (!t) return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.button === 1) return; // let "open in new tab" work
    e.preventDefault();
    open();
  });

  window.tmInstallModal = { open: open, close: close };
})();
